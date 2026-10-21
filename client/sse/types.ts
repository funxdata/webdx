import type { EventSourceMessage } from "./parse.ts";
import type { FetchEventSourceInit } from "./req.ts";

/**
 * webdx 数据交换服务使用的 SSE 查询参数。
 *
 * 对应 endpoint：
 * `/sse?lib=sys_info&symbol=post_file_exists&args={"path":"README.md"}`
 */
export interface SseQuery {
  /** 动态库名，例如 `sys_info`。 */
  lib: string;
  /** 动态库导出的符号 / 方法名，例如 `post_file_exists`。 */
  symbol: string;
  /** 传给符号的参数，对象会被 JSON 序列化。 */
  args?: unknown;
  /** 服务端轮询间隔（毫秒）。 */
  interval_ms?: number;
  /** 允许附加任意查询参数。 */
  [key: string]: unknown;
}

/** 订阅回调。 */
export interface SseHandlers {
  onopen?: (response: Response) => Promise<void> | void;
  /** 每条消息触发一次，`payload` 是 `data` 字段 JSON.parse 的结果。 */
  onmessage?: (message: EventSourceMessage, payload: unknown) => void;
  /** 仅当消息带有 `event:` 字段时触发。 */
  onevent?: (
    event: string,
    message: EventSourceMessage,
    payload: unknown,
  ) => void;
  onclose?: () => void;
  onerror?: (err: unknown) => number | null | undefined | void;
  /** 外部中止信号，触发后本次订阅正常结束。 */
  signal?: AbortSignal;
}

/** `DxSse` 的默认配置，透传给 `fetchEventSource`。 */
export type DxSseOptions =
  & Omit<
    FetchEventSourceInit,
    "signal" | "headers" | "onopen" | "onmessage" | "onclose" | "onerror"
  >
  & {
    headers?: Record<string, string>;
  };
