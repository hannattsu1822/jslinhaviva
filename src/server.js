require("dotenv").config();
const { server, app, logger } = require("./init"); // Importa o servidor JÁ CRIADO no init
const { iniciarClienteMQTT } = require("./mqtt_handler");

// Iniciar Cliente MQTT
iniciarClienteMQTT(app);

// Importar e usar rotas principais
const aggregatorRoutes = require("./routes");
app.use("/", aggregatorRoutes);

const port = process.env.SERVER_PORT || 3000;

// Inicia o servidor no init.js
server.listen(port, () => {
  logger.info(`Servidor HTTP e WebSocket rodando em http://localhost:${port}`);
});
