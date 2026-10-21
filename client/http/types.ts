/** HTTP 请求配置。 */
export type DxHttpRequestConfig = {
  /** 基址；为空时直接使用 `url`。 */
  baseURL?: string;

  /** 请求方法（保留字段；具体方法由 `get` / `post` 等决定）。 */
  method?: string;

  /** 请求头，键名大小写不敏感。 */
  headers?: Record<string, string>;

  /** 超时时间（毫秒），默认 5000。 */
  timeout?: number;

  /** 查询参数；`undefined` / `null` 会被跳过。 */
  params?: Record<string, string | number | boolean | null | undefined>;
};

export type DxHttpResponse<T> = {
  /** 解析后的响应数据；204 / 205 时为 null。 */
  data: T;

  /** HTTP 状态码。 */
  status: number;

  /** HTTP 状态文本。 */
  statusText: string;

  /** 是否为 2xx。 */
  ok: boolean;

  /** 响应头。 */
  headers: Headers;

  /**
   * 是否为 2xx。
   * @deprecated 请使用 `ok`，保留该字段仅为兼容旧代码。
   */
  msg: boolean;
};

/** 请求失败回调。 */
export type Callback = (error: unknown) => void;

export type DxHttpType = {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;

  get<T>(url: string, config?: DxHttpRequestConfig): Promise<DxHttpResponse<T>>;
  post<T>(
    url: string,
    data: unknown,
    config?: DxHttpRequestConfig,
  ): Promise<DxHttpResponse<T>>;
  put<T>(
    url: string,
    data: unknown,
    config?: DxHttpRequestConfig,
  ): Promise<DxHttpResponse<T>>;
  patch<T>(
    url: string,
    data: unknown,
    config?: DxHttpRequestConfig,
  ): Promise<DxHttpResponse<T>>;
  delete<T>(
    url: string,
    config?: DxHttpRequestConfig,
  ): Promise<DxHttpResponse<T>>;

  /** 是否在请求中附加 token。 */
  setAuthorize(status: boolean): void;
  /** 设置一个 token 头；多次调用会合并。 */
  setToken(key: string, token: string): void;
  /** 设置请求失败回调。 */
  setRequestErrorHook(fn: Callback): void;
};

/** 错误分类。 */
export type DxHttpErrorCode = "HTTP" | "TIMEOUT" | "NETWORK";

/** DxHttp 抛出的错误。 */
export class DxHttpError extends Error {
  readonly code: DxHttpErrorCode;
  readonly status: number;
  readonly statusText: string;
  readonly headers?: Headers;
  readonly data?: unknown;

  constructor(
    message: string,
    options: {
      code: DxHttpErrorCode;
      status?: number;
      statusText?: string;
      headers?: Headers;
      data?: unknown;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "DxHttpError";
    this.code = options.code;
    this.status = options.status ?? 0;
    this.statusText = options.statusText ?? "";
    this.headers = options.headers;
    this.data = options.data;
  }
}

/** 请求超时。 */
export class RequestTimeoutError extends DxHttpError {
  constructor(timeout: number) {
    super(`Request timeout after ${timeout}ms`, {
      code: "TIMEOUT",
      status: 0,
    });
    this.name = "RequestTimeoutError";
  }
}
