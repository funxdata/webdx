import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { DxHttp } from "../client/dxhttp.ts";

function startMockServer() {
  const handler = (req: Request) => {
    const url = new URL(req.url);

    if (url.pathname === "/get") {
      return Response.json({ method: "GET", ok: true });
    }

    if (url.pathname === "/post") {
      return new Response(
        JSON.stringify({ method: "POST", ok: true }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response("Not Found", { status: 404 });
  };

  const server = Deno.serve({ port: 0 }, handler);
  const port = (server.addr as Deno.NetAddr).port;

  return { server, port };
}

Deno.test("DxHttp GET request", async () => {
  const { server, port } = startMockServer();

  const client = new DxHttp({
    baseURL: `http://localhost:${port}`,
  });

  const res = await client.get<{ method: string; ok: boolean }>("/get");

  assertEquals(res.data.method, "GET");
  assertEquals(res.data.ok, true);

  server.shutdown();
});

Deno.test("DxHttp POST request", async () => {
  const { server, port } = startMockServer();

  const client = new DxHttp({
    baseURL: `http://localhost:${port}`,
  });

  const res = await client.post<{ method: string; ok: boolean }>(
    "/post",
    { hello: "world" },
  );

  assertEquals(res.data.method, "POST");
  assertEquals(res.data.ok, true);

  server.shutdown();
});
