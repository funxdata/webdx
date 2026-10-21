import { assert, assertEquals, assertRejects } from "@std/assert";
import {
  type EventSourceMessage,
  EventStreamContentType,
  fetchEventSource,
} from "../client/dxsse.ts";

const encoder = new TextEncoder();

function sseResponse(
  chunks: string[],
  init: ResponseInit = {},
): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    ...init,
    headers: {
      "content-type": EventStreamContentType,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

async function withServer<T>(
  handler: (req: Request) => Response | Promise<Response>,
  run: (baseURL: string) => Promise<T>,
): Promise<T> {
  const server = Deno.serve(
    { port: 0, hostname: "127.0.0.1", onListen: () => {} },
    handler,
  );
  const port = (server.addr as Deno.NetAddr).port;
  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await server.shutdown();
  }
}

Deno.test("fetchEventSource: 解析基本消息", async () => {
  await withServer(
    () => sseResponse(["data: hello\n\n", "data: world\n\n"]),
    async (baseURL) => {
      const messages: EventSourceMessage[] = [];
      await fetchEventSource(`${baseURL}/sse`, {
        onmessage: (message) => messages.push(message),
      });

      assertEquals(messages.map((m) => m.data), ["hello", "world"]);
    },
  );
});

Deno.test("fetchEventSource: 自动添加 Accept 头并透传自定义头", async () => {
  let seen: { accept: string | null; custom: string | null } | null = null;

  await withServer(
    (req) => {
      seen = {
        accept: req.headers.get("accept"),
        custom: req.headers.get("x-token"),
      };
      return sseResponse(["data: ok\n\n"]);
    },
    async (baseURL) => {
      await fetchEventSource(`${baseURL}/sse`, {
        headers: { "x-token": "abc" },
      });
    },
  );

  assertEquals(seen, {
    accept: EventStreamContentType,
    custom: "abc",
  });
});

Deno.test("fetchEventSource: 消息被拆分到多个 chunk 时仍能解析", async () => {
  await withServer(
    () => sseResponse(["da", "ta: he", "llo\n\n", "event: ms", "g\n\n"]),
    async (baseURL) => {
      const messages: EventSourceMessage[] = [];
      await fetchEventSource(`${baseURL}/sse`, {
        onmessage: (message) => messages.push(message),
      });

      assertEquals(messages.length, 2);
      assertEquals(messages[0].data, "hello");
      assertEquals(messages[1].event, "msg");
    },
  );
});

Deno.test("fetchEventSource: 透传 method / body 并支持 POST", async () => {
  let method: string | null = null;
  let body: string | null = null;

  await withServer(
    async (req) => {
      method = req.method;
      body = await req.text();
      return sseResponse(["data: posted\n\n"]);
    },
    async (baseURL) => {
      const messages: string[] = [];
      await fetchEventSource(`${baseURL}/sse`, {
        method: "POST",
        body: JSON.stringify({ lib: "sys_info" }),
        headers: { "content-type": "application/json" },
        onmessage: (message) => messages.push(message.data),
      });

      assertEquals(messages, ["posted"]);
    },
  );

  assertEquals(method, "POST");
  assertEquals(body, JSON.stringify({ lib: "sys_info" }));
});

Deno.test("fetchEventSource: 正常结束触发 onclose", async () => {
  let closed = 0;

  await withServer(
    () => sseResponse(["data: bye\n\n"]),
    async (baseURL) => {
      await fetchEventSource(`${baseURL}/sse`, {
        onclose: () => {
          closed += 1;
        },
      });
    },
  );

  assertEquals(closed, 1);
});

Deno.test("fetchEventSource: onopen 可自定义校验", async () => {
  let opened = 0;

  await withServer(
    () =>
      sseResponse(["data: plain\n\n"], {
        headers: { "content-type": "text/plain" },
      }),
    async (baseURL) => {
      const messages: string[] = [];
      await fetchEventSource(`${baseURL}/sse`, {
        onopen: () => {
          opened += 1;
        },
        onmessage: (message) => messages.push(message.data),
      });

      assertEquals(messages, ["plain"]);
    },
  );

  assertEquals(opened, 1);
});

Deno.test("fetchEventSource: content-type 不符时进入 onerror", async () => {
  await withServer(
    () =>
      new Response("not sse", { headers: { "content-type": "text/plain" } }),
    async (baseURL) => {
      await assertRejects(
        () =>
          fetchEventSource(`${baseURL}/sse`, {
            onerror: (err) => {
              throw err;
            },
          }),
        Error,
        "Expected content-type to be text/event-stream",
      );
    },
  );
});

