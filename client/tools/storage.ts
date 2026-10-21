import type { ObjType, StorageType } from "./types.ts";

export const Storage: StorageType = {
  // 存
  set(key: string, val: unknown, expired?: number) {
    const obj: ObjType = {
      data: val,
      time: Date.now(),
      expired,
    };
    localStorage.setItem(key, JSON.stringify(obj));
  },

  // 取
  get<T = unknown>(key: string): T | null {
    const val = localStorage.getItem(key);
    if (!val) return null;

    const parseVal = JSON.parse(val) as ObjType;

    if (parseVal.expired) {
      if (Date.now() - parseVal.time > parseVal.expired) {
        localStorage.removeItem(key);
        return null;
      }
    }

    return (parseVal.data ?? null) as T | null;
  },

  // 单独删除
  remove(key: string) {
    localStorage.removeItem(key);
  },

  // 全部删除
  clear() {
    localStorage.clear();
  },
};
