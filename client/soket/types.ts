/**
 * DxSocket 的线协议与公共类型。
 *
 * 客户端 -> 服务端（cmd 协议）：
 * - `{ cmd: "bind", uuid, lib }`
 * - `{ cmd: "msg", uuid, data }`
 * - `{ cmd: "status" }`
 * - `{ cmd: "remove", uuid }`
 *
 * 服务端 -> 客户端：
 * - `{ type: "realtime", data: { action: "bind" | "remove" | "status", uuid?, status? } }`
 * - `{ type: "msg", uuid?, data }`
 * - `{ type: "system", data: { status? } }`
 *
 * 同时兼容旧的 `action` / `taskName` / `taskData` / `taskUID` 格式。
 */

/** 任务回调，默认只要求拿到数据。 */
export type TaskCallback<T = unknown> = (data: T) => void;

/** 绑定信息（兼容旧 API `bindTask`）。 */
export type dyncfgType = {
  uri?: string;
  type?: string;
  task_uid?: string;
  /** 动态库名，新协议使用。 */
  lib?: string;
  [key: string]: unknown;
};

export type NameToTaskUID = Map<string, string>;
export type TaskMap = Map<string, TaskCallback>;
export type TaskStatusMap = Map<string, string>;

export type TaskStatus =
  | "unknown"
  | "binding"
  | "bound"
  | "bind_failed"
  | "removing"
  | "removed"
  | "error";

export type DxSocketState =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed";

export type SocketEvent =
  | "open"
  | "close"
  | "error"
  | "message"
  | "bind"
  | "remove"
  | "status"
  | "data"
  | "call"
  | "system"
  | "state";

/** 客户端发出的命令。 */
export type ClientCommand =
  | { cmd: "bind"; uuid: string; lib: string }
  | { cmd: "msg"; uuid: string; data: unknown }
  | { cmd: "status" }
  | { cmd: "remove"; uuid: string }
  | {
    id: string;
    cmd: "call";
    lib: string;
    symbol: string;
    args?: unknown;
    timeout_ms?: number;
  };

/** 服务端 realtime 消息。 */
export interface ServerRealtimeMessage {
  type: "realtime";
  data?: {
    action?: string;
    uuid?: string;
    status?: string;
    [key: string]: unknown;
  };
  action?: string;
  uuid?: string;
  status?: string;
  [key: string]: unknown;
}

/** 服务端业务数据消息。 */
export interface ServerDataMessage {
  type: "msg";
  uuid?: string;
  data?: unknown;
  [key: string]: unknown;
}

/** 服务端 call 响应。 */
export interface ServerCallMessage {
  type: "call";
  id?: string;
  ok?: boolean;
  code?: number;
  lib?: string;
  symbol?: string;
  elapsed_ms?: number;
  result?: unknown;
  error?: string;
  [key: string]: unknown;
}

/** call 选项。 */
export interface CallOptions {
  /** 超时毫秒数，默认 10000。 */
  timeoutMs?: number;
}

/** call 结果。 */
export interface CallResult<T = unknown> {
  ok: boolean;
  code: number;
  result?: T;
  error?: string;
  elapsed_ms?: number;
}

/** 服务端系统消息。 */
export interface ServerSystemMessage {
  type: "system";
  data?: unknown;
  status?: string;
  [key: string]: unknown;
}

/** 旧版服务端消息格式。 */
export interface LegacyServerMessage {
  action?: "bind" | "message" | "remove" | "status" | string;
  name?: string;
  dyn?: dyncfgType;
  taskUID?: string;
  taskName?: string;
  taskData?: unknown;
  taskStatus?: TaskStatus | string;
  data?: unknown;
  [key: string]: unknown;
}

export type ServerMessage =
  | ServerRealtimeMessage
  | ServerDataMessage
  | ServerCallMessage
  | ServerSystemMessage
  | LegacyServerMessage
  | Record<string, unknown>;

/** 归一化后的消息，供 DxSocket 内部与测试使用。 */
export type NormalizedMessage =
  | { kind: "bind"; uuid: string; status?: string; raw: unknown }
  | { kind: "remove"; uuid: string; raw: unknown }
  | { kind: "status"; uuid?: string; status?: string; raw: unknown }
  | { kind: "data"; uuid: string; data: unknown; raw: unknown }
  | { kind: "call"; id: string; raw: unknown }
  | { kind: "system"; status?: string; data?: unknown; raw: unknown }
  | { kind: "unknown"; raw: unknown };

