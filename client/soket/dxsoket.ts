import type {
  DxSocketType,
  dyncfgType,
  NameToTaskUID,
  SocketConfig,
  TaskMap,
  TaskStatus,
  TaskStatusMap,
  WebSocketMessage,
} from "./types.ts";

export const DEFAULT_SOCKET_CONFIG: Required<SocketConfig> = {
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  autoReconnect: true,
};

const generateShortUUID = (): string => {
  return Math.random().toString(36).substring(2, 10);
};

const isWebSocketSupported = (): boolean => {
  return typeof WebSocket !== "undefined";
};

export class DxSocket implements DxSocketType {
  private socket: WebSocket | null = null;
  private taskMap: TaskMap = new Map();
  private taskUIDMap: NameToTaskUID = new Map();
  private taskStatusMap: TaskStatusMap = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private config: Required<SocketConfig>;
  private url: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isManualClose: boolean = false;
  private isReconnecting: boolean = false;

  constructor(url: string, config: SocketConfig = {}) {
    if (!isWebSocketSupported()) {
      throw new Error("WebSocket is not supported in this environment");
    }

    this.url = url;
    this.config = { ...DEFAULT_SOCKET_CONFIG, ...config };
    this.initializeSocket();
  }

  private initializeSocket() {
    this.socket = new WebSocket(this.url);

    this.socket.onopen = this.handleOpen.bind(this);
    this.socket.onclose = this.handleClose.bind(this);
    this.socket.onerror = this.handleError.bind(this);
    this.socket.onmessage = this.handleMessage.bind(this);
  }

  private handleOpen() {
    console.log("WebSocket connection established");
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.isManualClose = false;
    this.isReconnecting = false;
  }

  private handleClose(event: CloseEvent) {
    console.log("WebSocket connection closed");
    this.isConnected = false;

    if (!this.isManualClose && this.config.autoReconnect) {
      this.handleReconnect();
    }
  }

  private handleError(error: Event) {
    console.error("WebSocket error:", error);
  }

  private handleMessage(event: MessageEvent) {
    try {
      const data: WebSocketMessage = JSON.parse(event.data);
      this.processMessage(data);
    } catch (error) {
      console.error("Error processing message:", error);
    }
  }

  private processMessage(data: WebSocketMessage) {
    const { taskName, taskData, taskStatus, taskUID, action, name } = data;
    const taskIdentifier = taskName || name;

    switch (action) {
      case "bind":
        if (taskIdentifier && taskUID) {
          this.taskUIDMap.set(taskIdentifier, taskUID);
          this.taskStatusMap.set(taskIdentifier, "bound");
        }
        break;
      case "remove":
        if (taskIdentifier) {
          this.taskStatusMap.set(taskIdentifier, "removed");
        }
        break;
      case "status":
        if (taskIdentifier && taskStatus) {
          this.taskStatusMap.set(taskIdentifier, taskStatus);
        }
        break;
      default:
        if (taskIdentifier && this.taskMap.has(taskIdentifier)) {
          const callback = this.taskMap.get(taskIdentifier);
          if (callback) {
            callback(taskData);
          }
        } else if (taskIdentifier) {
          console.warn(`No callback registered for task: ${taskIdentifier}`);
        }
        break;
    }

    if (taskStatus && taskIdentifier) {
      this.taskStatusMap.set(taskIdentifier, taskStatus);
    }

    if (taskUID && taskIdentifier) {
      this.taskUIDMap.set(taskIdentifier, taskUID);
    }
  }

