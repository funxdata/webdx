# webdx

**Web Data Exchange Framework** —— 基于 Deno 与 Web 标准的数据交换 /
数据存储库。

webdx 把 Web 应用里最常见的四类数据通道收敛成一个小型、无框架依赖的 TypeScript
工具集：

| 模块   | 入口                      | 用途                                   | 运行时依赖               |
| ------ | ------------------------- | -------------------------------------- | ------------------------ |
| HTTP   | `@funxdata/webdx/dxhttp`  | REST / 本地 FFI 服务调用               | `fetch`                  |
| SSE    | `@funxdata/webdx/dxsse`   | 服务端事件流订阅                       | `fetch` + WHATWG Streams |
| Socket | `@funxdata/webdx/dxsoket` | 长连接任务与实时消息                   | `WebSocket`              |
| Tools  | `@funxdata/webdx/tools`   | 带过期的 localStorage 缓存、日期格式化 | Web Storage              |
| Types  | `@funxdata/webdx/types`   | 公共类型                               | —                        |

设计目标：

- **Deno 原生**：直接运行 TypeScript，不需要构建步骤，通过 JSR 分发。
- **Web 标准**：只依赖
  `fetch`、`ReadableStream`、`WebSocket`、`localStorage`，不绑定 UI 框架。
- **面向数据交换**：HTTP 取数、SSE 订阅、WebSocket 任务，共用一套基址 / 错误 /
  重连约定。
- **可测试**：SSE 可注入 `fetch`，Socket 可注入 `WebSocket`
  构造器，测试不需要真实服务。

> 详细文档见 [`docs/`](./docs/index.md)，其中 [Deno 使用指南](./docs/deno.md)
> 覆盖安装、权限、JSR 发布、Deno Deploy 与常见问题。

---

## 目录