/** 可注入的 WebSocket 接口，便于测试与跨运行时使用。 */
export interface WebSocketLike {
  readonly readyState: number;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface WebSocketConstructor {
  new (url: string): WebSocketLike;
}

/** DxSocket 配置。 */
export interface SocketConfig {
  /** 最大重连次数，默认 5。 */
  maxReconnectAttempts?: number;
  /** 首次重连延迟（毫秒），默认 1000。 */
  reconnectDelay?: number;
  /** 重连延迟上限（毫秒），默认 30000。 */
  maxReconnectDelay?: number;
  /** 指数退避因子，默认 1.5。 */
  reconnectFactor?: number;
  /** 抖动比例（0-1），默认 0.2。 */
  reconnectJitter?: number;
  /** 是否自动重连，默认 true。 */
  autoReconnect?: boolean;
  /** 构造后是否立即连接，默认 true。 */
  autoConnect?: boolean;
  /** 连接超时（毫秒），0 表示不限制，默认 10000。 */
  connectTimeout?: number;
  /** 输出调试日志，默认 false。 */
  debug?: boolean;
  /** 自定义 WebSocket 构造器（测试 / 非浏览器运行时）。 */
  webSocket?: WebSocketConstructor;
}

/** 公共 API 形态，便于外部 mock。 */
export interface DxSocketType {
  readonly state: DxSocketState;
  readonly isConnected: boolean;
  connect(): Promise<void>;
  bind(uuid: string, lib: string, callback?: TaskCallback): Promise<void>;
  bindTask(
    name: string,
    dyn: dyncfgType,
    callback: TaskCallback,
  ): Promise<void>;
  send(uuid: string, data: unknown): Promise<void>;
  call<T = unknown>(
    lib: string,
    symbol: string,
    args?: unknown,
    options?: CallOptions,
  ): Promise<CallResult<T>>;
  taskSendMessage(name: string, data: unknown): Promise<void>;
  requestStatus(): Promise<void>;
  remove(uuid: string): Promise<void>;
  removeTask(name: string): Promise<void>;
  updateTaskCallBack(name: string, callback: TaskCallback): void;
  getTaskStatus(name: string): TaskStatus;
  on(event: SocketEvent, handler: (payload: unknown) => void): () => void;
  close(): void;
}

/**
 * 把任意服务端回包归一化成内部消息。
 *
 * 兼容新 cmd 协议与旧 task 协议，无法识别时返回 `unknown`。
 */
export function normalizeServerMessage(raw: unknown): NormalizedMessage {
  if (!isRecord(raw)) {
    return { kind: "unknown", raw };
  }

  const type = typeof raw.type === "string" ? raw.type : undefined;
  const inner = isRecord(raw.data) ? raw.data : undefined;
  const action = firstString(inner?.action, raw.action);
  const status = firstString(inner?.status, raw.status, raw.taskStatus);
  const uuid = firstString(
    inner?.uuid,
    raw.uuid,
    inner?.name,
    raw.name,
    raw.taskName,
    inner?.task_uid,
    raw.task_uid,
    inner?.taskUID,
    raw.taskUID,
  );

  if (type === "call") {
    const id = firstString(raw.id, inner?.id);
    return { kind: "call", id, raw };
  }

  if (type === "realtime" || action) {
    switch (action) {
      case "bind":
        return { kind: "bind", uuid, status, raw };
      case "remove":
        return { kind: "remove", uuid, raw };
      case "status":
        return { kind: "status", uuid, status, raw };
      case "message":
        return {
          kind: "data",
          uuid,
          data: raw.taskData ?? inner?.data ?? raw.data,
          raw,
        };
    }
    if (type === "realtime") {
      // 没有 action 的 realtime 回包，按状态更新处理。
      return { kind: "status", uuid, status, raw };
    }
  }

  if (type === "msg") {
    return {
      kind: "data",
      uuid,
      data: raw.taskData ?? raw.data,
      raw,
    };
  }

  if (type === "system") {
    return { kind: "system", status, data: raw.data, raw };
  }

  // 旧协议：{ taskName, taskData, taskUID, taskStatus }
  if ("taskData" in raw || "taskUID" in raw || "taskName" in raw) {
    return { kind: "data", uuid, data: raw.taskData, raw };
  }

  if (typeof raw.status === "string" || typeof raw.taskStatus === "string") {
    return { kind: "status", uuid, status, raw };
  }

  return { kind: "unknown", raw };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value !== "") return value;
  }
  return "";
}
