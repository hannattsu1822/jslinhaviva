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

// Importa o helper de caminho. 
// Certifique-se que este arquivo exporta corretamente o caminho raiz do projeto.
const { projectRootDir } = require("./shared/path.helper");

const app = express();
const server = http.createServer(app);

// --- LOGGER PADRÃO ---
const logger = {
  debug: (msg) => process.env.NODE_ENV === 'development' && console.log(`[DEBUG] ${msg}`),
  info: (msg) => console.log(`[INFO] ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`)
};

// --- MIDDLEWARES GERAIS ---
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cors());

// --- CONFIGURAÇÃO DA VIEW ENGINE ---
app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");

// Definição dos caminhos absolutos
const publicDir = path.join(projectRootDir, "public");
const viewsDir = path.join(projectRootDir, "views");

// Configura onde o Express busca os templates (arquivos .html/.ejs)
app.set("views", [viewsDir, publicDir]);

// --- ARQUIVOS ESTÁTICOS (CORRIGIDO) ---
// 1. Arquivos na pasta public (css, img, js globais)
app.use(express.static(publicDir));
logger.info(`[Static] Servindo 'public': ${publicDir}`);

// 2. Scripts e Assets específicos dentro da pasta views (Logbox/Scripts)
// Acessível via: /scripts/meu-script.js
app.use("/scripts", express.static(path.join(viewsDir, "scripts")));
// Acessível via: /static/minha-imagem.png
app.use("/static", express.static(path.join(viewsDir, "static")));

// --- GERENCIAMENTO DE DIRETÓRIOS DE UPLOAD ---
// Função auxiliar para criar diretórios se não existirem (evita repetição de código)
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

// Definição dos caminhos de upload
const uploadsSubestacoesDir = path.join(projectRootDir, "upload_arquivos_subestacoes");
const uploadsFibraDir = path.join(projectRootDir, "upload_arquivos_fibra");
const trafosReformadosAnexosDir = path.join(projectRootDir, "trafos_reformados_anexos");
const uploadsInspRedesDir = path.join(projectRootDir, "upload_InspDistRedes");
const uploadsChecklistDailyDir = path.join(projectRootDir, "upload_checklist_diario_veiculos");
const uploadsProcessosDir = path.join(projectRootDir, "upload_arquivos_processos"); // Adicionado pois era usado no salvarAnexos
const multerTempDir = path.join(projectRootDir, "upload_temp_multer");

// Inicializa os diretórios
ensureDirectoryExists(uploadsSubestacoesDir, "Uploads Subestações");
ensureDirectoryExists(uploadsFibraDir, "Uploads Fibra");
ensureDirectoryExists(trafosReformadosAnexosDir, "Anexos Trafos");
ensureDirectoryExists(uploadsInspRedesDir, "Inspeção Redes");
ensureDirectoryExists(uploadsChecklistDailyDir, "Checklist Diário");
ensureDirectoryExists(uploadsProcessosDir, "Uploads Processos");
ensureDirectoryExists(multerTempDir, "Temp Multer");

// Rotas estáticas para acessar os arquivos upados
app.use("/upload_arquivos_subestacoes", express.static(uploadsSubestacoesDir));
app.use("/upload_arquivos_fibra", express.static(uploadsFibraDir));
app.use("/trafos_reformados_anexos", express.static(trafosReformadosAnexosDir));
app.use("/upload_InspDistRedes", express.static(uploadsInspRedesDir));
app.use("/upload_checklist_diario_veiculos", express.static(uploadsChecklistDailyDir));
app.use("/upload_arquivos_processos", express.static(uploadsProcessosDir));

// --- CONFIGURAÇÃO DO MULTER (UPLOAD GERAL) ---
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

// --- CONFIGURAÇÃO DO MULTER (ANEXOS TRAFOS) ---
const anexoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // ATENÇÃO: req.params.id só funciona se a rota for definida como /rota/:id
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

// --- SESSÃO ---
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || typeof sessionSecret !== "string" || sessionSecret.trim() === "") {
  logger.error("A variável de ambiente SESSION_SECRET não está definida.");
  process.exit(1);
}

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Mude para true se estiver usando HTTPS
  })
);

// --- BANCO DE DADOS ---
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

// --- WEBSOCKET ---
const wss = new WebSocketServer({ server });
app.set("wss", wss);

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress;
  logger.info(`[WebSocket] Conexão de: ${ip}`);

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

// --- FUNÇÕES AUXILIARES ---
async function salvarAnexos(processoId, files) {
  const anexosSalvos = [];
  // Usa a variável definida lá em cima para garantir consistência
  const processoUploadDir = path.join(uploadsProcessosDir, String(processoId));

  if (!fs.existsSync(processoUploadDir)) {
    fs.mkdirSync(processoUploadDir, { recursive: true });
  }

  for (const file of files) {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const novoNome = `${processoId}_${Date.now()}${fileExtension}`;
    const novoPath = path.join(processoUploadDir, novoNome);

    // Move do temp para a pasta final
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

// --- EXPORTS ---
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
