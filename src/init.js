const express = require("express");
const path = require("path");
const session = require("express-session");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(cors());

const projectRootDir = path.resolve(__dirname, "..");

app.set("view engine", "ejs");
app.set("views", path.join(projectRootDir, "views"));

app.use("/static", express.static(path.join(projectRootDir, "views/static")));
app.use("/scripts", express.static(path.join(projectRootDir, "views/scripts")));

const publicDir = path.join(projectRootDir, "public");
app.use(express.static(publicDir));
console.log(`Servindo arquivos estáticos da pasta 'public' em: ${publicDir}`);

const uploadsSubestacoesDir = path.join(
  projectRootDir,
  "upload_arquivos_subestacoes"
);

if (!fs.existsSync(uploadsSubestacoesDir)) {
  try {
    fs.mkdirSync(uploadsSubestacoesDir, { recursive: true });
    console.log(
      `Diretório de uploads de subestações criado em: ${uploadsSubestacoesDir}`
    );
  } catch (err) {
    console.error(
      `Falha ao criar diretório de uploads de subestações em ${uploadsSubestacoesDir}:`,
      err
    );
  }
} else {
  console.log(
    `Diretório de uploads de subestações já existe em: ${uploadsSubestacoesDir}`
  );
}
app.use("/upload_arquivos_subestacoes", express.static(uploadsSubestacoesDir));
console.log(
  `Servindo arquivos de '/upload_arquivos_subestacoes' a partir de: ${uploadsSubestacoesDir}`
);

const multerTempDir = path.join(projectRootDir, "upload_temp_multer");
if (!fs.existsSync(multerTempDir)) {
  try {
    fs.mkdirSync(multerTempDir, { recursive: true });
    console.log(`Diretório temporário do Multer criado em: ${multerTempDir}`);
  } catch (err) {
    console.error(
      `Falha ao criar diretório temporário do Multer em ${multerTempDir}:`,
      err
    );
  }
} else {
  console.log(`Diretório temporário do Multer já existe em: ${multerTempDir}`);
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
    fileSize: 15 * 1024 * 1024,
    files: 25,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/heic",
      "image/heif",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "application/csv",
      "text/x-csv",
      "text/plain",
      "application/octet-stream",
    ];
    const allowedExtensions = [
      ".pdf",
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".heic",
      ".heif",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".csv",
      ".txt",
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    const isValidExt = allowedExtensions.includes(ext);
    const isValidMime = allowedMimeTypes.includes(file.mimetype);

    if (isValidExt || isValidMime) {
      return cb(null, true);
    } else {
      console.warn(
        `Arquivo rejeitado: ${file.originalname}, mimetype: ${file.mimetype}, ext: ${ext}`
      );
      cb(
        new Error("Tipo de arquivo não permitido. Verifique os tipos aceitos.")
      );
    }
  },
});

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
};
