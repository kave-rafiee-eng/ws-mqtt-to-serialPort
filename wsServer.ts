import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 3001 });

const clients = new Set<WebSocket>();
console.log("WebSocket server started on port 3001");

type MessageCallback = (message: Buffer) => void;

let Cb_WsMessArrived: MessageCallback | null = null;

export function WsSend(data: Buffer | Uint8Array): void {
  console.log("Recived Data From USB : ");
  console.log(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

export function SetCb_WsMessArrived(CbFn: MessageCallback): void {
  Cb_WsMessArrived = CbFn;
}

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log("Client connected");

  ws.on("message", (message) => {
    if (Cb_WsMessArrived) Cb_WsMessArrived(message as Buffer);
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });

  ws.send("Connected to server");
});
