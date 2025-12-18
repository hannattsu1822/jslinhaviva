const express = require("express");
const session = require("express-session");
const http = require("http");
const { WebSocketServer } = require("ws");
const mysql = require("mysql2");
const path = require("path");
const winston = require("winston");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "app.log" }),
  ],
});

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);
const promisePool = pool.promise();

pool.getConnection((err, connection) => {
  if (err) {
    logger.error("Erro ao conectar ao banco de dados: " + err.message);
  } else {
    logger.info("Conectado ao banco de dados MySQL com sucesso!");
    connection.release();
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "segredo_padrao_desenvolvimento",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, 
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, 
    },
  })
);

app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));

app.use("/scripts", express.static(path.join(__dirname, "views", "scripts")));
app.use("/static", express.static(path.join(__dirname, "views", "static")));

const wss = new WebSocketServer({ server });
app.set("wss", wss);

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress;
  logger.info(`[WebSocket] Nova conexão estabelecida de: ${ip}`);

  ws.on("message", (message) => {
    try {
      const msg = JSON.parse(message);
      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    } catch (e) {
      logger.error(`[WebSocket] Erro ao processar mensagem: ${e.message}`);
    }
  });

  ws.on("error", (error) => {
    logger.error(`[WebSocket] Erro na conexão: ${error.message}`);
  });
});

module.exports = {
  app,
  server,
  promisePool,
  logger,
  wss,
};
