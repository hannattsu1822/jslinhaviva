const session = require("express-session");

function createSessionMiddleware(logger) {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || typeof sessionSecret !== "string" || sessionSecret.trim() === "") {
    logger.error("A variável de ambiente SESSION_SECRET não está definida.");
    process.exit(1);
  }

  const isProduction = process.env.NODE_ENV === "production";

  return session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000,
    },
  });
}

module.exports = { createSessionMiddleware };
