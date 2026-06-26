const express = require("express");
const path = require("path");
const { applySecurityMiddleware } = require("./config/security");
const { cspNonceMiddleware, createStaticWithHtmlNonce } = require("./middleware/cspNonce");
const { frontendDir, publicDir, viewsDir } = require("./shared/path.helper");

function createBaseApp(logger) {
  const app = express();
  app.set("trust proxy", 1);

  app.use(cspNonceMiddleware);
  applySecurityMiddleware(app);

  app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || "15mb" }));
  app.use(
    express.urlencoded({
      limit: process.env.REQUEST_BODY_LIMIT || "15mb",
      extended: true,
    })
  );

  app.engine("html", require("ejs").renderFile);
  app.set("view engine", "html");
  app.set("views", [viewsDir, publicDir]);

  const serveFrontend = process.env.SERVE_FRONTEND !== "false";

  if (serveFrontend) {
    app.use(createStaticWithHtmlNonce(publicDir));
    logger.info(`[Static] Servindo frontend/public: ${publicDir}`);

    app.use("/scripts", express.static(path.join(viewsDir, "scripts")));
    app.use("/static", express.static(path.join(viewsDir, "static")));
    app.use("/shared", express.static(path.join(frontendDir, "shared")));
  } else {
    logger.info("[Static] SERVE_FRONTEND=false — backend em modo API-only");
  }

  return app;
}

module.exports = { createBaseApp };
