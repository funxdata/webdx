import type { WebSocketConstructor, WebSocketLike } from "../client/dxsoket.ts";

/** 可手动驱动的 WebSocket 假实现，用于测试 DxSocket。 */
export class FakeWebSocket implements WebSocketLike {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static instances: FakeWebSocket[] = [];

  static reset(): void {
    FakeWebSocket.instances = [];
  }

  static get last(): FakeWebSocket {
    const instance = FakeWebSocket.instances.at(-1);
    if (!instance) throw new Error("No FakeWebSocket has been created");
    return instance;
  }

  readyState = FakeWebSocket.CONNECTING;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  readonly sent: string[] = [];
  closed: { code?: number; reason?: string } | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    if (this.readyState !== FakeWebSocket.OPEN) {
      throw new Error("FakeWebSocket is not open");
    }
    this.sent.push(data);
  }

  close(code = 1000, reason = ""): void {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    this.closed = { code, reason };
    this.onclose?.({ code, reason });
  }

  // ============ 测试驱动 ============

  /** 模拟连接建立。 */
  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.({});
  }

  /** 模拟收到服务端消息（对象会被 JSON 序列化）。 */
  receive(data: unknown): void {
    this.onmessage?.({
      data: typeof data === "string" ? data : JSON.stringify(data),
    });
  }

  /** 模拟服务端主动断开。 */
  serverClose(code = 1006, reason = "server closed"): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }

  /** 解析出已发送的 JSON 命令。 */
  commands(): Array<Record<string, unknown>> {
    return this.sent.map((item) => JSON.parse(item));
  }
}

/** 作为 DxSocket 的 `webSocket` 注入。 */
export const FakeWebSocketCtor =
  FakeWebSocket as unknown as WebSocketConstructor;

/** 等待条件成立。 */
export async function waitFor(
  condition: () => boolean,
  timeout = 1000,
): Promise<void> {
  const start = performance.now();
  while (!condition()) {
    if (performance.now() - start > timeout) {
      throw new Error("waitFor timed out");
    }
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
