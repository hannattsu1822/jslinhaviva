const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { projectRootDir } = require("../shared/path.helper");
const { createUploadFileFilter, validateMulterUploads } = require("../shared/secureUpload.middleware");
const logger = require("../config/logger");

function ensureDirectoryExists(dirPath, dirName) {
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.info(`Diretório criado: ${dirName} -> ${dirPath}`);
    } catch (err) {
      logger.error(`Erro ao criar diretório ${dirName}: ${err.message}`);
    }
  }
}

const uploadsSubestacoesDir     = path.join(projectRootDir, "upload_arquivos_subestacoes");
const uploadsFibraDir           = path.join(projectRootDir, "upload_arquivos_fibra");
const trafosReformadosAnexosDir = path.join(projectRootDir, "trafos_reformados_anexos");
const uploadsInspRedesDir       = path.join(projectRootDir, "upload_InspDistRedes");
const uploadsChecklistDailyDir  = path.join(projectRootDir, "upload_checklist_diario_veiculos");
const uploadsProcessosDir       = path.join(projectRootDir, "upload_arquivos_processos");
const multerTempDir             = path.join(projectRootDir, "upload_temp_multer");

ensureDirectoryExists(uploadsSubestacoesDir,     "Uploads Subestações");
ensureDirectoryExists(uploadsFibraDir,           "Uploads Fibra");
ensureDirectoryExists(trafosReformadosAnexosDir, "Anexos Trafos");
ensureDirectoryExists(uploadsInspRedesDir,       "Inspeção Redes");
ensureDirectoryExists(uploadsChecklistDailyDir,  "Checklist Diário");
ensureDirectoryExists(uploadsProcessosDir,       "Uploads Processos");
ensureDirectoryExists(multerTempDir,             "Temp Multer");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, multerTempDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "temp_" + uniqueSuffix + path.extname(file.originalname));
  },
});

const multerInstance = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 25 },
  fileFilter: createUploadFileFilter(),
});

function chainUploadMiddleware(...middlewares) {
  return (req, res, next) => {
    let index = 0;
    const run = (err) => {
      if (err) return next(err);
      const middleware = middlewares[index];
      index += 1;
      if (!middleware) return next();
      middleware(req, res, run);
    };
    run();
  };
}

const upload = {
  single: (fieldName) =>
    chainUploadMiddleware(multerInstance.single(fieldName), validateMulterUploads),
  array: (fieldName, maxCount) =>
    chainUploadMiddleware(
      multerInstance.array(fieldName, maxCount),
      validateMulterUploads
    ),
  fields: (fields) =>
    chainUploadMiddleware(multerInstance.fields(fields), validateMulterUploads),
  any: () =>
    chainUploadMiddleware(multerInstance.any(), validateMulterUploads),
  none: () => chainUploadMiddleware(multerInstance.none()),
};

const anexoStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const trafoId = req.params.id;
    if (!trafoId) return cb(new Error("ID do transformador não encontrado na requisição."));
    const dir = path.join(trafosReformadosAnexosDir, String(trafoId));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `anexo-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const anexoFileFilter = (_req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Apenas arquivos de imagem são permitidos!"), false);
  }
};

const uploadAnexoChecklistMulter = multer({
  storage: anexoStorage,
  fileFilter: anexoFileFilter,
  limits: { fileSize: 3 * 1024 * 1024 },
});

const uploadAnexoChecklist = {
  single: (fieldName) =>
    chainUploadMiddleware(
      uploadAnexoChecklistMulter.single(fieldName),
      validateMulterUploads
    ),
  array: (fieldName, maxCount) =>
    chainUploadMiddleware(
      uploadAnexoChecklistMulter.array(fieldName, maxCount),
      validateMulterUploads
    ),
};

module.exports = {
  upload,
  uploadAnexoChecklist,
  uploadsSubestacoesDir,
  uploadsFibraDir,
  trafosReformadosAnexosDir,
  uploadsInspRedesDir,
  uploadsChecklistDailyDir,
  uploadsProcessosDir,
};
