export interface ObjType {
  data: unknown;
  time: number;
  expired?: number;
}
export interface StorageType {
  set(key: string, val: unknown, expired?: number): void;
  get<T = unknown>(key: string): T | null;
  remove(key: string): void;
  clear(): void;
}
