# Socket · `DxSocket`

`@funxdata/webdx/dxsoket` 是对 WebSocket 的任务化封装：用 `uuid`
绑定任务、收发消息、查询状态、移除任务，并内置重连与重绑。

```ts
import { DxSocket } from "@funxdata/webdx/dxsoket";
```

## 目录

- [状态机](#状态机)
- [创建与配置](#创建与配置)
- [API](#api)
- [事件](#事件)
- [协议](#协议)
- [重连策略](#重连策略)
- [兼容旧 API](#兼容旧-api)
- [示例](#示例)
- [测试与注入](#测试与注入)
- [限制](#限制)

---

## 状态机

```text
idle ──connect()──▶ connecting ──onopen──▶ open
                         │                  │
                         │ onclose/error    │ onclose
                         ▼                  ▼
                    reconnecting ◀──────────┘
                         │
                         ├── 重连成功 ──▶ open
                         └── 达到上限 ──▶ closed

任意状态 ──close()──▶ closed ──connect()──▶ connecting
```

`state` 的取值：

| 状态           | 含义                                          |
| -------------- | --------------------------------------------- |
| `idle`         | 尚未连接（`autoConnect: false` 时的初始状态） |
| `connecting`   | 首次连接中                                    |
| `open`         | 已连接，可发送命令                            |
| `reconnecting` | 已排期重连，等待 `reconnectDelay`             |
| `closed`       | 已关闭 / 达到最大重连次数                     |

---

## 创建与配置

```ts
const socket = new DxSocket("ws://127.0.0.1:44944/soket", {
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  autoConnect: true,
});
```

| 配置                   | 类型                   | 默认             | 说明                             |
| ---------------------- | ---------------------- | ---------------- | -------------------------------- |
| `maxReconnectAttempts` | `number`               | `5`              | 最大重连次数；`0` 表示不重连     |
| `reconnectDelay`       | `number`               | `1000`           | 首次重连延迟（毫秒）             |
| `maxReconnectDelay`    | `number`               | `30000`          | 延迟上限（毫秒）                 |
| `reconnectFactor`      | `number`               | `1.5`            | 指数退避因子                     |
| `reconnectJitter`      | `number`               | `0.2`            | 抖动比例（0–1）                  |
| `autoReconnect`        | `boolean`              | `true`           | 断线后是否自动重连               |
| `autoConnect`          | `boolean`              | `true`           | 构造后是否立即连接               |
| `connectTimeout`       | `number`               | `10000`          | 连接超时（毫秒）；`0` 表示不限制 |
| `debug`                | `boolean`              | `false`          | 输出调试日志                     |
| `webSocket`            | `WebSocketConstructor` | 全局 `WebSocket` | 注入自定义实现                   |

> `autoConnect: true` 时构造即连接。连接失败的 Promise 在内部被捕获，错误通过
> `"error"` 事件暴露，不会产生未处理的 rejection。

---

## API

### `connect(): Promise<void>`

建立连接：

```ts
await socket.connect();
```

- 已连接时立即 resolve；
- 正在连接时复用同一个 Promise；
- 处于 `reconnecting` 时等待既有重连，不会创建第二个 socket；
- 连接关闭 / 达到上限时 reject。

### `bind(uuid, lib, callback?)`

```ts
await socket.bind("task-001", "libsoket_demo", (data) => {
  console.log(data);
});
```

- 发送 `{ cmd: "bind", uuid, lib }`；
- 未连接时自动 `connect()`；
- 发送成功即把任务状态置为 `bound`（服务端的 ack 通过 `"bind"` 事件返回）；
- 发送失败时状态为 `bind_failed`，并抛出错误；
- `uuid` / `lib` 不能为空。

任务回调收到服务端 `msg` 消息中的 `data`。

### `send(uuid, data)`

```ts
await socket.send("task-001", { action: "getData" });
```

- 发送 `{ cmd: "msg", uuid, data }`；
- 任务必须已 `bind`，否则抛 `Task <uuid> is not bound`；
- 未连接时会等待连接。

### `requestStatus()`

```ts
await socket.requestStatus();
```

发送 `{ cmd: "status" }`。结果通过 `"status"` 事件返回，不会直接返回 Promise
值。

### `remove(uuid)`

```ts
await socket.remove("task-001");
```

- 发送 `{ cmd: "remove", uuid }`；
- 成功后从本地任务表删除；
- 未绑定的 `uuid` 直接返回；
- 发送失败时状态为 `error` 并抛出。

### `on(event, handler)`

```ts
const off = socket.on("data", (payload) => {
  console.log(payload);
});

off(); // 取消订阅
```

### `close()`

```ts
socket.close();
```

- 设置为手动关闭，停止重连；
- 关闭底层 socket；
- 状态变为 `closed`；
- **不会清空已绑定任务**；再次 `connect()` 成功后会自动重新绑定。

### 只读属性

| 属性          | 类型            | 说明                                       |
| ------------- | --------------- | ------------------------------------------ |
| `state`       | `DxSocketState` | 当前状态                                   |
| `isConnected` | `boolean`       | 状态为 `open` 且底层 `readyState === OPEN` |

---

## 事件

| 事件      | payload                                           | 触发时机                       |
| --------- | ------------------------------------------------- | ------------------------------ |
| `state`   | `DxSocketState`                                   | 状态变化                       |
| `open`    | `{ url }`                                         | 连接建立                       |
| `close`   | `{ code?, reason? }`                              | 连接关闭                       |
| `error`   | `unknown`                                         | 底层错误 / 重连上限 / 发送失败 |
| `message` | 原始消息（已尝试 JSON.parse）                     | 每收到一条消息                 |
| `bind`    | 归一化消息 `{ kind: "bind", uuid, status?, raw }` | 绑定相关回包                   |
| `remove`  | `{ kind: "remove", uuid, raw }`                   | 移除相关回包                   |
| `status`  | `{ kind: "status", uuid?, status?, raw }`         | 状态回包                       |
| `data`    | `{ kind: "data", uuid, data, raw }`               | 任务数据                       |
| `system`  | `{ kind: "system", status?, data?, raw }`         | 系统消息                       |

同一个消息会同时触发 `message` 和对应的具体事件。

```ts
socket.on("bind", (msg) => {
  const { uuid, status } = msg as { uuid: string; status?: string };
  console.log(uuid, status);
});

socket.on("data", (msg) => {
  const { uuid, data } = msg as { uuid: string; data: unknown };
  console.log(uuid, data);
});
```

---

## 协议

### 客户端命令

```json
{ "cmd": "bind",   "uuid": "task-001", "lib": "libsoket_demo" }
{ "cmd": "msg",    "uuid": "task-001", "data": { "action": "getData" } }
{ "cmd": "status" }
{ "cmd": "remove", "uuid": "task-001" }
```

### 服务端回包

```json
{ "type": "realtime", "data": { "action": "bind", "uuid": "task-001", "status": "success" } }
{ "type": "realtime", "data": { "action": "status", "uuid": "task-001", "status": "running" } }
{ "type": "realtime", "data": { "action": "remove", "uuid": "task-001" } }
{ "type": "msg", "uuid": "task-001", "data": { "value": 1 } }
{ "type": "system", "data": { "status": "ready" } }
```

### 状态映射

`DxSocket` 会归一化服务端状态：

| 服务端 `status`             | 本地任务状态  |
| --------------------------- | ------------- |
| `success` / `ok` / `bound`  | `bound`       |
| `failed` / `fail` / `error` | `bind_failed` |
| `binding`                   | `binding`     |
| `removing`                  | `removing`    |
| `removed`                   | `removed`     |
| 其他字符串                  | 原样保存      |
| 缺失                        | 不改变        |

`getTaskStatus(uuid)` 返回本地状态；未绑定返回 `"unknown"`。

### uuid 解析优先级

服务端回包中的任务标识按以下顺序取第一个非空字符串：

```text
data.uuid → uuid → data.name → name → taskName
→ data.task_uid → task_uid → data.taskUID → taskUID
```

### 旧协议兼容

以下格式同样能被识别：

```json
{ "action": "bind", "name": "task-001", "taskUID": "uid", "taskStatus": "bound" }
{ "action": "message", "name": "task-001", "data": { "value": 1 } }
{ "taskName": "task-001", "taskData": { "value": 1 } }
{ "action": "remove", "taskName": "task-001" }
```

协议归一化逻辑由 `normalizeServerMessage` 实现，也可以单独导入用于自定义处理：

```ts
import { normalizeServerMessage } from "@funxdata/webdx/dxsoket";

const message = normalizeServerMessage(raw);
// { kind: "bind" | "remove" | "status" | "data" | "system" | "unknown", ... }
```

---

## 重连策略

第 `n` 次重连（从 0 开始）的延迟：

```text
delay = min(maxReconnectDelay, reconnectDelay × reconnectFactor^n)
delay = delay × (1 ± reconnectJitter)
```

默认值下：

| 次数 | 约延迟   |
| ---- | -------- |
| 1    | 0.8–1.2s |
| 2    | 1.2–1.8s |
| 3    | 1.8–2.7s |
| 4    | 2.7–4.1s |
| 5    | 4.1–6.1s |

超过 `maxReconnectAttempts` 后：

- 状态变为 `closed`；
- 触发 `"error"` 事件（`Max reconnect attempts reached`）；
- 不再重连。

### 重连后自动重绑

连接成功后，`DxSocket` 会遍历所有未移除的任务，重新发送：

```json
{ "cmd": "bind", "uuid": "...", "lib": "..." }
```

因此服务端重启后，客户端不需要重新调用 `bind()`。

### 连接超时

`connectTimeout` 内没有触发 `onopen` 时，会关闭当前 socket 并按重连策略处理。

---

## 兼容旧 API

| 旧 API                               | 等价新 API                                 | 说明                     |
| ------------------------------------ | ------------------------------------------ | ------------------------ |
| `bindTask(name, dyn, callback)`      | `bind(name, dyn.lib ?? dyn.uri, callback)` | `dyn` 支持 `lib` / `uri` |
| `taskSendMessage(name, data)`        | `send(name, data)`                         | —                        |
| `removeTask(name)`                   | `remove(name)`                             | —                        |
| `updateTaskCallBack(name, callback)` | —                                          | 更新本地回调，不发送消息 |
| `getTaskStatus(name)`                | —                                          | 返回本地状态             |

```ts
await socket.bindTask(
  "legacy",
  { uri: "libsoket_demo", type: "json", task_uid: "" },
  (data) => console.log(data),
);
```

---

## 示例

### 完整生命周期

```ts
import { DxSocket } from "@funxdata/webdx/dxsoket";

const socket = new DxSocket("ws://127.0.0.1:44944/soket", {
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  debug: false,
});

socket.on("open", () => console.log("connected"));
socket.on("close", (event) => console.log("closed", event));
socket.on("error", (error) => console.error("socket error", error));
socket.on("system", (message) => console.log("system", message));

await socket.connect();

await socket.bind("task-001", "libsoket_demo", (data) => {
  console.log("task data", data);
});

await socket.send("task-001", { action: "getData" });
await socket.requestStatus();

console.log(socket.state, socket.isConnected);
console.log(socket.getTaskStatus("task-001"));

await socket.remove("task-001");
socket.close();
```

### 只等待连接，不自动连接

```ts
const socket = new DxSocket(url, { autoConnect: false });

await socket.connect();
```

### 手动控制重连

```ts
const socket = new DxSocket(url, {
  autoReconnect: false,
});

socket.on("close", () => {
  setTimeout(() => socket.connect().catch(console.error), 3000);
});
```

---

## 测试与注入

`DxSocket` 不要求真实网络。仓库使用 `tests/_fake_websocket.ts`：

```ts
import { DxSocket } from "@funxdata/webdx/dxsoket";

class FakeWebSocket {
  static OPEN = 1;
  readyState = 0;
  onopen = null;
  onmessage = null;
  onclose = null;
  onerror = null;
  sent: string[] = [];
  constructor(readonly url: string) {}
  send(data: string) {
    if (this.readyState !== FakeWebSocket.OPEN) throw new Error("not open");
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
  connectTimeout: 0,
  reconnectJitter: 0,
});
```

测试技巧：

- `autoConnect: false` 控制连接时机；
- `connectTimeout: 0` 避免测试中的超时定时器；
- `reconnectJitter: 0` 让重连延迟可预测；
- 通过 `instances` 数组模拟断线与重连；
- 测试结束务必 `socket.close()`，否则 Deno 的 op sanitizer 会报泄漏。

仓库测试：

| 文件                             | 内容                             |
| -------------------------------- | -------------------------------- |
| `tests/socket_protocol_test.ts`  | 新旧协议归一化                   |
| `tests/socket_test.ts`           | 连接、命令、消息、事件、兼容 API |
| `tests/socket_reconnect_test.ts` | 重连、重绑、超时、取消           |

---

## 限制

- `bind()` 发送成功即认为 `bound`，不等待服务端 ack；需要确认时监听 `"bind"`
  事件并检查 `status`。
- 没有离线消息队列：断线期间调用 `send()` 会等待重连，但不会缓存消息。
- `close()` 不清空任务；如果希望彻底丢弃，请重新创建实例。
- 任务状态是本地视图，可能与服务端短暂不一致，以 `"status"` 回包为准。
- 消息必须是 JSON；非 JSON 文本只会触发 `"message"`，不会分发到任务回调。
