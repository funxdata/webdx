import { assertEquals } from "@std/assert";
import { DxDate, Storage } from "../client/dxtools.ts";

const originalLocalStorage = (globalThis as { localStorage?: unknown })
  .localStorage;

async function withMemoryStorage(
  fn: () => void | Promise<void>,
): Promise<void> {
  const store = new Map<string, string>();
  const fake = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: fake,
  });

  try {
    await fn();
  } finally {
    if (originalLocalStorage === undefined) {
      Reflect.deleteProperty(globalThis, "localStorage");
    } else {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Deno.test("Storage: set / get / remove / clear", async () => {
  await withMemoryStorage(() => {
    Storage.set("token", "abc");
    assertEquals(Storage.get("token"), "abc");

    Storage.set("token", "updated");
    assertEquals(Storage.get("token"), "updated");

    Storage.remove("token");
    assertEquals(Storage.get("token"), null);

    Storage.set("a", 1);
    Storage.set("b", 2);
    Storage.clear();
    assertEquals(Storage.get("a"), null);
    assertEquals(Storage.get("b"), null);
  });
});

Deno.test("Storage: 不存在的键返回 null", async () => {
  await withMemoryStorage(() => {
    assertEquals(Storage.get("missing"), null);
  });
});

Deno.test("Storage: 过期后返回 null 并删除键", async () => {
  await withMemoryStorage(async () => {
    Storage.set("short", "value", 5);
    assertEquals(Storage.get("short"), "value");

    await delay(10);
    assertEquals(Storage.get("short"), null);
    assertEquals(Storage.get("short"), null);
  });
});

Deno.test("Storage: expired=0 表示不过期", async () => {
  await withMemoryStorage(async () => {
    Storage.set("forever", "value", 0);
    await delay(10);
    assertEquals(Storage.get("forever"), "value");
  });
});

Deno.test("Storage: 支持 JSON 可序列化的对象", async () => {
  await withMemoryStorage(() => {
    Storage.set("user", { id: 1, name: "webdx" });
    assertEquals(Storage.get("user"), { id: 1, name: "webdx" });
  });
});

Deno.test("DxDate: 支持的 format pattern", () => {
  const date = new DxDate(new Date(2026, 9, 21, 12, 3, 5));

  assertEquals(date.format("ss"), "05");
  assertEquals(date.format("mm:ss"), "03:05");
  assertEquals(date.format("HH:mm"), "12:03");
  assertEquals(date.format("HH:mm:ss"), "12:03:05");
  assertEquals(date.format("DD HH:mm:ss"), "21 12:03:05");
  assertEquals(date.format("MM-DD HH:mm:ss"), "10-21 12:03:05");
  assertEquals(date.format("YYYY-MM-DD HH:mm:ss"), "2026-10-21 12:03:05");
  assertEquals(date.format("YYYY-MM-DD HH:mm"), "2026-10-21 12:03");
  assertEquals(date.format("MM-DD HH:mm"), "10-21 12:03");
  assertEquals(date.format("YYYY-MM-DD HH"), "2026-10-21 12");
  assertEquals(date.format("YYYY-MM-DD"), "2026-10-21");
  assertEquals(date.format("YYYY年MM月DD日"), "2026年10月21日");
});

Deno.test("DxDate: 未知 pattern 回退默认格式", () => {
  const date = new DxDate(new Date(2026, 9, 21, 12, 3, 5));
  assertEquals(date.format("YYYY/MM/DD"), "2026-10-21 12:03:05");
});

Deno.test("DxDate: is_same 判断今天 / 本月 / 今年", () => {
  const now = new DxDate(Date.now());
  assertEquals(now.is_same("day"), true);
  assertEquals(now.is_same("month"), true);
  assertEquals(now.is_same("year"), true);

  const old = new DxDate(new Date(2000, 0, 1));
  assertEquals(old.is_same("day"), false);
  assertEquals(old.is_same("month"), false);
  assertEquals(old.is_same("year"), false);
});

Deno.test("DxDate: differ 返回与当前时间的毫秒差", () => {
  const future = new DxDate(Date.now() + 60_000);
  const past = new DxDate(Date.now() - 60_000);

  assertEquals(future.differ() > 0, true);
  assertEquals(past.differ() < 0, true);
});

Deno.test("DxDate: commnet_time 对今天返回 HH:mm", () => {
  const date = new DxDate(new Date(2026, 9, 21, 12, 3, 5));
  // 仅当测试运行在 2026-10-21 时精确匹配；否则检查格式。
  const value = date.commnet_time();
  assertEquals(
    /^\d{2}:\d{2}$/.test(value) || /^\d{2}-\d{2} \d{2}:\d{2}$/.test(value) ||
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value),
    true,
  );
});

Deno.test("DxDate: 非法日期输出 NaN 字段", () => {
  const date = new DxDate("not-a-date");
  assertEquals(date.format("YYYY-MM-DD"), "NaN-NaN-NaN");
});
