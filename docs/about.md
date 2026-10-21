# 关于 webdx

## 定位

webdx 是一个**数据交换 / 数据存储**工具库：

- **交换**：HTTP 请求、SSE 事件流、WebSocket 长连接；
- **存储**：浏览器 `localStorage` 的带过期封装；
- **辅助**：日期格式化、URL 解析、JSON 可序列化判断。

它不提供 UI、不绑定框架，也不要求构建工具。库代码直接以 TypeScript 发布，由 Deno
原生执行。

## 包信息

| 字段     | 值                                      |
| -------- | --------------------------------------- |
| 包名     | `@funxdata/webdx`                       |
| 分发     | JSR                                     |
| 语言     | TypeScript（Deno）                      |
| 许可证   | MIT                                     |
| 当前布局 | `client/**` 为对外库，`src/**` 为文档站 |

## 安装

```bash
deno add jsr:@funxdata/webdx
```

```ts
import { DxHttp } from "@funxdata/webdx/dxhttp";
import { DxSse } from "@funxdata/webdx/dxsse";
import { DxSocket } from "@funxdata/webdx/dxsoket";
import { DxDate, Storage } from "@funxdata/webdx/tools";
```

## 仓库结构

```text
client/                 对外发布的库
  dxhttp.ts             HTTP 入口
  dxsse.ts              SSE 入口
  dxsoket.ts            Socket 入口
  dxtools.ts            Tools 入口
  types.ts              类型入口
  http/                 DxHttp 实现
  sse/                  SSE 解析 / 请求 / 高层客户端
  soket/                DxSocket 实现与协议
  tools/                Storage / DxDate / JSON 工具
  utils/                URL 工具（未导出）

src/                    文档 / 演示站
assets/                 站点静态资源与 router.json
docs/                   本目录
tests/                  单元测试与 mock 辅助
todo/                   任务清单与待决策项
```

## 相关链接

- [JSON Schema / JSR](https://jsr.io/@funxdata/webdx)
- [Deno 官网](https://deno.com/)
- [JSR 文档](https://jsr.io/docs)

## 版本

库当前声明版本见 `deno.json`。版本变更、破坏性调整记录在
`CHANGELOG.md`（规划中）。

## 贡献

1. 阅读 `todo/` 中的任务清单与待决策项。
2. 修改 `client/**` 时同步更新 `docs/**`。
3. 提交前运行：

```bash
deno fmt --check client tests
deno lint client tests
deno test --allow-net tests/
```
