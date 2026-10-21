# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与
[语义化版本](https://semver.org/lang/zh-CN/)。

## [0.2.0] - 2026-10-21

### Added

- `DxHttpError` / `RequestTimeoutError`：非 2xx 时携带 `status`、`statusText`、
  `headers` 与解析后的响应体；网络错误统一为 `code: "NETWORK"`。
- `DxHttpResponse.ok`、`statusText`、`headers`；`msg` 保留为兼容别名。
- `DxHttp` 支持 `params` 查询参数（`get` / `delete` 等所有方法）。
- `setRequestErrorHook` 现在会在 HTTP 非 2xx、超时、网络错误时调用。
- SSE 高层客户端：`DxSse`、`buildSseUrl`、`parseSseData`、`unwrapSseData`。
- Socket 新 `cmd` 协议（`bind` / `msg` / `status` / `remove`）、事件订阅、
  指数退避重连与重连后自动重新绑定。
- `DxSocket` 支持注入 `webSocket` 构造器，便于测试与跨运行时使用。
- `isJSONSerializable` 从 `@funxdata/webdx/tools` 导出。
- 文档站路由页面与 `docs/*.md` 渲染；新增 API / Deno / 协议文档。
- GitHub Actions CI（fmt、lint、check、test）。

### Changed

- 统一以 `client/**` 作为唯一发布的库布局，版本号升至 `0.2.0`。
- HTTP 请求头合并改为大小写不敏感；`setToken` 支持多 key 合并， 显式
  `Authorization` 优先。
- `FormData`、`URLSearchParams`、`Blob`、`ArrayBuffer`、`ReadableStream`
  不再被强制 `Content-Type: application/json`。
- `Storage.get` 支持泛型，统一返回 `null` 表示不存在 / 已过期。
- 测试统一使用 `@std/assert`；`tests/cyctron_test.ts` 默认跳过， 需要设置
  `CYCTRON_URL` 才运行。
- `deno.lock` 不再纳入版本控制。

### Removed

- 根目录旧布局：`http/`、`sse/`、`soket/`、`tools/`、`types/`。
- `client/utils/url.ts`（调用未定义函数，且无引用）。
- `config/token.ts`（含明文密钥）。
- 重复的 `tests/dxhttp_test.ts`、`tests/dxhttp2_test.ts` 与空的
  `tests/test_get.ts`。
- `src/route/sse.ts`（死代码，手写 SSE 且依赖明文密钥）。

### Fixed

- SSE 实现不再依赖 `document` / `window`，可在 Deno / Node / Worker 运行。
- 修复 `fetchEventSource` 在 abort 与错误重试之间的状态混淆。
- 修复 `DxSocket` 在重连期间再次调用 `connect()` 会创建第二个连接的问题。
- 非 2xx 响应不再丢失响应体。
- `Content-Type: application/json` 但响应体不是 JSON 时回退为文本。
- `DxSocket` 在服务端回包使用旧 `action` / `taskName` 格式时仍能分发消息。
