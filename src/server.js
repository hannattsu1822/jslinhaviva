require("dotenv").config();
const http = require("http");
const { WebSocketServer } = require("ws");
const { app } = require("./init");
const { iniciarClienteMQTT } = require("./mqtt_handler");

const admin = require("firebase-admin");

const serviceAccount = require("../gestao-servicos-notifica-18299-firebase-adminsdk-fbsvc-f88a4cba28.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

console.log("Firebase Admin SDK inicializado com sucesso.");

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
