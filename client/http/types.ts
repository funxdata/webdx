export type DxHttpRequestConfig = {
  /** 请求的 URL */
  baseURL?: string;

  /** 请求方法，例如"GET", "POST", "PUT", "DELETE" */
  method?: string;

  /** 请求头，例如 { "Content-Type": "application/json" } */
  headers?: Record<string, string>;

  /** 请求超时时间（毫秒） */
  timeout?: number;
};

export type DxHttpResponse<T> = {
  /** 解析后的响应数据 */
  data: T;

  /** HTTP 状态码，例如 200, 404, 500 */
  status: number;

  /** 请求是否成功 (status 200-299) */
  msg: boolean;
};

export type Callback = () => void;
export type DxHttpType = {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;

  get<T>(url: string): Promise<DxHttpResponse<T>>;
  post<T>(url: string, data: T): Promise<DxHttpResponse<T>>;
  put<T>(url: string, data: T): Promise<DxHttpResponse<T>>;
  patch<T>(url: string, data: T): Promise<DxHttpResponse<T>>;
  delete<T>(url: string): Promise<DxHttpResponse<T>>;

  setAuthorize(status: boolean): void; // 是否开启授权
  setToken(key: string, token: string): void; // 设置token
  setRequestErrorHook: (fn: Callback) => void; // 错误处理函数
};
