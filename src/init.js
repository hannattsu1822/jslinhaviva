const express = require("express");
const path = require("path");
const session = require("express-session");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const http = require("http"); // Adicionado
const { WebSocketServer } = require("ws"); // Adicionado
const winston = require("winston"); // Adicionado (para manter compatibilidade com meu código anterior, ou remova e use seu logger local)

require("dotenv").config();
const { projectRootDir } = require("./shared/path.helper");

const app = express();
const server = http.createServer(app); // Adicionado: Criar servidor HTTP explícito

// Logger original mantido
const logger = {
  debug: (msg) => process.env.NODE_ENV === 'development' && console.log(`[DEBUG] ${msg}`),
  info: (msg) => console.log(`[INFO] ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`)
};

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cors());

app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");

const publicDir = path.join(projectRootDir, "public");
const viewsDir = path.join(projectRootDir, "views");

app.set("views", [publicDir, viewsDir]);
app.use(express.static(publicDir));
logger.info(`Servindo arquivos estáticos da pasta 'public': ${publicDir}`);

app.use(express.static(viewsDir));
logger.info(`Servindo arquivos estáticos da pasta 'views' como fallback: ${viewsDir}`);

// --- NOVA CONFIGURAÇÃO DE SCRIPTS PARA O LOGBOX ---
// Permite acesso direto aos scripts em views/scripts via /scripts/...
app.use("/scripts", express.static(path.join(viewsDir, "scripts")));
app.use("/static", express.static(path.join(viewsDir, "static")));
// --------------------------------------------------

const uploadsSubestacoesDir = path.join(projectRootDir, "upload_arquivos_subestacoes");
if (!fs.existsSync(uploadsSubestacoesDir)) {
  try {
    fs.mkdirSync(uploadsSubestacoesDir, { recursive: true });
    logger.info(`Diretório criado: ${uploadsSubestacoesDir}`);
  } catch (err) {
    logger.error(`Falha ao criar diretório de uploads de subestações em ${uploadsSubestacoesDir}: ${err.message}`);
  }
}
app.use("/upload_arquivos_subestacoes", express.static(uploadsSubestacoesDir));

const uploadsFibraDir = path.join(projectRootDir, "upload_arquivos_fibra");
if (!fs.existsSync(uploadsFibraDir)) {
  try {
    fs.mkdirSync(uploadsFibraDir, { recursive: true });
    logger.info(`Diretório criado: ${uploadsFibraDir}`);
  } catch (err) {
    logger.error(`Falha ao criar diretório de uploads de fibra em ${uploadsFibraDir}: ${err.message}`);
  }
}
app.use("/upload_arquivos_fibra", express.static(uploadsFibraDir));

const trafosReformadosAnexosDir = path.join(projectRootDir, "trafos_reformados_anexos");
if (!fs.existsSync(trafosReformadosAnexosDir)) {
  try {
    fs.mkdirSync(trafosReformadosAnexosDir, { recursive: true });
    logger.info(`Diretório criado: ${trafosReformadosAnexosDir}`);
  } catch (err) {
    logger.error(`Falha ao criar diretório de anexos de trafos reformados em ${trafosReformadosAnexosDir}: ${err.message}`);
  }
}
app.use("/trafos_reformados_anexos", express.static(trafosReformadosAnexosDir));

const uploadsInspRedesDir = path.join(projectRootDir, "upload_InspDistRedes");
if (!fs.existsSync(uploadsInspRedesDir)) {
  try {
    fs.mkdirSync(uploadsInspRedesDir, { recursive: true });
    logger.info(`Diretório criado: ${uploadsInspRedesDir}`);
  } catch (err) {
    logger.error(`Falha ao criar diretório de uploads de Inspeção de Redes em ${uploadsInspRedesDir}: ${err.message}`);
  }
}
app.use("/upload_InspDistRedes", express.static(uploadsInspRedesDir));

