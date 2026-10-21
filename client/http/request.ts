import type {
  Callback,
  DxHttpRequestConfig,
  DxHttpResponse,
  DxHttpType,
} from "./types.ts";
import { DxHttpError } from "./types.ts";
import {
  CoreRequest,
  DEFAULT_TIMEOUT,
  hasHeader,
  mergeHeaders,
  setHeader,
} from "./core.ts";
import { CoreResponse } from "./parse.ts";

export class DxHttp implements DxHttpType {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  timeout: number;

  private tokencache: Record<string, string> = {};
  private authorize = false;
  private errorHook: Callback | null = null;

  constructor(baseConfig: DxHttpRequestConfig = {}) {
    this.url = baseConfig.baseURL;
    this.method = baseConfig.method;
    this.headers = baseConfig.headers;
    this.timeout = baseConfig.timeout ?? DEFAULT_TIMEOUT;
  }

  private get_headers(config?: DxHttpRequestConfig): Record<string, string> {
    const headers = mergeHeaders(this.headers, config?.headers);

    if (this.authorize) {
      for (const [key, value] of Object.entries(this.tokencache)) {
        // 显式请求头优先于 token。
        if (!hasHeader(headers, key)) {
          setHeader(headers, key, value);
        }
      }
    }

    return headers;
  }

  private get_url(
    uri: string,
    params?: DxHttpRequestConfig["params"],
  ): string {
    let url = uri;

    const isAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(uri);
    if (this.url && !isAbsolute) {
      const base = this.url.replace(/\/+$/, "");
      const path = uri.startsWith("/") ? uri : `/${uri}`;
      url = `${base}${path}`;
    }

    if (!params) return url;

    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        query.set(key, String(value));
      }
    }

    const queryString = query.toString();
    if (!queryString) return url;

    return `${url}${url.includes("?") ? "&" : "?"}${queryString}`;
  }

  private async request<T>(
    method: string,
    uri: string,
    body: unknown,
    config?: DxHttpRequestConfig,
  ): Promise<DxHttpResponse<T>> {
    const headers = this.get_headers(config);

    try {
      const response = await CoreRequest(
        this.get_url(uri, config?.params),
        method,
        body,
        headers,
        config?.timeout ?? this.timeout,
      );

      const parsed = await CoreResponse<T>(response);

      if (!response.ok) {
        throw new DxHttpError(
          `Request failed with HTTP status ${response.status}`,
          {
            code: "HTTP",
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: parsed.data,
          },
        );
      }

      return parsed;
    } catch (error) {
      const dxError = error instanceof DxHttpError ? error : new DxHttpError(
        error instanceof Error ? error.message : "Network request failed",
        { code: "NETWORK", cause: error },
      );

      this.invokeErrorHook(dxError);
      throw dxError;
    }
  }

  // deno-lint-ignore no-explicit-any
  get<T = any>(
    uri: string,
    config?: DxHttpRequestConfig,
  ): Promise<DxHttpResponse<T>> {
    return this.request<T>("GET", uri, undefined, config);
  }

  // deno-lint-ignore no-explicit-any
  post<T = any>(
    uri: string,
    body: unknown,
    config?: DxHttpRequestConfig,
  ): Promise<DxHttpResponse<T>> {
    return this.request<T>("POST", uri, body, config);
  }

  // deno-lint-ignore no-explicit-any
  put<T = any>(
    uri: string,
    body: unknown,
    config?: DxHttpRequestConfig,
  ): Promise<DxHttpResponse<T>> {
    return this.request<T>("PUT", uri, body, config);
  }

  // deno-lint-ignore no-explicit-any
  patch<T = any>(
    uri: string,
    body: unknown,
    config?: DxHttpRequestConfig,
  ): Promise<DxHttpResponse<T>> {
    return this.request<T>("PATCH", uri, body, config);
  }

  // deno-lint-ignore no-explicit-any
  delete<T = any>(
    uri: string,
    config?: DxHttpRequestConfig,
  ): Promise<DxHttpResponse<T>> {
    return this.request<T>("DELETE", uri, undefined, config);
  }

  setAuthorize(status: boolean): void {
    this.authorize = status;
  }

  setToken(key: string, token: string): void {
    this.tokencache = { ...this.tokencache, [key]: token };
  }

  setRequestErrorHook(fn: Callback): void {
    this.errorHook = fn;
  }

  private invokeErrorHook(error: unknown): void {
    if (!this.errorHook) return;
    try {
      this.errorHook(error);
    } catch {
      // 错误回调不应影响请求本身。
    }
  }
}
