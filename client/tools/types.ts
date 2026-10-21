export interface ObjType {
  data: unknown;
  time: number;
  expired?: number;
}

/** `Storage` 使用的底层键值存储，可以是 localStorage、内存 Map 或自定义实现。 */
export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

export interface StorageType {
  set(key: string, val: unknown, expired?: number): void;
  get<T = unknown>(key: string): T | null;
  remove(key: string): void;
  clear(): void;
}
