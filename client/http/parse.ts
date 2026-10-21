import type { DxHttpResponse } from "./types.ts";

/**
 * 根据 Content-Type 自动检测解析方式
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

  return "json"; // 默认 json
};

/**
 * 将 fetch Response 解析成 DxHttpResponse<T>
 * 根据 Content-Type 自动选择解析方法
 */
export const CoreResponse = async <T>(
  res: Response,
): Promise<DxHttpResponse<T>> => {
  const contentType = res.headers.get("Content-Type")?.toLowerCase() || "";
  const type = detectResponseType(contentType);

  let data: T;

  switch (type) {
    case "json":
      data = await res.json();
      break;
    case "text":
      data = (await res.text()) as unknown as T;
      break;
    case "blob":
      data = (await res.blob()) as unknown as T;
      break;
    case "arrayBuffer":
      data = (await res.arrayBuffer()) as unknown as T;
      break;
    default:
      data = await res.json();
      break;
  }

  return {
    data,
    status: res.status,
    msg: res.status >= 200 && res.status < 300,
  };
};
