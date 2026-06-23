// cyctron_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { DxHttp } from "../client/http/request.ts";

const DATABASE_URL = "http://127.0.0.1:44944";
const DATABASE_PATH = "/database";
const timestamp = Date.now();

const client = new DxHttp({
  baseURL: DATABASE_URL,
  timeout: 5000,
  headers: {
    "Content-Type": "application/database",
  },
});

Deno.test("Create table", async () => {
  console.log("📤 Creating table...");
  
  const result = await client.post(DATABASE_PATH, {
    path: `./test_${timestamp}`,
    table: `users_${timestamp}`,
    schema: "id INTEGER PRIMARY KEY, name TEXT, age INTEGER",
  }, {
    headers: {
      "FFI-Symbol": "db_create",
    },
  });
  
  console.log("📥 Result:", result.data);
  assertEquals(result.status, 200);
  assertEquals(result.data.code, 200);
});

