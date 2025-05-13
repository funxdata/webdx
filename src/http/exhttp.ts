// 使用 fetch 获取数据
// http.ts
export type RequestOptions = {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: HeadersInit;
    xtoken:string;
    body?: any;
  };
  
  import { FetchClient } from './core.ts';

  const Dxhttp = new FetchClient({
    baseURL: 'https://jsonplaceholder.typicode.com',
    timeout: 5000,
  });
  
  export default Dxhttp;
  