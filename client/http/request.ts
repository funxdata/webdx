// client/http/request.ts
import type {
  Callback,
  DxHttpRequestConfig,
  DxHttpResponse,
  DxHttpType,
} from "./types.ts";
import { CoreRequest } from "./core.ts";
import { CoreResponse } from "./parse.ts";

export class DxHttp implements DxHttpType {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
  private tokencache: Record<string, string> = {};
  private authorize: boolean = false;
  private errorHook: Callback = () => {};

  constructor(private baseConfig: DxHttpRequestConfig = {}) {
    this.url = baseConfig.baseURL;
    this.method = baseConfig.method;
    this.headers = baseConfig.headers;
    this.timeout = baseConfig.timeout;
  }

  private get_headers(config?: DxHttpRequestConfig) {
    const defaultHeaders = this.headers || {};
    
    let headers: Record<string, string> = {
      ...defaultHeaders,
      ...config?.headers,
    };
    
    const hasContentType = Object.keys(headers).some(key => key.toLowerCase() === "content-type");
    if (!hasContentType) {
      headers["Content-Type"] = "application/json";
    }
    
    if (this.authorize) {
      headers = { ...headers, ...this.tokencache };
    }
    
    return headers;
  }

  private get_url(uri: string) {
    if (!this.url) return uri;
    const base = this.url.replace(/\/+$/, '');
    const path = uri.startsWith('/') ? uri : `/${uri}`;
    return `${base}${path}`;
  }

  async get<T = any>(
    uri: string,
    config?: DxHttpRequestConfig,
  ): Promise<DxHttpResponse<T>> {
    const headers = this.get_headers(config);
    const res = await CoreRequest(
      this.get_url(uri),
      "GET",
      undefined,
      headers,  // 直接传递 headers，不要包在对象里
      this.timeout
    );
    return CoreResponse<T>(res);
  }

  async post<T = any>(
    uri: string,
    body: any,
    config?: DxHttpRequestConfig,
  ): Promise<DxHttpResponse<T>> {
    const headers = this.get_headers(config);
    const res = await CoreRequest(
      this.get_url(uri),
      "POST",
      body,
      headers,  // 直接传递 headers，不要包在对象里
      this.timeout
    );
    return CoreResponse<T>(res);
  }

  async put<T = any>(
    uri: string,
    body: any,
    config?: DxHttpRequestConfig,
  ): Promise<DxHttpResponse<T>> {
    const headers = this.get_headers(config);
    const res = await CoreRequest(
      this.get_url(uri),
      "PUT",
      body,
      headers,  // 直接传递 headers
      this.timeout
    );
    return CoreResponse<T>(res);
  }

  async patch<T = any>(
    uri: string,
    body: any,
    config?: DxHttpRequestConfig,
  ): Promise<DxHttpResponse<T>> {
    const headers = this.get_headers(config);
    const res = await CoreRequest(
      this.get_url(uri),
      "PATCH",
      body,
      headers,  // 直接传递 headers
      this.timeout
    );
    return CoreResponse<T>(res);
  }

  async delete<T = any>(
    uri: string,
    config?: DxHttpRequestConfig,
  ): Promise<DxHttpResponse<T>> {
    const headers = this.get_headers(config);
    const res = await CoreRequest(
      this.get_url(uri),
      "DELETE",
      undefined,
      headers,  // 直接传递 headers
      this.timeout
    );
    return CoreResponse<T>(res);
  }

  setAuthorize(status: boolean) {
    this.authorize = status;
  }

  setToken(key: string, token: string) {
    this.tokencache = { [key]: token };
  }

  setRequestErrorHook(fn: Callback) {
    this.errorHook = fn;
  }
}

