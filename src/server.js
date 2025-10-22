require("dotenv").config();
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");
const { app } = require("./init");
const { iniciarClienteMQTT } = require("./mqtt_handler");

const server = http.createServer(app);

const wss = new WebSocketServer({ server });

app.set("wss", wss);

wss.on("connection", (ws) => {
  console.log("[WebSocket] Novo cliente conectado.");
  ws.on("close", () => {
    console.log("[WebSocket] Cliente desconectado.");
  });
});

iniciarClienteMQTT(app);

const aggregatorRoutes = require("./routes");
app.use("/", aggregatorRoutes);

const port = process.env.SERVER_PORT || 3000;
server.listen(port, () => {
  console.log(`Servidor HTTP e WebSocket rodando em http://localhost:${port}`);
});
