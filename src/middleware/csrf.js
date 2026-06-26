const crypto = require("crypto");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const EXEMPT_PATHS = new Set(["/login"]);

function ensureCsrfToken(req) {
  if (!req.session) return null;
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  return req.session.csrfToken;
}

function tokensMatch(sessionToken, requestToken) {
  if (!sessionToken || !requestToken) return false;
  const a = Buffer.from(String(sessionToken));
  const b = Buffer.from(String(requestToken));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const path = req.path || "";
  if (EXEMPT_PATHS.has(path)) return next();

  const sessionToken = req.session?.csrfToken;
  const requestToken =
    req.headers["x-csrf-token"] ||
    req.headers["x-xsrf-token"] ||
    req.body?._csrf;

  if (!tokensMatch(sessionToken, requestToken)) {
    return res.status(403).json({
      success: false,
      message: "Token CSRF inválido ou ausente.",
    });
  }

  return next();
}

module.exports = { ensureCsrfToken, csrfProtection };
