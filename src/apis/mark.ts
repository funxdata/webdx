import { DxHttp } from "@/client/dxhttp.ts";
const request = new DxHttp({
  baseURL: "/docs/",
  timeout: 3000,
  headers: {
    "Content-Type": "application/html",
  },
});

export const get_mark_info = async (file_name: string) => {
  return await request.get(file_name);
};
