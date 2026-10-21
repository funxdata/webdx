# P1 · 客户端库（`client/`）

这是发布到 JSR 的对外 API，正确性优先。全部完成后应满足：`deno check client/**`
0 错误、无调试输出、浏览器 / Deno / Worker 行为明确。

## HTTP（`client/http/`）

### L-01 移除调试日志

- [x] 删除 `client/http/core.ts:21`、`:46`、`:52` 的 `console.log`（含
      `🔍 [CoreRequest]` 前缀）。
- [x] `client/http/request.ts` 中 `errorHook`
      未使用（`:18`、`:141`），一并处理（见 L-02）。
- 验收：`grep -rn 'console\.log' client/` 只剩明确的、可关闭的调试入口（默认 0
  条）。

### L-02 统一错误模型（重点）

现状：

- 非 2xx 直接
  `throw new Error("Request failed with HTTP status ${status}")`，**丢弃响应体与响应头**（`client/http/core.ts:49-56`）。
- 超时抛 `RequestTimeoutError`，但 `DxHttpResponse.msg` 仍表达「是否
  2xx」，语义重叠。
- `errorHook` 只被赋值，从不调用。
- 任务：
  - [x] 定义 `DxHttpError extends Error`，字段 `status`、`response`（可含
        `data`、`headers`）、`code: "HTTP" | "TIMEOUT" | "NETWORK"`。
  - [x] 非 2xx 时先按 Content-Type 解析响应体，再附带在错误上抛出。
  - [x] 决定「抛错」还是「返回 `DxHttpResponse`」为默认行为，并在 README
        中写明；`errorHook` 要么实现（调用后仍按策略抛出/吞掉），要么删除。
  - [x] 保留 `RequestTimeoutError.name`，因为 `tests/dxhttp3_test.ts:324`
        已断言。
- 验收：新增错误路径测试（见 T-06）通过；`deno check` 通过。

### L-03 修正 `DxHttpResponse` 与 `DxHttpType`

- [x] `msg: boolean`（`client/http/types.ts:23`）改名为 `ok`（与 HTTP 语义、旧
      `http/request.ts` 一致），或至少补 `statusText`。
- [x] `DxHttpType` 的方法签名与类不一致：接口写 `get<T>(url)` /
      `post<T>(url, data)`，实现多一个 `config?: DxHttpRequestConfig`
      参数（`types.ts:30-36` vs `request.ts:53` 起）。补全可选参数。
- [x] `setRequestErrorHook`
      在接口里是属性箭头函数（`types.ts:41`），类里是方法；统一为方法。
- [x] `Callback` 类型加 `err?: unknown` 形参（若实现 errorHook）。
- 验收：`client/types.ts` 导出后，外部使用处无类型错误。

### L-04 请求参数能力补齐

- [x] `get` / `delete` 支持
      `params?: Record<string, string | number | boolean>`，统一在 `get_url`
      中编码（可参考旧 `http/core.ts` 的 `buildUrl`）。
- [x] `get` / `delete` 若传 `config.body`，目前被忽略；明确禁止或支持。
- [x] `get_url` 在 `baseURL` 为空且 `uri` 是绝对 URL
      时不应拼接（当前行为正确，补测试固化）。
- 验收：`tests/dxhttp3_test.ts` 的「GET with query parameters」用例通过。

### L-05 Header / Token 合并逻辑

- [x] `setToken(key, token)` 当前用 `this.tokencache = { [key]: token }`
      **覆盖**之前所有 key（`request.ts:136-138`），改为合并。
- [x] `authorize` 开启时 `{ ...headers, ...tokencache }` 会覆盖用户显式传入的
      `Authorization`；确认优先级（建议：显式 config header > token > 默认）。
- [x] `Content-Type` 对 `FormData` / `URLSearchParams` / Blob 不应强制
      `application/json`（`request.ts:35-38`，`core.ts:37-44`）。
- [x] Header key 大小写重复（用户传 `content-type` + 默认
      `Content-Type`）会产生重复头；合并时统一小写比较。
- 验收：新增 header 合并单测。

## SSE（`client/sse/`）

### L-06 去掉对浏览器全局的硬依赖 ✅（2026-10-21）

原有问题：`client/sse/req.ts` 直接使用 `document` / `window`，在 Deno / Node /
Worker 中会 `ReferenceError`。