- [安装](#安装)
- [快速开始](#快速开始)
- [运行时兼容性](#运行时兼容性)
- [模块与导出](#模块与导出)
- [数据交换协议](#数据交换协议)
- [开发](#开发)
- [测试](#测试)
- [发布](#发布)
- [已知限制](#已知限制)
- [License](#license)

---

## 安装

### 使用 `deno add`（推荐）

```bash
deno add jsr:@funxdata/webdx
```

命令会在当前项目的 `deno.json` 中写入：

```json
{
  "imports": {
    "@funxdata/webdx": "jsr:@funxdata/webdx@^0.1.2"
  }
}
```

之后可以直接使用主入口和子路径：

```ts
import { DxHttp } from "@funxdata/webdx/dxhttp";
import { DxSse, fetchEventSource } from "@funxdata/webdx/dxsse";
import { DxSocket } from "@funxdata/webdx/dxsoket";
import { DxDate, Storage } from "@funxdata/webdx/tools";
```

子路径由 JSR 的 `exports` 字段解析，**不需要**在 `imports` 中逐个声明。

### 手动配置 `deno.json`

```json
{
  "imports": {
    "@funxdata/webdx": "jsr:@funxdata/webdx@^0.1.2"
  },
  "compilerOptions": {
    "lib": ["deno.ns", "dom", "esnext"]
  }
}
```

`dom` 不是库本身的要求（SSE 实现不依赖 DOM
类型），但如果你同时编写浏览器端代码，加上它更方便。

### 直接使用 JSR URL

不经过 `deno.json`，适合脚本或一次性验证：

```ts
import { DxHttp } from "jsr:@funxdata/webdx@0.1.2/dxhttp";
```

### 权限

`deno run` 默认没有网络权限。HTTP、SSE、WebSocket 都需要 `--allow-net`：

```bash
deno run --allow-net main.ts
```

`Storage` 需要宿主提供 `localStorage`（浏览器、Deno Deploy，或带 `--location` 的
Deno 进程），详见
[Deno 指南 · Web Storage](./docs/deno.md#web-storage-与-localstorage)。

---

## 快速开始

### HTTP

```ts
import { DxHttp } from "@funxdata/webdx/dxhttp";

const http = new DxHttp({
  baseURL: "http://127.0.0.1:44944",
  timeout: 5000,
  headers: { "Content-Type": "application/json" },
});

const res = await http.get<{ code: number; data: unknown }>("/database");

console.log(res.status); // HTTP 状态码
console.log(res.msg); // 是否 2xx
console.log(res.data); // 按 Content-Type 自动解析后的数据
```

### SSE

```ts
import { DxSse, unwrapSseData } from "@funxdata/webdx/dxsse";

const sse = new DxSse("http://127.0.0.1:44944");

const done = sse.subscribe(
  {
    lib: "sys_info",
    symbol: "post_file_exists",
    args: { path: "README.md" },
    interval_ms: 200,
  },
  {
    onmessage: (message, payload) => {
      // message: { id, event, data, retry? }
      // payload: data 字段 JSON.parse 后的结果
      console.log(message.event, unwrapSseData(payload));
    },
  },
);

// 停止订阅
sse.close();
await done;
```

### Socket

```ts
import { DxSocket } from "@funxdata/webdx/dxsoket";

const socket = new DxSocket("ws://127.0.0.1:44944/soket", {
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
});

const taskId = "task-001";

await socket.bind(taskId, "libsoket_demo", (data) => {
  console.log("收到任务消息:", data);
});

await socket.send(taskId, { action: "getData" });
await socket.requestStatus();
await socket.remove(taskId);

socket.close();
```

### Tools

```ts
import { DxDate, Storage } from "@funxdata/webdx/tools";

// 缓存 60 秒
Storage.set("token", "abc", 60_000);
const token = Storage.get("token");

// 日期格式化
const now = new DxDate(Date.now());
console.log(now.format("YYYY-MM-DD HH:mm:ss"));
console.log(now.commnet_time());
```

---

## 运行时兼容性

| 能力                         | 浏览器 | Deno 2                                   | Deno Deploy | Node 22+                       |
| ---------------------------- | ------ | ---------------------------------------- | ----------- | ------------------------------ |
| `DxHttp`                     | ✅     | ✅                                       | ✅          | ✅                             |
| `fetchEventSource` / `DxSse` | ✅     | ✅                                       | ✅          | ✅（需全局 `fetch` + Streams） |
| `DxSocket`                   | ✅     | ✅                                       | ✅          | ✅（需全局 `WebSocket`）       |
| `Storage`                    | ✅     | ⚠️ 需要 `--location` 或 Web Storage 环境 | ✅          | ❌ 默认无 `localStorage`       |
| `DxDate`                     | ✅     | ✅                                       | ✅          | ✅                             |

- SSE 实现**不使用** `document` / `window`：页面可见性逻辑只在存在 `document`
  时启用。
- `DxSocket` 的 `autoConnect` 默认是 `true`，构造即连接；测试或服务端环境可设为
  `false`。
- Node 下使用 `Storage` 需要自行 polyfill `localStorage`，或改用其他持久化方案。

---

## 模块与导出

`deno.json` 中声明的入口：

| 子路径      | 文件                | 主要导出                                                                                                                                                         |
| ----------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./dxhttp`  | `client/dxhttp.ts`  | `DxHttp`                                                                                                                                                         |
| `./dxsse`   | `client/dxsse.ts`   | `fetchEventSource`、`DxSse`、`buildSseUrl`、`parseSseData`、`unwrapSseData`、`EventStreamContentType`、`getBytes` / `getLines` / `getMessages` / `formatMessage` |
| `./dxsoket` | `client/dxsoket.ts` | `DxSocket`、`normalizeServerMessage` 及协议类型                                                                                                                  |
| `./tools`   | `client/dxtools.ts` | `Storage`、`DxDate`                                                                                                                                              |
| `./types`   | `client/types.ts`   | HTTP / SSE / Socket / Tools 的公共类型                                                                                                                           |

各模块的完整 API 见：

- [HTTP 文档](./docs/http.md)
- [SSE 文档](./docs/sse.md)
- [Socket 文档](./docs/soket.md)
- [Tools 文档](./docs/tools.md)
- [数据交换协议](./docs/protocol.md)

---

## 数据交换协议

webdx 默认对接 `cyctron` 风格的数据交换服务（示例端口 `44944`）。

### SSE

```text
GET /sse?lib=<动态库>&symbol=<符号>&args=<JSON>&interval_ms=<毫秒>
Accept: text/event-stream
```

服务端返回：

```text
id: 1
event: post_file_exists
data: {"data":{"exists":true}}
```

`data` 既可能是 `{ "data": ... }`，也可能直接是业务对象；用 `unwrapSseData()`
统一取出。

### WebSocket

客户端命令：

```json
{ "cmd": "bind",   "uuid": "task-001", "lib": "libsoket_demo" }
{ "cmd": "msg",    "uuid": "task-001", "data": { "action": "getData" } }
{ "cmd": "status" }
{ "cmd": "remove", "uuid": "task-001" }
```

服务端回包：

```json
{ "type": "realtime", "data": { "action": "bind", "uuid": "task-001", "status": "success" } }
{ "type": "realtime", "data": { "action": "status", "uuid": "task-001", "status": "running" } }
{ "type": "msg", "uuid": "task-001", "data": { "value": 1 } }
{ "type": "system", "data": { "status": "ready" } }
```

同时兼容旧格式（`action` / `taskName` / `taskData` / `taskUID`）。完整说明见
[协议文档](./docs/protocol.md)。

---

## 开发

```bash
# 启动文档 / 演示站（需要 @funxdata/toolkit）
deno task view

# 生成静态站点
deno task pack

# 类型检查
deno check client/dxhttp.ts client/dxsse.ts client/dxsoket.ts client/dxtools.ts client/types.ts

# 代码风格
deno fmt --check client tests
deno lint client tests
```

> **当前分支状态**：仓库仍处于一次未完成的 merge 中，`deno.json` / `deno.lock` /
> `README.md` / `index.html` / `src/app.ts` 含冲突标记。此时上面的 `deno task`
> 与默认配置读取会失败，可临时使用：
>
> ```bash
> deno check --no-config client/dxsse.ts client/dxsoket.ts client/types.ts
> deno test --no-config --allow-net tests/sse_parse_test.ts tests/sse_req_test.ts \
>   tests/sse_client_test.ts tests/socket_protocol_test.ts \
>   tests/socket_test.ts tests/socket_reconnect_test.ts
> ```
>
> 冲突解决后应删除 `--no-config`。

---

## 测试

测试使用 Deno 内置的 `Deno.test`，不需要 Jest / Vitest：

```bash
deno test --allow-net tests/
```

重点测试文件：

| 文件                             | 覆盖范围                                                          |
| -------------------------------- | ----------------------------------------------------------------- |
| `tests/sse_parse_test.ts`        | SSE 字节流解析、分块、CRLF、UTF-8、消息拼接                       |
| `tests/sse_req_test.ts`          | `fetchEventSource` 与本地 mock 服务、重试、`last-event-id`、abort |
| `tests/sse_client_test.ts`       | `DxSse`、URL 构造、payload 解析、生命周期                         |
| `tests/socket_protocol_test.ts`  | 新旧 WebSocket 回包归一化                                         |
| `tests/socket_test.ts`           | 连接、bind/send/status/remove、消息分发、兼容 API                 |
| `tests/socket_reconnect_test.ts` | 断线重连、退避、超时、重新绑定                                    |

Socket 测试通过 `tests/_fake_websocket.ts` 注入 `WebSocket` 假实现，SSE 测试通过
`Deno.serve` 启动临时 HTTP 服务，**不依赖 44944 端口**。

---

## 发布

```bash
deno login
deno publish --dry-run
deno publish
```

发布前检查：

- `deno.json` 的 `name`、`version`、`license`、`exports`、`publish.include`。
- `deno task check` / `deno test` / `deno lint` 全部通过。
- README 与 `docs/` 中的示例使用当前版本的 API。

JSR 发布与 Deno Deploy 的详细步骤见 [Deno 使用指南](./docs/deno.md)。

---

## 已知限制

- `DxHttp` 在非 2xx 时抛出
  `Error("Request failed with HTTP status N")`，暂不暴露响应体（规划中的
  `DxHttpError` 会携带 `status` / `data`）。
- `DxHttpResponse.msg` 表示「是否 2xx」，后续版本可能改名为 `ok`。
- `DxHttp.setRequestErrorHook()` 目前只保存回调，尚未在请求失败时调用。
- `DxHttp` 的 `get` / `delete` 不接受查询参数对象；需要自行拼接 URL。
- `Storage` 直接依赖 `localStorage`，在 Node / 无 Web Storage 的 Deno
  进程中不可用。
- `DxSse` 不特殊处理 `data: [DONE]`，由调用方在 `onmessage` 中判断。
- `DxDate.format()` 只支持固定 pattern 列表（见
  [Tools 文档](./docs/tools.md)）。
- 仓库当前仍保留旧目录（`http/`、`sse/`、`soket/`、`tools/`、`types/`），清理计划见
  `todo/`。

---

## License

[MIT](./LICENSE)
