# TODO 06：`DxSocket.call()` 后续任务

> 状态：**1.1.0 已完成并发布到 JSR**（`@funxdata/webdx@1.1.0`）。
> 关联：`docs/soket.md`、`tests/socket_call_test.ts`、cyctron `todo/socket-call.md`。
> 约定：每个功能点都必须有 `Deno.test` 用例；优先使用 `FakeWebSocket`，不依赖网络。

---

## 0. 已完成（1.1.0）

| 项 | 实现 | 测试 |
| --- | --- | --- |
| `call(lib, symbol, args, options)` | 生成 `id`、发送 `cmd:"call"`、按 id 等待 | `tests/socket_call_test.ts` |
| 默认超时 | `timeoutMs`，默认 10000 | 超时用例 |
| 业务失败 | `ok:false` 也 resolve | 错误码用例 |
| 断线清理 | `rejectPendingCalls("Socket closed")` | 断线用例 |
| 自动连接 | `ensureConnected()` | 自动连接用例 |
| 事件 | `"call"` | 事件断言（待补） |
| JSR 发布 | 1.1.0 | `deno publish` 已完成 |

---

## 1. 任务总表

| ID | 功能点 | 优先级 | 主要文件 | 测试 |
| --- | --- | --- | --- | --- |
| WC-01 | JSR 1.1.0 验证与依赖切换 | P0 | `deno.json`、`docs/` | `deno info` / `deno check` |
| WC-02 | `call` 取消（AbortSignal） | P1 | `client/soket/dxsoket.ts` | `tests/socket_call_cancel_test.ts` |
| WC-03 | `batch` 批量调用 | P2 | `client/soket/dxsoket.ts` | `tests/socket_batch_test.ts` |
| WC-04 | 重连后的 pending 策略 | P1 | `client/soket/dxsoket.ts` | `tests/socket_call_reconnect_test.ts` |
| WC-05 | pending / id 冲突与泄漏防护 | P1 | `client/soket/dxsoket.ts` | `tests/socket_call_pending_test.ts` |
| WC-06 | 超时边界与参数校验 | P1 | `client/soket/dxsoket.ts` | `tests/socket_call_options_test.ts` |
| WC-07 | 事件顺序与归一化 | P2 | `client/soket/types.ts` | `tests/socket_call_event_test.ts` |
| WC-08 | 文档与示例站 | P2 | `docs/soket.md`、`src/` | 手工 |

---

## 2. 任务详情

### WC-01 JSR 1.1.0 验证与依赖切换（P0）

**目标**：确认 1.1.0 在 JSR 可用，并让下游切回包名依赖。

**步骤**：

```bash
deno info jsr:@funxdata/webdx@1.1.0 --min-dep-age 0
deno doc jsr:@funxdata/webdx@1.1.0/dxsoket
```

- 由于 Deno 的 `minimumDependencyAge` 默认 24 小时，刚发布的 1.1.0 可能被阻止；发布/CI 可加 `--min-dep-age 0` 或等待。
- chat_ui 的 `deno.json` 从本地路径改回：

```json
"@funxdata/webdx/dxsoket": "jsr:@funxdata/webdx@^1.1.0",
"@funxdata/webdx/dxhttp": "jsr:@funxdata/webdx@^1.1.0"
```

**测试**：`deno check src/app.ts`（chat_ui）与 `deno task check`（webdx）。

**验收**：不依赖本地路径；构建与运行正常。

---

### WC-02 `call` 取消（AbortSignal）（P1）

**目标**：调用方可以主动取消等待，避免长时间 pending。

**改动**：

```ts
call<T>(lib, symbol, args?, options?: { timeoutMs?: number; signal?: AbortSignal })
```

- 已中止的 signal 立即 reject `AbortError`；
- 取消时从 `pendingCalls` 删除并清理定时器；
- 已发送的请求不会撤回（服务端仍会执行），文档需注明。

**测试**：`tests/socket_call_cancel_test.ts`

- 发送前中止；
- 等待中中止；
- 中止后不触发未处理 rejection；
- 正常完成不受影响。

**验收**：pending 不泄漏；错误类型可区分。

---

### WC-03 `batch` 批量调用（P2）

**目标**：一次请求执行多个 FFI 调用（对应 cyctron `batch`，需服务端先实现）。

**改动**：

```ts
batch<T>(calls: Array<{ lib; symbol; args? }>, options?): Promise<CallResult<T>[]>
```

