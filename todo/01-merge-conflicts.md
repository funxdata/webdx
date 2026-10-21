# P0 · 收尾合并（阻塞全部）

目标：工作区无冲突标记、无未合并路径，`deno check` 与核心测试可运行。

> **2026-10-21 状态**：M-01 ~ M-05 已完成，全部冲突已解决并 `git add`；M-06 的 merge commit 尚未提交（等待确认）。

## M-01 解决 `README.md` 冲突 ✅
- [x] 采用 origin/main 的定位：「Web-client Data Exchange Framework」。
- [x] 安装命令统一为 `deno add jsr:@funxdata/webdx`（不带前导 4 空格）。
- [x] 删除全部 `<<<<<<<` / `=======` / `>>>>>>>` 行。
- 验收：`grep -n '^<<<<<<<\|^=======$\|^>>>>>>>' README.md` 无输出；README 已完整重写（见 D-01）。

## M-02 合并 `deno.json` ✅（`publish.include` 待定）
- [x] 以 origin/main 侧为基线：`version: 0.1.2`、`exports` 全部指向 `client/**`、保留 `tailwindcss` 导入。
- [x] 保留 `"exclude"` 中的 `assets/`；`compilerOptions.lib` 保留 `deno.ns`、`dom`、`esnext`。
- [x] 保留 `"@/"` 映射（站点源码使用；发布时通过 `exclude` 排除 `src/`）。
- [x] 去掉指向已删除 `./server/sse.ts` 的 `tasks.sse`。
- [x] 补充 `tasks.test` / `tasks.check` / `tasks.lint` / `tasks.fmt` 与 `description`。
- [ ] 增加发布范围（建议）：
  ```json
  "publish": { "include": ["client/"] }
  ```
- 验收：`deno task check` 通过；`deno task` 可列出任务。

## M-03 处理 `deno.lock` 冲突 ✅
- [x] 不手工合并 lock 内容，取 origin/main 版本（`git checkout --theirs deno.lock`）。
- [x] 与 decisions.md Q4 保持一致（暂继续跟踪）。
- [x] `git status` 中无 `AA deno.lock`；`deno check` 可正常解析依赖。
- [ ] 待 Q4 决定后：重新 `deno install` 或 `git rm --cached deno.lock`。

## M-04 解决 `index.html` 冲突 ✅
- [x] 保留 origin/main 的站点版（`<div id="app">`、`/assets/css/base.css`、`/assets/markdown.css`、`marked`、uxpages `browser.js`/`router.js`）。
- [ ] `deno task view` 启动后的实际转译 / 404 验证（S-07）。

## M-05 解决 `src/app.ts` 冲突 ✅
- [x] 保留 origin/main 的站点启动逻辑（`get_router_info` → `GlobalPagesRouter.on(...)` → 渲染 `main_tpl` / `menu_tpl` → `replace("/")`）。
- [x] 删除不存在的导入 `@/router/types.ts`、`@/tpls/types.ts`，改为 `@/src/types/uxpages.ts`（新增本地类型声明）。
- [x] 修正原代码中 `GlobalPagesRoute` / `GlobalPagesRouter` 变量名不一致的问题。
- [x] 顶层 `await` 与 `index.html` 的 `type="module"` 一致。
- 验收：`deno check src/app.ts` 通过。

## M-06 完成 merge 并建立基线 ⏳
- [ ] `git commit` 提交 merge（冲突已解决，尚未提交）。
- [x] 确认没有误删本地成果：`Storage` 过期时间、类型修复、dxhttp 测试均存在于 `client/`。
- [ ] 打基线标签（可选）：`git tag pre-refactor-baseline`。
- 验收（已验证部分）：
  ```bash
  git status --short          # 无 UU/AA/DU 等 ✅
  grep -rn '^<<<<<<< \|^>>>>>>> ' --exclude-dir=.git --exclude-dir=node_modules .  # 无输出 ✅
  deno check client/dxhttp.ts client/dxsse.ts client/dxsoket.ts client/dxtools.ts client/types.ts src/app.ts  # 通过 ✅
  deno test --allow-net tests/sse_*.ts tests/socket_*.ts tests/dxhttp*_test.ts  # 129 passed ✅
  ```

## 完成记录

| 日期 | 任务 | 备注 |
| --- | --- | --- |
| 2026-10-21 | M-01 ~ M-05 | 解决全部 5 个冲突文件；新增 `src/types/uxpages.ts`；清理 `git diff --check` 报告的尾随空白 |
| 2026-10-21 | M-06（部分） | 无未合并路径、无冲突标记、check / test 全绿；merge commit 待提交 |
