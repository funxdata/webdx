import { assert, assertEquals, assertRejects } from "@std/assert";
import { DxHttp, DxHttpError, RequestTimeoutError } from "../client/dxhttp.ts";

function startServer() {
  const handler = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    switch (url.pathname) {
      case "/not-found":
        return new Response(
          JSON.stringify({ error: "Not Found", code: 404 }),
          {
            status: 404,
            statusText: "Not Found",
            headers: { "Content-Type": "application/json" },
          },
        );

      case "/error":
        return new Response("server exploded", {
          status: 500,
          statusText: "Internal Server Error",
          headers: { "Content-Type": "text/plain" },
        });

      case "/slow":
        await new Promise((resolve) => setTimeout(resolve, 200));
        return Response.json({ ok: true });

      case "/params":
        return Response.json({
          query: Object.fromEntries(url.searchParams),
        });

      case "/headers":
        return Response.json({
          headers: Object.fromEntries(req.headers),
        });

      case "/form":
        return Response.json({
          contentType: req.headers.get("content-type"),
        });

      case "/empty":
        return new Response(null, { status: 204 });

      case "/bad-json":
        return new Response("not-json", {
          headers: { "Content-Type": "application/json" },
        });

      default:
        return Response.json({ ok: true });
    }
  };

  const server = Deno.serve(
    { port: 0, hostname: "127.0.0.1", onListen: () => {} },
    handler,
  );
  const port = (server.addr as Deno.NetAddr).port;
  return { server, baseURL: `http://127.0.0.1:${port}` };
}

Deno.test("DxHttpError: 404 携带 status / statusText / data / headers", async () => {
  const { server, baseURL } = startServer();

  try {
    const client = new DxHttp({ baseURL });
    const error = await assertRejects(() => client.get("/not-found"));

    assert(error instanceof DxHttpError);
    assertEquals(error.code, "HTTP");
    assertEquals(error.status, 404);
    assertEquals(error.statusText, "Not Found");
    assertEquals(error.message, "Request failed with HTTP status 404");
    assertEquals(error.data, { error: "Not Found", code: 404 });
    assertEquals(error.headers?.get("content-type"), "application/json");
  } finally {
    await server.shutdown();
  }
});

Deno.test("DxHttpError: 500 保留文本响应体", async () => {
  const { server, baseURL } = startServer();

  try {
    const client = new DxHttp({ baseURL });
    const error = await assertRejects(() => client.get("/error"));

    assert(error instanceof DxHttpError);
    assertEquals(error.status, 500);
    assertEquals(error.data, "server exploded");
  } finally {
    await server.shutdown();
  }
});

Deno.test("DxHttpError: 超时是 RequestTimeoutError", async () => {
  const { server, baseURL } = startServer();

  try {
    const client = new DxHttp({ baseURL, timeout: 50 });
    const error = await assertRejects(() => client.get("/slow"));

    assert(error instanceof RequestTimeoutError);
    assert(error instanceof DxHttpError);
    assertEquals(error.name, "RequestTimeoutError");
    assertEquals(error.code, "TIMEOUT");
    assertEquals(error.message, "Request timeout after 50ms");
  } finally {
    await server.shutdown();
  }
});

Deno.test("DxHttpError: error hook 收到错误且抛错不影响请求", async () => {
  const { server, baseURL } = startServer();

  try {
    const client = new DxHttp({ baseURL });
    const received: unknown[] = [];
    client.setRequestErrorHook((error) => {
      received.push(error);
    });

    await assertRejects(() => client.get("/not-found"));
    assertEquals(received.length, 1);
    assert(received[0] instanceof DxHttpError);

    client.setRequestErrorHook(() => {
      throw new Error("hook failed");
    });
    await assertRejects(() => client.get("/not-found"));
  } finally {
    await server.shutdown();
  }
});

Deno.test("DxHttp: params 会编码到 query string", async () => {
  const { server, baseURL } = startServer();

  try {
    const client = new DxHttp({ baseURL });
    const res = await client.get<{ query: Record<string, string> }>("/params", {
      params: {
        q: "中文 value",
        page: 2,
        active: true,
        empty: null,
        missing: undefined,
      },
    });

    assertEquals(res.data.query.q, "中文 value");
    assertEquals(res.data.query.page, "2");
    assertEquals(res.data.query.active, "true");
    assertEquals("empty" in res.data.query, false);
    assertEquals("missing" in res.data.query, false);
  } finally {
    await server.shutdown();
  }
});

