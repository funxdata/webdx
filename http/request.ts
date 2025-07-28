import { HttpRequestConfig,HttpResponse } from "../types/exhttp.ts"
import { getTokenInfo } from "./token.ts"
const token_info = await getTokenInfo();
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
        'x-token': token_info.token,
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

  get<T = any>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...config, method: 'GET' });
  }

  post<T = any>(url: string, body: any, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...config, method: 'POST', body });
  }

  put<T = any>(url: string, body: any, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...config, method: 'PUT', body });
  }

  patch<T = any>(url: string, body: any, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...config, method: 'PATCH', body });
  }

  delete<T = any>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...config, method: 'DELETE' });
  }
}


