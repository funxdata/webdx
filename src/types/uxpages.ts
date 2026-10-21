/**
 * 文档站使用的 uxpages 全局 API 类型声明。
 *
 * 运行时由 index.html 中的 CDN 脚本注入：
 * - `browser.js`  → `TplToHtml`
 * - `router.js`   → `GlobalPagesRouter`
 *
 * 这里只声明 src/ 用到的部分，避免依赖外部包的类型。
 */

export interface RouteChild {
  path: string;
  url: string;
  title: string;
}

export interface Route {
  title: string;
  child: RouteChild[];
}

export interface PageRouterNode {
  /** 进入路由时加载的脚本地址。 */
  loadjs?: string;
  /** 路由钩子。 */
  hook?: () => void;
}

export interface PagesRouter {
  /** 注册路由。 */
  on(path: string, title: string): PageRouterNode | null;
  /** 查找路由。 */
  search(path: string): PageRouterNode;
  /** 跳转到指定路径。 */
  replace(path: string): void;
}

export interface Tpl {
  /** 用数据渲染模板字符串。 */
  renderString(
    template: string,
    data: Record<string, unknown>,
  ): Promise<string> | string;
}

/** `GlobalPagesRouter` 的类型别名。 */
export type PagesRouterInfo = PagesRouter;

declare global {
  // deno-lint-ignore no-var
  var TplToHtml: Tpl;
  // deno-lint-ignore no-var
  var GlobalPagesRouter: PagesRouter;
}
