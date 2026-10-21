/**
 * HTTP 测试共用的 mock 服务。
 *
 * 覆盖 dxhttp3_test 与 dxhttp_error_test 需要的端点，
 * 使用随机端口，测试结束务必 `await server.shutdown()`。
 */
export interface MockServer {
  server: Deno.HttpServer;
  port: number;
  baseURL: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function startMockServer(): MockServer {
  const handler = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const method = req.method;
    const path = url.pathname;

    switch (path) {
      case "/get":
        return Response.json({ method: "GET", ok: true, path });

      case "/get-with-params":
      case "/params": {
        const params = Object.fromEntries(url.searchParams);
        return Response.json({
          method,
          ok: true,
          params,
          query: params,
        });
      }

      case "/post": {
        const body = await req.json();
        return Response.json({ method: "POST", ok: true, body });
      }

      case "/post-with-headers": {
        const body = await req.json();
        const headers = Object.fromEntries(req.headers);
        return Response.json({
          method: "POST",
          ok: true,
          body,
          headers: {
            "content-type": headers["content-type"],
            "x-custom": headers["x-custom"],
          },
        });
      }

      case "/put": {
        const body = await req.json();
        return Response.json({ method: "PUT", ok: true, body });
      }

      case "/patch": {
        const body = await req.json();
        return Response.json({ method: "PATCH", ok: true, body });
      }

      case "/delete":
        return Response.json({ method: "DELETE", ok: true, path });

      case "/delete-with-id":
        return Response.json({
          method: "DELETE",
          ok: true,
          id: url.searchParams.get("id"),
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
        await delay(200);
        return Response.json({ ok: true });

      case "/timeout":
        await delay(300);
        return Response.json({ ok: true });

      case "/anything":
        return Response.json({ ok: true });

      default:
        return new Response(
          JSON.stringify({ error: "Not Found", path, method }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
    }
  };

  const server = Deno.serve(
    { port: 0, hostname: "127.0.0.1", onListen: () => {} },
    handler,
  );
  const port = (server.addr as Deno.NetAddr).port;

  return { server, port, baseURL: `http://127.0.0.1:${port}` };
}
