import {
  type EventSourceMessage,
  getBytes,
  getLines,
  getMessages,
} from "./parse.ts";

export const EventStreamContentType = "text/event-stream";

const DEFAULT_RETRY_INTERVAL = 1000;
const LAST_EVENT_ID_HEADER = "last-event-id";

export type OnError = (err: unknown) => number | null | undefined | void;

export interface FetchEventSourceInit
  extends Omit<RequestInit, "headers" | "signal"> {
  /** 请求头，必须是 `Record<string, string>`。 */
  headers?: Record<string, string>;

  /** 中止信号：触发后请求被取消，`fetchEventSource` 正常 resolve。 */
  signal?: AbortSignal;

  /**
   * 收到响应时调用。默认会校验状态码与 `content-type`。
   * 可以在其中抛错来拒绝这次响应（随后进入 `onerror` 重试逻辑）。
   */
  onopen?: (response: Response) => Promise<void> | void;

  /** 收到任意 SSE 消息时调用（包括自定义 `event` 的消息）。 */
  onmessage?: (ev: EventSourceMessage) => void;

  /** 服务端正常结束流时调用。 */
  onclose?: () => void;

  /**
   * 请求 / 解析 / 回调出错时调用。
   * - 返回数字：等待该毫秒数后重连（携带 `last-event-id`）。
   * - 返回 `undefined`：使用服务端 `retry:` 或默认 1000ms。
   * - 抛出异常：停止重连并 reject。
   */
  onerror?: OnError;

  /**
   * 为 `true` 时页面隐藏也不中断连接。
   * 默认 `false`（仅在存在 `document` 的浏览器环境中生效）。
   */
  openWhenHidden?: boolean;

  /** 自定义 fetch 实现，默认使用 `globalThis.fetch`。 */
  fetch?: typeof fetch;
}

/**
 * 通过 `fetch` 订阅 SSE 流。
 *
 * 与浏览器原生 `EventSource` 的区别：
 * - 支持 POST、自定义请求头、请求体；
 * - 收到所有事件（含自定义 `event` 字段）；
 * - 可完全控制重连策略；
 * - 不依赖 DOM API，可在 Deno / Node / Worker 中使用。
 */
export function fetchEventSource(
  input: RequestInfo | URL,
  init: FetchEventSourceInit,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const {
      signal: inputSignal,
      headers: inputHeaders,
      onopen: inputOnOpen,
      onmessage,
      onclose,
      onerror,
      openWhenHidden = false,
      fetch: inputFetch,
      ...rest
    } = init;

    // 复制一份请求头：重连时需要就地修改 `last-event-id`。
    const headers: Record<string, string> = { ...inputHeaders };
    if (!hasHeader(headers, "accept")) {
      headers.accept = EventStreamContentType;
    }

    const doc = getVisibilityDocument();
    let currentController: AbortController | null = null;
    let retryInterval = DEFAULT_RETRY_INTERVAL;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const visibilityHandler = () => {
      if (disposed) return;
      currentController?.abort();
      if (!doc?.hidden) void create();
    };

    if (!openWhenHidden) {
      doc?.addEventListener("visibilitychange", visibilityHandler);
    }

    const dispose = () => {
      if (disposed) return;
      disposed = true;
      doc?.removeEventListener("visibilitychange", visibilityHandler);
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      currentController?.abort();
    };

    const abortHandler = () => {
      dispose();
      resolve();
    };

    if (inputSignal?.aborted) {
      abortHandler();
      return;
    }
    inputSignal?.addEventListener("abort", abortHandler, { once: true });

    const fetchImpl = inputFetch ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      dispose();
      reject(new Error("fetch is not available in this environment"));
      return;
    }

    const onopen = inputOnOpen ?? defaultOnOpen;

    async function create(): Promise<void> {
      if (disposed) return;
      const controller = new AbortController();
      currentController = controller;

      try {
        const response = await fetchImpl(input, {
          ...rest,
          headers,
          signal: controller.signal,
        });

        await onopen(response);

        if (!response.body) {
          throw new Error("SSE response body is null");
        }

        await getBytes(
          response.body,
          getLines(
            getMessages(
              (id) => {
                if (id) {
                  headers[LAST_EVENT_ID_HEADER] = id;
                } else {
                  delete headers[LAST_EVENT_ID_HEADER];
                }
              },
              (retry) => {
                retryInterval = retry;
              },
              onmessage,
            ),
          ),
        );

        if (disposed) return;
        onclose?.();
        dispose();
        resolve();
      } catch (err) {
        // 主动 abort（dispose / 页面隐藏 / 输入 signal）不触发重连。
        if (controller.signal.aborted) return;
        if (disposed) return;

        try {
          const suggested = onerror?.(err);
          const interval = normalizeInterval(
            suggested === undefined ? retryInterval : suggested,
            retryInterval,
          );

          if (retryTimer !== null) clearTimeout(retryTimer);
          retryTimer = setTimeout(() => {
            retryTimer = null;
            void create();
          }, interval);
        } catch (innerErr) {
          // onerror 主动抛出：停止重连。
          dispose();
          reject(innerErr);
        }
      }
    }

    void create();
  });
}

function defaultOnOpen(response: Response): void {
  if (!response.ok) {
    throw new Error(
      `SSE request failed with HTTP status ${response.status}`,
    );
  }
  const contentType = response.headers.get("content-type");
  if (!contentType?.startsWith(EventStreamContentType)) {
    throw new Error(
      `Expected content-type to be ${EventStreamContentType}, Actual: ${contentType}`,
    );
  }
}

function normalizeInterval(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  return Object.keys(headers).some((key) => key.toLowerCase() === name);
}

/** 浏览器中的 `document` 的最小结构，避免依赖 DOM 类型。 */
interface VisibilityDocument {
  readonly hidden?: boolean;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

function getVisibilityDocument(): VisibilityDocument | undefined {
  return (globalThis as { document?: VisibilityDocument }).document;
}
