const { WebSocketServer } = require("ws");

function setupWebSocket({ server, app, sessionMiddleware, logger }) {
  const wss = new WebSocketServer({ noServer: true });
  app.set("wss", wss);

  server.on("upgrade", (request, socket, head) => {
    sessionMiddleware(request, {}, () => {
      if (!request.session || !request.session.user) {
        logger.warn(
          `[WebSocket] Tentativa de conexão sem sessão válida: ${request.socket.remoteAddress}`
        );
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      logger.info(`[WebSocket] Upgrade autorizado para usuário: ${request.session.user.matricula}`);
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    });
  });

  wss.on("connection", (ws, req) => {
    const ip   = req.socket.remoteAddress;
    const user = req.session ? req.session.user.matricula : "Desconhecido";
    logger.info(`[WebSocket] Conexão estabelecida. IP: ${ip}, Usuário: ${user}`);

    ws.on("message", (message) => {
      try {
        const msg = JSON.parse(message);
        if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
      } catch (e) {
        logger.error(`[WebSocket] Erro msg: ${e.message}`);
      }
    });

    ws.on("error", (error) => logger.error(`[WebSocket] Erro: ${error.message}`));
  });

  return wss;
}

module.exports = { setupWebSocket };
