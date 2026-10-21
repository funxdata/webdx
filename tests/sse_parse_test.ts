import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type EventSourceMessage,
  formatMessage,
  getBytes,
  getLines,
  getMessages,
} from "../client/dxsse.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function collectMessages(text: string, chunks: string[] = [text]) {
  const messages: EventSourceMessage[] = [];
  const ids: string[] = [];
  const retries: number[] = [];
  const onLine = getMessages(
    (id) => ids.push(id),
    (retry) => retries.push(retry),
    (message) => messages.push(message),
  );
  const onChunk = getLines(onLine);
  for (const chunk of chunks) onChunk(encoder.encode(chunk));
  return { messages, ids, retries };
}

/* =========================
   getLines
========================= */

Deno.test("getLines: 单行", () => {
  const lines: Array<{ text: string; fieldLength: number }> = [];
  const next = getLines((line, fieldLength) => {
    lines.push({ text: decoder.decode(line), fieldLength });
  });

  next(encoder.encode("id: abc\n"));

  assertEquals(lines, [{ text: "id: abc", fieldLength: 2 }]);
});

Deno.test("getLines: 多行", () => {
  const lines: string[] = [];
  const next = getLines((line) => lines.push(decoder.decode(line)));

  next(encoder.encode("id: abc\ndata: def\n"));

  assertEquals(lines, ["id: abc", "data: def"]);
});

Deno.test("getLines: 一行被拆分到多个 chunk", () => {
  const lines: string[] = [];
  const next = getLines((line) => lines.push(decoder.decode(line)));

  next(encoder.encode("id: a"));
  next(encoder.encode("bc\n"));

  assertEquals(lines, ["id: abc"]);
});

Deno.test("getLines: 多行被拆分到多个 chunk", () => {
  const lines: string[] = [];
  const next = getLines((line) => lines.push(decoder.decode(line)));

  next(encoder.encode("id: ab"));
  next(encoder.encode("c\nda"));
  next(encoder.encode("ta: def\n"));

  assertEquals(lines, ["id: abc", "data: def"]);
});

Deno.test("getLines: 空行", () => {
  const lines: Array<{ text: string; fieldLength: number }> = [];
  const next = getLines((line, fieldLength) => {
    lines.push({ text: decoder.decode(line), fieldLength });
  });

  next(encoder.encode("\n"));

  assertEquals(lines, [{ text: "", fieldLength: -1 }]);
});

Deno.test("getLines: 注释行 fieldLength 为 0", () => {
  const lines: Array<{ text: string; fieldLength: number }> = [];
  const next = getLines((line, fieldLength) => {
    lines.push({ text: decoder.decode(line), fieldLength });
  });

  next(encoder.encode(": this is a comment\n"));

  assertEquals(lines, [{ text: ": this is a comment", fieldLength: 0 }]);
});

Deno.test("getLines: 没有字段名的行", () => {
  const lines: Array<{ text: string; fieldLength: number }> = [];
  const next = getLines((line, fieldLength) => {
    lines.push({ text: decoder.decode(line), fieldLength });
  });

  next(encoder.encode("this is an invalid line\n"));

  assertEquals(lines, [
    { text: "this is an invalid line", fieldLength: -1 },
  ]);
});

Deno.test("getLines: 一行有多个冒号时只取第一个", () => {
  const lines: Array<{ text: string; fieldLength: number }> = [];
  const next = getLines((line, fieldLength) => {
    lines.push({ text: decoder.decode(line), fieldLength });
  });

  next(encoder.encode("id: abc: def\n"));

  assertEquals(lines, [{ text: "id: abc: def", fieldLength: 2 }]);
});

Deno.test("getLines: 支持 \\n 分隔", () => {
  const lines: string[] = [];
  const next = getLines((line) => lines.push(decoder.decode(line)));

  next(encoder.encode("id: abc\ndata: def\n"));

  assertEquals(lines, ["id: abc", "data: def"]);
});

Deno.test("getLines: 支持 \\r 分隔", () => {
  const lines: string[] = [];
  const next = getLines((line) => lines.push(decoder.decode(line)));

  next(encoder.encode("id: abc\rdata: def\r"));

  assertEquals(lines, ["id: abc", "data: def"]);
});

Deno.test("getLines: 支持 \\r\\n 分隔", () => {
  const lines: string[] = [];
  const next = getLines((line) => lines.push(decoder.decode(line)));

  next(encoder.encode("id: abc\r\ndata: def\r\n"));

  assertEquals(lines, ["id: abc", "data: def"]);
});

Deno.test("getLines: \\r\\n 被拆分到两个 chunk", () => {
  const lines: string[] = [];
  const next = getLines((line) => lines.push(decoder.decode(line)));

  next(encoder.encode("data: abc\r"));
  next(encoder.encode("\ndata: def\r\n"));

  assertEquals(lines, ["data: abc", "data: def"]);
});

Deno.test("getLines: 一行内的 UTF-8 多字节字符不丢失", () => {
  const lines: string[] = [];
  const next = getLines((line) => lines.push(decoder.decode(line)));

  next(encoder.encode("data: 你好 🌍\n"));

  assertEquals(lines, ["data: 你好 🌍"]);
});

/* =========================
   getMessages
========================= */

