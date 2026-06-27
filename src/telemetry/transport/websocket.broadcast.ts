import { WebSocketServer, WebSocket } from "ws";
import type { WebSocketPayload } from "../types";

export function broadcastToClients(
  wss: WebSocketServer | null | undefined,
  payload: WebSocketPayload
): void {
  if (!wss?.clients) return;

  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
