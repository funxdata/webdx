import type { ObjType, StorageBackend, StorageType } from "./types.ts";

const LOCAL_STORAGE_ERROR =
  "localStorage is not available in this environment; use createStorage() with a custom backend";

/** 默认后端：浏览器 localStorage；不可用时抛出明确错误。 */
const localStorageBackend: StorageBackend = {
  getItem(key) {
    return requireLocalStorage().getItem(key);
  },
  setItem(key, value) {
    requireLocalStorage().setItem(key, value);
  },
  removeItem(key) {
    requireLocalStorage().removeItem(key);
  },
  clear() {
    requireLocalStorage().clear();
  },
};

/**
 * 用自定义后端创建 Storage。
 *
 * ```ts
 * const memory = new Map<string, string>();
 * const storage = createStorage({
 *   getItem: (key) => memory.get(key) ?? null,
 *   setItem: (key, value) => memory.set(key, value),
 *   removeItem: (key) => memory.delete(key),
 *   clear: () => memory.clear(),
 * });
 * ```
 */
export function createStorage(backend: StorageBackend): StorageType {
  return {
    set(key: string, val: unknown, expired?: number) {
      const obj: ObjType = {
        data: val,
        time: Date.now(),
        expired,
      };
      backend.setItem(key, JSON.stringify(obj));
    },

    get<T = unknown>(key: string): T | null {
      const val = backend.getItem(key);
      if (!val) return null;

      const parseVal = JSON.parse(val) as ObjType;

      if (parseVal.expired) {
        if (Date.now() - parseVal.time > parseVal.expired) {
          backend.removeItem(key);
          return null;
        }
      }

      return (parseVal.data ?? null) as T | null;
    },

    remove(key: string) {
      backend.removeItem(key);
    },

    clear() {
      backend.clear();
    },
  };
}

/** 默认 Storage，使用 localStorage。在 Node / 无 Web Storage 的 Deno 中请改用 createStorage。 */
export const Storage: StorageType = createStorage(localStorageBackend);

function requireLocalStorage(): StorageBackend {
  const storage = (globalThis as { localStorage?: StorageBackend })
    .localStorage;
  if (!storage) {
    throw new Error(LOCAL_STORAGE_ERROR);
  }
  return storage;
}
