import {
  DxHttpError,
  type DxHttpErrorCode,
  RequestTimeoutError,
} from "./types.ts";

export const DEFAULT_TIMEOUT = 5000;
export const NO_BODY_METHODS = new Set(["GET", "HEAD"]);

/** 大小写不敏感地判断请求头是否存在。 */
export function hasHeader(
  headers: Record<string, string>,
  name: string,
): boolean {
  return Object.keys(headers).some((key) =>
    key.toLowerCase() === name.toLowerCase()
  );
}

/** 大小写不敏感地写入请求头（会替换同名不同大小写的键）。 */
export function setHeader(
  headers: Record<string, string>,
  name: string,
  value: string,
): void {
  const existing = Object.keys(headers).find((key) =>
    key.toLowerCase() === name.toLowerCase()
  );
  if (existing && existing !== name) {
    delete headers[existing];
  }
  headers[name] = value;
}

/** 合并多组请求头，后者覆盖前者（大小写不敏感）。 */
export function mergeHeaders(
  ...sources: Array<Record<string, string> | undefined>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source ?? {})) {
      setHeader(result, key, value);
    }
  }
  return result;
}

/**
 * 发起底层请求。
 *
 * - 只负责发送与超时，不判定业务状态；
 * - 非 JSON 的 `BodyInit`（FormData / Blob / ArrayBuffer / URLSearchParams /
 *   ReadableStream）会原样发送，不强制 `Content-Type: application/json`；
 * - 超时抛出 `RequestTimeoutError`。
 */
export const CoreRequest = async (
  url: string,
  method: string,
  body?: unknown,
  headers?: Record<string, string>,
  timeout: number = DEFAULT_TIMEOUT,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const requestInit: RequestInit = {
      method,
      headers: { ...(headers ?? {}) },
      signal: controller.signal,
    };

    if (body !== undefined && !NO_BODY_METHODS.has(method.toUpperCase())) {
      const encoded = encodeBody(body);
      requestInit.body = encoded.body;

      if (
        encoded.isJson &&
        !hasHeader(
          requestInit.headers as Record<string, string>,
          "content-type",
        )
      ) {
        setHeader(
          requestInit.headers as Record<string, string>,
          "Content-Type",
          "application/json",
        );
      }
    }

    return await fetch(url, requestInit);
  } catch (error) {
    if (isAbortError(error)) {
      throw new RequestTimeoutError(timeout);
    }
    throw new DxHttpError(
      error instanceof Error ? error.message : "Network request failed",
      { code: "NETWORK" as DxHttpErrorCode, cause: error },
    );
  } finally {
    clearTimeout(timer);
  }
};

function encodeBody(body: unknown): {
  body: RequestInit["body"];
  isJson: boolean;
} {
  if (
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    body instanceof ReadableStream
  ) {
    return { body: body as RequestInit["body"], isJson: false };
  }

  if (typeof body === "string") {
    return { body, isJson: true };
  }

  return { body: JSON.stringify(body), isJson: true };
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "AbortError";
}
