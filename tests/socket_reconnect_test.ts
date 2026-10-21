import { assertEquals, assertRejects } from "@std/assert";
import { DxSocket, type SocketConfig } from "../client/dxsoket.ts";
import {
  delay,
  FakeWebSocket,
  FakeWebSocketCtor,
  waitFor,
} from "./_fake_websocket.ts";

function createSocket(config: Partial<SocketConfig> = {}): DxSocket {
  return new DxSocket("ws://test/soket", {
    autoConnect: false,
    connectTimeout: 0,
    reconnectJitter: 0,
    webSocket: FakeWebSocketCtor,
    ...config,
  });
}

async function openSocket(socket: DxSocket): Promise<FakeWebSocket> {
  const connecting = socket.connect();
  const ws = FakeWebSocket.last;
  ws.open();
  await connecting;
  return ws;
}

Deno.test("DxSocket 重连: 断线后自动重连并重新绑定任务", async () => {
  FakeWebSocket.reset();
  const socket = createSocket({
    reconnectDelay: 5,
    maxReconnectAttempts: 3,
  });

  try {
    const first = await openSocket(socket);
    await socket.bind("task-001", "libsoket_demo");
    assertEquals(first.commands(), [{
      cmd: "bind",
      uuid: "task-001",
      lib: "libsoket_demo",
    }]);

    first.serverClose();

    await waitFor(() => socket.state === "reconnecting");
    await waitFor(() => FakeWebSocket.instances.length === 2);

    const second = FakeWebSocket.last;
    second.open();
    await waitFor(() => socket.isConnected);

    assertEquals(second.commands(), [{
      cmd: "bind",
      uuid: "task-001",
      lib: "libsoket_demo",
    }]);
    assertEquals(socket.getTaskStatus("task-001"), "bound");
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket 重连: 达到最大次数后进入 closed", async () => {
  FakeWebSocket.reset();
  const socket = createSocket({
    reconnectDelay: 5,
    maxReconnectAttempts: 1,
  });

  try {
    const first = await openSocket(socket);
    first.serverClose();

    await waitFor(() => FakeWebSocket.instances.length === 2);
    assertEquals(socket.state, "reconnecting");

    FakeWebSocket.last.serverClose();

    await waitFor(() => socket.state === "closed");
    assertEquals(FakeWebSocket.instances.length, 2);
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket 重连: maxReconnectAttempts=0 不重连", async () => {
  FakeWebSocket.reset();
  const socket = createSocket({
    reconnectDelay: 5,
    maxReconnectAttempts: 0,
  });

  try {
    const connecting = socket.connect();
    const ws = FakeWebSocket.last;
    ws.serverClose();

    await assertRejects(
      () => connecting,
      Error,
      "Socket closed before open",
    );

    assertEquals(socket.state, "closed");
    await delay(10);
    assertEquals(FakeWebSocket.instances.length, 1);
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket 重连: 连接超时后重连", async () => {
  FakeWebSocket.reset();
  const socket = createSocket({
    connectTimeout: 5,
    reconnectDelay: 5,
    maxReconnectAttempts: 1,
  });

  try {
    const connecting = socket.connect();

    await assertRejects(
      () => connecting,
      Error,
      "Socket closed before open",
    );

    await waitFor(() => FakeWebSocket.instances.length === 2);
    const second = FakeWebSocket.last;
    second.open();
    await waitFor(() => socket.isConnected);
    assertEquals(socket.state, "open");
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket 重连: close 会取消已排期的重连", async () => {
  FakeWebSocket.reset();
  const socket = createSocket({
    reconnectDelay: 5,
    maxReconnectAttempts: 3,
  });

  try {
    const first = await openSocket(socket);
    first.serverClose();

    await waitFor(() => socket.state === "reconnecting");
    socket.close();

    await delay(20);
    assertEquals(FakeWebSocket.instances.length, 1);
    assertEquals(socket.state, "closed");
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket 重连: 重连期间 connect 不会创建第二个 socket", async () => {
  FakeWebSocket.reset();
  const socket = createSocket({
    reconnectDelay: 10,
    maxReconnectAttempts: 2,
  });

  try {
    const first = await openSocket(socket);
    first.serverClose();

    await waitFor(() => socket.state === "reconnecting");

    const waiting = socket.connect();
    await delay(2);
    assertEquals(FakeWebSocket.instances.length, 1);

    await waitFor(() => FakeWebSocket.instances.length === 2);
    FakeWebSocket.last.open();
    await waiting;

    assertEquals(socket.state, "open");
    assertEquals(FakeWebSocket.instances.length, 2);
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket 重连: 重连成功前 bind 会等待连接", async () => {
  FakeWebSocket.reset();
  const socket = createSocket({
    reconnectDelay: 10,
    maxReconnectAttempts: 2,
  });

  try {
    const first = await openSocket(socket);
    first.serverClose();
    await waitFor(() => socket.state === "reconnecting");

    const binding = socket.bind("task-002", "demo");
    await waitFor(() => FakeWebSocket.instances.length === 2);

    const second = FakeWebSocket.last;
    second.open();
    await binding;

    assertEquals(second.commands(), [{
      cmd: "bind",
      uuid: "task-002",
      lib: "demo",
    }]);
    assertEquals(socket.getTaskStatus("task-002"), "bound");
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket 重连: 重新绑定多个任务", async () => {
  FakeWebSocket.reset();
  const socket = createSocket({
    reconnectDelay: 5,
    maxReconnectAttempts: 2,
  });

  try {
    const first = await openSocket(socket);
    await socket.bind("task-a", "lib-a");
    await socket.bind("task-b", "lib-b");

    first.serverClose();
    await waitFor(() => FakeWebSocket.instances.length === 2);

    const second = FakeWebSocket.last;
    second.open();
    await waitFor(() => socket.isConnected);

    const commands = second.commands();
    assertEquals(commands.length, 2);
    assertEquals(commands, [
      { cmd: "bind", uuid: "task-a", lib: "lib-a" },
      { cmd: "bind", uuid: "task-b", lib: "lib-b" },
    ]);
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket 重连: 已移除的任务不会重新绑定", async () => {
  FakeWebSocket.reset();
  const socket = createSocket({
    reconnectDelay: 5,
    maxReconnectAttempts: 2,
  });

  try {
    const first = await openSocket(socket);
    await socket.bind("task-a", "lib-a");
    await socket.bind("task-b", "lib-b");
    await socket.remove("task-a");

    first.serverClose();
    await waitFor(() => FakeWebSocket.instances.length === 2);

    const second = FakeWebSocket.last;
    second.open();
    await waitFor(() => socket.isConnected);

    assertEquals(second.commands(), [{
      cmd: "bind",
      uuid: "task-b",
      lib: "lib-b",
    }]);
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket 重连: 状态事件序列包含 reconnecting / open", async () => {
  FakeWebSocket.reset();
  const socket = createSocket({
    reconnectDelay: 5,
    maxReconnectAttempts: 2,
  });

  try {
    const states: string[] = [];
    socket.on("state", (state) => states.push(state as string));

    const first = await openSocket(socket);
    first.serverClose();
    await waitFor(() => FakeWebSocket.instances.length === 2);
    FakeWebSocket.last.open();
    await waitFor(() => socket.isConnected);

    assertEquals(states, [
      "connecting",
      "open",
      "reconnecting",
      "open",
    ]);
  } finally {
    socket.close();
  }
});
