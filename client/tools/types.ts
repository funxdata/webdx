export interface ObjType {
    // deno-lint-ignore no-explicit-any
    data: unknown,
    time: number,
    expired?: number
}
export interface StorageType {
  set(key: string, val: unknown, expired?: number): void
  get(key: string): unknown
  remove(key: string): void
  clear(): void
}