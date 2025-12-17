require("dotenv").config();
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");
const { app } = require("./init");
const { iniciarClienteMQTT } = require("./mqtt_handler");

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.set("wss", wss);

wss.on("connection", (ws, req) => {
  const cookies = req.headers.cookie;
  
  if (!cookies) {
    console.log("[WebSocket] Conexão rejeitada: sem cookie de sessão");
    ws.close(1008, "Autenticação necessária");
    return;
  }

  const sessionCookie = cookies.split(';').find(c => c.trim().startsWith('connect.sid='));
  
  if (!sessionCookie) {
    console.log("[WebSocket] Conexão rejeitada: cookie de sessão inválido");
    ws.close(1008, "Autenticação necessária");
    return;
  }

  console.log("[WebSocket] Novo cliente conectado e autenticado.");

  ws.on("close", () => {
    console.log("[WebSocket] Cliente desconectado.");
  });

  ws.on("error", (error) => {
    console.error("[WebSocket] Erro na conexão:", error);
  });
});

iniciarClienteMQTT(app);

const aggregatorRoutes = require("./routes");
app.use("/", aggregatorRoutes);

const port = process.env.SERVER_PORT || 3000;

server.listen(port, () => {
  console.log(`Servidor HTTP e WebSocket rodando em http://localhost:${port}`);
});
