import type { DxHttpResponse } from "./types.ts";

/**
 * 根据 Content-Type 自动检测解析方式。
 */
const detectResponseType = (
  contentType: string | null,
): "json" | "text" | "blob" | "arrayBuffer" => {
  if (!contentType) return "json";

  if (contentType.includes("application/json")) return "json";
  if (
    contentType.includes("text/") || contentType.includes("application/html")
  ) return "text";
  if (contentType.includes("application/octet-stream")) return "arrayBuffer";
  if (
    contentType.includes("image/") || contentType.includes("video/") ||
    contentType.includes("audio/")
  ) return "blob";

  return "json";
};

/**
 * 将 fetch Response 解析成 DxHttpResponse<T>。
 *
 * - 204 / 205 / 空 body：`data` 为 null；
 * - JSON 解析失败时回退为原始文本，避免错误响应体丢失；
 * - 保留 `msg` 作为 `ok` 的兼容别名。
 */
export const CoreResponse = async <T>(
  res: Response,
): Promise<DxHttpResponse<T>> => {
  const contentType = res.headers.get("Content-Type")?.toLowerCase() || "";
  const type = detectResponseType(contentType);

  let data: T;

  if (res.status === 204 || res.status === 205) {
    data = null as T;
  } else if (type === "blob") {
    data = (await res.blob()) as T;
  } else if (type === "arrayBuffer") {
    data = (await res.arrayBuffer()) as T;
  } else {
    const text = await res.text();
    if (type === "json") {
      if (text === "") {
        data = null as T;
      } else {
        try {
          data = JSON.parse(text) as T;
        } catch {
          data = text as T;
        }
      }
    } else {
      data = text as T;
    }
  }

  return {
    data,
    status: res.status,
    statusText: res.statusText,
    ok: res.ok,
    headers: res.headers,
    msg: res.ok,
  };
};
