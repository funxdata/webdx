# webdx 任务清单

> 生成时间：2026-10-21
> 状态：**merge 进行中，未解决冲突，工作区不可构建**

## 一、项目是什么

`@funxdata/webdx` 是一个基于 Deno 的 **Web 数据交换框架**，提供四个能力：

| 模块 | 入口 | 实现 | 说明 |
| --- | --- | --- | --- |
| HTTP | `client/dxhttp.ts` → `client/http/` | `fetch` 封装 | `DxHttp` 类：get/post/put/patch/delete、超时、token、按 Content-Type 自动解析 |
| SSE | `client/dxsse.ts` → `client/sse/` | `@microsoft/fetch-event-source` 移植 | `fetchEventSource` + 字节流解析（getBytes/getLines/getMessages） |
| Socket | `client/dxsoket.ts` → `client/soket/` | 原生 `WebSocket` | `DxSocket` 类：bindTask/taskSendMessage/removeTask、自动重连、任务状态表 |
| Tools | `client/dxtools.ts` → `client/tools/` | 浏览器 API | `Storage`（带过期时间的 localStorage）、`DxDate`（格式化/相对判断）、`isJSONSerializable` |

`src/` + `assets/` + `index.html` 是**官方文档站/演示站**：由 CDN 上的 `uxpages`（`TplToHtml`、`GlobalPagesRouter`）驱动，`assets/router.json` 声明路由，页面模板在 `src/views/`，数据请求在 `src/apis/`。

```
deno.json (exports)
  ├── ./dxhttp   -> client/dxhttp.ts
  ├── ./dxsse    -> client/dxsse.ts
  ├── ./dxsoket  -> client/dxsoket.ts
  ├── ./tools    -> client/dxtools.ts
  └── ./types    -> client/types.ts

src/  ── 演示站（不对外导出）
http/ sse/ soket/ tools/ types/ server/  ── 旧结构（server 时代遗留，与 client/ 重复）
tests/ ── Deno.test 用例 + 手工脚本混放
```

## 二、当前状态（2026-10-21 更新）

仓库正在把 **244b7ba（origin/main：Web-client 化 + 文档站）** 合并进 **ed458e0（本地：tools/storage、request 修复、测试）**。

- ✅ **全部冲突已解决**（`README.md`、`deno.json`、`deno.lock`、`index.html`、`src/app.ts`），`git status` 无未合并路径。
- ✅ `deno.json` 采用 client 布局（`exports` 指向 `client/**`，版本 `0.1.2`），并补充了 `test` / `check` / `lint` / `fmt` tasks 与 `description`。
- ✅ `deno.lock` 取 origin/main 版本；`index.html`、`src/app.ts` 取 origin/main 版本，`src/app.ts` 的 `@/router/types.ts`、`@/tpls/types.ts` 已改为本地 `src/types/uxpages.ts`。
- ✅ `src/` 中 `deno check` 通过；client 入口 0 错误。
- ⏳ `.git/MERGE_HEAD` 仍在：冲突已解决但 **merge commit 尚未提交**，等待确认后执行 `git commit`。
- ✅ 已验证：`deno task check` 通过；SSE / Socket / HTTP 共 **129 个测试通过**；`git diff HEAD --check` 通过。
- 剩余工作：旧目录清理（D-05 / Q2）、版本号与 lock 策略（Q3/Q4）、文档站页面补全（P2）。

## 三、任务索引

| 阶段 | 文件 | 内容 | 是否阻塞其他工作 |
| --- | --- | --- | --- |
| **P0** | [01-merge-conflicts.md](./01-merge-conflicts.md) | 收尾 merge、解决 5 个冲突、恢复可构建 | ✅ 阻塞全部 |
| **P1** | [02-library-client.md](./02-library-client.md) | `client/` 库的正确性、类型、跨运行时 | 部分阻塞测试 |
| **P2** | [03-demo-site.md](./03-demo-site.md) | 演示站补全、密钥与构建流程 | 否 |
| **P3** | [04-testing-ci.md](./04-testing-ci.md) | 测试整理、去重、CI | 依赖 P0/P1 |
| **P4** | [05-docs-release.md](./05-docs-release.md) | 文档、版本、发布、旧目录清理 | 依赖 P0 |
| — | [decisions.md](./decisions.md) | 需要项目所有者拍板的 7 个问题 | 影响 P0/P4 |

## 四、推荐执行顺序

1. **P0 全部完成**（先让仓库能 `deno check` / `deno test`）。
2. **decisions.md 的 Q1–Q4 拍板**（决定是否删旧目录、版本号、lock 策略）。
3. **P1 的 L-01 ~ L-09**（库对外 API 的正确性优先于站内体验）。
4. **P3**（把 P1 的修复固化进测试）+ **P2**（站点内容补齐）。
5. **P4**（文档与发布）。

## 五、任务书写约定

- 每个任务都有唯一编号（`M-xx` / `L-xx` / `S-xx` / `T-xx` / `D-xx`），可直接在 PR/commit message 中引用。
- 完成一个任务就把对应条目的 `[ ]` 改成 `[x]`，并在该文件末尾「完成记录」追加日期与 commit。
- 「验收」是可执行命令或可观察结果，不写「改好了」这种描述。
