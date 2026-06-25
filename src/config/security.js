const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://linhaviva.sulgipe.com.br",
  "https://sulgipelinhaviva.online",
].filter(Boolean);

function isLocalOrigin(origin) {
  if (!origin) return true;
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function applySecurityMiddleware(app) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://cdn.jsdelivr.net",
            "https://cdnjs.cloudflare.com",
            "https://unpkg.com",
            "https://code.jquery.com",
            "https://cdn.datatables.net",
          ],
          scriptSrcAttr: ["'unsafe-inline'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://cdn.jsdelivr.net",
            "https://cdnjs.cloudflare.com",
            "https://fonts.googleapis.com",
            "https://unpkg.com",
            "https://cdn.datatables.net",
          ],
          fontSrc: [
            "'self'",
            "https://fonts.gstatic.com",
            "https://cdnjs.cloudflare.com",
            "data:",
          ],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          connectSrc: [
            "'self'",
            "ws:",
            "wss:",
            "https://cdn.jsdelivr.net",
            "https://cdnjs.cloudflare.com",
            "https://unpkg.com",
            "https://code.jquery.com",
            "https://cdn.datatables.net",
            "https://fonts.googleapis.com",
            "https://fonts.gstatic.com",
            "https://*.tile.openstreetmap.org",
            "https://*.tile.opentopomap.org",
          ],
          frameSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (
          process.env.NODE_ENV !== "production" ||
          isLocalOrigin(origin) ||
          !origin ||
          allowedOrigins.indexOf(origin) !== -1
        ) {
          callback(null, true);
        } else {
          callback(new Error("Acesso não permitido pela política de CORS"));
        }
      },
      credentials: true,
    })
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: "Muitas requisições. Tente novamente em alguns minutos.",
      },
    })
  );
}

module.exports = { applySecurityMiddleware };
