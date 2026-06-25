const mysql = require("mysql2");
const logger = require("../config/logger");

function buildPool() {
  const pool = mysql.createPool({
    host:               process.env.DB_HOST,
    port:               process.env.DB_PORT,
    user:               process.env.DB_USER,
    password:           process.env.DB_PASSWORD,
    database:           process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    timezone:           "local",
  });

  const promisePool = pool.promise();

  pool.on("connection", (connection) =>
    logger.debug(`DB: Nova conexão (ID: ${connection.threadId})`)
  );
  pool.on("error", (err) =>
    logger.error(`DB: Erro no pool MySQL: ${err.message}`)
  );

  return { pool, promisePool };
}

const { pool, promisePool } = buildPool();

module.exports = { pool, promisePool };
