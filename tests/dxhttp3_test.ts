// dxhttp3_test.ts
import { assertEquals } from "@std/assert";
import { DxHttp } from "../client/dxhttp.ts";
import { startMockServer } from "./_mock_server.ts";

function createClient(baseURL: string) {
  return new DxHttp({ baseURL, timeout: 3000 });
}

// 辅助函数：处理错误类型
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/* =========================
   GET 测试
========================= */
Deno.test("DxHttp GET request", async () => {
  const { server, baseURL } = startMockServer();

  try {
    const client = createClient(baseURL);
    const res = await client.get("/get");

    assertEquals(res.status, 200);
    assertEquals(res.msg, true);
    assertEquals(res.data.method, "GET");
    assertEquals(res.data.ok, true);
    assertEquals(res.data.path, "/get");
  } finally {
    server.shutdown();
  }
});

Deno.test("DxHttp GET request with query parameters", async () => {
  const { server, baseURL } = startMockServer();

  try {
    const client = createClient(baseURL);
    const res = await client.get("/get-with-params?name=John&age=30");

    assertEquals(res.status, 200);
    assertEquals(res.data.params.name, "John");
    assertEquals(res.data.params.age, "30");
  } finally {
    server.shutdown();
  }
});

/* =========================
   POST 测试
========================= */
Deno.test("DxHttp POST request", async () => {
  const { server, baseURL } = startMockServer();

  try {
    const client = createClient(baseURL);
    const testData = { hello: "world", number: 42 };
    const res = await client.post("/post", testData);

    assertEquals(res.status, 200);
    assertEquals(res.data.method, "POST");
    assertEquals(res.data.body.hello, "world");
    assertEquals(res.data.body.number, 42);
  } finally {
    server.shutdown();
  }
});

Deno.test("DxHttp POST request with custom headers", async () => {
  const { server, baseURL } = startMockServer();

  try {
    const client = createClient(baseURL);
    const testData = { name: "John" };
    const res = await client.post("/post-with-headers", testData, {
      headers: {
        "X-Custom": "custom-value",
      },
    });

    assertEquals(res.status, 200);
    assertEquals(res.data.headers["x-custom"], "custom-value");
  } finally {
    server.shutdown();
  }
});

/* =========================
   PUT 测试
========================= */
Deno.test("DxHttp PUT request", async () => {
  const { server, baseURL } = startMockServer();

  try {
    const client = createClient(baseURL);
    const testData = { id: 1, name: "Updated Name" };
    const res = await client.put("/put", testData);

    assertEquals(res.status, 200);
    assertEquals(res.data.method, "PUT");
    assertEquals(res.data.body.id, 1);
    assertEquals(res.data.body.name, "Updated Name");
  } finally {
    server.shutdown();
  }
});

/* =========================
   PATCH 测试
========================= */
Deno.test("DxHttp PATCH request", async () => {
  const { server, baseURL } = startMockServer();

  try {
    const client = createClient(baseURL);
    const testData = { name: "Patched Name" };
    const res = await client.patch("/patch", testData);

    assertEquals(res.status, 200);
    assertEquals(res.data.method, "PATCH");
    assertEquals(res.data.body.name, "Patched Name");
  } finally {
    server.shutdown();
  }
});

/* =========================
   DELETE 测试
========================= */
Deno.test("DxHttp DELETE request", async () => {
  const { server, baseURL } = startMockServer();

  try {
    const client = createClient(baseURL);
    const res = await client.delete("/delete");

    assertEquals(res.status, 200);
    assertEquals(res.data.method, "DELETE");
    assertEquals(res.data.ok, true);
  } finally {
    server.shutdown();
  }
});

Deno.test("DxHttp DELETE request with ID parameter", async () => {
  const { server, baseURL } = startMockServer();

  try {
    const client = createClient(baseURL);
    const res = await client.delete("/delete-with-id?id=123");

    assertEquals(res.status, 200);
    assertEquals(res.data.id, "123");
  } finally {
    server.shutdown();
  }
});

/* =========================
   错误处理测试 - 修复版本
========================= */
Deno.test("DxHttp handles 404 error", async () => {
  const { server, baseURL } = startMockServer();

  try {
    const client = createClient(baseURL);

    try {
      await client.get("/not-exists");
      throw new Error("Expected error was not thrown");
    } catch (error) {
      // 使用类型守卫检查 error 类型
      if (isError(error)) {
        assertEquals(error.message, "Request failed with HTTP status 404");
      } else {
        throw new Error("Unexpected error type");
      }
    }
  } finally {
    server.shutdown();
  }
});

Deno.test("DxHttp handles 500 error", async () => {
  const { server, baseURL } = startMockServer();

  try {
    const client = createClient(baseURL);

    try {
      await client.get("/error");
      throw new Error("Expected error was not thrown");
    } catch (error) {
      if (isError(error)) {
        assertEquals(error.message, "Request failed with HTTP status 500");
      } else {
        throw new Error("Unexpected error type");
      }
    }
  } finally {
    server.shutdown();
  }
});

/* =========================
   超时测试 - 修复版本
========================= */
Deno.test("DxHttp handles timeout", async () => {
  const { server, baseURL } = startMockServer();

  try {
    const client = new DxHttp({
      baseURL,
      timeout: 100, // 100ms 超时
    });

    try {
      await client.get("/timeout");
      throw new Error("Expected timeout error was not thrown");
    } catch (error) {
      if (isError(error)) {
        assertEquals(error.name, "RequestTimeoutError");
        assertEquals(error.message, "Request timeout after 100ms");
      } else {
        throw new Error("Unexpected error type");
      }
    }
  } finally {
    server.shutdown();
  }
});

/* =========================
   批量请求测试
========================= */
Deno.test("DxHttp handles multiple requests", async () => {
  const { server, baseURL } = startMockServer();

  try {
    const client = createClient(baseURL);

    const results = await Promise.all([
      client.get("/get"),
      client.post("/post", { test: "data" }),
      client.delete("/delete"),
    ]);

    assertEquals(results.length, 3);
    assertEquals(results[0].data.method, "GET");
    assertEquals(results[1].data.method, "POST");
    assertEquals(results[2].data.method, "DELETE");
  } finally {
    server.shutdown();
  }
});

/* =========================
   Header 测试
========================= */
Deno.test("DxHttp uses default headers", async () => {
  const { server, baseURL } = startMockServer();

  try {
    const client = new DxHttp({
      baseURL,
      headers: {
        "X-Default": "default-value",
      },
    });

    const res = await client.post("/post-with-headers", { test: "data" }, {
      headers: {
        "X-Custom": "custom-value",
      },
    });

    // 验证默认 header 和自定义 header 都发送了
    assertEquals(res.data.headers["x-custom"], "custom-value");
  } finally {
    server.shutdown();
  }
});

console.log("🧪 All tests ready!");
