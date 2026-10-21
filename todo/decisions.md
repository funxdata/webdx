# 待决策问题

以下问题没有「明显默认答案」，会影响实施方向，需要项目所有者确认。确认后请在此文件记录结论与日期，并同步修改相关任务。

## Q1 仓库最终定位

两个分支代表两种方向：
- **A（origin/main，建议）**：纯客户端库 `client/**` + 文档站 `src/**`，仓库同时是 JSR 包与官网。
- **B（本地 HEAD）**：仍保留服务端能力（`server/`、服务端 SSE）。

问题：是否彻底放弃服务端代码？若保留，服务端代码放在哪里、是否作为第二个 export？

## Q2 旧目录是否删除

`http/`、`sse/`、`soket/`、`tools/`、`types/` 与 `client/**` 功能重复；旧 `http/request.ts` 在模块顶层读取 `localStorage`，`types/sse.ts` 只剩一个孤立的 `const enum`。
- 选项：立即删除（需先迁移 `sse/spec.ts` 测试） / 先标记 deprecated 一版再删 / 保留作为 v0 兼容层。
- 影响：D-05、M-02（`tasks.sse`）、包体积。

## Q3 版本号

- 本地分支：`0.0.7`；origin/main：`0.1.2`。
- 需要确认 `0.1.2` 是否已在 JSR 发布：
  - 已发布 → 下一版 `0.1.3`。
  - 未发布 → 直接 `0.1.2`。
- 若 HTTP 错误模型改为抛 `DxHttpError`（L-02），属于破坏性变更，是否升 `0.2.0`？

## Q4 `deno.lock` 是否入库

- `.gitignore` 已包含 `deno.lock`，但文件仍被跟踪（合并状态 `AA`）。
- 库（JSR 包）通常不提交 lock；但仓库含文档站与 npm 依赖（tailwind），提交 lock 可复现构建。
- 选项：入库 / 忽略并 `git rm --cached` / 拆分 workspace（库与站各自配置）。

## Q5 文档站是否随包发布

`src/`、`assets/`、`index.html`、`docs/` 属于站点，不应进入 JSR 包。当前用 `exclude` 逐个排除，容易漏。
- 选项：改用 `publish.include: ["client/"]`（建议） / 保持 `exclude` 列表 / 把站点拆到独立仓库或 workspace member。

## Q6 站点的构建与托管

`index.html` 直接 `<script type="module" src="/src/app.ts">`，并依赖 CDN 的 `uxpages@0.0.26`。
- 需要确认：`deno task view`（`@funxdata/toolkit/view`）是否负责 TS → JS 转译？
- 站点最终部署到哪里（CDN / Deno Deploy / 静态托管）？是否需要在仓库内提交构建产物？

## Q7 `config/token.ts` 与 API Key

该文件包含明文 `sk-...` 密钥，虽未被 git 跟踪（`git ls-files config` 为空），但位于工作区且被 `src/route/sse.ts` 使用。
- 需要确认：该 key 是否为真实生产 key；若是，**先在服务商后台吊销 / 轮换**。
- 站点为纯前端，任何密钥都会暴露给访问者；建议改为用户输入或服务端代理（需新增服务端，与 Q1 关联）。

## 决策记录

| 日期 | 问题 | 结论 |
| --- | --- | --- |
