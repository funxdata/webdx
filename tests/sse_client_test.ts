import { assert, assertEquals, assertRejects } from "@std/assert";
import {
  buildSseUrl,
  DxSse,
  EventStreamContentType,
  parseSseData,
  unwrapSseData,
} from "../client/dxsse.ts";

const encoder = new TextEncoder();

/* =========================
   buildSseUrl
========================= */

Deno.test("buildSseUrl: 构造 lib/symbol/args", () => {
  const url = buildSseUrl("http://127.0.0.1:44944", {
    lib: "sys_info",
    symbol: "post_file_exists",
    args: { path: "README.md" },
  });

  const parsed = new URL(url);
  assertEquals(parsed.origin, "http://127.0.0.1:44944");
  assertEquals(parsed.pathname, "/sse");
  assertEquals(parsed.searchParams.get("lib"), "sys_info");
  assertEquals(parsed.searchParams.get("symbol"), "post_file_exists");
  assertEquals(parsed.searchParams.get("args"), '{"path":"README.md"}');
});

Deno.test("buildSseUrl: 去除 baseURL 末尾斜杠", () => {
  const url = buildSseUrl("http://127.0.0.1:44944///", {
    lib: "sys_info",
    symbol: "info",
  });

  assertEquals(new URL(url).pathname, "/sse");
});

Deno.test("buildSseUrl: 保留 baseURL 的路径前缀", () => {
  const url = buildSseUrl("https://api.example.com/dx/", {
    lib: "sys_info",
    symbol: "info",
  });

  assertEquals(new URL(url).pathname, "/dx/sse");
});

Deno.test("buildSseUrl: 空 baseURL 返回相对路径", () => {
  const url = buildSseUrl("", { lib: "a", symbol: "b" });

  assert(url.startsWith("/sse?"));
});

Deno.test("buildSseUrl: args 是字符串时原样传递", () => {
  const url = buildSseUrl("http://host", {
    lib: "a",
    symbol: "b",
    args: "plain-string",
  });

  assertEquals(new URL(url).searchParams.get("args"), "plain-string");
});

Deno.test("buildSseUrl: interval_ms 与额外参数", () => {
  const url = buildSseUrl("http://host", {
    lib: "a",
    symbol: "b",
    interval_ms: 200,
    token: "xyz",
  });

  const params = new URL(url).searchParams;
  assertEquals(params.get("interval_ms"), "200");
  assertEquals(params.get("token"), "xyz");
});

Deno.test("buildSseUrl: 跳过 undefined / null 参数", () => {
  const url = buildSseUrl("http://host", {
    lib: "a",
    symbol: "b",
    args: undefined,
    extra: null,
  });

  const params = new URL(url).searchParams;
  assertEquals(params.has("args"), false);
  assertEquals(params.has("extra"), false);
});

Deno.test("buildSseUrl: 中文与特殊字符被正确编码", () => {
  const url = buildSseUrl("http://host", {
    lib: "系统",
    symbol: "查询",
    args: { path: "docs/关于.md" },
  });

  const params = new URL(url).searchParams;
  assertEquals(params.get("lib"), "系统");
  assertEquals(params.get("symbol"), "查询");
  assertEquals(params.get("args"), '{"path":"docs/关于.md"}');
});

/* =========================
   payload 解析
========================= */

Deno.test("parseSseData: JSON 对象", () => {
  assertEquals(parseSseData('{"data":{"exists":true}}'), {
    data: { exists: true },
  });
});

Deno.test("parseSseData: JSON 数字与布尔值", () => {
  assertEquals(parseSseData("42"), 42);
  assertEquals(parseSseData("true"), true);
});

Deno.test("parseSseData: 非 JSON 返回原字符串", () => {
  assertEquals(parseSseData("hello"), "hello");
});

Deno.test("parseSseData: 空字符串返回 null", () => {
  assertEquals(parseSseData(""), null);
});

Deno.test("unwrapSseData: 取出 data 字段", () => {
  assertEquals(unwrapSseData({ data: { exists: true } }), { exists: true });
});

Deno.test("unwrapSseData: 没有 data 字段时原样返回", () => {
  assertEquals(unwrapSseData({ exists: true }), { exists: true });
});

