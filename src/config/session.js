const session = require("express-session");
const { promisePool } = require("../infrastructure/database");

function createSessionMiddleware(logger) {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || typeof sessionSecret !== "string" || sessionSecret.trim() === "") {
    logger.error("A variável de ambiente SESSION_SECRET não está definida.");
    process.exit(1);
  }

  const isProduction = process.env.NODE_ENV === "production";
  const sessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000,
    },
  };

  if (process.env.SESSION_STORE === "mysql") {
    try {
      const MySQLStore = require("express-mysql-session")(session);
      sessionOptions.store = new MySQLStore(
        {
          clearExpired: true,
          checkExpirationInterval: 900000,
          expiration: 8 * 60 * 60 * 1000,
          createDatabaseTable: true,
          schema: {
            tableName: "sessions",
            columnNames: {
              session_id: "session_id",
              expires: "expires",
              data: "data",
            },
          },
        },
        promisePool
      );
      logger.info("[Session] Store MySQL ativo.");
    } catch (err) {
      logger.error(`[Session] Falha ao iniciar store MySQL: ${err.message}`);
      if (isProduction) process.exit(1);
    }
  } else if (isProduction) {
    logger.warn(
      "[Session] MemoryStore em produção — defina SESSION_STORE=mysql para persistência."
    );
  }

  return session(sessionOptions);
}

module.exports = { createSessionMiddleware };
