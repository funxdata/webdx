import { Dxhttp } from "@/client/dxhttp.ts";
const request = new Dxhttp({
  baseURL: '/assets/',
  timeout: 3000
});

export const get_router_info =async ()=>{
    return  await request.get(`router.json`);
}

