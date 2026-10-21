import { render_doc } from "./doc.ts";

export const index_init = (): Promise<void> => render_doc("index.md");