Deno.test("DxHttp: 已有 query 时用 & 追加 params", async () => {
  const { server, baseURL } = startServer();

  try {
    const client = new DxHttp({ baseURL });
    const res = await client.get<{ query: Record<string, string> }>(
      "/params?fixed=1",
      { params: { extra: "2" } },
    );

    assertEquals(res.data.query.fixed, "1");
    assertEquals(res.data.query.extra, "2");
  } finally {
    await server.shutdown();
  }
});

Deno.test("DxHttp: 空 baseURL 时绝对 URL 不会被拼接", async () => {
  const { server, baseURL } = startServer();

  try {
    const client = new DxHttp();
    const res = await client.get<{ ok: boolean }>(`${baseURL}/anything`);
    assertEquals(res.data.ok, true);
  } finally {
    await server.shutdown();
  }
});

Deno.test("DxHttp: 多个 token 会合并，显式 Authorization 优先", async () => {
  const { server, baseURL } = startServer();

  try {
    const client = new DxHttp({
      baseURL,
      headers: { Authorization: "Bearer explicit" },
    });
    client.setToken("X-One", "1");
    client.setToken("X-Two", "2");
    client.setAuthorize(true);

    const res = await client.get<{ headers: Record<string, string> }>(
      "/headers",
    );

    assertEquals(res.data.headers["x-one"], "1");
    assertEquals(res.data.headers["x-two"], "2");
    assertEquals(res.data.headers.authorization, "Bearer explicit");
  } finally {
    await server.shutdown();
  }
});

Deno.test("DxHttp: header 大小写不敏感覆盖，不产生重复键", async () => {
  const { server, baseURL } = startServer();

  try {
    const client = new DxHttp({
      baseURL,
      headers: { "Content-Type": "text/plain" },
    });

    const res = await client.post<{ headers: Record<string, string> }>(
      "/headers",
      { a: 1 },
      { headers: { "content-type": "text/custom" } },
    );

    assertEquals(res.data.headers["content-type"], "text/custom");
  } finally {
    await server.shutdown();
  }
});

Deno.test("DxHttp: FormData 不强制 JSON Content-Type", async () => {
  const { server, baseURL } = startServer();

  try {
    const client = new DxHttp({ baseURL });
    const form = new FormData();
    form.set("name", "webdx");

    const res = await client.post<{ contentType: string }>("/form", form);

    assert(res.data.contentType?.startsWith("multipart/form-data"));
  } finally {
    await server.shutdown();
  }
});

Deno.test("DxHttp: URLSearchParams 不强制 JSON Content-Type", async () => {
  const { server, baseURL } = startServer();

  try {
    const client = new DxHttp({ baseURL });
    const body = new URLSearchParams({ a: "1" });

    const res = await client.post<{ contentType: string }>("/form", body);

    assertEquals(
      res.data.contentType,
      "application/x-www-form-urlencoded;charset=UTF-8",
    );
  } finally {
    await server.shutdown();
  }
});

Deno.test("DxHttp: 204 响应的 data 为 null", async () => {
  const { server, baseURL } = startServer();

  try {
    const client = new DxHttp({ baseURL });
    const res = await client.get<null>("/empty");

    assertEquals(res.status, 204);
    assertEquals(res.ok, true);
    assertEquals(res.msg, true);
    assertEquals(res.data, null);
  } finally {
    await server.shutdown();
  }
});

Deno.test("DxHttp: JSON content-type 但非法 JSON 时回退文本", async () => {
  const { server, baseURL } = startServer();

  try {
    const client = new DxHttp({ baseURL });
    const res = await client.get<string>("/bad-json");

    assertEquals(res.data, "not-json");
  } finally {
    await server.shutdown();
  }
});

Deno.test("DxHttp: 响应包含 ok / msg / statusText / headers", async () => {
  const { server, baseURL } = startServer();

  try {
    const client = new DxHttp({ baseURL });
    const res = await client.get("/anything");

    assertEquals(res.status, 200);
    assertEquals(res.ok, true);
    assertEquals(res.msg, true);
    assertEquals(res.statusText, "OK");
    assert(res.headers instanceof Headers);
  } finally {
    await server.shutdown();
  }
});

Deno.test("DxHttp: 网络错误被包装为 NETWORK", async () => {
  const client = new DxHttp({
    baseURL: "http://127.0.0.1:1",
    timeout: 50,
  });

  const error = await assertRejects(() => client.get("/"));

  assert(error instanceof DxHttpError);
  assertEquals(error.code, "NETWORK");
});
