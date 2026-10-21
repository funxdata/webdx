import { fetchEventSource } from "./req.ts";
import type { DxSseOptions, SseHandlers, SseQuery } from "./types.ts";

/**
 * 构造数据交换服务的 SSE URL。
 *
 * ```ts
 * buildSseUrl("http://127.0.0.1:44944", {
 *   lib: "sys_info",
 *   symbol: "post_file_exists",
 *   args: { path: "README.md" },
 * });
 * // http://127.0.0.1:44944/sse?lib=sys_info&symbol=post_file_exists&args=%7B%22path%22%3A%22README.md%22%7D
 * ```
 */
export function buildSseUrl(baseURL: string, query: SseQuery): string {
  const base = baseURL.replace(/\/+$/, "");
  const path = base === "" ? "/sse" : `${base}/sse`;

  const params = new URLSearchParams();
  params.set("lib", query.lib);
  params.set("symbol", query.symbol);

  if (query.args !== undefined) {
    params.set(
      "args",
      typeof query.args === "string" ? query.args : JSON.stringify(query.args),
    );
  }
  if (query.interval_ms !== undefined) {
    params.set("interval_ms", String(query.interval_ms));
  }

  const reserved = new Set(["lib", "symbol", "args", "interval_ms"]);
  for (const [key, value] of Object.entries(query)) {
    if (reserved.has(key) || value === undefined || value === null) continue;
    params.set(key, typeof value === "string" ? value : JSON.stringify(value));
  }

  return `${path}?${params.toString()}`;
}

/** 尝试把 SSE 的 `data` 字段解析为 JSON，失败时返回原始字符串。 */
export function parseSseData(data: string): unknown {
  if (data === "") return null;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

/**
 * 取出数据交换服务返回的业务数据。
 *
 * 服务端回包有两种形态：
 * - `{ "data": { ... } }`
 * - `{ ... }`
 */
export function unwrapSseData(payload: unknown): unknown {
  if (
    payload !== null &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    "data" in payload
  ) {
    return (payload as { data: unknown }).data;
  }
  return payload;
}

/**
 * 面向 webdx 数据交换服务的 SSE 客户端。
 *
 * 负责 URL 构造、`data` JSON 解析、订阅生命周期管理；
 * 底层复用 `fetchEventSource` 的自动重连能力。
 *
 * ```ts
 * const sse = new DxSse("http://127.0.0.1:44944");
 * const done = sse.subscribe(
 *   { lib: "sys_info", symbol: "post_file_exists", args: { path: "README.md" } },
 *   { onmessage: (_msg, payload) => console.log(unwrapSseData(payload)) },
 * );
 * // ...
 * sse.close();
 * await done;
 * ```
 */
export class DxSse {
  private readonly baseURL: string;
  private readonly options: DxSseOptions;
  private readonly controllers = new Set<AbortController>();
  private closed = false;

  constructor(baseURL = "", options: DxSseOptions = {}) {
    this.baseURL = baseURL;
    this.options = options;
  }

  /** 当前活跃的订阅数量。 */
  get activeCount(): number {
    return this.controllers.size;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  /** 生成某个查询对应的 URL（便于调试或复用请求）。 */
  url(query: SseQuery): string {
    return buildSseUrl(this.baseURL, query);
  }

  /**
   * 发起一次 SSE 订阅。
   *
   * 返回的 Promise 在流正常结束、被外部 signal 中止或调用 `close()` 时 resolve；
   * 只有在 `onerror` 主动抛错时 reject。
   */
  subscribe(
    query: SseQuery,
    handlers: SseHandlers = {},
  ): Promise<void> {
    if (this.closed) {
      return Promise.reject(new Error("DxSse is closed"));
    }

    const controller = new AbortController();
    const externalSignal = handlers.signal;
    const onExternalAbort = () => controller.abort();

    if (externalSignal?.aborted) {
      controller.abort();
    } else {
      externalSignal?.addEventListener("abort", onExternalAbort, {
        once: true,
      });
    }

    this.controllers.add(controller);

    return fetchEventSource(this.url(query), {
      ...this.options,
      signal: controller.signal,
      onopen: handlers.onopen,
      onclose: handlers.onclose,
      onerror: handlers.onerror,
      onmessage: (message) => {
        const payload = parseSseData(message.data);
        handlers.onmessage?.(message, payload);
        if (message.event) {
          handlers.onevent?.(message.event, message, payload);
        }
      },
    }).finally(() => {
      this.controllers.delete(controller);
      externalSignal?.removeEventListener("abort", onExternalAbort);
    });
  }

  /** 中止全部订阅并关闭客户端。 */
  close(): void {
    this.closed = true;
    for (const controller of this.controllers) {
      controller.abort();
    }
    this.controllers.clear();
  }
}
