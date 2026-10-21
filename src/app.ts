import type { PagesRouterInfo, Route } from "@/src/types/uxpages.ts";
import { get_router_info } from "@/src/apis/route.ts";
import { main_tpl } from "./views/main.ts";
import { menu_tpl } from "./views/menu.ts";
import { index_init } from "./rout/index.ts";

// 由 index.html 中的 CDN 脚本注入，类型见 src/types/uxpages.ts。
const TplToHtml = globalThis.TplToHtml;
const pagesRouter: PagesRouterInfo = globalThis.GlobalPagesRouter;

const req_routerData = await get_router_info();
const routerinfo = req_routerData.data as Route[];

for (let index = 0; index < routerinfo.length; index++) {
  const allinfo = routerinfo[index];
  for (let j = 0; j < allinfo.child.length; j++) {
    const element = allinfo.child[j];
    const rout = pagesRouter.on(element.path, element.title);
    if (element.url != "") {
      if (rout != null) {
        rout.loadjs = element.url;
      }
    }
  }
}

const root_node = pagesRouter.search("/");
root_node.hook = () => {
  index_init();
};

const app_main = document.getElementById("app") as HTMLElement;
app_main.innerHTML = main_tpl;

const app_navtabs = app_main.querySelector("#asides") as HTMLElement;
app_navtabs.innerHTML = await TplToHtml.renderString(menu_tpl, {
  "tabledata": routerinfo,
});

pagesRouter.replace("/");
