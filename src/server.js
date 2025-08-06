require("dotenv").config();
const http = require("http");
const { WebSocketServer } = require("ws");
const { app } = require("./init");
const { iniciarClienteMQTT } = require("./mqtt_handler");

// 1. Cria um servidor HTTP padrão e entrega o seu 'app' Express para ele.
//    Seu 'app' continua funcionando da mesma forma.
const server = http.createServer(app);

// 2. Cria o servidor WebSocket e o anexa ao servidor HTTP.
const wss = new WebSocketServer({ server });

// 3. Guarda a instância do WebSocket no 'app' para que o mqtt_handler possa encontrá-la.
app.set("wss", wss);

// 4. Configura o que acontece quando um navegador se conecta via WebSocket.
wss.on("connection", (ws) => {
  console.log("[WebSocket] Novo cliente conectado.");
  ws.on("close", () => {
    console.log("[WebSocket] Cliente desconectado.");
  });
});

// 5. Inicia o cliente MQTT, passando o 'app' para que ele tenha acesso ao wss.
//    Isso é feito DEPOIS que tudo foi configurado, resolvendo o erro anterior.
iniciarClienteMQTT(app);

// 6. Carrega todas as suas rotas existentes.
const aggregatorRoutes = require("./routes");
app.use("/", aggregatorRoutes);

// 7. Inicia o servidor principal.
const port = process.env.SERVER_PORT || 3000;
server.listen(port, () => {
  console.log(`Servidor HTTP e WebSocket rodando em http://localhost:${port}`);
});
