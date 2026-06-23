import type { DxHttpRequestConfig } from "./types.ts";

// 常量提取
export const DEFAULT_TIMEOUT = 5000;
export const NO_BODY_METHODS = new Set(["GET", "HEAD"]);

/** 自定义超时错误，用于业务区分超时失败 */
export class RequestTimeoutError extends Error {
  constructor(timeout: number) {
    super(`Request timeout after ${timeout}ms`);
    this.name = "RequestTimeoutError";
  }
}

/**
 * 底层fetch请求封装，带超时中断
 * @param url 完整请求地址
 * @param method 请求方法
 * @param body 请求体
 * @param config 自定义请求配置（headers/timeout/signal等）
 * @returns fetch原始Response
 */
export const CoreRequest = async (
  url: string,
  method: string,
  body?: unknown,
  config: DxHttpRequestConfig = {},
): Promise<Response> => {
  const { timeout = DEFAULT_TIMEOUT, headers = {}, ...restConfig } = config;

  const controller = new AbortController();
  // 超时计时器
  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const requestInit: RequestInit = {
      ...restConfig,
      method,
      headers,
      signal: controller.signal,
    };

    // 非GET/HEAD才携带body
    if (body !== undefined && !NO_BODY_METHODS.has(method.toUpperCase())) {
      // 自动序列化JSON，字符串直接透传
      requestInit.body = typeof body === "string" ? body : JSON.stringify(body);
      // 无自定义content-type时自动补充json头
      if (!(headers instanceof Headers) && !("Content-Type" in headers)) {
        (requestInit.headers as Record<string, string>)["Content-Type"] =
          "application/json";
      }
    }

    const res = await fetch(url, requestInit);

    if (!res.ok) {
      throw new Error(`Request failed with HTTP status ${res.status}`);
    }

    return res;
  } catch (err) {
    // 区分超时中断
    if ((err as Error).name === "AbortError") {
      throw new RequestTimeoutError(timeout);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};
