import { HttpClient } from './request.ts';
const request = new HttpClient({
    baseURL: '/assets/',
  timeout: 3000
});

export const get_router_info =async ()=>{
    return  await request.get(`router.json`);
}

