# SSE · `fetchEventSource` / `DxSse`

`@funxdata/webdx/dxsse` 提供 Server-Sent Events 的完整实现，分两层：

| 层   | 导出                                                                         | 适用场景                                                   |
| ---- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 低层 | `fetchEventSource`、`getBytes` / `getLines` / `getMessages`、`formatMessage` | 自定义请求、自定义解析、需要完全控制重连                   |
| 高层 | `DxSse`、`buildSseUrl`、`parseSseData`、`unwrapSseData`                      | 对接 webdx 数据交换服务，按 `lib` / `symbol` / `args` 订阅 |

```ts
import {
  buildSseUrl,
  DxSse,
  EventStreamContentType,
  fetchEventSource,
  parseSseData,
  unwrapSseData,
} from "@funxdata/webdx/dxsse";
```

## 目录

- [为什么不用原生 EventSource](#为什么不用原生-eventsource)
- [低层：fetchEventSource](#低层fetcheventsource)
- [解析工具](#解析工具)
- [高层：DxSse](#高层dxsse)
- [服务端返回格式](#服务端返回格式)
- [示例](#示例)
- [取消与清理](#取消与清理)
- [重连语义](#重连语义)
- [测试](#测试)
- [限制](#限制)

---

## 为什么不用原生 EventSource

浏览器原生 `EventSource`：

- 只能 GET，不能自定义请求头（无法携带 token）；
- 不能发送请求体；
- 重连策略不可控；
- 在 Deno / Node / Worker 中不存在。

`fetchEventSource` 用 `fetch` + `ReadableStream` 实现同等能力，并保持 SSE
规范解析：

- 支持任意 `RequestInit`（method、body、headers）；
- 可在浏览器、Deno、Node 22+、Worker 中运行；
- 支持 `AbortSignal`；
- 可完全控制重试；
- 自动处理 `id:` → `last-event-id`。

---

## 低层：fetchEventSource

```ts
await fetchEventSource(input, init);
```

### 参数

`input`：`RequestInfo | URL`，与 `fetch` 相同。

`init` 继承 `RequestInit`，并额外支持：

| 字段             | 类型                                                    | 默认                      | 说明                                                 |
| ---------------- | ------------------------------------------------------- | ------------------------- | ---------------------------------------------------- |
| `headers`        | `Record<string, string>`                                | `{}`                      | 未提供 `Accept` 时自动加 `Accept: text/event-stream` |
| `signal`         | `AbortSignal`                                           | —                         | 触发后终止请求并 **resolve**                         |
| `onopen`         | `(response) => void \| Promise<void>`                   | 校验状态码与 content-type | 可在其中抛错来拒绝响应                               |
| `onmessage`      | `(message: EventSourceMessage) => void`                 | —                         | 每条消息调用一次                                     |
| `onclose`        | `() => void`                                            | —                         | 流正常结束时调用                                     |
| `onerror`        | `(err: unknown) => number \| null \| undefined \| void` | —                         | 错误 / 重试控制                                      |
| `openWhenHidden` | `boolean`                                               | `false`                   | `true` 时页面隐藏也保持连接                          |
| `fetch`          | `typeof fetch`                                          | `globalThis.fetch`        | 自定义 fetch（测试 / 代理）                          |

其余字段（`method`、`body`、`credentials` 等）原样传给 `fetch`。

### 返回值

返回 `Promise<void>`：

- 流正常结束 → resolve；
- `signal` 中止 → resolve；
- `onerror` 主动抛错 → reject（错误为 `onerror` 抛出的值）；
- 无 `fetch` 环境 → reject。

### `onmessage` 的消息结构

```ts
interface EventSourceMessage {
  id: string; // id: 字段
  event: string; // event: 字段，默认为 ""
  data: string; // data: 字段，多行以 \n 拼接
  retry?: number; // retry: 字段，毫秒
}
```

`data` 始终是字符串。需要对象时用 `parseSseData()` 或自行 `JSON.parse`。

### 默认 `onopen` 行为

```ts
function defaultOnOpen(response: Response): void {
  if (!response.ok) {
    throw new Error(`SSE request failed with HTTP status ${response.status}`);
  }
  const contentType = response.headers.get("content-type");
  if (!contentType?.startsWith("text/event-stream")) {
    throw new Error(
      `Expected content-type to be text/event-stream, Actual: ${contentType}`,
    );
  }
}
```

自定义 `onopen` 会**完全替换**默认校验。常见的宽松写法：

```ts
onopen: ((response) => {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  // 接受 text/event-stream 之外的类型
});
```

---

## 解析工具

导出的底层函数可用于自定义流处理：

```ts
import {
  formatMessage,
  getBytes,
  getLines,
  getMessages,
} from "@funxdata/webdx/dxsse";

await getBytes(
  response.body!,
  getLines(
    getMessages(
      (id) => console.log("id", id),
      (retry) => console.log("retry", retry),
      (message) => console.log(message),
    ),
  ),
);
```

| 函数                                     | 作用                                        |
| ---------------------------------------- | ------------------------------------------- |
| `getBytes(stream, onChunk)`              | 持续读取 `ReadableStream<Uint8Array>`       |
| `getLines(onLine)`                       | 字节块 → 行，处理 `\n`、`\r`、`\r\n` 与跨块 |
| `getMessages(onId, onRetry, onMessage?)` | 行 → `EventSourceMessage`                   |
| `formatMessage(message)`                 | 把对象编码为 SSE 文本（测试 / 模拟服务端）  |

`formatMessage` 示例：

```ts
formatMessage({ id: "1", event: "tick", data: "hello" });
// "id: 1\nevent: tick\ndata: hello\n\n"
```

### 解析细节

- 注释行（以 `:` 开头）被忽略；
- 没有字段名的行被忽略；
- `data` 多行以 `\n` 拼接；
- 空行表示消息结束；
- `retry:` 只接受整数；
- 字段值前的单个空格会被去掉；
- `id:` 为空时，重连不再携带 `last-event-id`。

---

## 高层：DxSse

`DxSse` 面向 webdx 数据交换服务，负责：

- 根据 `lib` / `symbol` / `args` 构造 `/sse?...` URL；
- 自动 `JSON.parse` 消息的 `data`；
- 管理多个订阅的生命周期；
- 统一取消。

### 创建

```ts
const sse = new DxSse("http://127.0.0.1:44944");
```

第二个参数是默认 `FetchEventSourceInit`（`headers`、`fetch`、`openWhenHidden`
等）：

```ts
const sse = new DxSse("http://127.0.0.1:44944", {
  headers: { Authorization: "Bearer abc" },
  openWhenHidden: true,
});
```

### 查询参数

```ts
interface SseQuery {
  lib: string; // 动态库，例如 "sys_info"
  symbol: string; // 符号，例如 "post_file_exists"
  args?: unknown; // 对象会被 JSON.stringify
  interval_ms?: number; // 服务端轮询间隔
  [key: string]: unknown;
}
```

`buildSseUrl` 的编码规则：

- `baseURL` 末尾的 `/` 去掉，拼接 `/sse`；
- `args` 是字符串时原样放入，否则 `JSON.stringify`；
- 其余参数用 `URLSearchParams` 编码；
- `undefined` / `null` 参数跳过。

```ts
buildSseUrl("http://127.0.0.1:44944", {
  lib: "sys_info",
  symbol: "post_file_exists",
  args: { path: "README.md" },
  interval_ms: 200,
});
// http://127.0.0.1:44944/sse?lib=sys_info&symbol=post_file_exists&args=%7B%22path%22%3A%22README.md%22%7D&interval_ms=200
```

### 订阅

```ts
const done = sse.subscribe(query, handlers);
```

`handlers`：

| 字段        | 签名                                           | 说明                              |
| ----------- | ---------------------------------------------- | --------------------------------- |
| `onopen`    | `(response) => void \| Promise<void>`          | 同底层                            |
| `onmessage` | `(message, payload) => void`                   | `payload` 是 `data` JSON 解析结果 |
| `onevent`   | `(event, message, payload) => void`            | 仅当消息带 `event:` 时            |
| `onclose`   | `() => void`                                   | 流结束                            |
| `onerror`   | `(err) => number \| null \| undefined \| void` | 同底层                            |
| `signal`    | `AbortSignal`                                  | 外部取消                          |

返回值：`Promise<void>`，语义与 `fetchEventSource` 相同。

### payload 解析

```ts
parseSseData('{"data":{"exists":true}}');
// { data: { exists: true } }

parseSseData("hello");
// "hello"（非 JSON 原样返回）

parseSseData("");
// null

unwrapSseData({ data: { exists: true } });
// { exists: true }

unwrapSseData({ exists: true });
// { exists: true }
```

服务端可能把业务数据包在 `data` 字段里，也可能直接返回对象；`unwrapSseData`
兼容两种。

### 生命周期

```ts
sse.activeCount; // 当前订阅数
sse.isClosed; // 是否已 close

sse.close(); // 中止全部订阅；之后的 subscribe 会 reject
```

`close()` 之后实例不可复用；需要重新订阅时创建新的 `DxSse`。

---

## 服务端返回格式

```text
id: 1
event: post_file_exists
data: {"data":{"exists":true}}

id: 2
event: post_file_exists
data: {"data":{"exists":false}}
```

服务端必须返回：

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
```

事件名（`event:`）通常等于 `symbol`，但不强制。`DxSse` 会把事件名放进
`message.event`。

---

## 示例

### 1. 查询文件是否存在

```ts
import { DxSse, unwrapSseData } from "@funxdata/webdx/dxsse";

const sse = new DxSse("http://127.0.0.1:44944");

await sse.subscribe(
  {
    lib: "sys_info",
    symbol: "post_file_exists",
    args: { path: "README.md" },
    interval_ms: 200,
  },
  {
    onmessage: (message, payload) => {
      const data = unwrapSseData(payload);
      console.log(message.event, data);
    },
    onerror: (err) => {
      console.error("SSE error:", err);
      return 1000; // 1 秒后重试
    },
  },
);
```

### 2. 只消费一次

服务端可能持续推送。只想要第一条时：

```ts
const controller = new AbortController();

await sse.subscribe(query, {
  signal: controller.signal,
  onmessage: (_message, payload) => {
    console.log(payload);
    controller.abort();
  },
});
```

### 3. 带鉴权头

```ts
const sse = new DxSse("https://api.example.com", {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 4. 流式 AI 输出（OpenAI 兼容）

```ts
import { fetchEventSource } from "@funxdata/webdx/dxsse";

await fetchEventSource("https://api.example.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: "deepseek-chat",
    messages: [{ role: "user", content: "你好" }],
    stream: true,
  }),
  onmessage: (message) => {
    if (message.data === "[DONE]") return;
    const chunk = JSON.parse(message.data);
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) process.stdout.write(delta);
  },
});
```

> 库不特殊处理 `[DONE]`，由调用方判断。

### 5. 用 `fetch` 注入测试

```ts
let calls = 0;
const fakeFetch = (() => {
  calls += 1;
  return Promise.resolve(
    new Response("data: hello\n\n", {
      headers: { "content-type": "text/event-stream" },
    }),
  );
}) as typeof fetch;

await fetchEventSource("http://test/sse", {
  fetch: fakeFetch,
  onmessage: (m) => console.log(m.data),
});
```

---

## 取消与清理

三种取消方式：

```ts
// 1. 外部 signal
const controller = new AbortController();
sse.subscribe(query, { signal: controller.signal });
controller.abort();

// 2. 关闭整个 DxSse
sse.close();

// 3. 在 onmessage 中主动取消
onmessage: (() => controller.abort());
```

取消后：

- `subscribe()` 的 Promise resolve；
- 底层请求被 abort；
- 不再重连；
- `activeCount` 减一。

页面卸载时建议：

```ts
globalThis.addEventListener("beforeunload", () => sse.close());
```

---

## 重连语义

`fetchEventSource` 只在**错误**时重试：

| 情况                    | 行为                            |
| ----------------------- | ------------------------------- |
| 流正常结束              | `onclose()`，resolve，不重试    |
| `response.ok === false` | 进入 `onerror`，默认 1 秒后重试 |
| content-type 不符       | 进入 `onerror`，默认 1 秒后重试 |
| 网络中断 / 流错误       | 进入 `onerror`，默认 1 秒后重试 |
| `signal` abort          | resolve，不重试                 |
| `onerror` 抛错          | reject，停止                    |

`onerror` 返回值：

```ts
onerror: ((err) => {
  if (fatal(err)) throw err; // 停止
  return 3000; // 3 秒后重试
  // return undefined;         // 使用服务端 retry: 或默认 1000ms
});
```

重试时会自动携带最近一次 `id:` 作为 `last-event-id` 请求头。

---

## 测试

仓库测试文件：

| 文件                       | 内容                                                           |
| -------------------------- | -------------------------------------------------------------- |
| `tests/sse_parse_test.ts`  | 行解析、消息解析、分块、CRLF、UTF-8、`formatMessage`           |
| `tests/sse_req_test.ts`    | 请求、重试、`last-event-id`、abort、content-type、自定义 fetch |
| `tests/sse_client_test.ts` | `DxSse`、URL 构造、payload、生命周期                           |

运行：

```bash
deno test --allow-net tests/sse_parse_test.ts tests/sse_req_test.ts tests/sse_client_test.ts
```

---

## 限制

- 不处理 `data: [DONE]`，由调用方判断。
- 默认 `onopen` 严格校验 `text/event-stream`；服务端类型不规范时需自定义
  `onopen`。
- `onerror` 返回 `null` 会回退到 `retry:` / 默认值；要停止请抛错。
- 每条消息都会触发 `onmessage`（包括没有 `data` 的空消息块），调用方需自行过滤。
- 没有内置的指数退避；需要时在 `onerror` 中实现。
