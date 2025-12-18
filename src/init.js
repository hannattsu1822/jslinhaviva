const express = require("express");
const path = require("path");
const session = require("express-session");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const http = require("http");
const { WebSocketServer } = require("ws");
require("dotenv").config();

const { projectRootDir } = require("./shared/path.helper");

const app = express();
const server = http.createServer(app);

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

app.set("views", [viewsDir, publicDir]);

app.use(express.static(publicDir));
logger.info(`[Static] Servindo 'public': ${publicDir}`);

app.use("/scripts", express.static(path.join(viewsDir, "scripts")));
app.use("/static", express.static(path.join(viewsDir, "static")));

const ensureDirectoryExists = (dirPath, dirName) => {
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.info(`Diretório criado: ${dirName} -> ${dirPath}`);
    } catch (err) {
      logger.error(`Erro ao criar diretório ${dirName}: ${err.message}`);
    }
  }
};

const uploadsSubestacoesDir = path.join(projectRootDir, "upload_arquivos_subestacoes");
const uploadsFibraDir = path.join(projectRootDir, "upload_arquivos_fibra");
const trafosReformadosAnexosDir = path.join(projectRootDir, "trafos_reformados_anexos");
const uploadsInspRedesDir = path.join(projectRootDir, "upload_InspDistRedes");
const uploadsChecklistDailyDir = path.join(projectRootDir, "upload_checklist_diario_veiculos");
const uploadsProcessosDir = path.join(projectRootDir, "upload_arquivos_processos");
const multerTempDir = path.join(projectRootDir, "upload_temp_multer");

ensureDirectoryExists(uploadsSubestacoesDir, "Uploads Subestações");
ensureDirectoryExists(uploadsFibraDir, "Uploads Fibra");
ensureDirectoryExists(trafosReformadosAnexosDir, "Anexos Trafos");
ensureDirectoryExists(uploadsInspRedesDir, "Inspeção Redes");
ensureDirectoryExists(uploadsChecklistDailyDir, "Checklist Diário");
ensureDirectoryExists(uploadsProcessosDir, "Uploads Processos");
ensureDirectoryExists(multerTempDir, "Temp Multer");

app.use("/upload_arquivos_subestacoes", express.static(uploadsSubestacoesDir));
app.use("/upload_arquivos_fibra", express.static(uploadsFibraDir));
app.use("/trafos_reformados_anexos", express.static(trafosReformadosAnexosDir));
app.use("/upload_InspDistRedes", express.static(uploadsInspRedesDir));
app.use("/upload_checklist_diario_veiculos", express.static(uploadsChecklistDailyDir));
app.use("/upload_arquivos_processos", express.static(uploadsProcessosDir));

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
  limits: { fileSize: 50 * 1024 * 1024, files: 25 },
  fileFilter: (req, file, cb) => cb(null, true),
});

const anexoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const trafoId = req.params.id;
    if (!trafoId) {
      return cb(new Error("ID do transformador não encontrado na requisição."));
    }
    const dir = path.join(trafosReformadosAnexosDir, String(trafoId));
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
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
  limits: { fileSize: 3 * 1024 * 1024 },
});

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || typeof sessionSecret !== "string" || sessionSecret.trim() === "") {
  logger.error("A variável de ambiente SESSION_SECRET não está definida.");
  process.exit(1);
}

const sessionMiddleware = session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false },
});

app.use(sessionMiddleware);

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
  logger.debug(`DB: Nova conexão (ID: ${connection.threadId})`);
});

pool.on('error', (err) => {
  logger.error(`DB: Erro no pool MySQL: ${err.message}`);
});

const wss = new WebSocketServer({ noServer: true });
app.set("wss", wss);

server.on('upgrade', (request, socket, head) => {
  sessionMiddleware(request, {}, () => {
    if (!request.session || !request.session.user) {
      logger.warn(`[WebSocket] Tentativa de conexão sem sessão válida: ${request.socket.remoteAddress}`);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
});

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress;
  const user = req.session ? req.session.user.matricula : "Desconhecido";
  
  logger.info(`[WebSocket] Conexão estabelecida. IP: ${ip}, Usuário: ${user}`);

  ws.on("message", (message) => {
    try {
      const msg = JSON.parse(message);
      if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
    } catch (e) {
      logger.error(`[WebSocket] Erro msg: ${e.message}`);
    }
  });

  ws.on("error", (error) => logger.error(`[WebSocket] Erro: ${error.message}`));
});

async function salvarAnexos(processoId, files) {
  const anexosSalvos = [];
  const processoUploadDir = path.join(uploadsProcessosDir, String(processoId));

  if (!fs.existsSync(processoUploadDir)) {
    fs.mkdirSync(processoUploadDir, { recursive: true });
  }

  for (const file of files) {
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
  server,
  wss,
  upload,
  promisePool,
  salvarAnexos,
  projectRootDir,
  uploadsSubestacoesDir,
  uploadAnexoChecklist,
  logger,
};
