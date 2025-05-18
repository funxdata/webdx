const eventSource = new EventSource("http://127.0.0.1:8000/sse");
const log = document.getElementById("log") as HTMLElement;

eventSource.onmessage = (event) => {
  const msg = document.createElement("p");
  const rece_data = JSON.parse(event.data);
  msg.textContent = "Received: " + rece_data.time+"  客户端计数器："+rece_data.message;
  log.appendChild(msg);
};

eventSource.onerror = (err) => {
  console.error("SSE Error:", err);
};