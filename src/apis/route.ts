import { DxHttp } from "@/client/dxhttp.ts";
const request = new DxHttp({
  baseURL: "/assets/",
  timeout: 3000,
  headers: {
    "Content-Type": "application/html",
  },
});

export const get_router_info = async () => {
  return await request.get(`router.json`);
};
