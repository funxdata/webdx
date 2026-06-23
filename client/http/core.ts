// client/http/core.ts
import type { DxHttpRequestConfig } from "./types.ts";

export const DEFAULT_TIMEOUT = 5000;
export const NO_BODY_METHODS = new Set(["GET", "HEAD"]);

export class RequestTimeoutError extends Error {
  constructor(timeout: number) {
    super(`Request timeout after ${timeout}ms`);
    this.name = "RequestTimeoutError";
  }
}

export const CoreRequest = async (
  url: string,
  method: string,
  body?: unknown,
  headers?: Record<string, string>,  // 直接接收 headers
  timeout: number = DEFAULT_TIMEOUT,
): Promise<Response> => {
  console.log("🔍 [CoreRequest] Headers received:", JSON.stringify(headers));

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const requestInit: RequestInit = {
      method,
      headers: headers || {},
      signal: controller.signal,
    };

    if (body !== undefined && !NO_BODY_METHODS.has(method.toUpperCase())) {
      requestInit.body = typeof body === "string" ? body : JSON.stringify(body);
      
      // 检查是否有 Content-Type
      const hasCT = headers && Object.keys(headers).some(key => key.toLowerCase() === "content-type");
      
      if (!hasCT && requestInit.headers) {
        (requestInit.headers as Record<string, string>)["Content-Type"] = "application/json";
      }
    }

    console.log("🔍 [CoreRequest] Final Headers:", JSON.stringify(requestInit.headers));

    const res = await fetch(url, requestInit);

    if (!res.ok) {
      const text = await res.text();
      console.log("🔍 [CoreRequest] Error response:", text);
      throw new Error(`Request failed with HTTP status ${res.status}`);
    }

    return res;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new RequestTimeoutError(timeout);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