- [x] `openWhenHidden` 改为 `getVisibilityDocument()` 特性检测，无 `document`
      时直接跳过。
- [x] 定时器统一为 `globalThis.setTimeout` / `ReturnType<typeof setTimeout>`。
- [x] `fetch` 统一读取 `globalThis.fetch`，缺失时 reject 明确的错误。
- [x] 手动 abort / 页面隐藏 / 输入 signal 与错误重试路径分离，abort 时 resolve
      而不是 reject。
- 验收：`deno check --no-config client/dxsse.ts` 通过；`tests/sse_req_test.ts`
  在 Deno 中完成 mock SSE 请求。

### L-07 导出面与空文件 ✅（2026-10-21）

- [x] `client/sse/types.ts` 补齐 `SseQuery` / `SseHandlers` / `DxSseOptions`。
- [x] `client/dxsse.ts` 导出 `getBytes` / `getLines` / `getMessages` /
      `formatMessage` 与 `DxSse`。
- [x] `FetchEventSourceInit.onerror` 参数改为 `unknown`。
- 验收：`deno doc client/dxsse.ts` 能看到完整 API。

## Socket（`client/soket/`）

### L-08 类型与消息协议 ✅（2026-10-21，最后一项保留）

- [x] `Function` 改为 `TaskCallback<T = unknown>`。
- [x] 统一为 `cmd` 协议，并兼容旧 `action` / `taskName` / `taskData` /
      `taskUID`（`normalizeServerMessage`）。
- [x] 消息状态 / uuid 只在 `normalizeServerMessage` 中解析一次。
- [ ] `bind` 失败时任务仍保留在 `tasks` 中（状态
      `bind_failed`），便于诊断与重试；是否回滚待定。
- 验收：`deno check --no-config client/dxsoket.ts`
  通过；`tests/socket_*_test.ts` 覆盖。

### L-09 重连与资源清理 ✅（2026-10-21）

- [x] 移除 `setInterval(500)` + 30s 兜底；重连由 `setTimeout` +
      指数退避（含抖动）驱动。
- [x] `close()` 后可再次 `connect()`；`manualClose` 在 `connect()` 中复位。
- [x] 日志由 `debug?: boolean` 控制，默认静默。
- [x] 重连成功后自动重新绑定未移除的任务。
- 验收：`tests/socket_reconnect_test.ts` 覆盖断线、超时、上限、close
  取消与重绑；无残留定时器。

## Tools / 其他

### L-10 `Storage` 类型与运行环境

- [x] `get(key)` 返回 `unknown`（`client/tools/types.ts:9`），使用处需 as
      断言；改泛型 `get<T = unknown>(key: string): T | null`。
- [x] 直接使用 `localStorage`（`storage.ts`），Deno / SSR 下不可用；提供可注入的
      storage backend 或明确抛错。
- [x] 过期判断 `Date.now() - time > expired`，`expired = 0`
      时被当作「无过期」，确认语义。
- 验收：`deno check client/dxtools.ts` 通过；补 Storage 单测（T-06）。

### L-11 `DxDate` 修正

- [x] `format(pattern)` 实际是**固定字符串映射**，不支持自定义 pattern（如
      `"YYYY/MM/DD"` 会回退为完整时间）；改为 token
      替换，或在文档中声明只支持枚举。
- [x] 方法名 `commnet_time` 拼写错误 → `comment_time`（保留别名兼容）。
- [x] `new Date("invalid")` 时所有字段为 `NaN`；增加 `isValid`。
- 验收：行为在 README 或 JSDoc 中写明；补单测。

### L-12 清理失修文件

- [x] `client/utils/url.ts` 引用未定义的 `debug()`（`:42`、`:51`）与
      `parse()`（`:52`），且没有任何入口导出。用 `URL` 自包含重写或删除。
- [x] `client/tools/json.ts` 未从 `client/dxtools.ts` 导出；补齐导出。
- [x] `client/http/core.ts` 的 `DEFAULT_TIMEOUT = 5000` 与 `request.ts` 默认
      `undefined` 不一致：不传 `timeout` 时 `CoreRequest` 用 5000，但 `DxHttp`
      从不传默认值——确认默认超时是否应生效。
- 验收：`grep -rn 'utils/url' client/ src/` 无引用或文件已删除；`deno check`
  通过。

## 完成记录

| 日期 | 任务 | 备注 |
| ---- | ---- | ---- |
