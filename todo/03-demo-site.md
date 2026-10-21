# P2 · 演示站 / 文档站（`src/`、`assets/`、`index.html`）

站点用于展示库的用法，也可作为 dogfooding。当前**导航会点到
404**，且有明文密钥。

## S-01 补齐 router.json 引用的页面 ✅（2026-10-21）

`assets/router.json` 引用了以下不存在的文件：

| route           | 引用路径                  | 状态                       |
| --------------- | ------------------------- | -------------------------- |
| `/http/request` | `/src/dxhttp_request.ts`  | 缺失                       |
| `/sse/example`  | `/src/dxsse_example.ts`   | 缺失                       |
| `/soket/instro` | `/src/dxsoket_example.ts` | 缺失（注意 `instro` 拼写） |
| `/tools`        | `/src/tools.ts`           | 缺失                       |
| `/tools/instro` | `/src/tools_cache.ts`     | 缺失                       |

- [x] 为每个页面实现「模板 + 初始化函数」，遵循现有 `src/views/*` + `src/rout/*`
      模式。
- [x] 示例代码直接 import 库入口（`src/apis/*` 已使用 `@/client/dxhttp.ts`）。
- 验收：`deno task view` 后逐个点击菜单，控制台无 404 / 模块加载错误。

## S-02 处理空文件 ✅（2026-10-21）

以下文件为 0 字节，部分被路由引用：
`src/about.ts`、`src/dxhttp.ts`、`src/dxhttp_example.ts`、`src/dxhttp_install.ts`、`src/dxsoket.ts`、`src/dxsse.ts`。

- [x] 要么实现，要么从 `assets/router.json` 移除对应条目，避免死链。
- 验收：`find src -type f -size 0` 不再列出被路由引用的文件。

## S-03 声明 uxpages 全局 API 的类型 ✅（2026-10-21）

`src/app.ts` 从 CDN 加载 `uxpages@0.0.26` 的 `browser.js` / `router.js`，通过
`(globalThis as any)` 访问 `TplToHtml`、`GlobalPagesRouter`，并从
`@/router/types.ts`、`@/tpls/types.ts` 导入类型——这两个文件在两个分支都不存在。

- [x] 新建 `src/types/uxpages.ts`，声明：
  - `Route`、`PagesRouterInfo`、`Tpl`、页面路由节点（含
    `loadjs`、`hook`、`on()`、`search()`、`replace()`）
  - `window.TplToHtml`、`window.GlobalPagesRouter`
- [x] 去掉 `as any`。
- 验收：`deno check src/app.ts` 通过。

## S-04 恢复 Markdown 渲染 ✅（2026-10-21）

- [x] `src/rout/index.ts` 中 `get_mark_info("index.md")` 与 `marked(...)`
      被注释，导致 `/` 页面空白；恢复并处理加载失败。
- [x] `src/apis/mark.ts` 使用 `baseURL: "/docs/"`，`index.html` 把 `marked` 挂到
      `window`；统一用 `window.marked.parse`。
- [x] `assets/router.json` 为 about 配置了 `/src/about.ts`，但 `docs/about.md`
      未被任何页面使用；决定 about 页的数据来源。
- 验收：`/` 与 `/about` 显示 docs 内容。

## S-05 用 SSE 库替换手写解析 ✅（2026-10-21）

- [x] `src/route/sse.ts` 已删除（死代码）手写 `fetch` + `\n\n` 分割 +
      `JSON.parse`，且 token 来自 `config/token.ts`。改为使用 `client/dxsse.ts`
      的 `fetchEventSource`，既减少代码又验证库。
- [x] 该文件不在 `src/rout/*`
      引用链中，确认它是被路由使用的页面还是死代码；死代码则删除。
- 验收：SSE 示例能逐字输出，取消请求后无未关闭的 reader。

## S-06 移除明文密钥（安全）✅（代码已删除，密钥待吊销）

`config/token.ts` 当前包含真实 SiliconFlow API Key（`SECRET_KEY = "sk-..."`）。

- [x] 从文件删除密钥，改为读取环境变量 /
      运行时输入。站点为纯前端，**任何写入前端的密钥都必须视为公开**：建议改为用户自行填写，或走后端代理。
- [x] `.gitignore` 已含 `config/*`，确认 `git ls-files config`
      为空（现状为空）。
- [ ] 若该 key 曾在任何公开位置出现，**在服务商后台吊销并轮换**。
- 验收：`grep -rn 'sk-' --exclude-dir=.git --exclude-dir=node_modules .`
  无结果。

## S-07 明确开发 / 构建流程 ✅（2026-10-21）

- [x] 验证 `deno task view`（`jsr:@funxdata/toolkit/view`）与 `deno task pack`
      是否负责 TS 转译；若否，补充构建脚本（`deno bundle` / esbuild）并把
      `index.html` 指向产物。
- [x] 确认 `index.html` 中 uxpages CDN 版本 `0.0.26` 是否需要升级 / 锁定。
- [x] 文档写明本地启动命令。
- 验收：从干净 clone 执行 README 中的命令可打开站点。

## S-08 路由元数据修正 ✅（2026-10-21）

- [x] `assets/router.json` 中 `"title": "instro"` 拼写错误（两处），应为
      `intro`。
- [x] tools 分组：`/tools` → `src/tools.ts`（title `instro`），`/tools/instro` →
      `src/tools_cache.ts`（title `cache`），路径与含义错位；重排为
      `/tools/intro`、`/tools/cache`。
- 验收：JSON 合法，菜单文案与页面一致。

## 完成记录

| 日期 | 任务 | 备注 |
| ---- | ---- | ---- |
