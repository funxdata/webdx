import type {
  ClientCommand,
  DxSocketState,
  DxSocketType,
  dyncfgType,
  SocketConfig,
  SocketEvent,
  TaskCallback,
  TaskStatus,
  WebSocketConstructor,
  WebSocketLike,
} from "./types.ts";
import { normalizeServerMessage } from "./types.ts";

const WS_OPEN = 1;

const DEFAULT_CONFIG: Required<
  Omit<SocketConfig, "webSocket">
> = {
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  reconnectFactor: 1.5,
  reconnectJitter: 0.2,
  autoReconnect: true,
  autoConnect: true,
  connectTimeout: 10000,
  debug: false,
};

interface TaskEntry {
  lib: string;
  callback?: TaskCallback;
  status: string;
}

/**
 * 面向 webdx 数据交换服务的 WebSocket 客户端。
 *
 * 协议：
 * - 绑定：`bind(uuid, lib)` -> `{ cmd: "bind", uuid, lib }`
 * - 发消息：`send(uuid, data)` -> `{ cmd: "msg", uuid, data }`
 * - 查询状态：`requestStatus()` -> `{ cmd: "status" }`
 * - 移除：`remove(uuid)` -> `{ cmd: "remove", uuid }`
 *
 * 特性：
 * - 断线自动重连（指数退避 + 抖动），重连后自动重新绑定所有任务；
 * - 同时兼容服务端新旧两种回包格式；
 * - 可注入 WebSocket 实现，便于测试与服务端 / Worker 使用；
 * - 事件订阅：`on("data" | "bind" | "status" | "system" | ...)`。
 */
export class DxSocket implements DxSocketType {
  private readonly config: Required<Omit<SocketConfig, "webSocket">>;
  private readonly ctor: WebSocketConstructor;
  private socket: WebSocketLike | null = null;
  private currentState: DxSocketState = "idle";
  private readonly tasks = new Map<string, TaskEntry>();
  private readonly listeners = new Map<
    SocketEvent,
    Set<(payload: unknown) => void>
  >();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;
  private connectPromise: Promise<void> | null = null;
  private connectResolve: (() => void) | null = null;
  private connectReject: ((err: Error) => void) | null = null;

  constructor(readonly url: string, config: SocketConfig = {}) {
    const { webSocket, ...rest } = config;
    this.config = { ...DEFAULT_CONFIG, ...rest };

    if (webSocket) {
      this.ctor = webSocket;
    } else {
      const native = (globalThis as { WebSocket?: WebSocketConstructor })
        .WebSocket;
      if (!native) {
        throw new Error("WebSocket is not supported in this environment");
      }
      this.ctor = native;
    }

    if (this.config.autoConnect) {
      // 自动连接失败不应产生未处理的 rejection；错误通过 "error" 事件暴露。
      void this.connect().catch(() => {});
    }
  }

  get state(): DxSocketState {
    return this.currentState;
  }

  get isConnected(): boolean {
    return this.currentState === "open" &&
      this.socket !== null &&
      this.socket.readyState === WS_OPEN;
  }

  /** 建立连接；已连接或正在连接时复用同一个 Promise。 */
  async connect(): Promise<void> {
    if (this.isConnected) return;

    this.manualClose = false;

    // 已经排期重连时，等待既有重连完成，避免创建第二个 socket。
    if (this.currentState === "reconnecting" && this.reconnectTimer !== null) {
      await this.waitForOpenOrClosed();
      if (!this.isConnected) {
        throw new Error("WebSocket is not connected");
      }
      return;
    }

    if (!this.connectPromise) {
      this.connectPromise = new Promise<void>((resolve, reject) => {
        this.connectResolve = resolve;
        this.connectReject = reject;
        this.open();
      });
    }

    await this.connectPromise;
  }

  // ============ 公共 API ============

  /** 绑定一个任务。发送成功后任务状态为 `bound`。 */
  async bind(
    uuid: string,
    lib: string,
    callback?: TaskCallback,
  ): Promise<void> {
    if (!uuid) throw new Error("bind requires a non-empty uuid");
    if (!lib) throw new Error("bind requires a non-empty lib");

    await this.ensureConnected();

    const task: TaskEntry = { lib, callback, status: "binding" };
    this.tasks.set(uuid, task);

    try {
      this.sendRaw({ cmd: "bind", uuid, lib });
      task.status = "bound";
      this.emit("bind", { uuid, lib, status: task.status });
    } catch (error) {
      task.status = "bind_failed";
      this.emit("error", error);
      throw error;
    }
  }

  /** 向已绑定的任务发送数据。 */
  async send(uuid: string, data: unknown): Promise<void> {
    if (!this.tasks.has(uuid)) {
      throw new Error(`Task ${uuid} is not bound`);
    }
    await this.ensureConnected();
    this.sendRaw({ cmd: "msg", uuid, data });
  }

