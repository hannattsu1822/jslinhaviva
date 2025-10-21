require("dotenv").config();
const http = require("http");
const path = require("path"); // Adicionado para garantir que 'path' esteja disponível
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

// --- ROTA ESPECIAL PARA O SERVICE WORKER ---
app.get('/firebase-messaging-sw.js', (req, res) => {
  // LOG DE DEBUG: Isso vai aparecer no console da sua VPS
  console.log(">>> ROTA /firebase-messaging-sw.js FOI ACESSADA! <<<");
  
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.resolve(__dirname, '../public/firebase-messaging-sw.js'), (err) => {
    if (err) {
      // LOG DE ERRO: Se o arquivo não for encontrado
      console.error("!!! ERRO AO ENVIAR O ARQUIVO firebase-messaging-sw.js:", err);
      res.status(500).send('Erro ao servir o Service Worker.');
    } else {
      console.log(">>> Arquivo firebase-messaging-sw.js enviado com sucesso. <<<");
    }
  });
});
// --- FIM DA ROTA ESPECIAL ---

const aggregatorRoutes = require("./routes");
app.use("/", aggregatorRoutes);

const port = process.env.SERVER_PORT || 3000;
server.listen(port, () => {
  console.log(`Servidor HTTP e WebSocket rodando em http://localhost:${port}`);
});
