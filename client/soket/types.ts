// types.ts

export type dyncfgType = {
  uri: string;
  type: string;
  task_uid: string;
};

export type NameToTaskUID = Map<string, string>;
export type TaskMap = Map<string, Function>;
export type TaskStatusMap = Map<string, string>;

export type TaskStatus =
  | "unknown"
  | "binding"
  | "bound"
  | "bind_failed"
  | "removing"
  | "removed"
  | "error";

export interface WebSocketMessage {
  action?: "bind" | "message" | "remove" | "status";
  name?: string;
  dyn?: dyncfgType;
  taskUID?: string;
  taskName?: string;
  taskData?: any;
  taskStatus?: TaskStatus;
  data?: any;
}

export interface SocketConfig {
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  autoReconnect?: boolean;
}

export interface DxSocketType {
  bindTask(name: string, dyn: dyncfgType, callback: Function): Promise<void>;
  taskSendMessage(name: string, data: any): Promise<void>;
  removeTask(name: string): Promise<void>;
  updateTaskCallBack(name: string, callback: Function): void;
  getTaskStatus(name: string): TaskStatus;
  close(): void;
}
