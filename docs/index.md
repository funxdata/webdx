# webdx 文档

**Web Data Exchange Framework** —— 用 Deno 与 Web 标准完成数据交换和数据存储。

## 从哪一篇开始

| 你想做什么                               | 阅读                          |
| ---------------------------------------- | ----------------------------- |
| 在 Deno 项目里安装、配置权限、发布到 JSR | [Deno 使用指南](./deno.md)    |
| 调用 REST / 本地 FFI 服务                | [HTTP](./http.md)             |
| 订阅服务端事件流（SSE）                  | [SSE](./sse.md)               |
| 建立长连接、绑定任务、收发消息           | [Socket](./soket.md)          |
| 缓存数据、格式化时间                     | [Tools](./tools.md)           |
| 搞清楚服务端 URL / 消息格式              | [数据交换协议](./protocol.md) |
| 了解项目定位与版本                       | [关于](./about.md)            |

## 30 秒示例

```ts
import { DxSse, unwrapSseData } from "@funxdata/webdx/dxsse";

const sse = new DxSse("http://127.0.0.1:44944");
await sse.subscribe(
  { lib: "sys_info", symbol: "post_file_exists", args: { path: "README.md" } },
  { onmessage: (_msg, payload) => console.log(unwrapSseData(payload)) },
);
```

## 模块一览

| 模块   | 入口                      | 依赖的 Web API                           |
| ------ | ------------------------- | ---------------------------------------- |
| HTTP   | `@funxdata/webdx/dxhttp`  | `fetch`、`AbortController`               |
| SSE    | `@funxdata/webdx/dxsse`   | `fetch`、`ReadableStream`、`TextDecoder` |
| Socket | `@funxdata/webdx/dxsoket` | `WebSocket`                              |
| Tools  | `@funxdata/webdx/tools`   | `localStorage`（仅 Storage）             |
| Types  | `@funxdata/webdx/types`   | —                                        |

## 安装

```bash
deno add jsr:@funxdata/webdx
```

然后：

```ts
import { DxHttp } from "@funxdata/webdx/dxhttp";
```

运行带网络的脚本：

```bash
deno run --allow-net main.ts
```
