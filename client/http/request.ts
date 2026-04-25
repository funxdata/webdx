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

  // 整理headers
  private get_headers(config?: DxHttpRequestConfig) {
    let headers: Record<string, string> = {
      ...this.headers,
      ...config?.headers,
    };
    if (this.authorize) {
      headers = { ...headers, ...this.tokencache };
    }
    return headers;
  }

  private get_url(uri: string) {
    return this.url + uri;
  }

  // deno-lint-ignore no-explicit-any
  async get<T = any>(
    uri: string,
    config?: DxHttpRequestConfig,
  ): Promise<DxHttpResponse<T>> {
    const headers = this.get_headers(config);
    const res = await CoreRequest(this.get_url(uri), headers); // 发请求
    return CoreResponse<T>(res); // 解析响应
  }

  // deno-lint-ignore no-explicit-any
  async post<T = any>(
    uri: string,
    body: any,
    config?: DxHttpRequestConfig,
  ): Promise<DxHttpResponse<T>> {
    const headers = this.get_headers();
    const res = await CoreRequest(this.get_url(uri), headers, body);

    return CoreResponse<T>(res);
  }

  // deno-lint-ignore no-explicit-any
  async put<T = any>(
    uri: string,
    body: any,
    config?: DxHttpRequestConfig,
  ): Promise<DxHttpResponse<T>> {
    const headers = this.get_headers(config);
    const res = await CoreRequest(this.get_url(uri), headers, body);

    return CoreResponse<T>(res);
  }

  // deno-lint-ignore no-explicit-any
  async patch<T = any>(
    url: string,
    body: any,
    config?: DxHttpRequestConfig,
  ): Promise<DxHttpResponse<T>> {
    const headers = this.get_headers(config);
    const res = await CoreRequest(this.get_url(url), headers, body);
    return CoreResponse<T>(res);
  }

  // deno-lint-ignore no-explicit-any
  async delete<T = any>(
    url: string,
    config?: DxHttpRequestConfig,
  ): Promise<DxHttpResponse<T>> {
    const headers = this.get_headers(config);
    const res = await CoreRequest(this.get_url(url), headers);

    return CoreResponse<T>(res);
  }
  // 是否开启授权
  setAuthorize(status: boolean) {
    this.authorize = status;
  }

  // 设置token
  setToken(key: string, token: string) {
    this.tokencache = { [key]: token };
  }

  // 错误处理函数
  setRequestErrorHook(fn: Callback) {
    this.errorHook = fn;
  }
}
