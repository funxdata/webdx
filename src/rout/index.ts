import { index_tpl } from "../views/index.ts";
import { get_mark_info } from "../apis/mark.ts";
declare const marked: any;
export const index_init = async () => {
  const main_info = document.getElementById("main-info") as HTMLElement;
  main_info.innerHTML = index_tpl;

  const mark_node = main_info.querySelector("#mark-content") as HTMLElement;

  //  const req_markData = await get_mark_info("index.md");
  //  console.log(req_markData);
  //  mark_node.innerHTML = marked(req_markData.data);
};
