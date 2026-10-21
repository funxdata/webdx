import { get_mark_info } from "../apis/mark.ts";

declare const marked: { parse(markdown: string): string } | undefined;

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/**
 * 把 `docs/<file>` 渲染到 `#main-info`。
 *
 * 路由模块只需在加载时调用一次：
 * ```ts
 * import { render_doc } from "../rout/doc.ts";
 * void render_doc("http.md");
 * ```
 */
export const render_doc = async (file: string): Promise<void> => {
  const main = document.getElementById("main-info");
  if (!main) return;

  main.innerHTML = `<div class="markdown-body" id="mark-content">正在加载 ${
    escapeHtml(file)
  }…</div>`;

  try {
    const response = await get_mark_info(file);
    const text = typeof response.data === "string"
      ? response.data
      : JSON.stringify(response.data, null, 2);

    const parser = typeof marked === "undefined" ? undefined : marked;
    const content = parser
      ? parser.parse(text)
      : `<pre>${escapeHtml(text)}</pre>`;

    main.innerHTML =
      `<div class="markdown-body" id="mark-content">${content}</div>`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    main.innerHTML =
      `<div class="markdown-body" id="mark-content"><p>加载文档失败：${
        escapeHtml(message)
      }</p></div>`;
  }
};