Deno.test("getMessages: id/event/retry/data 全字段", () => {
  const ids: string[] = [];
  const retries: number[] = [];
  const messages: EventSourceMessage[] = [];

  const next = getMessages(
    (id) => ids.push(id),
    (retry) => retries.push(retry),
    (message) => messages.push(message),
  );

  next(encoder.encode("retry: 42"), 5);
  next(encoder.encode("id: abc"), 2);
  next(encoder.encode("event:def"), 5);
  next(encoder.encode("data:ghi"), 4);
  next(encoder.encode(""), -1);

  assertEquals(ids, ["abc"]);
  assertEquals(retries, [42]);
  assertEquals(messages, [{
    retry: 42,
    id: "abc",
    event: "def",
    data: "ghi",
  }]);
});

Deno.test("getMessages: 忽略未知字段", () => {
  const messages: EventSourceMessage[] = [];
  const next = getMessages(
    () => {},
    () => {
      throw new Error("retry should not be called");
    },
    (message) => messages.push(message),
  );

  next(encoder.encode("id: abc"), 2);
  next(encoder.encode("foo: null"), 3);
  next(encoder.encode(""), -1);

  assertEquals(messages, [{
    id: "abc",
    data: "",
    event: "",
    retry: undefined,
  }]);
});

Deno.test("getMessages: 忽略非整数 retry", () => {
  const messages: EventSourceMessage[] = [];
  const next = getMessages(
    () => {
      throw new Error("id should not be called");
    },
    () => {
      throw new Error("retry should not be called");
    },
    (message) => messages.push(message),
  );

  next(encoder.encode("retry: def"), 5);
  next(encoder.encode(""), -1);

  assertEquals(messages, [{
    id: "",
    data: "",
    event: "",
    retry: undefined,
  }]);
});

Deno.test("getMessages: 注释行不影响消息", () => {
  const messages: EventSourceMessage[] = [];
  const next = getMessages(
    (id) => assertEquals(id, "123"),
    () => {
      throw new Error("retry should not be called");
    },
    (message) => messages.push(message),
  );

  next(encoder.encode("id:123"), 2);
  next(encoder.encode(":"), 0);
  next(encoder.encode(":    "), 0);
  next(encoder.encode("event: foo "), 5);
  next(encoder.encode(""), -1);

  assertEquals(messages, [{
    retry: undefined,
    id: "123",
    event: "foo ",
    data: "",
  }]);
});

Deno.test("getMessages: 多行 data 以换行拼接", () => {
  const messages: EventSourceMessage[] = [];
  const next = getMessages(
    () => {
      throw new Error("id should not be called");
    },
    () => {
      throw new Error("retry should not be called");
    },
    (message) => messages.push(message),
  );

  next(encoder.encode("data:YHOO"), 4);
  next(encoder.encode("data: +2"), 4);
  next(encoder.encode("data"), 4);
  next(encoder.encode("data: 10"), 4);
  next(encoder.encode(""), -1);

  assertEquals(messages, [{
    data: "YHOO\n+2\n\n10",
    id: "",
    event: "",
    retry: undefined,
  }]);
});

Deno.test("getMessages: id 可以清空", () => {
  const ids: string[] = [];
  const messages: EventSourceMessage[] = [];
  const next = getMessages(
    (id) => ids.push(id),
    () => {
      throw new Error("retry should not be called");
    },
    (message) => messages.push(message),
  );

  next(encoder.encode("id: foo"), 2);
  next(encoder.encode("id"), 2);
  next(encoder.encode(""), -1);

  assertEquals(ids, ["foo", ""]);
  assertEquals(messages.length, 1);
});

Deno.test("getMessages: 连续两条消息互不污染", () => {
  const messages: EventSourceMessage[] = [];
  const next = getMessages(
    () => {},
    () => {},
    (message) => messages.push(message),
  );

  for (
    const line of [
      "id: 1",
      "event: first",
      "data: one",
      "",
      "id: 2",
      "data: two",
      "",
    ]
  ) {
    next(encoder.encode(line), line.indexOf(":"));
  }

  assertEquals(messages, [
    { id: "1", event: "first", data: "one", retry: undefined },
    { id: "2", event: "", data: "two", retry: undefined },
  ]);
});

Deno.test("getMessages: data 值可以包含冒号", () => {
  const { messages } = collectMessages('data: {"url":"http://a:1"}\n\n');

  assertEquals(messages.length, 1);
  assertEquals(messages[0].data, '{"url":"http://a:1"}');
});

/* =========================
   边界与工具
========================= */

Deno.test("getBytes: 按块读取整个流", async () => {
  const chunks: string[] = [];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("a"));
      controller.enqueue(encoder.encode("b"));
      controller.enqueue(encoder.encode("c"));
      controller.close();
    },
  });

  await getBytes(stream, (chunk) => chunks.push(decoder.decode(chunk)));

  assertEquals(chunks, ["a", "b", "c"]);
});

Deno.test("formatMessage: 与解析器往返一致", () => {
  const text = formatMessage({
    id: "42",
    event: "update",
    retry: 100,
    data: "line1\nline2",
  });

  const { messages } = collectMessages(text);

  assertEquals(messages, [{
    id: "42",
    event: "update",
    retry: 100,
    data: "line1\nline2",
  }]);
});

Deno.test("parse: 多条消息与自定义事件", () => {
  const { messages, ids } = collectMessages(
    'id: 1\nevent: bind\ndata: {"status":"success"}\n\n' +
      "id: 2\nevent: msg\ndata: hello\n\n",
  );

  assertEquals(ids, ["1", "2"]);
  assertEquals(messages.length, 2);
  assertEquals(messages[0].event, "bind");
  assertEquals(messages[0].data, '{"status":"success"}');
  assertEquals(messages[1].event, "msg");
});
