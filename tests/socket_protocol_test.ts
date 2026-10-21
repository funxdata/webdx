import { assertEquals } from "@std/assert";
import { normalizeServerMessage } from "../client/dxsoket.ts";

Deno.test("normalizeServerMessage: realtime bind", () => {
  const raw = {
    type: "realtime",
    data: { action: "bind", uuid: "task-001", status: "success" },
  };
  const message = normalizeServerMessage(raw);

  assertEquals(message.kind, "bind");
  if (message.kind === "bind") {
    assertEquals(message.uuid, "task-001");
    assertEquals(message.status, "success");
    assertEquals(message.raw, raw);
  }
});

Deno.test("normalizeServerMessage: realtime remove", () => {
  const message = normalizeServerMessage({
    type: "realtime",
    data: { action: "remove", uuid: "task-002" },
  });

  assertEquals(message.kind, "remove");
  if (message.kind === "remove") {
    assertEquals(message.uuid, "task-002");
  }
});

Deno.test("normalizeServerMessage: realtime status", () => {
  const message = normalizeServerMessage({
    type: "realtime",
    data: { action: "status", uuid: "task-003", status: "running" },
  });

  assertEquals(message.kind, "status");
  if (message.kind === "status") {
    assertEquals(message.uuid, "task-003");
    assertEquals(message.status, "running");
  }
});

Deno.test("normalizeServerMessage: realtime 无 action 视为状态更新", () => {
  const message = normalizeServerMessage({
    type: "realtime",
    data: { uuid: "task-004", status: "success" },
  });

  assertEquals(message.kind, "status");
  if (message.kind === "status") {
    assertEquals(message.uuid, "task-004");
    assertEquals(message.status, "success");
  }
});

Deno.test("normalizeServerMessage: msg 消息", () => {
  const message = normalizeServerMessage({
    type: "msg",
    uuid: "task-001",
    data: { value: 42 },
  });

  assertEquals(message.kind, "data");
  if (message.kind === "data") {
    assertEquals(message.uuid, "task-001");
    assertEquals(message.data, { value: 42 });
  }
});

Deno.test("normalizeServerMessage: system 消息", () => {
  const message = normalizeServerMessage({
    type: "system",
    data: { status: "ready" },
  });

  assertEquals(message.kind, "system");
  if (message.kind === "system") {
    assertEquals(message.status, "ready");
    assertEquals(message.data, { status: "ready" });
  }
});

Deno.test("normalizeServerMessage: 旧协议 bind", () => {
  const message = normalizeServerMessage({
    action: "bind",
    name: "legacy",
    taskUID: "uid-1",
    taskStatus: "bound",
  });

  assertEquals(message.kind, "bind");
  if (message.kind === "bind") {
    assertEquals(message.uuid, "legacy");
    assertEquals(message.status, "bound");
  }
});

Deno.test("normalizeServerMessage: 旧协议 remove", () => {
  const message = normalizeServerMessage({
    action: "remove",
    taskName: "legacy",
  });

  assertEquals(message.kind, "remove");
  if (message.kind === "remove") {
    assertEquals(message.uuid, "legacy");
  }
});

Deno.test("normalizeServerMessage: 旧协议 status", () => {
  const message = normalizeServerMessage({
    action: "status",
    taskName: "legacy",
    taskStatus: "running",
  });

  assertEquals(message.kind, "status");
  if (message.kind === "status") {
    assertEquals(message.uuid, "legacy");
    assertEquals(message.status, "running");
  }
});

Deno.test("normalizeServerMessage: 旧协议 message", () => {
  const message = normalizeServerMessage({
    action: "message",
    name: "legacy",
    data: { value: 1 },
  });

  assertEquals(message.kind, "data");
  if (message.kind === "data") {
    assertEquals(message.uuid, "legacy");
    assertEquals(message.data, { value: 1 });
  }
});

Deno.test("normalizeServerMessage: 旧协议裸 taskData", () => {
  const message = normalizeServerMessage({
    taskName: "legacy",
    taskData: "payload",
  });

  assertEquals(message.kind, "data");
  if (message.kind === "data") {
    assertEquals(message.uuid, "legacy");
    assertEquals(message.data, "payload");
  }
});

Deno.test("normalizeServerMessage: uuid 优先级 inner > raw > task_uid > taskName", () => {
  const message = normalizeServerMessage({
    type: "msg",
    uuid: "raw-uuid",
    task_uid: "snake-uid",
    taskUID: "camel-uid",
    taskName: "task-name",
    data: { value: 1 },
  });

  if (message.kind === "data") {
    assertEquals(message.uuid, "raw-uuid");
  } else {
    throw new Error(`unexpected kind: ${message.kind}`);
  }

  const inner = normalizeServerMessage({
    type: "realtime",
    data: { action: "bind", uuid: "inner-uuid" },
    uuid: "raw-uuid",
  });
  if (inner.kind === "bind") {
    assertEquals(inner.uuid, "inner-uuid");
  } else {
    throw new Error(`unexpected kind: ${inner.kind}`);
  }
});

Deno.test("normalizeServerMessage: status 优先级 inner > raw > taskStatus", () => {
  const message = normalizeServerMessage({
    type: "realtime",
    data: { action: "status", status: "inner" },
    status: "outer",
    taskStatus: "legacy",
  });

  if (message.kind === "status") {
    assertEquals(message.status, "inner");
  } else {
    throw new Error(`unexpected kind: ${message.kind}`);
  }
});

Deno.test("normalizeServerMessage: 非对象返回 unknown", () => {
  for (const value of [null, undefined, 1, "text", true, [1, 2]]) {
    const message = normalizeServerMessage(value);
    assertEquals(message.kind, "unknown");
    assertEquals(message.raw, value);
  }
});

Deno.test("normalizeServerMessage: 无法识别的对象返回 unknown", () => {
  const raw = { foo: "bar" };
  const message = normalizeServerMessage(raw);

  assertEquals(message.kind, "unknown");
  if (message.kind === "unknown") {
    assertEquals(message.raw, raw);
  }
});

Deno.test("normalizeServerMessage: 裸 status 对象", () => {
  const message = normalizeServerMessage({
    uuid: "task-005",
    status: "running",
  });

  assertEquals(message.kind, "status");
  if (message.kind === "status") {
    assertEquals(message.uuid, "task-005");
    assertEquals(message.status, "running");
  }
});