Deno.test("unwrapSseData: null / 数组 / 原始值", () => {
  assertEquals(unwrapSseData(null), null);
  assertEquals(unwrapSseData([1, 2]), [1, 2]);
  assertEquals(unwrapSseData("text"), "text");
});

/* =========================
   DxSse 端到端
========================= */

async function withSseServer<T>(
  handler: (req: Request) => Response,
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

function sseResponse(chunks: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": EventStreamContentType },
  });
}

Deno.test("DxSse: 订阅并解析 data 与 event", async () => {
  await withSseServer(
    () =>
      sseResponse([
        'event: post_file_exists\ndata: {"data":{"exists":true}}\n\n',
        'event: post_file_info\ndata: {"data":{"size":10}}\n\n',
      ]),
    async (baseURL) => {
      const sse = new DxSse(baseURL);
      const events: string[] = [];
      const payloads: unknown[] = [];

      const done = sse.subscribe(
        {
          lib: "sys_info",
          symbol: "post_file_exists",
          args: { path: "README.md" },
          interval_ms: 200,
        },
        {
          onevent: (event) => events.push(event),
          onmessage: (_message, payload) => payloads.push(payload),
        },
      );

      assertEquals(sse.activeCount, 1);
      await done;

      assertEquals(sse.activeCount, 0);
      assertEquals(events, ["post_file_exists", "post_file_info"]);
      assertEquals(unwrapSseData(payloads[0]), { exists: true });
      assertEquals(unwrapSseData(payloads[1]), { size: 10 });
    },
  );
});

Deno.test("DxSse: 请求 URL 携带查询参数", async () => {
  let seen: URL | null = null;

  await withSseServer(
    (req) => {
      seen = new URL(req.url);
      return sseResponse(['data: {"ok":true}\n\n']);
    },
    async (baseURL) => {
      const sse = new DxSse(baseURL);
      await sse.subscribe(
        { lib: "sys_info", symbol: "post_file_info", args: { path: "a.md" } },
        {},
      );
    },
  );

  assert(seen !== null);
  assertEquals((seen as URL).searchParams.get("lib"), "sys_info");
  assertEquals((seen as URL).searchParams.get("symbol"), "post_file_info");
  assertEquals((seen as URL).searchParams.get("args"), '{"path":"a.md"}');
});

Deno.test("DxSse: close 中止所有订阅", async () => {
  await withSseServer(
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
      const sse = new DxSse(baseURL);
      let received = 0;

      const done = sse.subscribe(
        { lib: "a", symbol: "b" },
        {
          onmessage: () => {
            received += 1;
            sse.close();
          },
        },
      );

      await done;
      assertEquals(received, 1);
      assertEquals(sse.activeCount, 0);
      assert(sse.isClosed);
    },
  );
});

Deno.test("DxSse: 外部 signal 中止订阅", async () => {
  await withSseServer(
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
      const sse = new DxSse(baseURL);
      const controller = new AbortController();

      const done = sse.subscribe(
        { lib: "a", symbol: "b" },
        {
          signal: controller.signal,
          onmessage: () => controller.abort(),
        },
      );

      await done;
      assertEquals(sse.activeCount, 0);
    },
  );
});

Deno.test("DxSse: 关闭后订阅立即 reject", async () => {
  const sse = new DxSse("http://127.0.0.1:1");
  sse.close();

  await assertRejects(
    () => sse.subscribe({ lib: "a", symbol: "b" }),
    Error,
    "DxSse is closed",
  );
});

Deno.test("DxSse: 默认 headers / fetch 透传", async () => {
  let seenToken: string | null = null;

  await withSseServer(
    (req) => {
      seenToken = req.headers.get("x-token");
      return sseResponse([]);
    },
    async (baseURL) => {
      const sse = new DxSse(baseURL, { headers: { "x-token": "secret" } });
      await sse.subscribe({ lib: "a", symbol: "b" });
    },
  );

  assertEquals(seenToken, "secret");
});

Deno.test("DxSse: url 方法与环境状态", () => {
  const sse = new DxSse("http://host/");
  const url = sse.url({ lib: "a", symbol: "b" });

  assert(url.startsWith("http://host/sse?"));
  assertEquals(sse.activeCount, 0);
  assertEquals(sse.isClosed, false);
  sse.close();
  assertEquals(sse.isClosed, true);
});
