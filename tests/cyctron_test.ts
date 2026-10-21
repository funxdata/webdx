// 集成测试：需要一个运行中的 cyctron FFI 服务。
//
// 启用方式：
//   CYCTRON_URL=http://127.0.0.1:44944 deno test --allow-net --allow-env tests/cyctron_test.ts
import { assertEquals } from "@std/assert";
import { DxHttp } from "../client/http/request.ts";

const DATABASE_URL = Deno.env.get("CYCTRON_URL") ?? "http://127.0.0.1:44944";
const DATABASE_PATH = "/database";
const timestamp = Date.now();
const enabled = Boolean(Deno.env.get("CYCTRON_URL"));

const client = new DxHttp({
  baseURL: DATABASE_URL,
  timeout: 5000,
  headers: {
    "Content-Type": "application/database",
  },
});

Deno.test({
  name: "Create table (requires CYCTRON_URL)",
  ignore: !enabled,
  fn: async () => {
    const result = await client.post(DATABASE_PATH, {
      path: `./test_${timestamp}`,
      table: `users_${timestamp}`,
      schema: "id INTEGER PRIMARY KEY, name TEXT, age INTEGER",
    }, {
      headers: {
        "FFI-Symbol": "db_create",
      },
    });

    assertEquals(result.status, 200);
    assertEquals(result.data.code, 200);
  },
});
