import { Method,ExHeaders,Payload } from "./common.ts";
export type  ExSSE =  {
    /** Constructor. */
    new (url: string, options?: ExSSEOptions): ExSSE;

    headers: ExHeaders;
    payload?: Payload;
    method: Method;
    withCredentials: 'omit' | 'same-origin' | 'include';  // 支持跨域
    debug: boolean;  // 调试标志
    listeners: Record<string, CallBack[]>;   // 事件监听器
    readyState: number;     // 读取前的准备
    progress: number;       // 进度
    chunk: string;
    INITIALIZING: -1;
    CONNECTING: 0;          // 链接中的状态
    OPEN: 1;                // 打开状态
    CLOSED: 2;              // 关闭状态
    addEventListener: AddEventListener;   // 添加监听事件
    removeEventListener: RemoveEventListener;  // 移除监听事件
    dispatchEvent: DispatchEvent;  // 销毁监听时间
    stream: Stream;                // 流数据处理
    close: Close;               // 关闭链接执行的回调
    onmessage: OnMessage;        // 收到通知执行的回调    
    onopen: OnOpen;               // 绑定打开事件  
    onload: OnLoad;              //  绑定加载事件
    onreadystatechange: OnReadystatechange;
    onerror: OnError;          // 错误执行的回调
    onabort: OnAbort;          // 中断执行的回调
  };
  export type ExSSEOptions = {
    headers?: ExHeaders;
    payload?: Payload;
    method: Method;
    withCredentials?:'omit' | 'same-origin' | 'include';  // 支持跨域;
    start?: boolean;
    debug?: boolean;
  };
  export type _SSEvent = {
    id: string;
    data: string;
  };
  export type _ReadyStateEvent = {
    readyState: number;
  };

  export type CallBack = () => void;
  export type SSEvent = Event & _SSEvent;
  export type ReadyStateEvent = SSEvent & _ReadyStateEvent;
  export type AddEventListener = (type: string, listener: CallBack) => void;
  export type RemoveEventListener = (type: string, listener: CallBack) => void;
  export type DispatchEvent = (type: string, listener: CallBack) => boolean;
  export type Stream = () => void;
  export type Close = () => void;
  export type OnMessage = (event: SSEvent) => void;
  export type OnOpen = (event: SSEvent) => void;
  export type OnLoad = (event: SSEvent) => void;
  export type OnReadystatechange = (event: ReadyStateEvent) => void;
  export type OnError = (event: SSEvent) => void;
  export type OnAbort = (event: SSEvent) => void;
  