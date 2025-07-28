export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface HttpRequestConfig {
  method?: HttpMethod;
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