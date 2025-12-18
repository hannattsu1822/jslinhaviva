require("dotenv").config();
const http = require("http");
const { WebSocketServer } = require("ws");
const { app } = require("./init");
const { iniciarClienteMQTT } = require("./mqtt_handler");

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.set("wss", wss);

wss.on("connection", (ws, req) => {
  const origin = req.headers.origin || req.headers.host;
  console.log(`[WebSocket] Novo cliente conectado. Origem: ${origin}`);

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log("[WebSocket] Mensagem recebida do cliente:", data);
    } catch (e) {
      console.error("[WebSocket] Erro ao processar mensagem:", e.message);
    }
  });

  ws.on("close", () => {
    console.log("[WebSocket] Cliente desconectado.");
  });

  ws.on("error", (error) => {
    console.error("[WebSocket] Erro na conexão:", error.message);
  });
});

iniciarClienteMQTT(app);

const aggregatorRoutes = require("./routes");
app.use("/", aggregatorRoutes);

const port = process.env.SERVER_PORT || 3000;
server.listen(port, () => {
  console.log(`Servidor HTTP e WebSocket rodando em http://localhost:${port}`);
});
