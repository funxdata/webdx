export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'|'PATCH';

export type AcceptHeader =
  | 'application/json'
  | 'text/html'
  | 'text/plain'
  | 'application/xml'
  | '*/*'
  | `${string}/${string}`; // 允许自定义类型，例如 image/webp

  export type ContentType =
  | 'application/json'
  | 'multipart/form-data'
  | 'text/plain'
  | 'text/html'
  | 'application/xml'
  | 'text/xml'
  | 'application/octet-stream'
  | `${string}/${string}`; // 扩展支持任意 MIME

  export type CacheControlHeader =
  | 'no-cache'
  | 'no-store'
  | 'public'
  | 'private'
  | 'must-revalidate'
  | 'immutable'
  | `max-age=${number}`
  | `s-maxage=${number}`
  | `${string}`; // 支持自定义组合

  export type AcceptEncodingHeader =
  | 'gzip'
  | 'deflate'
  | 'br'
  | 'compress'
  | 'identity'
  | '*'
  | `${string}`; // 支持自定义或未来扩展

  export type LanguageTag = 
  | 'en'
  | 'en-US'
  | 'en-GB'
  | 'zh'
  | 'zh-CN'
  | 'zh-TW'
  | 'fr'
  | 'es'
  | 'de'
  | `${string}`; // 允许自定义其他标签

// export type Method =string;
export type ExHeaders = {
    'Content-Type': ContentType;   
    'Accept'?: AcceptHeader;
    'Authorization'?: string; //  定义认证头的类型为字符串
    'User-Agent'?: string;
    'Cache-Control'?: string;
    'Accept-Encoding'?: AcceptEncodingHeader;
    'Accept-Language'?: LanguageTag;  // 允许自定义语言标签
    'Connection'?: 'keep-alive' | 'close';
};

export type Payload =
  | string
  | Blob
  | ArrayBuffer
  | DataView
  | FormData
  | URLSearchParams
  | null;