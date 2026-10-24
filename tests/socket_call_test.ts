import { assertEquals, assertRejects } from "@std/assert";
import { DxSocket } from "../client/dxsoket.ts";
import { FakeWebSocket, FakeWebSocketCtor, waitFor } from "./_fake_websocket.ts";

function createSocket(): DxSocket {
  FakeWebSocket.reset();
  return new DxSocket("ws://test", {
    webSocket: FakeWebSocketCtor,
    autoConnect: false,
    connectTimeout: 0,
    reconnectJitter: 0,
  });
}

async function openSocket(socket: DxSocket): Promise<void> {
  const connecting = socket.connect();
  FakeWebSocket.last.open();
  await connecting;
}

Deno.test("call 发送命令并按 id 解析结果", async () => {
  const socket = createSocket();
  await openSocket(socket);

  const pending = socket.call("chatllm", "post_dialogue_list", { page: 1 });
  await waitFor(() => FakeWebSocket.last.sent.length > 0);
  const sent = FakeWebSocket.last.commands().at(-1)!;
  assertEquals(sent.cmd, "call");
  assertEquals(sent.lib, "chatllm");
  assertEquals(sent.symbol, "post_dialogue_list");
  assertEquals(sent.args, { page: 1 });
  assertEquals(typeof sent.id, "string");

  FakeWebSocket.last.receive({
    type: "call",
    id: sent.id,
    ok: true,
    code: 0,
    elapsed_ms: 3,
    result: { code: 200, data: { list: [] } },
  });

  const result = await pending;
  assertEquals(result.ok, true);
  assertEquals(result.code, 0);
  assertEquals(result.result, { code: 200, data: { list: [] } });
  socket.close();
});

Deno.test("call 业务失败仍 resolve", async () => {
  const socket = createSocket();
  await openSocket(socket);

  const pending = socket.call("bad", "post_x", {});
  await waitFor(() => FakeWebSocket.last.sent.length > 0);
  const sent = FakeWebSocket.last.commands().at(-1)!;
  FakeWebSocket.last.receive({
    type: "call",
    id: sent.id,
    ok: false,
    code: -5,
    error: "Invalid lib or symbol",
  });

  const result = await pending;
  assertEquals(result.ok, false);
  assertEquals(result.code, -5);
  assertEquals(result.error, "Invalid lib or symbol");
  socket.close();
});

Deno.test("call 超时 reject", async () => {
  const socket = createSocket();
  await openSocket(socket);

  await assertRejects(
    () => socket.call("chatllm", "post_chat", {}, { timeoutMs: 10 }),
    Error,
    "timed out",
  );
  socket.close();
});

Deno.test("连接断开时 reject 未完成的 call", async () => {
  const socket = createSocket();
  await openSocket(socket);

  const pending = socket.call("chatllm", "post_chat", {});
  await waitFor(() => FakeWebSocket.last.sent.length > 0);
  FakeWebSocket.last.serverClose();

  await assertRejects(() => pending, Error, "Socket closed");
  socket.close();
});

Deno.test("call 在未连接时自动连接", async () => {
  const socket = createSocket();
  const pending = socket.call("chatllm", "post_dialogue_list", {});
  await waitFor(() => FakeWebSocket.instances.length > 0);
  FakeWebSocket.last.open();
  await waitFor(() => FakeWebSocket.last.sent.length > 0);

  const sent = FakeWebSocket.last.commands().at(-1)!;
  FakeWebSocket.last.receive({
    type: "call",
    id: sent.id,
    ok: true,
    code: 0,
    result: { code: 200 },
  });

  const result = await pending;
  assertEquals(result.ok, true);
  socket.close();
});
