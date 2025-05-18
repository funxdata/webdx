// 测试sse使用的// sse_server.ts
let Send_count_sum = 0;
// deno-lint-ignore require-await
const handler = async (req: Request): Promise<Response> => {
  const { pathname } = new URL(req.url);
  if (pathname === "/sse") {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const send = () => {
          const data = JSON.stringify({ time: new Date(), message: "Hello from SSE!"+ Send_count_sum});
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          Send_count_sum = Send_count_sum + 1;
        };
        // Send_count_sum = Send_count_sum + 1;
        // 控制发送频率，这里设置为每2秒发送一次
        const interval = setInterval(send, 2000);

        req.signal.addEventListener("abort", () => {
          clearInterval(interval);
          controller.close();
        });
        // 首次立即推送
        send();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",    // 核心标准事件流的处理
        "Cache-Control": "no-cache",            // 控制缓存机制
        "Connection": "keep-alive",             // SSE 是服务器通过 HTTP 协议持续向客户端推送事件的机制。为了这个“持续性”能正常工作，需要保持 TCP 连接不断开          
        "Access-Control-Allow-Origin": "*",     // 允许跨域
      },
    });
  }

  // 默认返回信息的处理
  const data = { message: "Hello, test SSE!" };
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}
console.log("SSE server running on http://localhost:8000/sse");
Deno.serve({ port: 8000 }, handler);