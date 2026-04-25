import type { DxHttpRequestConfig } from "./types.ts";

export const CoreRequest = async (
  url: string,
  config: DxHttpRequestConfig = {},
  body?: any,
): Promise<Response> => {
  const { timeout = 5000, ...rest } = config;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
      body: body,
    });

    // HTTP状态检查
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    // 返回原始 Response
    return res;
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("Request timeout");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};
