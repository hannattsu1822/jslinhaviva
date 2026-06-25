const express = require("express");
const path = require("path");
const { applySecurityMiddleware } = require("./config/security");
const { frontendDir, publicDir, viewsDir } = require("./shared/path.helper");

function createBaseApp(logger) {
  const app = express();
  app.set("trust proxy", 1);

  applySecurityMiddleware(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.engine("html", require("ejs").renderFile);
  app.set("view engine", "html");
  app.set("views", [viewsDir, publicDir]);

  const serveFrontend = process.env.SERVE_FRONTEND !== "false";

  if (serveFrontend) {
    app.use(express.static(publicDir));
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