Deno.test("fetchEventSource: 非 2xx 响应进入 onerror", async () => {
  await withServer(
    () => new Response("boom", { status: 500 }),
    async (baseURL) => {
      await assertRejects(
        () =>
          fetchEventSource(`${baseURL}/sse`, {
            onerror: (err) => {
              throw err;
            },
          }),
        Error,
        "SSE request failed with HTTP status 500",
      );
    },
  );
});

Deno.test("fetchEventSource: onerror 返回间隔后重试", async () => {
  let calls = 0;

  await withServer(
    () => {
      calls += 1;
      if (calls === 1) {
        return new Response("boom", { status: 503 });
      }
      return sseResponse(["data: recovered\n\n"]);
    },
    async (baseURL) => {
      const messages: string[] = [];
      await fetchEventSource(`${baseURL}/sse`, {
        onerror: () => 5,
        onmessage: (message) => messages.push(message.data),
      });

      assertEquals(messages, ["recovered"]);
    },
  );

  assertEquals(calls, 2);
});

Deno.test("fetchEventSource: 重试时携带 last-event-id", async () => {
  let calls = 0;
  const seenIds: Array<string | null> = [];

  await withServer(
    (req) => {
      calls += 1;
      seenIds.push(req.headers.get("last-event-id"));

      if (calls === 1) {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode("id: 42\ndata: first\n\n"));
          },
          pull(controller) {
            controller.error(new Error("connection lost"));
          },
        });
        return new Response(stream, {
          headers: { "content-type": EventStreamContentType },
        });
      }

      return sseResponse([]);
    },
    async (baseURL) => {
      const messages: EventSourceMessage[] = [];
      await fetchEventSource(`${baseURL}/sse`, {
        onerror: () => 5,
        onmessage: (message) => messages.push(message),
      });

      assertEquals(messages.length, 1);
      assertEquals(messages[0].id, "42");
    },
  );

  assertEquals(calls, 2);
  assertEquals(seenIds, [null, "42"]);
});

Deno.test("fetchEventSource: abort 后正常 resolve", async () => {
  await withServer(
    () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode("data: tick\n\n"));
        },
      });
      return new Response(stream, {
        headers: { "content-type": EventStreamContentType },
      });
    },
    async (baseURL) => {
      const controller = new AbortController();
      const messages: string[] = [];

      await fetchEventSource(`${baseURL}/sse`, {
        signal: controller.signal,
        onmessage: (message) => {
          messages.push(message.data);
          controller.abort();
        },
      });

      assertEquals(messages, ["tick"]);
    },
  );
});

Deno.test("fetchEventSource: 已经 abort 的 signal 立即 resolve 且不发请求", async () => {
  let calls = 0;

  await withServer(
    () => {
      calls += 1;
      return sseResponse([]);
    },
    async (baseURL) => {
      const controller = new AbortController();
      controller.abort();

      await fetchEventSource(`${baseURL}/sse`, { signal: controller.signal });
    },
  );

  assertEquals(calls, 0);
});

Deno.test("fetchEventSource: 支持注入自定义 fetch", async () => {
  let calls = 0;
  const customFetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    return fetch(input, init);
  }) as typeof fetch;

  await withServer(
    () => sseResponse(["data: custom\n\n"]),
    async (baseURL) => {
      const messages: string[] = [];
      await fetchEventSource(`${baseURL}/sse`, {
        fetch: customFetch,
        onmessage: (message) => messages.push(message.data),
      });

      assertEquals(messages, ["custom"]);
    },
  );

  assertEquals(calls, 1);
});

Deno.test("fetchEventSource: 非 JSON 文本消息不抛错", async () => {
  await withServer(
    () => sseResponse(["data: not-json\n\n"]),
    async (baseURL) => {
      const messages: EventSourceMessage[] = [];
      await fetchEventSource(`${baseURL}/sse`, {
        onmessage: (message) => messages.push(message),
      });

      assertEquals(messages[0].data, "not-json");
    },
  );
});

Deno.test("fetchEventSource: 没有 body 的响应会 reject", async () => {
  const noBodyFetch = (() =>
    Promise.resolve(
      new Response(null, {
        headers: { "content-type": EventStreamContentType },
      }),
    )) as typeof fetch;

  await assertRejects(
    () =>
      fetchEventSource("http://127.0.0.1:1/sse", {
        fetch: noBodyFetch,
        onerror: (err) => {
          throw err;
        },
      }),
    Error,
    "SSE response body is null",
  );
});

Deno.test("fetchEventSource: 环境无 fetch 时给出明确错误", async () => {
  const original = globalThis.fetch;
  (globalThis as { fetch?: typeof fetch }).fetch = undefined;

  try {
    await assertRejects(
      () => fetchEventSource("http://127.0.0.1:1/sse", {}),
      Error,
      "fetch is not available",
    );
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("fetchEventSource: EventStreamContentType 常量", () => {
  assert(EventStreamContentType === "text/event-stream");
});
