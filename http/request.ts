import type { HttpRequestConfig, HttpResponse } from "@/types/exhttp.ts";
import { Storage } from "@/tools/storage.ts"

const token_info = Storage.get("xtoken") as string;

export class HttpClient {
  constructor(private baseConfig: HttpRequestConfig = {}) {}

  private async request<T>(
    url: string,
    config: HttpRequestConfig = {}
  ): Promise<HttpResponse<T>> {
    const finalUrl = (config.baseURL || this.baseConfig.baseURL || '') + url;

    const controller = new AbortController();
    const timeout = config.timeout || this.baseConfig.timeout;

    // 设置定时器，并保存定时器 ID 以便清除
    let timer: number | undefined;
    if (timeout) {
      timer = setTimeout(() => controller.abort(), timeout);
    }

    try {
      const res = await fetch(finalUrl, {
        method: config.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-token': token_info,
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
    } finally {
      // 清理定时器，防止内存泄漏
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }

  // deno-lint-ignore no-explicit-any
  get<T = any>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...config, method: 'GET' });
  }

  // deno-lint-ignore no-explicit-any
  post<T = any>(url: string, body: any, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...config, method: 'POST', body });
  }

  // deno-lint-ignore no-explicit-any
  put<T = any>(url: string, body: any, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...config, method: 'PUT', body });
  }

  // deno-lint-ignore no-explicit-any
  patch<T = any>(url: string, body: any, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...config, method: 'PATCH', body });
  }

  // deno-lint-ignore no-explicit-any
  delete<T = any>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...config, method: 'DELETE' });
  }
}
