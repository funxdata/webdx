import { getTokenInfo } from "./token.ts"
const token_info = await getTokenInfo();
export interface HttpRequestConfig {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    baseURL?: string;
    headers?: HeadersInit;
    timeout?: number;
    body?: unknown;
  }
  
  // deno-lint-ignore no-explicit-any
  export interface HttpResponse<T = any> {
    data: T;
    status: number;
    ok: boolean;
  }
  
  export class HttpClient {
    constructor(private baseConfig: HttpRequestConfig = {}) {}
  
    private async request<T>(url: string, config: HttpRequestConfig = {}): Promise<HttpResponse<T>> {
      const finalUrl = (config.baseURL || this.baseConfig.baseURL || '') + url;
  
      const controller = new AbortController();
      const timeout = config.timeout || this.baseConfig.timeout;
      if (timeout) {
        setTimeout(() => controller.abort(), timeout);
      }
  
      const res = await fetch(finalUrl, {
        method: config.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          "x-token":token_info.token,
          ...this.baseConfig.headers,
          ...config.headers
        },
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal: controller.signal
      });
  
      const data = await res.json().catch(() => null);
  
      return {
        data,
        status: res.status,
        ok: res.ok
      };
    }
  
    // deno-lint-ignore no-explicit-any
    get<T = any>(url: string, config?: HttpRequestConfig) {
      return this.request<T>(url, { ...config, method: 'GET' });
    }
  
    // deno-lint-ignore no-explicit-any
    post<T = any>(url: string, body: any, config?: HttpRequestConfig) {
      return this.request<T>(url, { ...config, method: 'POST', body });
    }
  
    // 也可以加 put/delete
    // deno-lint-ignore no-explicit-any
    put<T = any>(url: string, body: any, config?: HttpRequestConfig) {
      return this.request<T>(url, { ...config, method: 'PUT', body });
    }
     // 也可以加 put/delete
    // deno-lint-ignore no-explicit-any
    patch<T = any>(url: string, body: any, config?: HttpRequestConfig) {
      return this.request<T>(url, { ...config, method: 'PATCH', body });
    }

     // 也可以加 put/delete
    // deno-lint-ignore no-explicit-any
    delete<T = any>(url: string, config?: HttpRequestConfig) {
      return this.request<T>(url, { ...config, method: 'DELETE' });
    }
}