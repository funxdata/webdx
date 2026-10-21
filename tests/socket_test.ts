import { assert, assertEquals, assertRejects } from "@std/assert";
import { DxSocket, type SocketConfig } from "../client/dxsoket.ts";
import {
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

/* =========================
   连接
========================= */

Deno.test("DxSocket: connect 后进入 open 状态", async () => {
  FakeWebSocket.reset();
  const socket = createSocket();

  try {
    assertEquals(socket.state, "idle");
    assert(!socket.isConnected);

    const connecting = socket.connect();
    assertEquals(socket.state, "connecting");
    assertEquals(FakeWebSocket.instances.length, 1);
    assertEquals(FakeWebSocket.last.url, "ws://test/soket");

    FakeWebSocket.last.open();
    await connecting;

    assertEquals(socket.state, "open");
    assert(socket.isConnected);
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket: autoConnect 在构造时自动连接", async () => {
  FakeWebSocket.reset();
  const socket = new DxSocket("ws://auto/soket", {
    webSocket: FakeWebSocketCtor,
    connectTimeout: 0,
  });

  try {
    assertEquals(FakeWebSocket.instances.length, 1);
    FakeWebSocket.last.open();
    await waitFor(() => socket.isConnected);
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket: 重复 connect 复用同一个 socket", async () => {
  FakeWebSocket.reset();
  const socket = createSocket();

  try {
    const first = socket.connect();
    const second = socket.connect();
    assertEquals(FakeWebSocket.instances.length, 1);

    FakeWebSocket.last.open();
    await Promise.all([first, second]);

    await socket.connect();
    assertEquals(FakeWebSocket.instances.length, 1);
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket: bind 前会自动建立连接", async () => {
  FakeWebSocket.reset();
  const socket = createSocket();

  try {
    const binding = socket.bind("task-001", "demo");
    const ws = FakeWebSocket.last;
    ws.open();
    await binding;

    assertEquals(ws.commands(), [{
      cmd: "bind",
      uuid: "task-001",
      lib: "demo",
    }]);
    assertEquals(socket.getTaskStatus("task-001"), "bound");
  } finally {
    socket.close();
  }
});

/* =========================
   命令
========================= */

Deno.test("DxSocket: bind 发送 cmd=bind", async () => {
  FakeWebSocket.reset();
  const socket = createSocket();

  try {
    const ws = await openSocket(socket);
    const received: unknown[] = [];

    await socket.bind("task-001", "libsoket_demo", (data) => {
      received.push(data);
    });

    assertEquals(ws.commands(), [{
      cmd: "bind",
      uuid: "task-001",
      lib: "libsoket_demo",
    }]);

    ws.receive({ type: "msg", uuid: "task-001", data: { hello: "world" } });
    assertEquals(received, [{ hello: "world" }]);
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket: send 发送 cmd=msg", async () => {
  FakeWebSocket.reset();
  const socket = createSocket();

  try {
    const ws = await openSocket(socket);
    await socket.bind("task-001", "demo");
    await socket.send("task-001", { action: "getData" });

    assertEquals(ws.commands()[1], {
      cmd: "msg",
      uuid: "task-001",
      data: { action: "getData" },
    });
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket: requestStatus 发送 cmd=status", async () => {
  FakeWebSocket.reset();
  const socket = createSocket();

  try {
    const ws = await openSocket(socket);
    await socket.requestStatus();

    assertEquals(ws.commands(), [{ cmd: "status" }]);
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket: remove 发送 cmd=remove 并删除任务", async () => {
  FakeWebSocket.reset();
  const socket = createSocket();

  try {
    const ws = await openSocket(socket);
    await socket.bind("task-001", "demo");
    await socket.remove("task-001");

    assertEquals(ws.commands()[1], { cmd: "remove", uuid: "task-001" });
    assertEquals(socket.getTaskStatus("task-001"), "unknown");
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket: 未绑定任务不能发送", async () => {
  FakeWebSocket.reset();
  const socket = createSocket();

  try {
    await openSocket(socket);
    await assertRejects(
      () => socket.send("missing", 1),
      Error,
      "Task missing is not bound",
    );
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket: bind 校验 uuid 与 lib", async () => {
  FakeWebSocket.reset();
  const socket = createSocket();

  try {
    await assertRejects(
      () => socket.bind("", "demo"),
      Error,
      "non-empty uuid",
    );
    await assertRejects(
      () => socket.bind("task", ""),
      Error,
      "non-empty lib",
    );
    assertEquals(FakeWebSocket.instances.length, 0);
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket: send 失败时任务状态为 bind_failed", async () => {
  FakeWebSocket.reset();
  const socket = createSocket();

  try {
    const ws = await openSocket(socket);
    ws.send = () => {
      throw new Error("send failed");
    };

    await assertRejects(
      () => socket.bind("task-001", "demo"),
      Error,
      "send failed",
    );
    assertEquals(socket.getTaskStatus("task-001"), "bind_failed");
  } finally {
    socket.close();
  }
});

/* =========================
   消息
========================= */

Deno.test("DxSocket: 处理 realtime bind / status / remove", async () => {
  FakeWebSocket.reset();
  const socket = createSocket();

  try {
    const ws = await openSocket(socket);
    await socket.bind("task-001", "demo");

    const events: string[] = [];
    socket.on("bind", () => events.push("bind"));
    socket.on("status", () => events.push("status"));
    socket.on("remove", () => events.push("remove"));

    ws.receive({
      type: "realtime",
      data: { action: "bind", uuid: "task-001", status: "success" },
    });
    assertEquals(socket.getTaskStatus("task-001"), "bound");

    ws.receive({
      type: "realtime",
      data: { action: "status", uuid: "task-001", status: "removing" },
    });
    assertEquals(socket.getTaskStatus("task-001"), "removing");

    ws.receive({
      type: "realtime",
      data: { action: "remove", uuid: "task-001" },
    });
    assertEquals(socket.getTaskStatus("task-001"), "unknown");

    assertEquals(events, ["bind", "status", "remove"]);
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket: 失败状态映射为 bind_failed", async () => {
  FakeWebSocket.reset();
  const socket = createSocket();

  try {
    const ws = await openSocket(socket);
    await socket.bind("task-001", "demo");

    ws.receive({
      type: "realtime",
      data: { action: "status", uuid: "task-001", status: "failed" },
    });

    assertEquals(socket.getTaskStatus("task-001"), "bind_failed");
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket: 处理 msg 与 system 消息", async () => {
  FakeWebSocket.reset();
  const socket = createSocket();

  try {
    const ws = await openSocket(socket);
    await socket.bind("task-001", "demo");

    const system: unknown[] = [];
    socket.on("system", (payload) => system.push(payload));

    ws.receive({ type: "system", data: { status: "ready" } });

    assertEquals(system.length, 1);
    assertEquals(
      (system[0] as { status?: string }).status,
      "ready",
    );
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket: 旧协议 taskName / taskData 兼容", async () => {
  FakeWebSocket.reset();
  const socket = createSocket();

  try {
    const ws = await openSocket(socket);
    const received: unknown[] = [];
    await socket.bind("legacy", "demo", (data) => received.push(data));

    ws.receive({ taskName: "legacy", taskData: "from-old" });
    assertEquals(received, ["from-old"]);

    ws.receive({ taskName: "legacy", taskData: { value: 2 } });
    assertEquals(received, ["from-old", { value: 2 }]);
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket: 非 JSON 消息不抛错并触发 message", async () => {
  FakeWebSocket.reset();
  const socket = createSocket();

  try {
    const ws = await openSocket(socket);
    const messages: unknown[] = [];
    socket.on("message", (payload) => messages.push(payload));

    ws.receive("plain text");

    assertEquals(messages, ["plain text"]);
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket: 未知 uuid 的消息不会崩溃", async () => {
  FakeWebSocket.reset();
  const socket = createSocket();

  try {
    const ws = await openSocket(socket);
    ws.receive({ type: "msg", uuid: "missing", data: 1 });
    ws.receive({ type: "realtime", data: { status: "success" } });
    ws.receive({ foo: "bar" });

    assertEquals(socket.getTaskStatus("missing"), "unknown");
  } finally {
    socket.close();
  }
});

/* =========================
   事件与兼容 API
========================= */

Deno.test("DxSocket: on 返回取消订阅函数", async () => {
  FakeWebSocket.reset();
  const socket = createSocket();

  try {
    let opened = 0;
    const off = socket.on("open", () => {
      opened += 1;
    });

    await openSocket(socket);
    assertEquals(opened, 1);

    off();
    socket.close();

    const reconnecting = socket.connect();
    FakeWebSocket.last.open();
    await reconnecting;
    assertEquals(opened, 1);
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket: 兼容 bindTask / taskSendMessage / removeTask", async () => {
  FakeWebSocket.reset();
  const socket = createSocket();

  try {
    const ws = await openSocket(socket);
    const first: unknown[] = [];
    const second: unknown[] = [];

    await socket.bindTask(
      "legacy",
      { uri: "demo", type: "json", task_uid: "", lib: "demo" },
      (data) => first.push(data),
    );

    assertEquals(ws.commands()[0], {
      cmd: "bind",
      uuid: "legacy",
      lib: "demo",
    });
    assertEquals(socket.getTaskStatus("legacy"), "bound");

    socket.updateTaskCallBack("legacy", (data) => second.push(data));
    ws.receive({ taskName: "legacy", taskData: "value" });

    assertEquals(first, []);
    assertEquals(second, ["value"]);

    await socket.taskSendMessage("legacy", { action: "ping" });
    assertEquals(ws.commands()[1], {
      cmd: "msg",
      uuid: "legacy",
      data: { action: "ping" },
    });

    await socket.removeTask("legacy");
    assertEquals(socket.getTaskStatus("legacy"), "unknown");
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket: bindTask 可以从 dyn.uri 推导 lib", async () => {
  FakeWebSocket.reset();
  const socket = createSocket();

  try {
    const ws = await openSocket(socket);
    await socket.bindTask("legacy", { uri: "demo" }, () => {});

    assertEquals(ws.commands()[0], {
      cmd: "bind",
      uuid: "legacy",
      lib: "demo",
    });
  } finally {
    socket.close();
  }
});

Deno.test("DxSocket: close 后不自动重连，且可以重新连接", async () => {
  FakeWebSocket.reset();
  const socket = createSocket({
    autoReconnect: true,
    reconnectDelay: 5,
    maxReconnectAttempts: 3,
  });

  try {
    await openSocket(socket);
    socket.close();

    assertEquals(socket.state, "closed");
    await new Promise((resolve) => setTimeout(resolve, 20));
    assertEquals(FakeWebSocket.instances.length, 1);

    const reconnecting = socket.connect();
    const ws = FakeWebSocket.last;
    ws.open();
    await reconnecting;

    assertEquals(socket.state, "open");
  } finally {
    socket.close();
  }
});
