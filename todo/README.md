# webdx 任务清单

> 生成时间：2026-10-21 状态：**merge 进行中，未解决冲突，工作区不可构建**

## 一、项目是什么

`@funxdata/webdx` 是一个基于 Deno 的 **Web 数据交换框架**，提供四个能力：

| 模块   | 入口                                  | 实现                                 | 说明                                                                                      |
| ------ | ------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| HTTP   | `client/dxhttp.ts` → `client/http/`   | `fetch` 封装                         | `DxHttp` 类：get/post/put/patch/delete、超时、token、按 Content-Type 自动解析             |
| SSE    | `client/dxsse.ts` → `client/sse/`     | `@microsoft/fetch-event-source` 移植 | `fetchEventSource` + 字节流解析（getBytes/getLines/getMessages）                          |
| Socket | `client/dxsoket.ts` → `client/soket/` | 原生 `WebSocket`                     | `DxSocket` 类：bindTask/taskSendMessage/removeTask、自动重连、任务状态表                  |
| Tools  | `client/dxtools.ts` → `client/tools/` | 浏览器 API                           | `Storage`（带过期时间的 localStorage）、`DxDate`（格式化/相对判断）、`isJSONSerializable` |

`src/` + `assets/` + `index.html` 是**官方文档站/演示站**：由 CDN 上的
`uxpages`（`TplToHtml`、`GlobalPagesRouter`）驱动，`assets/router.json`
声明路由，页面模板在 `src/views/`，数据请求在 `src/apis/`。

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

## 二、当前状态（2026-10-21 收尾）

- ✅ **merge 已提交**（`edfd320`），无冲突标记、无未合并路径。
- ✅ 版本 **0.2.0**；`client/**` 为唯一库布局，旧目录
  `http/`、`sse/`、`soket/`、`tools/`、`types/` 已删除。
- ✅ `deno.lock` 已停止跟踪（本地文件保留，`.gitignore` 已忽略）。
- ✅ HTTP：`DxHttpError` / `RequestTimeoutError`、`params`、header/token
  合并、FormData、error hook。
- ✅ SSE：跨运行时 `fetchEventSource`、`DxSse`、URL 构造与 payload 解析。
- ✅ Socket：`cmd` 协议、事件订阅、指数退避重连与自动重绑。
- ✅ 文档站：所有 router 页面已实现；`docs/*.md` 渲染；明文密钥与死代码已删除。
- ✅ 测试：**153 passed / 1 ignored**（cyctron 集成测试需
  `CYCTRON_URL`）；`deno fmt --check`、`deno lint`、`deno task check` 全部通过。
- ✅ CI：`.github/workflows/ci.yml` 已添加。
- ✅ 发布 dry-run：`@funxdata/webdx@0.2.0`，仅包含 `client/` + README / LICENSE
  / deno.json。
- 剩余：真实浏览器下的 `deno task view` 验证、密钥轮换（服务商后台）、`DxDate`
  API 细节（`commnet_time` 别名 / `isValid`）、JSR 实际发布。

## 三、任务索引

| 阶段   | 文件                                             | 内容                                  | 是否阻塞其他工作 |
| ------ | ------------------------------------------------ | ------------------------------------- | ---------------- |
| **P0** | [01-merge-conflicts.md](./01-merge-conflicts.md) | 收尾 merge、解决 5 个冲突、恢复可构建 | ✅ 阻塞全部      |
| **P1** | [02-library-client.md](./02-library-client.md)   | `client/` 库的正确性、类型、跨运行时  | 部分阻塞测试     |
| **P2** | [03-demo-site.md](./03-demo-site.md)             | 演示站补全、密钥与构建流程            | 否               |
| **P3** | [04-testing-ci.md](./04-testing-ci.md)           | 测试整理、去重、CI                    | 依赖 P0/P1       |
| **P4** | [05-docs-release.md](./05-docs-release.md)       | 文档、版本、发布、旧目录清理          | 依赖 P0          |
| —      | [decisions.md](./decisions.md)                   | 需要项目所有者拍板的 7 个问题         | 影响 P0/P4       |

## 四、推荐执行顺序

1. **P0 全部完成**（先让仓库能 `deno check` / `deno test`）。
2. **decisions.md 的 Q1–Q4 拍板**（决定是否删旧目录、版本号、lock 策略）。
3. **P1 的 L-01 ~ L-09**（库对外 API 的正确性优先于站内体验）。
4. **P3**（把 P1 的修复固化进测试）+ **P2**（站点内容补齐）。
5. **P4**（文档与发布）。

## 五、任务书写约定

- 每个任务都有唯一编号（`M-xx` / `L-xx` / `S-xx` / `T-xx` / `D-xx`），可直接在
  PR/commit message 中引用。
- 完成一个任务就把对应条目的 `[ ]` 改成
  `[x]`，并在该文件末尾「完成记录」追加日期与 commit。
- 「验收」是可执行命令或可观察结果，不写「改好了」这种描述。