const uploadsChecklistDailyDir = path.join(projectRootDir, "upload_checklist_diario_veiculos");
if (!fs.existsSync(uploadsChecklistDailyDir)) {
  try {
    fs.mkdirSync(uploadsChecklistDailyDir, { recursive: true });
    logger.info(`Diretório criado: ${uploadsChecklistDailyDir}`);
  } catch (err) {
    logger.error(`Falha ao criar diretório de uploads de Checklist Diário em ${uploadsChecklistDailyDir}: ${err.message}`);
  }
}
app.use("/upload_checklist_diario_veiculos", express.static(uploadsChecklistDailyDir));

const multerTempDir = path.join(projectRootDir, "upload_temp_multer");
if (!fs.existsSync(multerTempDir)) {
  try {
    fs.mkdirSync(multerTempDir, { recursive: true });
    logger.info(`Diretório temporário do Multer criado: ${multerTempDir}`);
  } catch (err) {
    logger.error(`Falha ao criar diretório temporário do Multer em ${multerTempDir}: ${err.message}`);
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, multerTempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "temp_" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 25,
  },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  },
});

const anexoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const trafoId = req.params.id;
    if (!trafoId) {
      return cb(new Error("ID do transformador não encontrado na requisição."));
    }
    const dir = path.join(trafosReformadosAnexosDir, String(trafoId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, `anexo-${uniqueSuffix}${extension}`);
  },
});

const anexoFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Apenas arquivos de imagem são permitidos!"), false);
  }
};

const uploadAnexoChecklist = multer({
  storage: anexoStorage,
  fileFilter: anexoFileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024,
  },
});

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret || typeof sessionSecret !== "string" || sessionSecret.trim() === "") {
  logger.error("A variável de ambiente SESSION_SECRET não está definida ou não é uma string válida.");
  process.exit(1);
}

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "local",
});

const promisePool = pool.promise();

pool.on('connection', (connection) => {
  logger.debug(`Nova conexão estabelecida com o banco de dados (ID: ${connection.threadId})`);
});

pool.on('error', (err) => {
  logger.error(`Erro no pool de conexões do MySQL: ${err.message}`);
});

// --- CONFIGURAÇÃO DO WEBSOCKET ---
const wss = new WebSocketServer({ server }); // Usa a instância 'server'
app.set("wss", wss); // Permite recuperar wss via app.get("wss")

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
// ---------------------------------

async function salvarAnexos(processoId, files) {
  const anexosSalvos = [];
  const baseUploadDirProcessos = path.join(projectRootDir, "upload_arquivos_processos");

  for (const file of files) {
    const processoUploadDir = path.join(baseUploadDirProcessos, String(processoId));

    if (!fs.existsSync(processoUploadDir)) {
      fs.mkdirSync(processoUploadDir, { recursive: true });
    }

    const fileExtension = path.extname(file.originalname).toLowerCase();
    const novoNome = `${processoId}_${Date.now()}${fileExtension}`;
    const novoPath = path.join(processoUploadDir, novoNome);

    fs.renameSync(file.path, novoPath);

    const caminhoServidor = `/upload_arquivos_processos/${processoId}/${novoNome}`;

    const [result] = await promisePool.query(
      `INSERT INTO anexos_processos (processo_id, nome_original, caminho_servidor, tamanho) VALUES (?, ?, ?, ?)`,
      [processoId, file.originalname, caminhoServidor, file.size]
    );

    anexosSalvos.push({
      id: result.insertId,
      caminho: caminhoServidor,
      nomeOriginal: file.originalname,
    });
  }

  return anexosSalvos;
}

module.exports = {
  app,
  server, // <--- Exportado o servidor HTTP
  wss,    // <--- Exportado o WebSocket
  upload,
  promisePool,
  salvarAnexos,
  projectRootDir,
  uploadsSubestacoesDir,
  uploadAnexoChecklist,
  logger,
};
