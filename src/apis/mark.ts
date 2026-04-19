import { Dxhttp } from "@/client/dxhttp.ts";
const request = new Dxhttp({
  baseURL: '/docs/',
  timeout: 3000
});
const headers = {
  headers: {
    'Content-Type': 'application/html'
  }
};

export const get_mark_info =async (file_name:string)=>{
    return  await request.get(file_name,headers);
}
