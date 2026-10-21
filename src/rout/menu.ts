import { menu_tpl } from "../views/menu.ts";

export const init_menu = (): void => {
  const menu = document.getElementById("menu");
  if (!menu) return;
  menu.innerHTML = menu_tpl;
};
