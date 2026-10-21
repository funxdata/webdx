import { menu_tpl } from "../views/menu.ts";
export const init_menu = () => {
  const menu = document.getElementById("menu");
  menu.innerHTML = menu_tpl;
};
