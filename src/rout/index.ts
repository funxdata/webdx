import { index_tpl } from "../views/index.ts"
export const index_init = async () => {
    const main_info = document.getElementById("main-info") as HTMLElement;
    main_info.innerHTML = index_tpl;
}
