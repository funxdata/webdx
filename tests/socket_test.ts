// example.ts
import { DxSocket } from "../client/soket/dxsoket.ts";

const socket = new DxSocket("ws://127.0.0.1:44944/soket", {
  maxReconnectAttempts: 3,
  reconnectDelay: 2000,
  autoReconnect: true,
});

// 使用 async/await
async function example() {
  try {
    // 会自动检查连接，如果断开会自动重连
    await socket.bindTask("myTask", {
      uri: "test",
      type: "json",
      task_uid: "",
    }, (data: any) => {
      console.log("Received:", data);
    });

    // 自动处理连接状态
    await socket.taskSendMessage("myTask", { action: "getData" });

    // 获取状态（不需要等待）
    const status = socket.getTaskStatus("myTask");
    console.log("Task status:", status);

    // 移除任务
    await socket.removeTask("myTask");
  } catch (error: any) {
    console.error("Operation failed:", error.message);
  }
}

example();

// 手动关闭
setTimeout(() => {
  socket.close();
}, 10000);
