/** 判断一个值是否可以被 `JSON.stringify` 正常序列化。 */
export const isJSONSerializable = (value: unknown): boolean => {
  if (value === undefined) return false;
  if (value === null) return true;

  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") {
    return true;
  }
  if (type !== "object") {
    return false; // bigint, function, symbol
  }

  if (Array.isArray(value)) {
    return true;
  }

  if (value instanceof FormData || value instanceof URLSearchParams) {
    return false;
  }

  const record = value as {
    buffer?: unknown;
    constructor?: { name?: string };
    toJSON?: unknown;
  };

  if (record.buffer) {
    return false;
  }

  return (
    record.constructor?.name === "Object" ||
    typeof record.toJSON === "function"
  );
};
