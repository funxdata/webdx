import { InterceptorManager } from './interceptors.ts';

export interface FetchConfig extends RequestInit {
  baseURL?: string;
  timeout?: number;
  url?: string;
  params?: Record<string, any>;
}

export class FetchClient {
  defaults: FetchConfig = {
    headers: {
      'Content-Type': 'application/json',
    }
  };

  requestInterceptors = new InterceptorManager<FetchConfig>();
  responseInterceptors = new InterceptorManager<Response>();

  constructor(config?: FetchConfig) {
    Object.assign(this.defaults, config);
  }

  async request<T = any>(config: FetchConfig): Promise<T> {
    config = { ...this.defaults, ...config };

    config = await this.requestInterceptors.run(config);

    const fullUrl = this.buildUrl(config.baseURL ?? '', config.url!, config.params);
    const controller = new AbortController();
    const timeoutId = config.timeout
      ? setTimeout(() => controller.abort(), config.timeout)
      : null;

    try {
      const res = await fetch(fullUrl, {
        ...config,
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const handledRes = await this.responseInterceptors.run(res);
      return await handledRes.json();
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  get<T>(url: string, config?: FetchConfig) {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  post<T>(url: string, body: any, config?: FetchConfig) {
    return this.request<T>({ ...config, method: 'POST', body: JSON.stringify(body), url });
  }

  private buildUrl(base: string, path: string, params?: Record<string, any>): string {
    const query = params
      ? '?' + new URLSearchParams(params as Record<string, string>).toString()
      : '';
    return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '') + query;
  }
}