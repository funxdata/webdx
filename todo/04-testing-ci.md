# P3 · 测试与 CI

现状：`tests/` 混放单元测试、手工脚本、依赖外部服务的集成测试；无 CI；测试从远程
`https://deno.land/std@0.224.0/assert/mod.ts` 导入。

## T-01 补齐 deno task ✅（2026-10-21）

- [x] `deno.json` 增加：
  ```json
  "tasks": {
    "test": "deno test --allow-net --allow-env tests/",
    "check": "deno check client/**/*.ts src/**/*.ts",
    "lint": "deno lint client src tests",
    "fmt": "deno fmt client src tests"
  }
  ```
- [x] CI 与本地使用同一入口（避免参数漂移）。
- 验收：`deno task check`、`deno task test` 可执行。

## T-02 统一断言依赖 ✅（2026-10-21）

- [x] 测试统一使用 `@std/assert`、`dxhttp3_test.ts`、`cyctron_test.ts` 使用
      `https://deno.land/std@0.224.0/assert/mod.ts`；改为
      `jsr:@std/assert@^1`（或 `^0.224`），并在 `deno.json` 的 `imports`
      中声明。
- 验收：断网 / 首次运行时 `deno test` 不因远程 URL 失败；`deno info`
  无未锁定依赖。

## T-03 区分测试类型 ✅（2026-10-21）

- [x] `tests/socket_test.ts` 已重写为真正的 `Deno.test` 单测（`FakeWebSocket`
      注入，无需 44944 服务）。
- [x] `tests/cyctron_test.ts` 依赖 `http://127.0.0.1:44944/database` 的 FFI
      服务（`FFI-Symbol: db_create`），默认 `deno task test`
      必须跳过（`ignore: !Deno.env.get("CYCTRON_URL")`）。
- [x] `tests/test_get.ts` 已删除，删除。
- 验收：`deno task test` 在无外部服务的机器上全绿。

## T-04 去重 HTTP 测试 ✅（2026-10-21）

- [x] 已删除 `dxhttp_test.ts`、`dxhttp2_test.ts`，保留
      `dxhttp3_test.ts`、`dxhttp2_test.ts`（2 例）、`dxhttp3_test.ts`（14
      例）大量重叠；保留覆盖面最全的
      `dxhttp3_test.ts`，合并独有用例后删除另两个。
- [ ] 抽取 `startMockServer` / `createClient` 到
      `tests/_mock_server.ts`（下划线前缀避免被当作测试文件）。
- [x] 修复 `tests/dxhttp3_test.ts` 中已有的错误 / 超时预期（它断言非 2xx 抛
      `Request failed with HTTP status 404`）；若按 L-02 改为
      `DxHttpError`，同步更新断言。
- [x] `dxhttp2_test.ts` 已删除 未放在 `finally` 中，改用后删除。
- 验收：`deno test tests/` 用例数减少但覆盖不降。

## T-05 SSE 测试移植 ✅（2026-10-21）

- [x] `sse/spec.ts` 的解析器用例全部迁移到
      `tests/sse_parse_test.ts`（`Deno.test` + `assertEquals`），并补充
      UTF-8、`\r\n` 分块、多消息、`formatMessage` 往返。
- [x] `tests/sse_req_test.ts`：本地 `Deno.serve` 验证基本消息、分片、POST
      透传、`onclose`、content-type 校验、非
      2xx、重试、`last-event-id`、`AbortSignal`、自定义 fetch、无 body。
- [x] `tests/sse_client_test.ts`：`buildSseUrl`、`parseSseData`、`unwrapSseData`、`DxSse`
      端到端与生命周期。
- [ ] `fetchEventSource` 不特殊处理 `data: [DONE]`（由调用方在 `onmessage`
      中判断），如需内置需另行设计。
- 验收：`deno test tests/sse_parse_test.ts tests/sse_req_test.ts tests/sse_client_test.ts`
  全绿。

## T-06 补齐库单测 ✅（2026-10-21）

- [x] `Storage`：set/get、过期删除、无过期、覆盖写、`clear`。
- [x] `DxDate`：各 `format` 分支、`is_same`、`differ`、非法日期。
- [x] HTTP：header 合并优先级、`Content-Type` 自动推断（FormData /
      JSON）、baseURL 拼接、查询参数编码、`setToken` 多 key。
- [x] `client/utils/url.ts` 已删除：各类 URL 解析。
- [x] Socket：`tests/socket_protocol_test.ts`（协议归一化）、`tests/socket_test.ts`（连接
      / 命令 / 消息 / 兼容 API）、`tests/socket_reconnect_test.ts`（重连 / 重绑
      / 超时）。
- 验收：P1 中每个修复至少有一条回归测试。

## T-07 添加 CI ✅（2026-10-21）

- [x] 新建 `.github/workflows/ci.yml`：
  ```yaml
  name: ci
  on: [push, pull_request]
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: denoland/setup-deno@v2
          with: { deno-version: v2.x }
        - run: deno fmt --check
        - run: deno lint
        - run: deno task check
        - run: deno task test
  ```
- [x] 若引入 `npm:` 依赖（tailwind），确认 `deno check`
      不会把站点依赖拉进库检查。
- 验收：PR 上 CI 绿。

## T-08 测试稳定性（部分完成）

- [x] 超时缩短到 100ms（mock 延迟 300ms）真实等待 1000ms，串行会拉长 CI；改为
      100–200ms 的 mock 服务延迟。
- [ ] 避免真实计时断言（`Date.now()` 差值）。
- 验收：`deno test` 总耗时 < 10s，连续运行 3 次无 flake。

## 完成记录

| 日期 | 任务 | 备注 |
| ---- | ---- | ---- |