- 生成请求 id 与每个 `call_id`；
- 按 `results` 顺序返回；
- 支持 `stop_on_error`（与服务端协议一致）。

**测试**：`tests/socket_batch_test.ts`

- 全部成功；
- 部分失败；
- `stop_on_error`；
- 空数组。

**依赖**：cyctron SC-12 / `todo/socket.md` 阶段 2。

---

### WC-04 重连后的 pending 策略（P1）

**目标**：明确断线时未完成请求的行为，避免悬挂或重复执行。

**现状**：断线直接 reject `"Socket closed"`。

**可选策略**：

- `reject`（当前，默认）；
- `retry`：重连后按相同 `id` 重发（需要服务端幂等）；
- `notify`：触发 `"call"` 事件，由调用方决定。

**测试**：`tests/socket_call_reconnect_test.ts`

- 断线 → reject；
- 重连后新请求成功；
- 旧 pending 不残留；
- 开启 retry 时的重发次数（如实现）。

**验收**：行为可配置、文档明确。

---

### WC-05 pending / id 冲突与泄漏防护（P1）

**目标**：高并发下 id 唯一、pending 不泄漏。

**改动**：

- `id` 使用 `seq + 随机/时间`，避免同毫秒冲突；
- `pendingCalls` 增加上限（如 256），超出立即 reject；
- 每次 resolve/reject 都删除 pending 并清定时器。

**测试**：`tests/socket_call_pending_test.ts`

- 1000 次并发调用，id 全部唯一；
- 超上限拒绝；
- 响应乱序仍正确匹配；
- 关闭后 pending 为空。

**验收**：无泄漏、无错配。

---

### WC-06 超时边界与参数校验（P1）

**目标**：边界值行为明确。

**规则**：

| `timeoutMs` | 行为 |
| --- | --- |
| 未传 | 10000 |
| `0` | 不设超时（仅依赖断线/服务端） |
| 负数 | 按 `0` 处理或抛参数错误（建议抛错） |
| 超大 | 允许，但文档提示 |

**测试**：`tests/socket_call_options_test.ts`

- 0 / 负数 / 小数 / 极大值；
- `lib` / `symbol` 为空；
- `args` 为 `undefined` / `null` / 循环引用（`JSON.stringify` 抛错）。

**验收**：参数错误在发送前抛出，不产生 pending。

---

### WC-07 事件顺序与归一化（P2）

**目标**：保证 `"call"` 与 `"message"` 的触发顺序稳定。

**现状**：先 `emit("message", raw)`，再分发 `"call"`。

**测试**：`tests/socket_call_event_test.ts`

- 收到响应时先 `message` 后 `call`；
- 非 call 消息不触发 `call`；
- 未知 `type` 不崩溃。

**验收**：顺序与文档一致。

---

### WC-08 文档与示例站（P2）

- `docs/soket.md`：已补 `call`，后续补取消、batch、重连策略；
- `src/apis/`：示例站增加 call 演示；
- `CHANGELOG.md`：记录 1.1.0 的 `call`。

**验收**：文档与实现一致。

---

## 3. 测试文件规划

| 文件 | 内容 |
| --- | --- |
| `tests/socket_call_test.ts` | 已有：成功/失败/超时/断线/自动连接 |
| `tests/socket_call_cancel_test.ts` | 新增：AbortSignal |
| `tests/socket_call_reconnect_test.ts` | 新增：断线与重连 |
| `tests/socket_call_pending_test.ts` | 新增：并发/上限/泄漏 |
| `tests/socket_call_options_test.ts` | 新增：参数与超时边界 |
| `tests/socket_call_event_test.ts` | 新增：事件顺序 |
| `tests/socket_batch_test.ts` | 新增：batch（依赖服务端） |

---

## 4. 推荐顺序

1. WC-01（下游切换）；
2. WC-05 + WC-06（稳定性与边界）；
3. WC-02（取消）；
4. WC-04（重连策略）；
5. WC-07（事件）；
6. WC-03（batch，依赖 cyctron）；
7. WC-08（文档）。

---

## 5. 验收总则

- 所有新增 API 必须有 `Deno.test` 用例；
- `deno task check`、`deno lint`、`deno fmt --check` 通过；
- `FakeWebSocket` 覆盖，不依赖真实网络；
- 文档与 CHANGELOG 同步。
