# P4 · 文档、版本与发布

## D-01 README 完整化 ✅（2026-10-21）

- [x] 一句话定位（Web Data Exchange Framework）+ 模块表 + 依赖说明。
- [x] 安装：`deno add jsr:@funxdata/webdx`，并说明 `deno.json` 的 imports、子路径解析、直接 JSR URL、权限。
- [x] 五个入口的用法示例：`/dxhttp`、`/dxsse`、`/dxsoket`、`/tools`、`/types`。
- [x] 项目结构、运行时兼容性、数据交换协议摘要、开发 / 测试 / 发布命令。
- [x] 已知限制（非 2xx 错误、`msg` 命名、error hook、Storage 环境、`[DONE]`、`DxDate` pattern）。
- 验收：新用户仅凭 README 可完成安装与最小调用；README 已无冲突标记。

## D-02 补齐文档页内容 ✅（2026-10-21）

- [x] `docs/index.md`：文档索引 + 30 秒示例 + 模块表。
- [x] `docs/about.md`：定位、包信息、仓库结构、贡献流程；安装命令统一为 `deno add`。
- [x] 新增 `docs/deno.md`：安装、`deno.json` 配置、权限、运行时 API、Web Storage、类型检查、测试、`deno task`、JSR 发布、Deno Deploy、浏览器 / Node、FAQ、最佳实践。
- [x] 新增 `docs/http.md`：`DxHttp` 配置、方法、响应、header / token、错误、解析规则、示例、限制。
- [x] 新增 `docs/sse.md`：`fetchEventSource`、解析工具、`DxSse`、重连语义、取消、示例、测试。
- [x] 新增 `docs/soket.md`：状态机、配置、API、事件、协议、重连与重绑、旧 API 兼容、测试注入。
- [x] 新增 `docs/tools.md`：`Storage` 过期语义与环境、`DxDate` 支持的 pattern 表、内部工具、测试。
- [x] 新增 `docs/protocol.md`：SSE / WebSocket 请求响应格式、旧协议、状态映射、时序、调试与安全。
- 验收：`docs/` 下所有 Markdown 本地链接有效；`deno fmt --check README.md docs` 通过。

## D-03 deno.json 元数据

- [ ] 添加 `"description"`（JSR 评分项，当前缺失）。
- [ ] 确认 `exclude` / `publish.include` 只发布 `client/` + `README.md` + `LICENSE` + `deno.json`（站点与测试不发布）。
- [ ] `tasks.sse` 指向已不存在的 `./server/sse.ts`（合并后），删除或恢复。
- 验收：`deno publish --dry-run` 通过，产物文件列表符合预期。

## D-04 版本与变更记录

- [ ] 确定版本号（见 decisions.md Q3）：
  - 若 `0.1.2` 已在 JSR 发布 → `0.1.3`（合并 + client 布局）。
  - 若未发布 → 保持 `0.1.2`。
- [ ] 新建 `CHANGELOG.md`（Keep a Changelog 格式），记录：
  - 目录从根目录旧布局迁移到 `client/`
  - `Storage` 过期时间与类型修复
  - `DxHttp` 的响应结构 / 错误模型变化（破坏性）
  - `DxSocket` 重连改进
- 验收：`deno publish --dry-run` 的版本与 CHANGELOG 一致。

## D-05 旧目录清理（等待 Q2）

旧布局与新库重复，且部分文件已损坏：
- `http/`（`core.ts`、`request.ts`、`interceptors.ts`、`exhttp.ts`）
- `sse/`（`fetch.ts`、`parse.ts`、`spec.ts`、`sse.ts`）
- `soket/dxsoket.ts`
- `tools/`（`storage.ts`、`dxdate.ts`、`index.ts`、`types.ts`）
- `types/`（`common.ts`、`exhttp.ts`、`sse.ts`）
- `server/`（已在合并中删除）、`examples/app.ts`（已删除）

注意：
- [ ] 删除前逐项确认 `client/` 已有对应实现（`client/` 没有 `interceptors.ts`、`http/core.ts` 的拦截器能力，需决定是否迁移）。
- [ ] `sse/spec.ts` 是唯一完整的 SSE 解析测试，先迁到 `tests/`（T-05）再删。
- [ ] `tests/cyctron_test.ts` 引用 `client/http/request.ts`，不依赖旧目录。
- [ ] 用 `grep -rn 'http/\|sse/\|soket/\|tools/\|types/' --include=*.ts src client tests` 检查引用后再删。
- 验收：删除后 `deno check client src tests` 通过；无残留引用。

## D-06 源码卫生

- [ ] `deno fmt` / `deno lint` 全量通过（当前 `client/tools/storage.ts`、`sse/` 等缩进与风格不一致）。
- [ ] 统一注释语言（现状中英文混用）。
- [ ] 移除被注释掉的死代码（`src/rout/index.ts` 的 markdown 段等）。
- 验收：`deno fmt --check && deno lint` 无输出。

## D-07 提交历史与分支

- [ ] merge 完成后清理临时分支 / `MERGE_HEAD` 残留（`git status` 正常即已清理）。
- [ ] 为后续改造建立分支（如 `refactor/client-only`），避免直接在 `main` 上解决冲突。
- 验收：`git log --graph` 清晰；`main` 可构建。

## 完成记录

| 日期 | 任务 | 备注 |
| --- | --- | --- |
| 2026-10-21 | D-01 / D-02 | 重写 README；新增 `docs/deno.md`、`http.md`、`sse.md`、`soket.md`、`tools.md`、`protocol.md`，补全 `index.md` / `about.md` |
