# HTTP · `DxHttp`

`@funxdata/webdx/dxhttp` 提供一个基于 `fetch` 的轻量 HTTP 客户端：统一
baseURL、请求头、超时、token，并按响应 `Content-Type` 自动解析。

```ts
import { DxHttp } from "@funxdata/webdx/dxhttp";
```

## 目录

- [创建客户端](#创建客户端)
- [方法](#方法)
- [响应结构](#响应结构)
- [请求处理细节](#请求处理细节)
- [响应解析](#响应解析)
- [Token 与授权](#token-与授权)
- [错误处理](#错误处理)
- [示例](#示例)
- [限制](#限制)

---

## 创建客户端

```ts
const http = new DxHttp({
  baseURL: "http://127.0.0.1:44944",
  timeout: 5000,
  headers: {
    "Content-Type": "application/json",
    "X-Client": "webdx",
  },
});
```

配置字段：

| 字段      | 类型                      | 说明                                       |
| --------- | ------------------------- | ------------------------------------------ |
| `baseURL` | `string?`                 | 基址。请求路径会拼在它后面                 |
| `headers` | `Record<string, string>?` | 默认请求头                                 |
| `timeout` | `number?`                 | 超时毫秒数；不传时底层默认 5000            |
| `method`  | `string?`                 | 保留字段，当前版本各方法自行决定 HTTP 方法 |

URL 拼接规则：

- `baseURL` 末尾的 `/` 会被去掉；
- `uri` 不以 `/` 开头时自动补 `/`；
- `baseURL` 为空时直接使用 `uri`（可以是绝对 URL）。

```ts
new DxHttp({ baseURL: "https://api.example.com/v1" }).get("/user/self");
// https://api.example.com/v1/user/self
```

---

## 方法

所有方法返回 `Promise<DxHttpResponse<T>>`。

| 方法     | 签名                           | 请求体 |
| -------- | ------------------------------ | ------ |
| `get`    | `get<T>(uri, config?)`         | 无     |
| `post`   | `post<T>(uri, body, config?)`  | 有     |
| `put`    | `put<T>(uri, body, config?)`   | 有     |
| `patch`  | `patch<T>(uri, body, config?)` | 有     |
| `delete` | `delete<T>(uri, config?)`      | 无     |

`config` 类型为 `DxHttpRequestConfig`：

```ts
type DxHttpRequestConfig = {
  baseURL?: string;
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
};
```

> 当前实现中 `get` / `delete` 不会发送请求体，也不支持 `params`
> 查询对象；需要查询参数时自行拼接：
>
> ```ts
> await http.get(`/search?q=${encodeURIComponent(keyword)}`);
> ```

---

## 响应结构

```ts
type DxHttpResponse<T> = {
  /** 解析后的响应数据 */
  data: T;
  /** HTTP 状态码 */
  status: number;
  /** 是否 2xx */
  msg: boolean;
};
```

```ts
const res = await http.get<{ code: number; data: string[] }>("/list");
if (res.msg) {
  console.log(res.data.data);
}
```

> `msg` 的命名在后续版本可能改为 `ok`，语义不变。

---

## 请求处理细节

### 请求头合并

优先级（后者覆盖前者）：

1. 构造函数的 `headers`
2. 单次请求的 `config.headers`
3. 若开启授权，`setToken()` 设置的 token 头

如果最终没有任何 `Content-Type`（大小写不敏感），会自动补
`Content-Type: application/json`。

### 请求体序列化

- `body` 是字符串：原样发送；
- 其他值：`JSON.stringify(body)`；
- `GET` / `HEAD` 不发送 body。

> 由于实现会 `JSON.stringify`，**不要**用它上传
> `FormData`、`Blob`、`ArrayBuffer`；这些场景请直接使用 `fetch`。

### 超时

`timeout` 通过 `AbortController` 实现。超时后抛出：

```ts
class RequestTimeoutError extends Error {
  name = "RequestTimeoutError";
  message = "Request timeout after <timeout>ms";
}
```

捕获时按名称判断（`RequestTimeoutError` 目前未从包入口导出）：

```ts
try {
  await http.get("/slow");
} catch (error) {
  if (error instanceof Error && error.name === "RequestTimeoutError") {
    // 超时
  }
}
```

---

## 响应解析

根据响应头的 `Content-Type` 自动选择解析方式：

| Content-Type                    | 解析为                   |
| ------------------------------- | ------------------------ |
| `application/json`              | `response.json()`        |
| `text/*`、`application/html`    | `response.text()`        |
| `application/octet-stream`      | `response.arrayBuffer()` |
| `image/*`、`video/*`、`audio/*` | `response.blob()`        |
| 缺失或其他                      | 默认 `response.json()`   |

如果服务端返回了非 JSON 内容但 `Content-Type` 是
JSON（常见于错误页），`response.json()` 会抛
`SyntaxError`；这是底层行为，需要在调用方处理。

---

## Token 与授权

```ts
const http = new DxHttp({ baseURL: "https://api.example.com" });

http.setToken("Authorization", "Bearer abc");
http.setAuthorize(true);

await http.get("/user/self");
// 实际请求头包含 Authorization: Bearer abc
```

- `setToken(key, token)` 设置一个头。**注意**：当前实现每次调用会替换整个 token
  缓存，重复调用只保留最后一个 key。
- `setAuthorize(false)` 后 token 不再附加。
- `setRequestErrorHook(fn)` 目前只保存回调，尚未在请求失败时调用（见 README
  已知限制）。

推荐的替代做法：把 token 直接放进构造函数的 `headers`，或用单次请求的
`config.headers`。

---

## 错误处理

### 非 2xx

底层在 `response.ok === false` 时抛出：

```ts
throw new Error(`Request failed with HTTP status ${res.status}`);
```

响应体在抛错前被读取但**不会**附加到错误对象上。需要错误详情时，目前只能：

- 捕获错误并检查 `message`；
- 或直接使用 `fetch`。

规划中的 `DxHttpError` 会带上 `status`、`data`、`headers`。

### 网络错误

`fetch` 自身的错误（DNS、连接拒绝、CORS）会原样抛出。

### 超时

见上文 `RequestTimeoutError`。

### 示例

```ts
try {
  const res = await http.get("/user/self");
  return res.data;
} catch (error) {
  if (error instanceof Error && error.name === "RequestTimeoutError") {
    console.error("请求超时");
  } else if (error instanceof Error) {
    console.error(error.message);
  }
  throw error;
}
```

---

## 示例

### GET

```ts
const http = new DxHttp({
  baseURL: "https://user.funxdata.com/v1",
  timeout: 5000,
});

const profile = await http.get<{ name: string }>("/user/self");
console.log(profile.data);
```

### POST JSON

```ts
const result = await http.post<{ code: number }>("/database", {
  action: "create",
  table: "users",
});
```

### 本地 FFI 服务（44944）

```ts
const http = new DxHttp({
  baseURL: "http://127.0.0.1:44944",
  timeout: 5000,
  headers: { "Content-Type": "application/database" },
});

const result = await http.post(
  "/database",
  {
    path: "./test",
    table: "users",
    schema: "id INTEGER PRIMARY KEY, name TEXT",
  },
  {
    headers: { "FFI-Symbol": "db_create" },
  },
);
```

### 每次请求单独覆盖超时和头

```ts
await http.get("/slow", {
  timeout: 30_000,
  headers: { "X-Trace-Id": crypto.randomUUID() },
});
```

---

## 限制

| 限制                   | 说明                                             |
| ---------------------- | ------------------------------------------------ |
| 无查询参数对象         | `get` / `delete` 需自行拼接 query                |
| 无 FormData / 文件上传 | body 会被 `JSON.stringify`                       |
| 非 2xx 不暴露响应体    | 抛出的 `Error` 只有状态码                        |
| `msg` 字段命名         | 语义是 `ok`，后续可能改名                        |
| token 单 key           | `setToken` 会覆盖之前的 key                      |
| error hook 未生效      | `setRequestErrorHook` 仅保存回调                 |
| 无拦截器               | 旧目录 `http/interceptors.ts` 未迁移进 `client/` |

---

## 测试建议

```ts
import { assertEquals } from "jsr:@std/assert@^1";
import { DxHttp } from "@funxdata/webdx/dxhttp";

Deno.test("GET", async () => {
  const server = Deno.serve(
    { port: 0, hostname: "127.0.0.1", onListen: () => {} },
    () => Response.json({ ok: true }),
  );

  try {
    const port = (server.addr as Deno.NetAddr).port;
    const http = new DxHttp({ baseURL: `http://127.0.0.1:${port}` });
    const res = await http.get<{ ok: boolean }>("/");
    assertEquals(res.data.ok, true);
  } finally {
    await server.shutdown();
  }
});
```

仓库中的 `tests/dxhttp3_test.ts` 覆盖了方法、header、错误与超时。
