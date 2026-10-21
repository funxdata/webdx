/**
 * SSE (text/event-stream) 解析器。
 *
 * 逐字节解析，不依赖 `document` / `window`，可在浏览器、Deno、Node、
 * Cloudflare Workers 等任何实现了 WHATWG Streams 的运行时中使用。
 */

/** 一条完整的 SSE 消息。 */
export interface EventSourceMessage {
  /** 事件 ID（`id:` 字段），会作为下一次重连的 `last-event-id` 请求头。 */
  id: string;
  /** 事件类型（`event:` 字段），默认为空字符串。 */
  event: string;
  /** 事件数据（`data:` 字段），多行数据以 `\n` 拼接。 */
  data: string;
  /** 服务端建议的重连间隔（`retry:` 字段，毫秒）。 */
  retry?: number;
}

/** 从可读流中逐块读取字节。 */
export async function getBytes(
  stream: ReadableStream<Uint8Array>,
  onChunk: (arr: Uint8Array) => void,
): Promise<void> {
  const reader = stream.getReader();
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      onChunk(result.value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // 流已被取消 / 关闭时 releaseLock 可能抛错，忽略即可。
    }
  }
}

const enum ControlChars {
  NewLine = 10,
  CarriageReturn = 13,
  Space = 32,
  Colon = 58,
}

/**
 * 把字节块切分为行。
 *
 * @param onLine 收到一整行时调用，`fieldLength` 是第一个冒号的位置，
 *               没有冒号时为 -1，注释行（以冒号开头）为 0。
 */
export function getLines(
  onLine: (line: Uint8Array, fieldLength: number) => void,
): (arr: Uint8Array) => void {
  let buffer: Uint8Array | undefined;
  let position = 0;
  let fieldLength = -1;
  let discardTrailingNewline = false;

  return function onChunk(arr: Uint8Array): void {
    if (buffer === undefined) {
      buffer = arr;
      position = 0;
      fieldLength = -1;
    } else {
      buffer = concat(buffer, arr);
    }

    const bufLength = buffer.length;
    let lineStart = 0;
    while (position < bufLength) {
      if (discardTrailingNewline) {
        if (buffer[position] === ControlChars.NewLine) {
          lineStart = ++position;
        }
        discardTrailingNewline = false;
      }

      let lineEnd = -1;
      for (; position < bufLength && lineEnd === -1; ++position) {
        switch (buffer[position]) {
          case ControlChars.Colon:
            if (fieldLength === -1) {
              fieldLength = position - lineStart;
            }
            break;
          // \r 需要当作 \n 处理：先标记，遇到 \n 时跳过它。
          // deno-lint-ignore no-fallthrough
          case ControlChars.CarriageReturn:
            discardTrailingNewline = true;
          case ControlChars.NewLine:
            lineEnd = position;
            break;
        }
      }

      if (lineEnd === -1) break;

      onLine(buffer.subarray(lineStart, lineEnd), fieldLength);
      lineStart = position;
      fieldLength = -1;
    }

    if (lineStart === bufLength) {
      buffer = undefined;
    } else if (lineStart !== 0) {
      buffer = buffer.subarray(lineStart);
      position -= lineStart;
    }
  };
}

/**
 * 把行解析为 `EventSourceMessage`。
 *
 * @param onId 收到 `id` 字段时调用
 * @param onRetry 收到合法的整型 `retry` 字段时调用
 * @param onMessage 收到空行（消息结束）时调用
 */
export function getMessages(
  onId: (id: string) => void,
  onRetry: (retry: number) => void,
  onMessage?: (msg: EventSourceMessage) => void,
): (line: Uint8Array, fieldLength: number) => void {
  let message = newMessage();
  const decoder = new TextDecoder();

  return function onLine(line: Uint8Array, fieldLength: number): void {
    if (line.length === 0) {
      onMessage?.(message);
      message = newMessage();
      return;
    }

    // 注释行（fieldLength === 0）与没有字段名的行直接忽略。
    if (fieldLength <= 0) return;

    const field = decoder.decode(line.subarray(0, fieldLength));
    const valueOffset = fieldLength +
      (line[fieldLength + 1] === ControlChars.Space ? 2 : 1);
    const value = decoder.decode(line.subarray(valueOffset));

    switch (field) {
      case "data":
        message.data = message.data ? `${message.data}\n${value}` : value;
        break;
      case "event":
        message.event = value;
        break;
      case "id":
        onId(message.id = value);
        break;
      case "retry": {
        const retry = parseInt(value, 10);
        if (!isNaN(retry)) {
          onRetry(message.retry = retry);
        }
        break;
      }
    }
  };
}

/** 把字符串按 SSE 规范编码成一条消息（用于测试 / 客户端模拟）。 */
export function formatMessage(message: Partial<EventSourceMessage>): string {
  const lines: string[] = [];
  if (message.id) lines.push(`id: ${message.id}`);
  if (message.event) lines.push(`event: ${message.event}`);
  if (message.retry !== undefined) lines.push(`retry: ${message.retry}`);
  for (const line of (message.data ?? "").split("\n")) {
    lines.push(`data: ${line}`);
  }
  return `${lines.join("\n")}\n\n`;
}

const concat = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  const res = new Uint8Array(a.length + b.length);
  res.set(a);
  res.set(b, a.length);
  return res;
};

const newMessage = (): EventSourceMessage => ({
  data: "",
  event: "",
  id: "",
  retry: undefined,
});
