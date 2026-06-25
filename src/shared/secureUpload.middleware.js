const fs = require("fs");
const path = require("path");
const { resolvePathWithinBase } = require("./pathSecurity.helper");

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
  ALLOWED_UPLOAD_EXTENSIONS,
};
