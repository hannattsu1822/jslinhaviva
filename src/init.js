const express = require("express");
const path = require("path");
const session = require("express-session");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
require("dotenv").config();

const app = express();

// Configurações básicas
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "../public")));

// Configuração do multer para múltiplos arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../upload_arquivos");

    // Cria o diretório se não existir
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Nome temporário - será renomeado após inserção no banco
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "temp_" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB por arquivo
    files: 5, // Máximo de 5 arquivos
  },
  fileFilter: (req, file, cb) => {
    // Tipos MIME permitidos
    const allowedMimeTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "application/vnd.ms-excel", // XLS
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // XLSX
      "text/csv",
      "application/csv",
      "text/x-csv",
      "application/octet-stream", // Para alguns tipos de CSV
    ];

    // Extensões permitidas
    const allowedExtensions = [
      ".pdf",
      ".jpg",
      ".jpeg",
      ".png",
      ".xls",
      ".xlsx",
      ".csv",
    ];

    // Verifica a extensão do arquivo
    const ext = path.extname(file.originalname).toLowerCase();
    const isValidExt = allowedExtensions.includes(ext);

    // Verifica o tipo MIME
    const isValidMime = allowedMimeTypes.includes(file.mimetype);

    if (isValidExt && isValidMime) {
      return cb(null, true);
    } else {
      cb(
        new Error(
          "Apenas arquivos PDF, JPG, JPEG, PNG, XLS, XLSX e CSV são permitidos!"
        )
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
  console.error("Por favor, defina SESSION_SECRET no seu arquivo .env");
  process.exit(1);
}

// Configuração de sessão
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

// Configuração do pool MySQL
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

// Função para salvar anexos no banco de dados
async function salvarAnexos(processoId, files) {
  const anexosSalvos = [];

  for (const file of files) {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const novoNome = `${processoId}_${Date.now()}${fileExtension}`;
    const novoPath = path.join(__dirname, "../upload_arquivos", novoNome);

    // Renomeia o arquivo temporário
    fs.renameSync(file.path, novoPath);

    const caminhoServidor = `/api/upload_arquivos/${novoNome}`;

    // Insere no banco de dados
    const [result] = await promisePool.query(
      `INSERT INTO anexos_processos (
                processo_id, nome_original, caminho_servidor, tamanho
            ) VALUES (?, ?, ?, ?)`,
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

// Exportar configurações
module.exports = {
  app,
  upload,
  promisePool,
  salvarAnexos,
};
