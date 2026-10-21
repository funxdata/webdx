# Deno 使用指南

本文只讲 **在 Deno 中** 安装、运行、测试和发布 webdx。协议细节见
[数据交换协议](./protocol.md)，各模块 API 见对应文档。

## 目录

- [为什么用 Deno](#为什么用-deno)
- [环境要求](#环境要求)
- [安装](#安装)
- [deno.json 配置详解](#denojson-配置详解)
- [导入方式](#导入方式)
- [权限模型](#权限模型)
- [运行时 API 依赖](#运行时-api-依赖)
- [Web Storage 与 localStorage](#web-storage-与-localstorage)
- [类型检查与编辑器](#类型检查与编辑器)
- [在 Deno 中测试](#在-deno-中测试)
- [deno task 脚本](#deno-task-脚本)
- [发布到 JSR](#发布到-jsr)
- [Deno Deploy](#deno-deploy)
- [在浏览器 / Node 中使用](#在浏览器--node-中使用)
- [常见问题](#常见问题)
- [最佳实践](#最佳实践)

---

## 为什么用 Deno

webdx 的发布形态就是为 Deno 设计的：

- 源码是 TypeScript，**不需要 `tsc` / 打包器**；`deno run` 直接执行。
- 通过 **JSR** 分发，版本、校验和、exports 都由 `deno.json` 描述。
- 运行时只需要 Web 标准 API（`fetch`、`ReadableStream`、`WebSocket`），没有 Node
  原生模块依赖。
- 测试直接用 `Deno.test`，`Deno.serve` 可以在测试里起临时服务。
- 权限是显式的：网络访问必须 `--allow-net`，不会静默联网。

---

## 环境要求

| 项目        | 要求                                          |
| ----------- | --------------------------------------------- |
| Deno        | **2.x**（推荐最新稳定版）                     |
| 网络权限    | HTTP / SSE / WebSocket 需要 `--allow-net`     |
| Web Storage | 仅 `Storage` 需要（见下文）                   |
| 编辑器      | 推荐 VS Code + Deno 官方扩展（使用 Deno LSP） |

检查版本：

```bash
deno --version
```

`deno check`、`deno test`、`deno publish` 在 2.x 均可用。

---

## 安装

### 1. 在项目中安装（推荐）

```bash
deno add jsr:@funxdata/webdx
```

执行后 `deno.json` 会增加一条 import：

```json
{
  "imports": {
    "@funxdata/webdx": "jsr:@funxdata/webdx@^1.0.0"
  }
}
```

同时会更新 `deno.lock`（如果项目启用了 lockfile）。提交 `deno.lock`
可以获得可复现的依赖解析。

### 2. 手动写 `deno.json`

不使用 `deno add` 时，直接编辑：

```json
{
  "imports": {
    "@funxdata/webdx": "jsr:@funxdata/webdx@^1.0.0"
  }
}
```

### 3. 直接 URL（脚本 / 试用）

```ts
import { DxHttp } from "jsr:@funxdata/webdx@1.0.0/dxhttp";
```

固定完整版本号可以避免语义化版本漂移；适合一次性脚本或不方便写 `deno.json`
的场景。

### 不要使用 `deno install`

`deno install` 用于安装**可执行命令**（生成 shim），不是安装库。安装 webdx
请使用 `deno add` 或直接 import。

---

## deno.json 配置详解

一个包含 webdx 的最小 `deno.json`：

```json
{
  "imports": {
    "@funxdata/webdx": "jsr:@funxdata/webdx@^1.0.0"
  },
  "compilerOptions": {
    "lib": ["deno.ns", "dom", "esnext"]
  },
  "tasks": {
    "start": "deno run --allow-net main.ts",
    "test": "deno test --allow-net tests/"
  }
}
```

### `imports`

只需要声明包根：

```json
"@funxdata/webdx": "jsr:@funxdata/webdx@^1.0.0"
```

JSR 包的 `exports` 字段会自动把以下子路径解析到对应文件：

| 子路径                    | 目标                |
| ------------------------- | ------------------- |
| `@funxdata/webdx/dxhttp`  | `client/dxhttp.ts`  |
| `@funxdata/webdx/dxsse`   | `client/dxsse.ts`   |
| `@funxdata/webdx/dxsoket` | `client/dxsoket.ts` |
| `@funxdata/webdx/tools`   | `client/dxtools.ts` |
| `@funxdata/webdx/types`   | `client/types.ts`   |

因此 **不需要** 为每个子路径单独写 import map。

### `compilerOptions.lib`

库本身不要求
`dom`；但如果你在同一个项目里写浏览器代码（`document`、`window`、`HTMLElement`），加上
`dom` 能避免类型错误：

```json
"lib": ["deno.ns", "dom", "esnext"]
```

如果你的项目是纯 Deno 服务端，可以只用 `["deno.ns", "esnext"]`。

### `nodeModulesDir`

webdx 没有 npm 依赖，不需要设置 `"nodeModulesDir": "auto"`。只有在项目自己使用
npm 包时才需要。

### 版本范围

| 写法                         | 含义                         |
| ---------------------------- | ---------------------------- |
| `jsr:@funxdata/webdx@^1.0.0` | 允许 `1.x` 内的补丁 / 小版本 |
| `jsr:@funxdata/webdx@~1.0.0` | 只允许 `1.0.x` 补丁          |
| `jsr:@funxdata/webdx@1.0.0`  | 精确锁定                     |

生产项目建议使用 `^` + 提交 `deno.lock`。

---

## 导入方式

```ts
// HTTP
import { DxHttp } from "@funxdata/webdx/dxhttp";

// SSE：高层客户端 + 低层请求函数
import { DxSse, fetchEventSource } from "@funxdata/webdx/dxsse";
import { buildSseUrl, unwrapSseData } from "@funxdata/webdx/dxsse";

// Socket
import { DxSocket } from "@funxdata/webdx/dxsoket";
import type { SocketConfig, TaskStatus } from "@funxdata/webdx/dxsoket";

// Tools
import { DxDate, Storage } from "@funxdata/webdx/tools";

// 公共类型
import type { DxHttpResponse } from "@funxdata/webdx/types";
```

只导入类型时使用 `import type`，避免运行时不必要地加载模块：

```ts
import type { EventSourceMessage } from "@funxdata/webdx/dxsse";
```

---

## 权限模型

| 功能                         | 所需权限      | 说明                    |
| ---------------------------- | ------------- | ----------------------- |
| `DxHttp`                     | `--allow-net` | 允许访问目标主机        |
| `fetchEventSource` / `DxSse` | `--allow-net` | 同上                    |
| `DxSocket`                   | `--allow-net` | WebSocket 连接          |
| `Storage`                    | 无额外权限    | 但需要 Web Storage 环境 |
| `DxDate`                     | 无            | 纯计算                  |

运行：

```bash
deno run --allow-net main.ts
```

更精细的授权：

```bash
deno run --allow-net=127.0.0.1:44944 main.ts
```

测试：

```bash
deno test --allow-net tests/
```

> 如果忘记 `--allow-net`，`fetch` / `WebSocket` 会抛
> `PermissionDenied`，而不是返回网络错误。

---

## 运行时 API 依赖

webdx 不依赖 Node 内置模块。各模块用到的全局 API：

| 模块       | 依赖                                                        | 备注                                  |
| ---------- | ----------------------------------------------------------- | ------------------------------------- |
| `DxHttp`   | `fetch`、`AbortController`、`Response`、`JSON`              | Deno 2 全部内置                       |
| `DxSse`    | `fetch`、`ReadableStream`、`TextDecoder`、`AbortController` | **不使用** `document` / `window`      |
| `DxSocket` | `WebSocket`                                                 | 可通过 `webSocket` 配置注入自定义实现 |
| `Storage`  | `localStorage`                                              | 见下一节                              |
| `DxDate`   | `Date`                                                      | 无                                    |

### SSE 的页面可见性逻辑

`fetchEventSource` 在 `openWhenHidden` 为 `false` 时，会在**存在 `document`**
的情况下监听 `visibilitychange`；Deno / Node / Worker 中没有
`document`，该逻辑自动跳过。因此同一个库在浏览器和 Deno
中行为一致，不需要分支代码。

### WebSocket

Deno 2 提供全局 `WebSocket`。如果运行环境没有全局 `WebSocket`（某些 Worker /
测试环境），可以注入：

```ts
import { DxSocket } from "@funxdata/webdx/dxsoket";

const socket = new DxSocket("ws://127.0.0.1:44944/soket", {
  webSocket: MyWebSocketImplementation,
});
```

`MyWebSocketImplementation` 需要满足 `WebSocketLike`
接口：`readyState`、`send`、`close`、`onopen` / `onmessage` / `onclose` /
`onerror`。

---

## Web Storage 与 localStorage

`Storage` 是 `localStorage` 的薄封装：

```ts
Storage.set("token", "abc", 60_000);
Storage.get("token"); // "abc"，60 秒后返回 null
```

在 Deno 中：

- `localStorage` 需要一个 **origin**。使用 `--location` 指定：

  ```bash
  deno run --location=https://example.com --allow-net main.ts
  ```

- 没有指定 origin 时，`globalThis.localStorage` 可能不存在，`Storage.set` 会抛出
  `ReferenceError`。
- Deno Deploy 会自动提供 origin，无需额外参数。
- 如果只是想在 Deno 服务端缓存数据，建议改用内存 `Map`、文件或数据库，不要把
  `Storage` 当通用 KV。

浏览器中 `localStorage` 直接可用，但注意：

- 同源共享，容量通常 5 MB 左右；
- 只能存字符串；`Storage` 内部用 `JSON.stringify`，因此值必须可 JSON 序列化；
- 同步 API，大对象频繁读写会阻塞主线程。

---

## 类型检查与编辑器

```bash
# 检查库入口
deno check client/dxhttp.ts client/dxsse.ts client/dxsoket.ts client/dxtools.ts client/types.ts

# 检查你的项目
deno check main.ts
```

`deno check` 会做完整的 TypeScript 类型检查（不只是转译）。

VS Code 推荐配置（`.vscode/settings.json`）：

```json
{
  "deno.enable": true,
  "deno.lint": true,
  "editor.defaultFormatter": "denoland.vscode-deno"
}
```

如果项目同时有 Node 代码，建议使用工作区（`.vscode/settings.json` 的
`deno.enablePaths`）只为 Deno 目录启用 LSP，避免与 TS Server 冲突。

常用命令：

```bash
deno fmt            # 格式化
deno fmt --check    # CI 中检查
deno lint           # 静态检查
deno lint --fix     # 自动修复可修复项（部分版本支持）
```

---

## 在 Deno 中测试

### 基本用法

```bash
deno test --allow-net tests/
```

测试文件使用内置断言（推荐 JSR 的 `@std/assert`）：

```ts
import { assertEquals } from "jsr:@std/assert@^1";

Deno.test("DxHttp GET", async () => {
  // ...
  assertEquals(1 + 1, 2);
});
```

### 测试 SSE：本地 mock 服务

```ts
const server = Deno.serve(
  { port: 0, hostname: "127.0.0.1", onListen: () => {} },
  () =>
    new Response("data: hello\n\n", {
      headers: { "content-type": "text/event-stream" },
    }),
);

const port = (server.addr as Deno.NetAddr).port;
try {
  await fetchEventSource(`http://127.0.0.1:${port}/sse`, {
    onmessage: (message) => console.log(message.data),
  });
} finally {
  await server.shutdown();
}
```

`port: 0` 让系统分配空闲端口，避免测试之间冲突。

### 测试 Socket：注入 FakeWebSocket

`DxSocket` 不要求真实网络：

```ts
class FakeWebSocket {
  readyState = 0;
  onopen = null;
  onmessage = null;
  onclose = null;
  onerror = null;
  sent: string[] = [];
  constructor(readonly url: string) {}
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }
}

const socket = new DxSocket("ws://test", {
  webSocket: FakeWebSocket as never,
  autoConnect: false,
});
```

仓库中的 `tests/_fake_websocket.ts` 提供了完整实现，可以直接参考。

### 资源清理

Deno 的测试默认开启 op
sanitizer：未关闭的定时器、监听器、服务会报错。测试中务必：

- `server.shutdown()` 放在 `finally`；
- `socket.close()` 放在 `finally`；
- `AbortController.abort()` 停止 SSE；
- 不要在测试里留下未清理的 `setInterval`。

### 并行与超时

```bash
deno test --parallel          # 并行运行测试文件
deno test --filter "SSE"      # 按名称过滤
deno test --timeout 30s       # 单测超时
```

---

## deno task 脚本

在 `deno.json` 中定义：

```json
{
  "tasks": {
    "dev": "deno run --watch --allow-net main.ts",
    "test": "deno test --allow-net --allow-env tests/",
    "check": "deno check client/dxhttp.ts client/dxsse.ts client/dxsoket.ts client/dxtools.ts client/types.ts src/app.ts",
    "lint": "deno lint client src tests",
    "fmt": "deno fmt client src tests"
  }
}
```

运行：

```bash
deno task dev
deno task test
deno task check
```

`deno task` 会自动读取当前目录的 `deno.json`。本仓库已配置 `test` / `check` /
`lint` / `fmt` 四个 task。

---

## 发布到 JSR

webdx 通过 JSR 分发。发布自己的修改时：

### 1. 登录

```bash
deno login
```

### 2. 检查 `deno.json`

```json
{
  "name": "@funxdata/webdx",
  "version": "1.0.0",
  "license": "MIT",
  "exports": {
    "./dxhttp": "./client/dxhttp.ts",
    "./dxsse": "./client/dxsse.ts",
    "./dxsoket": "./client/dxsoket.ts",
    "./tools": "./client/dxtools.ts",
    "./types": "./client/types.ts"
  }
}
```

JSR 要求：

- `name` 使用 `@scope/name`；
- 每个 `exports` 目标必须真实存在；
- 版本不能重复发布；
- 包内不能包含未使用的敏感文件。

### 3. 控制发布内容

只发布 `client/`、README、LICENSE：

```json
{
  "publish": {
    "include": ["client/", "README.md", "LICENSE"]
  }
}
```

或用 `exclude` 排除
`assets/`、`src/`、`tests/`、`docs/`、`todo/`、`index.html`、`deno.lock`。

### 4. 干跑与发布

```bash
deno publish --dry-run
deno publish
```

`--dry-run`
会列出将要上传的文件与大小，务必检查没有把密钥、构建产物或测试资源带进去。

### 5. 验证安装

在临时目录中：

```bash
mkdir /tmp/webdx-check && cd /tmp/webdx-check
deno init
deno add jsr:@funxdata/webdx@<new-version>
deno eval 'import { DxHttp } from "@funxdata/webdx/dxhttp"; console.log(typeof DxHttp)'
```

---

## Deno Deploy

Deno Deploy 原生支持 JSR：

```ts
import { DxSse } from "jsr:@funxdata/webdx/dxsse";
```

- 网络权限由平台管理，不需要 `--allow-net`。
- `localStorage` 在 Deploy 上可用（按 deployment / origin
  隔离），但**不适合跨请求持久化业务数据**；请使用 Deno KV 或外部数据库。
- 长时间 SSE / WebSocket 连接需要关注平台的执行时长与连接数限制。

一个最小的 Deploy 入口（把上游 SSE 转发给浏览器）：

```ts
import { DxSse } from "jsr:@funxdata/webdx/dxsse";

Deno.serve((req) => {
  const upstream = new URL(req.url).searchParams;
  const body = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const sse = new DxSse("http://127.0.0.1:44944");
      sse.subscribe(
        {
          lib: upstream.get("lib") ?? "",
          symbol: upstream.get("symbol") ?? "",
        },
        {
          onmessage: (message) => {
            controller.enqueue(encoder.encode(`data: ${message.data}\n\n`));
          },
        },
      );
      req.signal.addEventListener("abort", () => sse.close());
    },
  });

  return new Response(body, {
    headers: { "content-type": "text/event-stream" },
  });
});
```

> 生产环境请补上错误处理、鉴权与目标地址白名单。

---

## 在浏览器 / Node 中使用

### 浏览器

JSR 包可以通过 **esm.sh** 直接加载：

```html
<script type="module">
import { DxHttp } from "https://esm.sh/jsr/@funxdata/webdx/dxhttp";
const http = new DxHttp({ baseURL: "/api" });
</script>
```

也可以用 esbuild / Vite / Rollup 等打包器，把 `jsr:` 说明符替换为
`https://esm.sh/...`。注意浏览器跨域需要服务端 CORS 支持。

### Node 22+

```bash
npx jsr add @funxdata/webdx
```

或直接使用 esm.sh：

```ts
import { DxHttp } from "https://esm.sh/jsr/@funxdata/webdx/dxhttp";
```

Node 22+ 内置 `fetch`、`WebSocket`、`ReadableStream`，HTTP / SSE / Socket
可用；`Storage` 需要 `localStorage` polyfill。

---

## 常见问题

### `PermissionDenied: Requires net access`

缺少 `--allow-net`：

```bash
deno run --allow-net main.ts
```

### `Expected content-type to be text/event-stream`

服务端没有返回正确的 `Content-Type`，或返回了 HTML 错误页。检查：

- URL 是否正确；
- 是否被网关 / 登录页拦截；
- 服务端是否在 200 响应中设置了 `text/event-stream`。

如果服务端有特殊行为，可以覆盖校验：

```ts
await fetchEventSource(url, {
  onopen: (response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    // 不检查 content-type
  },
});
```

### SSE 一直重连

- 服务端正常结束流时，`fetchEventSource` 会
  resolve，不会自动重连；只有发生**错误**时才重试。
- 如果服务端返回非 2xx 或流异常中断，默认每 1 秒重试。可以用 `onerror` 控制：

```ts
await fetchEventSource(url, {
  onerror: (err) => {
    if (err instanceof Error && err.message.includes("404")) {
      throw err; // 停止重试
    }
    return 3000; // 3 秒后重试
  },
});
```

### `localStorage is not defined`

Deno 进程没有 Web Storage 环境：

```bash
deno run --location=https://example.com main.ts
```

或改用内存 / 文件存储。

### `Socket closed before open`

连接在建立前被关闭（服务端拒绝、端口不通、超时）。检查：

- 地址是否 `ws://` / `wss://`；
- 服务是否监听对应端口；
- `connectTimeout` 是否过短（默认 10 秒）。

开启调试日志：

```ts
const socket = new DxSocket(url, { debug: true });
```

### `Task xxx is not bound`

`send()` 只能发给已 `bind()` 的任务。先绑定，或确认 `bind()` 没有抛错。

### Deno 找不到 `deno.json`

当前目录不在项目根时，`deno task` / `deno check` 不会读取配置。使用
`--config path/to/deno.json`，或先 `cd` 到项目根。

### `deno task test` 无法运行

确认在项目根目录；如果依赖尚未解析，先执行 `deno install`。也可以直接运行：

```bash
deno test --allow-net --allow-env tests/
```

外部 cyctron 集成测试默认跳过，需要设置 `CYCTRON_URL` 才会运行。

---

## 最佳实践

1. **复用客户端实例**：`DxHttp`、`DxSse`、`DxSocket`
   都有内部状态，不要在每次请求时新建。
2. **显式超时**：生产环境给 `DxHttp` 设置 `timeout`；给 `DxSocket` 设置
   `connectTimeout`。
3. **处理 `close()`**：页面卸载 / 服务关闭时关闭 SSE 与 Socket，避免连接泄漏。
4. **不要在前端放密钥**：浏览器代码中的 token 对用户可见；敏感调用应走后端代理。
5. **提交 `deno.lock`**：保证团队与 CI 使用同一解析结果。
6. **只发布 `client/`**：文档站、测试、`todo/` 不应进入 JSR 包。
7. **测试用注入**：SSE 用 `fetch` 注入或本地 `Deno.serve`，Socket 用 `webSocket`
   注入，避免依赖真实服务。
8. **日志默认关闭**：`DxSocket` 的 `debug` 默认 `false`，生产环境不要打开。

---

## 相关文档

- [HTTP](./http.md)
- [SSE](./sse.md)
- [Socket](./soket.md)
- [Tools](./tools.md)
- [数据交换协议](./protocol.md)