  /** 查询服务端任务状态（结果通过 `status` 事件返回）。 */
  async requestStatus(): Promise<void> {
    await this.ensureConnected();
    this.sendRaw({ cmd: "status" });
  }

  /** 移除任务并删除本地绑定。 */
  async remove(uuid: string): Promise<void> {
    const task = this.tasks.get(uuid);
    if (!task) return;

    await this.ensureConnected();
    task.status = "removing";

    try {
      this.sendRaw({ cmd: "remove", uuid });
      this.tasks.delete(uuid);
      this.emit("remove", { uuid });
    } catch (error) {
      task.status = "error";
      this.emit("error", error);
      throw error;
    }
  }

  /** 订阅事件，返回取消订阅函数。 */
  on(event: SocketEvent, handler: (payload: unknown) => void): () => void {
    let handlers = this.listeners.get(event);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(event, handlers);
    }
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  }

  /** 关闭连接，停止自动重连。关闭后再次调用 `connect()` 可复用实例。 */
  close(): void {
    this.manualClose = true;
    this.clearReconnectTimer();
    this.clearConnectTimer();

    const socket = this.socket;
    this.socket = null;
    if (socket) {
      try {
        socket.close(1000, "client closed");
      } catch {
        // 忽略关闭时的底层异常。
      }
    }

    this.setState("closed");
    this.settleConnect(new Error("Socket closed"));
  }

  // ============ 兼容旧 API ============

  /** @deprecated 使用 `bind(uuid, lib, callback)`。 */
  bindTask(
    name: string,
    dyn: dyncfgType,
    callback: TaskCallback,
  ): Promise<void> {
    const lib = dyn.lib ?? dyn.uri ?? "";
    if (!lib) {
      return Promise.reject(
        new Error(`Task ${name} requires dyn.lib or dyn.uri`),
      );
    }
    return this.bind(name, lib, callback);
  }

  /** @deprecated 使用 `send(uuid, data)`。 */
  taskSendMessage(name: string, data: unknown): Promise<void> {
    return this.send(name, data);
  }

  /** @deprecated 使用 `remove(uuid)`。 */
  removeTask(name: string): Promise<void> {
    return this.remove(name);
  }

  updateTaskCallBack(name: string, callback: TaskCallback): void {
    const task = this.tasks.get(name);
    if (!task) {
      this.debug(`Task ${name} does not exist`);
      return;
    }
    task.callback = callback;
  }

  getTaskStatus(name: string): TaskStatus {
    return (this.tasks.get(name)?.status as TaskStatus) ?? "unknown";
  }

  // ============ 连接管理 ============

  private open(): void {
    if (this.manualClose) return;

    this.clearConnectTimer();
    this.setState(
      this.reconnectAttempts > 0 ? "reconnecting" : "connecting",
    );

    let socket: WebSocketLike;
    try {
      socket = new this.ctor(this.url);
    } catch (error) {
      this.handleOpenFailure(error);
      return;
    }

    this.socket = socket;
    socket.onopen = () => this.handleOpen(socket);
    socket.onmessage = (event) => this.handleMessage(event);
    socket.onclose = (event) => this.handleClose(socket, event);
    socket.onerror = (event) => this.emit("error", event);

    if (this.config.connectTimeout > 0) {
      this.connectTimer = setTimeout(() => {
        this.connectTimer = null;
        if (this.socket !== socket || this.currentState === "open") return;
        this.debug("connect timeout");
        try {
          socket.close(4000, "connect timeout");
        } catch {
          // 忽略底层异常。
        }
        this.handleClose(socket, { code: 4000, reason: "connect timeout" });
      }, this.config.connectTimeout);
    }
  }

  private handleOpen(socket: WebSocketLike): void {
    if (this.socket !== socket || this.manualClose) return;

    this.clearConnectTimer();
    this.reconnectAttempts = 0;
    this.setState("open");
    this.settleConnect();
    this.emit("open", { url: this.url });
    this.rebindAll();
  }

  private handleClose(
    socket: WebSocketLike,
    event: { code?: number; reason?: string },
  ): void {
    if (this.socket !== socket) return;

    this.socket = null;
    this.clearConnectTimer();
    this.emit("close", event);

    if (this.manualClose) {
      this.setState("closed");
      this.settleConnect(new Error("Socket closed"));
      return;
    }

    this.settleConnect(
      new Error(`Socket closed before open (code ${event.code ?? "unknown"})`),
    );

    if (this.config.autoReconnect) {
      this.scheduleReconnect();
    } else {
      this.setState("closed");
    }
  }

  private handleOpenFailure(error: unknown): void {
    this.emit("error", error);
    this.settleConnect(
      error instanceof Error ? error : new Error(String(error)),
    );
    if (this.config.autoReconnect && !this.manualClose) {
      this.scheduleReconnect();
    } else {
      this.setState("closed");
    }
  }

  private scheduleReconnect(): void {
    if (this.manualClose) return;

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      const error = new Error(
        `Max reconnect attempts reached (${this.config.maxReconnectAttempts})`,
      );
      this.setState("closed");
      this.emit("error", error);
      this.settleConnect(error);
      return;
    }

    const delay = this.nextReconnectDelay();
    this.reconnectAttempts += 1;
    this.setState("reconnecting");
    this.debug(
      `reconnect ${this.reconnectAttempts}/${this.config.maxReconnectAttempts} in ${delay}ms`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private nextReconnectDelay(): number {
    const attempt = this.reconnectAttempts;
    const base = Math.min(
      this.config.maxReconnectDelay,
      this.config.reconnectDelay *
        Math.pow(this.config.reconnectFactor, attempt),
    );
    const jitter = this.config.reconnectJitter;
    const factor = jitter > 0 ? 1 + (Math.random() * 2 - 1) * jitter : 1;
    return Math.max(0, Math.round(base * factor));
  }

  /** 重连成功后重新绑定所有仍然存在的任务。 */
  private rebindAll(): void {
    for (const [uuid, task] of this.tasks) {
      if (task.status === "removing" || task.status === "removed") continue;
      try {
        this.sendRaw({ cmd: "bind", uuid, lib: task.lib });
        task.status = "bound";
        this.emit("bind", { uuid, lib: task.lib, status: task.status });
      } catch (error) {
        task.status = "bind_failed";
        this.emit("error", error);
      }
    }
  }

  // ============ 消息处理 ============

  private handleMessage(event: { data: unknown }): void {
    let raw: unknown = event.data;

    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        // 非 JSON 文本原样投递给 "message" 订阅者。
        this.emit("message", raw);
        return;
      }
    }

    this.emit("message", raw);
    const message = normalizeServerMessage(raw);

    switch (message.kind) {
      case "bind": {
        if (message.uuid) {
          const task = this.tasks.get(message.uuid);
          if (task) {
            task.status = mapRemoteStatus(message.status) ?? "bound";
          }
        }
        this.emit("bind", message);
        break;
      }
      case "remove": {
        if (message.uuid) this.tasks.delete(message.uuid);
        this.emit("remove", message);
        break;
      }
      case "status": {
        if (message.uuid) {
          const task = this.tasks.get(message.uuid);
          if (task) {
            task.status = mapRemoteStatus(message.status) ?? task.status;
          }
        }
        this.emit("status", message);
        break;
      }
      case "data": {
        const callback = message.uuid
          ? this.tasks.get(message.uuid)?.callback
          : undefined;
        callback?.(message.data);
        this.emit("data", message);
        break;
      }
      case "system":
        this.emit("system", message);
        break;
      default:
        this.debug("unhandled message", raw);
    }
  }

  // ============ 工具方法 ============

  private waitForOpenOrClosed(): Promise<void> {
    if (this.currentState === "open" || this.currentState === "closed") {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const off = this.on("state", (state) => {
        if (state === "open" || state === "closed") {
          off();
          resolve();
        }
      });
    });
  }

  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
    if (!this.isConnected) {
      throw new Error("WebSocket is not connected");
    }
  }

  private sendRaw(command: ClientCommand): void {
    if (!this.socket || this.socket.readyState !== WS_OPEN) {
      throw new Error("WebSocket is not connected");
    }
    const payload = JSON.stringify(command);
    this.debug("send", payload);
    this.socket.send(payload);
  }

  private settleConnect(error?: Error): void {
    const resolve = this.connectResolve;
    const reject = this.connectReject;
    this.connectResolve = null;
    this.connectReject = null;
    this.connectPromise = null;

    if (error) reject?.(error);
    else resolve?.();
  }

  private setState(state: DxSocketState): void {
    if (this.currentState === state) return;
    this.currentState = state;
    this.emit("state", state);
  }

  private emit(event: SocketEvent, payload: unknown): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of [...handlers]) {
      try {
        handler(payload);
      } catch (error) {
        this.debug(`listener for "${event}" threw`, error);
      }
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearConnectTimer(): void {
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  private debug(...args: unknown[]): void {
    if (this.config.debug) {
      console.log("[DxSocket]", ...args);
    }
  }
}

function mapRemoteStatus(status?: string): string | undefined {
  if (!status) return undefined;
  switch (status) {
    case "success":
    case "ok":
    case "bound":
      return "bound";
    case "failed":
    case "fail":
    case "error":
      return "bind_failed";
    default:
      return status;
  }
}
