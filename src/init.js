const express = require("express");
const path = require("path");
const session = require("express-session");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
require("dotenv").config();
const { projectRootDir } = require("./shared/path.helper"); 

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cors());

app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");

app.set("views", path.join(projectRootDir, "views"));

const publicDir = path.join(projectRootDir, "public");
const viewsDir = path.join(projectRootDir, "views");

app.use(express.static(publicDir));
console.log(
  `[Prioridade 1] Servindo arquivos estáticos da pasta 'public': ${publicDir}`
);

app.use(express.static(viewsDir));
console.log(
  `[Prioridade 2] Servindo arquivos estáticos da pasta 'views' como fallback: ${viewsDir}`
);

const uploadsSubestacoesDir = path.join(
  projectRootDir,
  "upload_arquivos_subestacoes"
);

if (!fs.existsSync(uploadsSubestacoesDir)) {
  try {
    fs.mkdirSync(uploadsSubestacoesDir, { recursive: true });
  } catch (err) {
    console.error(
      `Falha ao criar diretório de uploads de subestações em ${uploadsSubestacoesDir}:`,
      err
    );
  }
}
app.use("/upload_arquivos_subestacoes", express.static(uploadsSubestacoesDir));

const uploadsFibraDir = path.join(projectRootDir, "upload_arquivos_fibra");

if (!fs.existsSync(uploadsFibraDir)) {
  try {
    fs.mkdirSync(uploadsFibraDir, { recursive: true });
  } catch (err) {
    console.error(
      `Falha ao criar diretório de uploads de fibra em ${uploadsFibraDir}:`,
      err
    );
  }
}
app.use("/upload_arquivos_fibra", express.static(uploadsFibraDir));

// NOVA PASTA DE ANEXOS DOS TRAFOS REFORMADOS
const trafosReformadosAnexosDir = path.join(
  projectRootDir,
  "trafos_reformados_anexos"
);
if (!fs.existsSync(trafosReformadosAnexosDir)) {
  try {
    fs.mkdirSync(trafosReformadosAnexosDir, { recursive: true });
  } catch (err) {
    console.error(
      `Falha ao criar diretório de anexos de trafos reformados em ${trafosReformadosAnexosDir}:`,
      err
    );
  }
}
app.use("/trafos_reformados_anexos", express.static(trafosReformadosAnexosDir));
// FIM DA NOVA PASTA

const multerTempDir = path.join(projectRootDir, "upload_temp_multer");
if (!fs.existsSync(multerTempDir)) {
  try {
    fs.mkdirSync(multerTempDir, { recursive: true });
  } catch (err) {
    console.error(
      `Falha ao criar diretório temporário do Multer em ${multerTempDir}:`,
      err
    );
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
    fileSize: 3 * 1024 * 1024, // 3 MB
  },
});
// FIM DA NOVA CONFIGURAÇÃO

const sessionSecret = process.env.SESSION_SECRET;
if (
  !sessionSecret ||
  typeof sessionSecret !== "string" ||
  sessionSecret.trim() === ""
) {
  console.error(
    "Erro: A variável de ambiente SESSION_SECRET não está definida ou não é uma string válida."
  );
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

async function salvarAnexos(processoId, files) {
  const anexosSalvos = [];
  const baseUploadDirProcessos = path.join(
    projectRootDir,
    "upload_arquivos_processos"
  );

  for (const file of files) {
    const processoUploadDir = path.join(
      baseUploadDirProcessos,
      String(processoId)
    );
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
  upload,
  promisePool,
  salvarAnexos,
  projectRootDir,
  uploadsSubestacoesDir,
  uploadAnexoChecklist, 
};
