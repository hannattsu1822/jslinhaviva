require("dotenv").config();
const { server, app, logger } = require("./init");
const { iniciarClienteMQTT } = require("./mqtt_handler");

// ─── MQTT ─────────────────────────────────────────────────────────────────────
iniciarClienteMQTT(app);

// ─── Rotas principais ─────────────────────────────────────────────────────────
const aggregatorRoutes = require("./routes");
app.use("/", aggregatorRoutes);

// ─── Middleware global de erros (deve ficar APÓS todas as rotas) ──────────────
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === "production";

  logger.error(`[ERRO] ${req.method} ${req.originalUrl} → ${err.message}`);

  res.status(status).json({
    success: false,
    message: isProd ? "Erro interno do servidor." : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });
});

// ─── Iniciar servidor ─────────────────────────────────────────────────────────
const port = process.env.SERVER_PORT || 3000;

server.listen(port, () => {
  logger.info(`Servidor HTTP e WebSocket rodando em http://localhost:${port}`);
});
