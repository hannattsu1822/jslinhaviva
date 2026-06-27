require("dotenv").config();
const { server, app } = require("./init");
const logger = require("./config/logger");
const {
  uploadsSubestacoesDir,
  uploadsFibraDir,
  trafosReformadosAnexosDir,
  uploadsInspRedesDir,
  uploadsChecklistDailyDir,
  uploadsProcessosDir,
} = require("./infrastructure/uploads");
const { mountSecureUploads } = require("./shared/secureUpload.middleware");
const { autenticar, verificarNivel } = require("./auth");
const { iniciarClienteMQTT } = require("./mqtt_handler");
const { iniciarMonitoramentoConexao } = require("./modules/logbox/connectionHistory.service");

mountSecureUploads(app, [
  { urlPath: "/upload_arquivos_subestacoes", dir: uploadsSubestacoesDir, minNivel: 2 },
  { urlPath: "/upload_arquivos_fibra", dir: uploadsFibraDir, minNivel: 2 },
  { urlPath: "/trafos_reformados_anexos", dir: trafosReformadosAnexosDir, minNivel: 3 },
  { urlPath: "/upload_InspDistRedes", dir: uploadsInspRedesDir, minNivel: 2 },
  { urlPath: "/upload_checklist_diario_veiculos", dir: uploadsChecklistDailyDir, minNivel: 3 },
  { urlPath: "/upload_arquivos_processos", dir: uploadsProcessosDir, minNivel: 3 },
], { autenticar, verificarNivel });

// ─── MQTT ─────────────────────────────────────────────────────────────────────
iniciarClienteMQTT(app);
iniciarMonitoramentoConexao(logger);

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
