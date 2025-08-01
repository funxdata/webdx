
import { Dxhttp } from "../http/exhttp.ts";
const request = new Dxhttp({
  baseURL: 'https://user.funxdata.com/v1',
  timeout: 5000
});
// https://user.funxdata.com/v1/user/self

// 获取个人信息
const init = async ()=>{
    const req_data =  await request.get(`/user/self`)
    console.log(req_data);
}
init();
