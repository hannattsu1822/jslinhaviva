require("dotenv").config();

const http = require("http");
const { createBaseApp } = require("./app");
const logger = require("./config/logger");
const { createSessionMiddleware } = require("./config/session");
const { csrfProtection } = require("./middleware/csrf");
const { promisePool } = require("./infrastructure/database");
const uploads = require("./infrastructure/uploads");
const { setupWebSocket } = require("./infrastructure/websocket");
const { projectRootDir } = require("./shared/path.helper");
const { salvarAnexos } = require("./modules/gestaoServicos/anexo/processosAnexos.helper");

const app = createBaseApp(logger);
const sessionMiddleware = createSessionMiddleware(logger);

app.use(sessionMiddleware);
app.use(csrfProtection);

const server = http.createServer(app);
const wss = setupWebSocket({ server, app, sessionMiddleware, logger });

module.exports = {
  app,
  server,
  wss,
  upload: uploads.upload,
  promisePool,
  salvarAnexos,
  projectRootDir,
  uploadsSubestacoesDir: uploads.uploadsSubestacoesDir,
  uploadsFibraDir: uploads.uploadsFibraDir,
  trafosReformadosAnexosDir: uploads.trafosReformadosAnexosDir,
  uploadsInspRedesDir: uploads.uploadsInspRedesDir,
  uploadsChecklistDailyDir: uploads.uploadsChecklistDailyDir,
  uploadsProcessosDir: uploads.uploadsProcessosDir,
  uploadAnexoChecklist: uploads.uploadAnexoChecklist,
  logger,
};
