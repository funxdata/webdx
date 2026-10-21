
import * as Cfg from "@/config/token.ts"
export const init_sse = async (msg:string)=>{
    const ai_message = document.querySelector("#chat-message-user") as HTMLElement;
    const url = "https://api.siliconflow.cn/v1/chat/completions";

    const payload = {
    model: "deepseek-ai/DeepSeek-V2.5",
    messages: [
        {
        role: "user",
        content:
            msg,
        },
    ],
    stream: true,
    };

    const response = await fetch(url, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Cfg.SECRET_KEY}`,
    },
    body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
    throw new Error("请求失败");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let fullContent = "";
    let fullReasoningContent = "";
    let buffer = "";

    while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE 是按 \n\n 分隔
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
        if (!line.startsWith("data:")) continue;

        const data = line.replace(/^data:\s*/, "");
        if (data === "[DONE]") {
        console.log("\n--- DONE ---");
        continue;
        }

        try {
        const chunk = JSON.parse(data);
        const delta = chunk.choices?.[0]?.delta ?? {};

        if (delta.content) {
            fullContent += delta.content;

            ai_message.innerHTML = ai_message.innerHTML+delta.content
            // console.log(delta.content);
        }

        if (delta.reasoning_content) {
            fullReasoningContent += delta.reasoning_content;
            ai_message.innerHTML = ai_message.innerHTML+delta.reasoning_content
            // console.log(delta.reasoning_content);
        }
        } catch (e) {
        console.error("JSON 解析失败", data);
        }
    }
    }

    // console.log("完整 content:", fullContent);
    // console.log("完整 reasoning:", fullReasoningContent);

}