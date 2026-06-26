const fs = require("fs");
const path = require("path");
const { resolvePathWithinBase } = require("./pathSecurity.helper");

const MAGIC_SIGNATURES = {
  ".jpg": [[0xff, 0xd8, 0xff]],
  ".jpeg": [[0xff, 0xd8, 0xff]],
  ".png": [[0x89, 0x50, 0x4e, 0x47]],
  ".gif": [[0x47, 0x49, 0x46, 0x38]],
  ".webp": [[0x52, 0x49, 0x46, 0x46]],
  ".pdf": [[0x25, 0x50, 0x44, 0x46]],
  ".xls": [[0xd0, 0xcf, 0x11, 0xe0]],
  ".xlsx": [[0x50, 0x4b, 0x03, 0x04]],
  ".docx": [[0x50, 0x4b, 0x03, 0x04]],
  ".doc": [[0xd0, 0xcf, 0x11, 0xe0]],
};

function matchesSignature(buffer, signature) {
  return signature.every((byte, index) => buffer[index] === byte);
}

function isValidFileContent(filePath, ext) {
  const normalizedExt = (ext || "").toLowerCase();
  if ([".csv", ".txt"].includes(normalizedExt)) {
    const sample = fs.readFileSync(filePath);
    const slice = sample.subarray(0, Math.min(sample.length, 4096));
    for (let i = 0; i < slice.length; i += 1) {
      const code = slice[i];
      if (code === 9 || code === 10 || code === 13) continue;
      if (code >= 32 && code <= 126) continue;
      if (code >= 128) continue;
      return false;
    }
    return true;
  }

  const signatures = MAGIC_SIGNATURES[normalizedExt];
  if (!signatures) return false;

  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(16);
    const bytesRead = fs.readSync(fd, buffer, 0, 16, 0);
    const sample = buffer.subarray(0, bytesRead);
    if (normalizedExt === ".webp") {
      return (
        matchesSignature(sample, MAGIC_SIGNATURES[".webp"][0]) &&
        sample.subarray(8, 12).toString("ascii") === "WEBP"
      );
    }
    return signatures.some((signature) => matchesSignature(sample, signature));
  } finally {
    fs.closeSync(fd);
  }
}

function cleanupUploadedFiles(files) {
  for (const file of files) {
    if (file?.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        /* ignora falha de limpeza */
      }
    }
  }
}

function validateMulterUploads(req, res, next) {
  const files = []
    .concat(req.files || [])
    .concat(req.file ? [req.file] : []);

  if (files.length === 0) return next();

  try {
    for (const file of files) {
      const ext = path.extname(file.originalname || "").toLowerCase();
      if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
        throw new Error(`Tipo de arquivo não permitido: ${ext || "(sem extensão)"}`);
      }
      if (!isValidFileContent(file.path, ext)) {
        throw new Error(
          `Conteúdo do arquivo não corresponde à extensão permitida (${ext}).`
        );
      }
    }
    return next();
  } catch (error) {
    cleanupUploadedFiles(files);
    return res.status(400).json({
      success: false,
      message: error.message || "Arquivo inválido.",
    });
  }
}

function createSecureUploadHandler(baseDir) {
  return (req, res) => {
    const relativePath = decodeURIComponent(req.path || "").replace(/^\/+/, "");
    if (!relativePath) {
      return res.status(404).json({ message: "Arquivo não encontrado." });
    }

    const segments = relativePath.split("/").filter(Boolean);
    const safePath = resolvePathWithinBase(baseDir, ...segments);

    if (!safePath || !fs.existsSync(safePath)) {
      return res.status(404).json({ message: "Arquivo não encontrado." });
    }

    if (!fs.statSync(safePath).isFile()) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    return res.sendFile(safePath);
  };
}

function mountSecureUploads(app, mounts, { autenticar, verificarNivel }) {
  mounts.forEach(({ urlPath, dir, minNivel = 1 }) => {
    app.use(
      urlPath,
      autenticar,
      verificarNivel(minNivel),
      createSecureUploadHandler(dir)
    );
  });
}

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".pdf",
  ".xls",
  ".xlsx",
  ".csv",
  ".doc",
  ".docx",
  ".txt",
]);

function createUploadFileFilter() {
  return (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
      return cb(new Error(`Tipo de arquivo não permitido: ${ext || "(sem extensão)"}`));
    }
    cb(null, true);
  };
}

module.exports = {
  createSecureUploadHandler,
  mountSecureUploads,
  createUploadFileFilter,
  validateMulterUploads,
  isValidFileContent,
  ALLOWED_UPLOAD_EXTENSIONS,
};
