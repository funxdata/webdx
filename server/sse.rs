// 测试sse使用的// sse_server.ts
import { serve } from "std/http/server.ts";

console.log("SSE server running on http://localhost:8000/sse");

serve((req: Request): Response | Promise<Response> => {
  const { pathname } = new URL(req.url);

  if (pathname === "/sse") {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const send = () => {
          const data = JSON.stringify({ time: new Date().toISOString() });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

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
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  return new Response("Not Found", { status: 404 });
});