# 数据交换协议

webdx 默认对接 `cyctron` 风格的数据交换服务。服务通常在 `127.0.0.1:44944`
监听，提供 HTTP、SSE、WebSocket 三类端点。

本文描述 **webdx 客户端期望的协议**，方便：

- 对接现成的 cyctron 服务；
- 用其他语言 / 框架实现兼容服务；
- 编写 mock 服务与测试。

## 端点总览

| 端点             | 协议       | 用途                                      |
| ---------------- | ---------- | ----------------------------------------- |
| `POST /database` | HTTP       | 调用动态库的数据库符号（`FFI-Symbol` 头） |
| `GET /sse`       | HTTP + SSE | 订阅动态库符号的轮询结果                  |
| `ws://.../soket` | WebSocket  | 任务绑定、消息收发、状态查询              |

> 路径中的 `soket` 是历史拼写，保持不变。

---

## SSE

### 请求

```http
GET /sse?lib=sys_info&symbol=post_file_exists&args=%7B%22path%22%3A%22README.md%22%7D&interval_ms=200 HTTP/1.1
Accept: text/event-stream
```

查询参数：

| 参数          | 必填 | 说明                                      |
| ------------- | ---- | ----------------------------------------- |
| `lib`         | 是   | 动态库名，例如 `sys_info`                 |
| `symbol`      | 是   | 动态库导出的符号，例如 `post_file_exists` |
| `args`        | 否   | 传给符号的参数，JSON 字符串               |
| `interval_ms` | 否   | 服务端轮询间隔（毫秒）                    |

`args` 的 JSON 由客户端编码：

```json
{ "path": "README.md" }
```

编码后：

```text
args=%7B%22path%22%3A%22README.md%22%7D
```

### 响应头

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### 事件格式

```text
id: 1
event: post_file_exists
data: {"data":{"exists":true}}

id: 2
event: post_file_exists
data: {"data":{"exists":true}}
```

- `id`：递增事件 ID；客户端重连时通过 `last-event-id` 请求头回传。
- `event`：通常等于 `symbol`。
- `data`：JSON。业务数据可能在 `data` 字段内，也可能直接在根上。

### data 的两种形态

```json
{ "data": { "exists": true } }
```

```json
{ "exists": true }
```

客户端用 `unwrapSseData()` 统一取出：

```ts
unwrapSseData({ data: { exists: true } }); // { exists: true }
unwrapSseData({ exists: true }); // { exists: true }
```

### 结束与重连

| 情况       | 服务端行为              | 客户端行为                      |
| ---------- | ----------------------- | ------------------------------- |
| 查询完成   | 可以关闭流              | `onclose`，Promise resolve      |
| 持续轮询   | 保持连接，持续推送      | 持续触发 `onmessage`            |
| 错误       | 返回 4xx / 5xx 或中断流 | 触发 `onerror`，默认 1 秒后重试 |
| 客户端取消 | 连接被 abort            | Promise resolve，不重试         |

### curl 调试

```bash
curl -N \
  'http://127.0.0.1:44944/sse?lib=sys_info&symbol=post_file_exists&args=%7B%22path%22%3A%22README.md%22%7D&interval_ms=200'
```

`-N` 关闭缓冲，才能看到实时事件。

---

## WebSocket

### 连接

```text
ws://127.0.0.1:44944/soket
```

连接建立后，客户端通过 `cmd` 字段发送命令。所有消息都是 JSON 文本。

### 客户端命令

#### bind

```json
{ "cmd": "bind", "uuid": "task-001", "lib": "libsoket_demo" }
```

| 字段   | 说明                                |
| ------ | ----------------------------------- |
| `uuid` | 客户端生成的任务标识（一般短 UUID） |
| `lib`  | 动态库名                            |

服务端应返回绑定结果：

```json
{
  "type": "realtime",
  "data": { "action": "bind", "uuid": "task-001", "status": "success" }
}
```

#### msg

```json
{ "cmd": "msg", "uuid": "task-001", "data": { "action": "getData" } }
```

`data` 可以是任意 JSON 值。

#### status

```json
{ "cmd": "status" }
```

服务端可以返回所有任务状态，或针对具体 `uuid` 的实时消息：

```json
{
  "type": "realtime",
  "data": { "action": "status", "uuid": "task-001", "status": "running" }
}
```

#### remove

```json
{ "cmd": "remove", "uuid": "task-001" }
```

服务端确认：

```json
{
  "type": "realtime",
  "data": { "action": "remove", "uuid": "task-001" }
}
```

### 服务端消息

#### realtime

```json
{
  "type": "realtime",
  "data": {
    "action": "bind" | "remove" | "status",
    "uuid": "task-001",
    "status": "success"
  }
}
```

