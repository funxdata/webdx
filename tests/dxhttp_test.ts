import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { DxHttp } from "../client/dxhttp.ts";

function startMockServer() {
  const handler = async (req: Request) => {
    const url = new URL(req.url);
    const method = req.method;

    const path = url.pathname;

    if (path === "/get" && method === "GET") {
      return Response.json({ method: "GET", ok: true });
    }

    if (path === "/post" && method === "POST") {
      const body = await req.json();
      return Response.json({ method: "POST", ok: true, body });
    }

    if (path === "/patch" && method === "PATCH") {
      const body = await req.json();
      return Response.json({ method: "PATCH", ok: true, body });
    }

    if (path === "/delete" && method === "DELETE") {
      return Response.json({ method: "DELETE", ok: true });
    }

    return new Response(
      JSON.stringify({
        error: "Not Found",
        path,
        method,
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  const server = Deno.serve({ port: 0 }, handler);
  const port = (server.addr as Deno.NetAddr).port;

  return { server, port };
}

function createClient(port: number) {
  return new DxHttp({
    baseURL: `http://localhost:${port}`,
  });
}

/* =========================
   GET
========================= */
Deno.test("DxHttp GET request", async () => {
  const { server, port } = startMockServer();

  try {
    const client = createClient(port);

    const res = await client.get("/get");

    assertEquals(res.data.method, "GET");
    assertEquals(res.data.ok, true);
  } finally {
    server.shutdown();
  }
});

/* =========================
   POST
========================= */
Deno.test("DxHttp POST request", async () => {
  const { server, port } = startMockServer();

  try {
    const client = createClient(port);

    const res = await client.post("/post", {
      hello: "world",
    });

    assertEquals(res.data.method, "POST");
    assertEquals(res.data.body.hello, "world");
  } finally {
    server.shutdown();
  }
});

/* =========================
   PATCH
========================= */
Deno.test("DxHttp PATCH request", async () => {
  const { server, port } = startMockServer();

  try {
    const client = createClient(port);

    const res = await client.patch("/patch", {
      name: "updated",
    });

    assertEquals(res.data.method, "PATCH");
    assertEquals(res.data.body.name, "updated");
  } finally {
    server.shutdown();
  }
});

/* =========================
   DELETE
========================= */
Deno.test("DxHttp DELETE request", async () => {
  const { server, port } = startMockServer();

  try {
    const client = createClient(port);

    const res = await client.delete("/delete");

    assertEquals(res.data.method, "DELETE");
    assertEquals(res.data.ok, true);
  } finally {
    server.shutdown();
  }
});