  private handleReconnect() {
    if (this.isReconnecting) {
      return;
    }

    this.isReconnecting = true;

    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.config.reconnectDelay * this.reconnectAttempts;

      console.log(
        `Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`,
      );

      this.reconnectTimer = setTimeout(() => {
        this.initializeSocket();
        this.isReconnecting = false;
      }, delay);
    } else {
      console.error("Max reconnect attempts reached. Connection failed.");
      this.isReconnecting = false;
    }
  }

  private getTaskUID = (name: string): string => {
    return this.taskUIDMap.get(name) || "";
  };

  private ensureConnection = async (): Promise<boolean> => {
    // 如果已连接且 socket 存在，直接返回
    if (
      this.isConnected && this.socket &&
      this.socket.readyState === WebSocket.OPEN
    ) {
      return true;
    }

    // 如果正在重连，等待重连完成
    if (this.isReconnecting) {
      console.log("Waiting for reconnection...");
      await this.waitForReconnect();
      return this.isConnected && this.socket !== null &&
        this.socket.readyState === WebSocket.OPEN;
    }

    // 如果是手动关闭，不自动重连
    if (this.isManualClose) {
      console.warn("Socket was manually closed, cannot auto-reconnect");
      return false;
    }

    // 尝试重连
    console.log("Socket not connected, attempting to reconnect...");
    return new Promise((resolve) => {
      // 记录当前重连尝试次数
      const currentAttempts = this.reconnectAttempts;

      // 如果已经达到最大重连次数，直接返回 false
      if (currentAttempts >= this.config.maxReconnectAttempts) {
        resolve(false);
        return;
      }

      // 触发重连
      this.handleReconnect();

      // 等待重连完成或超时
      const checkInterval = setInterval(() => {
        if (
          this.isConnected && this.socket &&
          this.socket.readyState === WebSocket.OPEN
        ) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 500);

      // 超时处理（30秒）
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 30000);
    });
  };

  private waitForReconnect = (): Promise<void> => {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.isReconnecting) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 200);
    });
  };

  private sendMessage = async (message: WebSocketMessage): Promise<void> => {
    // 确保连接可用
    const connected = await this.ensureConnection();

    if (!connected) {
      throw new Error(
        "Cannot send message: WebSocket is not connected and reconnection failed",
      );
    }

    if (!this.socket) {
      throw new Error("WebSocket is null");
    }

    try {
      this.socket.send(JSON.stringify(message));
    } catch (error) {
      console.error("Failed to send message:", error);
      throw error;
    }
  };

  // ============ 公共 API ============

  bindTask = async (
    name: string,
    dyn: dyncfgType,
    callback: Function,
  ): Promise<void> => {
    if (!dyn.task_uid) {
      dyn.task_uid = generateShortUUID();
    }

    this.taskMap.set(name, callback);
    this.taskUIDMap.set(name, dyn.task_uid);
    this.taskStatusMap.set(name, "binding");

    try {
      await this.sendMessage({
        action: "bind",
        name,
        dyn,
        taskUID: dyn.task_uid,
      });
      this.taskStatusMap.set(name, "bound");
      console.log(`Task ${name} bound successfully`);
    } catch (error) {
      console.error(`Failed to bind task ${name}:`, error);
      this.taskStatusMap.set(name, "bind_failed");
      throw error;
    }
  };

  taskSendMessage = async (name: string, data: any): Promise<void> => {
    const taskUID = this.getTaskUID(name);
    if (!taskUID) {
      const error = `Task ${name} not bound or UID not found`;
      console.error(error);
      throw new Error(error);
    }

    await this.sendMessage({
      action: "message",
      name,
      taskUID,
      data,
    });
  };

  removeTask = async (name: string): Promise<void> => {
    const taskUID = this.getTaskUID(name);
    if (!taskUID) {
      console.warn(`Task ${name} not found or already removed`);
      return;
    }

    try {
      await this.sendMessage({
        action: "remove",
        name,
        taskUID,
      });

      this.taskStatusMap.set(name, "removing");
      this.taskMap.delete(name);
      this.taskUIDMap.delete(name);
      this.taskStatusMap.delete(name);

      console.log(`Task ${name} removed successfully`);
    } catch (error) {
      console.error(`Failed to remove task ${name}:`, error);
      this.taskStatusMap.set(name, "error");
      throw error;
    }
  };

  updateTaskCallBack = (name: string, callback: Function): void => {
    // 这个操作不需要发送消息，只更新本地回调
    if (this.taskMap.has(name)) {
      this.taskMap.set(name, callback);
      console.log(`Task ${name} callback updated`);
    } else {
      console.warn(`Task ${name} does not exist`);
    }
  };

  getTaskStatus = (name: string): TaskStatus => {
    return (this.taskStatusMap.get(name) as TaskStatus) || "unknown";
  };

  close = (): void => {
    this.isManualClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      if (
        this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING
      ) {
        this.socket.close();
      }
      this.socket = null;
    }
    this.isConnected = false;
    this.isReconnecting = false;
    console.log("Socket closed manually");
  };
}