`status` 常见值：

| 值                          | 含义       | 客户端映射        |
| --------------------------- | ---------- | ----------------- |
| `success` / `ok` / `bound`  | 绑定成功   | `bound`           |
| `failed` / `fail` / `error` | 绑定失败   | `bind_failed`     |
| `binding`                   | 绑定中     | `binding`         |
| `removing`                  | 移除中     | `removing`        |
| `removed`                   | 已移除     | `removed`         |
| `running`                   | 任务运行中 | `running`（原样） |

#### msg

```json
{ "type": "msg", "uuid": "task-001", "data": { "value": 1 } }
```

客户端把 `data` 交给该 `uuid` 的 `bind` 回调。

#### system

```json
{ "type": "system", "data": { "status": "ready" } }
```

用于服务端状态通知，不关联具体任务。

### 旧协议

旧版本使用 `action` / `taskName` / `taskData` / `taskUID`：

```json
{ "action": "bind", "name": "task-001", "taskUID": "uid", "taskStatus": "bound" }
{ "action": "message", "name": "task-001", "data": { "value": 1 } }
{ "action": "remove", "taskName": "task-001" }
{ "taskName": "task-001", "taskData": { "value": 1 } }
{ "taskName": "task-001", "taskStatus": "running" }
```

`DxSocket` 通过 `normalizeServerMessage` 同时兼容两套格式。

### 完整时序

```text
客户端                                  服务端
  │                                       │
  │──── WebSocket 握手 ──────────────────▶│
  │◀───────────────────────────── 101 ────│
  │                                       │
  │── {"cmd":"bind","uuid":"t1","lib":"x"}▶│
  │◀─ {"type":"realtime","data":           │
  │     {"action":"bind","uuid":"t1",      │
  │      "status":"success"}} ─────────────│
  │                                       │
  │── {"cmd":"msg","uuid":"t1",            │
  │    "data":{"action":"getData"}} ──────▶│
  │◀─ {"type":"msg","uuid":"t1",           │
  │     "data":{"value":1}} ───────────────│
  │                                       │
  │── {"cmd":"remove","uuid":"t1"} ───────▶│
  │◀─ {"type":"realtime","data":           │
  │     {"action":"remove","uuid":"t1"}} ──│
  │                                       │
```

### websocat 调试

```bash
websocat ws://127.0.0.1:44944/soket
```

然后手动输入：

```json
{"cmd":"bind","uuid":"t1","lib":"libsoket_demo"}
{"cmd":"msg","uuid":"t1","data":{"action":"getData"}}
{"cmd":"status"}
{"cmd":"remove","uuid":"t1"}
```

---

## 错误处理约定

### SSE

| 服务端返回                | 客户端行为          |
| ------------------------- | ------------------- |
| 200 + `text/event-stream` | 正常解析            |
| 200 + 其他 content-type   | `onerror`，默认重试 |
| 4xx / 5xx                 | `onerror`，默认重试 |
| 流异常中断                | `onerror`，默认重试 |

需要区分「可重试」与「致命」时，在 `onerror` 中判断并抛错：

```ts
onerror: ((err) => {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("404")) throw err;
  return 1000;
});
```

### WebSocket

| 情况             | 客户端行为                     |
| ---------------- | ------------------------------ |
| 连接失败 / 关闭  | 按指数退避重连                 |
| 超过最大次数     | `state = closed`，触发 `error` |
| 发送时未连接     | 等待重连；失败则抛错           |
| 向未绑定任务发送 | 立即抛错                       |
| 消息不是 JSON    | 只触发 `message`，不分发       |

---

## 安全建议

- 服务默认绑定 `127.0.0.1`，不要直接暴露到公网。
- 如必须跨机器访问，请加认证与 TLS（`https://` / `wss://`）。
- 不要在浏览器端存放服务端密钥；通过后端代理。
- 对 `lib` / `symbol` / `args` 做白名单校验，避免任意动态库调用。
- `interval_ms` 过小会造成高频轮询，建议服务端设置下限。

---

## 兼容性

| 特性                               | 最低版本     |
| ---------------------------------- | ------------ |
| `lib` / `symbol` / `args` SSE 参数 | 当前版本     |
| `cmd` WebSocket 协议               | 当前版本     |
| `type: "msg"` / `"system"` 回包    | 当前版本     |
| 旧 `action` / `taskName` 协议      | 当前版本兼容 |
| `interval_ms`                      | 服务端可选   |
| `last-event-id` 重连               | 服务端可选   |

如果服务端暂不支持 `last-event-id`，客户端仍能重连，只是会从头开始接收事件。
