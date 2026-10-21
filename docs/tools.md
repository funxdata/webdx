# Tools · `Storage` / `DxDate`

`@funxdata/webdx/tools` 提供两个轻量工具：

```ts
import { DxDate, Storage } from "@funxdata/webdx/tools";
```

## 目录

- [Storage](#storage)
- [DxDate](#dxdate)
- [内部工具](#内部工具)
- [示例](#示例)
- [测试](#测试)

---

## Storage

`Storage` 是 `localStorage` 的封装，支持过期时间。

### API

```ts
Storage.set(key, value, expired?): void
Storage.get(key): unknown | null
Storage.remove(key): void
Storage.clear(): void
```

| 方法                        | 说明                                |
| --------------------------- | ----------------------------------- |
| `set(key, value, expired?)` | 写入并记录时间；`expired` 单位毫秒  |
| `get(key)`                  | 读取；不存在或已过期返回 `null`     |
| `remove(key)`               | 删除单个键                          |
| `clear()`                   | 清空当前 origin 的所有 localStorage |

### 存储格式

内部写入的是 JSON 字符串：

```json
{
  "data": "hello",
  "time": 1760000000000,
  "expired": 60000
}
```

- `time` 是写入时的 `Date.now()`；
- `expired` 是相对过期时长（毫秒），不是绝对时间；
- `expired` 为 `undefined` 或 `0` 时不过期。

### 过期语义

```ts
Storage.set("token", "abc", 60_000); // 60 秒有效
Storage.get("token"); // "abc"
// 60 秒后
Storage.get("token"); // null（并自动删除）
```

判定条件是 `Date.now() - time > expired`，因此：

- 如果系统时间被回拨，可能延长有效期；
- `expired` 为负数时，下次读取立即过期。

### 值类型

值必须可 JSON 序列化：

```ts
Storage.set("user", { id: 1, name: "a" }); // ✅
Storage.set("date", new Date()); // ✅ 变成字符串
Storage.set("fn", () => {}); // ❌ 变成 {}
Storage.set("undefined", undefined); // ⚠️ 读回 undefined
```

读取返回值类型是 `unknown`，需要自行断言：

```ts
const user = Storage.get("user") as { id: number; name: string } | null;
```

### 环境要求

`Storage` 直接使用全局 `localStorage`：

| 环境                    | 可用性                       |
| ----------------------- | ---------------------------- |
| 浏览器                  | ✅                           |
| Deno（带 `--location`） | ✅                           |
| Deno Deploy             | ✅                           |
| Deno（无 origin）       | ❌ `localStorage` 可能不存在 |
| Node                    | ❌ 默认没有                  |

Deno 中启用：

```bash
deno run --location=https://example.com main.ts
```

不适合 `Storage` 的场景：大量数据、服务端持久化、跨设备同步。请使用数据库或 Deno
KV。

### 容量与性能

- 浏览器通常限制 5 MB 左右；
- 同步 API，频繁写入大对象会阻塞主线程；
- 同一 origin 下共享，注意键名冲突。

建议使用命名空间：

```ts
const ns = "webdx:";
Storage.set(`${ns}token`, "abc", 60_000);
```

---

## DxDate

`DxDate` 是日期格式化与相对判断的小工具。

### 创建

```ts
new DxDate(Date.now());
new DxDate("2026-10-21T12:00:00+08:00");
new DxDate(new Date());
```

构造时立即计算年、月、日、时、分、秒、星期，使用**本地时区**。

### `format(pattern)`

支持的 pattern（**固定列表**，不是任意模板）：

| pattern                 | 输出示例                |
| ----------------------- | ----------------------- |
| `"ss"`                  | `"05"`                  |
| `"mm:ss"`               | `"03:05"`               |
| `"HH:mm"`               | `"12:03"`               |
| `"HH:mm:ss"`            | `"12:03:05"`            |
| `"DD HH:mm:ss"`         | `"21 12:03:05"`         |
| `"MM-DD HH:mm:ss"`      | `"10-21 12:03:05"`      |
| `"YYYY-MM-DD HH:mm:ss"` | `"2026-10-21 12:03:05"` |
| `"YYYY-MM-DD HH:mm"`    | `"2026-10-21 12:03"`    |
| `"MM-DD HH:mm"`         | `"10-21 12:03"`         |
| `"YYYY-MM-DD HH"`       | `"2026-10-21 12"`       |
| `"YYYY-MM-DD"`          | `"2026-10-21"`          |
| `"YYYY年MM月DD日"`      | `"2026年10月21日"`      |

未知 pattern 会回退为 `"YYYY-MM-DD HH:mm:ss"`：

```ts
new DxDate(Date.now()).format("YYYY/MM/DD"); // "2026-10-21 12:03:05"
```

> 如果需要任意 pattern，建议使用 `Temporal`（Deno 支持）或
> `Intl.DateTimeFormat`。

### `is_same(unit)`

```ts
date.is_same("day"); // 是否今天
date.is_same("month"); // 是否本月
date.is_same("year"); // 是否今年
```

### `differ()`

与当前时间的差值（毫秒，可正可负）：

```ts
const diff = date.differ();
if (diff < 0) console.log("已过去", -diff, "ms");
else console.log("还有", diff, "ms");
```

### `commnet_time()`

（方法名原始拼写如此）按「今天 / 今年 / 更早」选择格式：

| 条件 | 格式               |
| ---- | ------------------ |
| 今天 | `HH:mm`            |
| 今年 | `MM-DD HH:mm`      |
| 更早 | `YYYY-MM-DD HH:mm` |

```ts
new DxDate(Date.now()).commnet_time(); // "12:03"
```

### 无效日期

```ts
new DxDate("not-a-date").format("YYYY-MM-DD");
// "NaN-NaN-NaN"
```

`DxDate` 当前没有 `isValid`，调用方需要自行判断输入。

---

## 内部工具

以下文件存在于 `client/`，但**未从 `tools` 入口导出**：

| 文件                   | 内容                        | 状态                                       |
| ---------------------- | --------------------------- | ------------------------------------------ |
| `client/tools/json.ts` | `isJSONSerializable(value)` | 可单独从内部路径导入，后续可能导出         |
| `client/utils/url.ts`  | URL 解析                    | 依赖未定义的 `debug` / `parse`，当前不可用 |

`isJSONSerializable` 的行为：

```ts
isJSONSerializable({ a: 1 }); // true
isJSONSerializable("text"); // true
isJSONSerializable(new Date()); // true（有 toJSON）
isJSONSerializable(new Map()); // false
isJSONSerializable(new FormData()); // false
isJSONSerializable(() => {}); // false
```

除非明确需要，建议不要依赖未导出的内部文件。

---

## 示例

### 缓存 token 并处理过期

```ts
import { Storage } from "@funxdata/webdx/tools";

const TOKEN_KEY = "webdx:token";

async function getToken(): Promise<string> {
  const cached = Storage.get(TOKEN_KEY) as string | null;
  if (cached) return cached;

  const res = await fetch("/api/token");
  const token = await res.text();
  Storage.set(TOKEN_KEY, token, 10 * 60_000); // 10 分钟
  return token;
}

function logout() {
  Storage.remove(TOKEN_KEY);
}
```

### 相对时间显示

```ts
import { DxDate } from "@funxdata/webdx/tools";

function timeAgo(value: string | number | Date): string {
  const date = new DxDate(value);
  const diff = date.differ();

  if (Math.abs(diff) < 60_000) return "刚刚";
  if (date.is_same("day")) return date.format("HH:mm");
  if (date.is_same("year")) return date.format("MM-DD HH:mm");
  return date.format("YYYY-MM-DD");
}
```

---

## 测试

`Storage` 依赖 `localStorage`。在 Deno 中可以用最小 polyfill 测试：

```ts
import { assertEquals } from "jsr:@std/assert@^1";
import { Storage } from "@funxdata/webdx/tools";

Deno.test("Storage 过期", () => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };

  Storage.set("k", "v", 10);
  assertEquals(Storage.get("k"), "v");
  // 等待过期后 Storage.get("k") === null
});
```

`DxDate` 是纯计算，可以直接测试：

```ts
import { assertEquals } from "jsr:@std/assert@^1";
import { DxDate } from "@funxdata/webdx/tools";

Deno.test("DxDate format", () => {
  const date = new DxDate(new Date(2026, 9, 21, 12, 3, 5));
  assertEquals(date.format("YYYY-MM-DD"), "2026-10-21");
  assertEquals(date.format("HH:mm:ss"), "12:03:05");
});
```
