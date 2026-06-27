const WebSocket = require("ws");

function broadcastToClients(wss, payload) {
  if (!wss || !wss.clients) return;

  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

module.exports = { broadcastToClients };
