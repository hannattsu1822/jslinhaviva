const path = require("path");
const fs = require("fs");
const { promisePool } = require("../../../infrastructure/database");
const { projectRootDir } = require("../../../shared/path.helper");
const { resolvePathWithinBase } = require("../../../shared/pathSecurity.helper");
const { verifyReportToken } = require("../../../shared/reportToken.helper");
const { TOKEN_SCOPE } = require("../../../shared/reports/publicAnexoUrl.helper");

function parseCaminhoUpload(caminhoServidor) {
  if (!caminhoServidor) return null;

  const normalized = String(caminhoServidor).replace(/\\/g, "/");
  const prefixApi = "/api/upload_arquivos/";
  const prefixLegacy = "/upload_arquivos_processos/";

  if (normalized.startsWith(prefixApi)) {
    const rel = normalized.slice(prefixApi.length);
    const slash = rel.indexOf("/");
    if (slash <= 0) return null;
    return {
      identificador: rel.slice(0, slash),
      filename: rel.slice(slash + 1),
    };
  }

  if (normalized.startsWith(prefixLegacy)) {
    const rel = normalized.slice(prefixLegacy.length);
    const slash = rel.indexOf("/");
    if (slash <= 0) return null;
    return {
      identificador: rel.slice(0, slash),
      filename: rel.slice(slash + 1),
      legacyProcessos: true,
    };
  }

  return null;
}

function resolverCaminhoFisicoAnexo(caminhoServidor) {
  const parsed = parseCaminhoUpload(caminhoServidor);
  if (!parsed) return null;

  const baseDir = parsed.legacyProcessos
    ? path.join(projectRootDir, "upload_arquivos_processos")
    : path.join(projectRootDir, "upload_arquivos");

  return resolvePathWithinBase(
    baseDir,
    parsed.identificador,
    parsed.filename
  );
}

function mimeFromFilename(filename) {
  const ext = path.extname(filename || "").toLowerCase();
  const map = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
  };
  return map[ext] || "application/octet-stream";
}

async function obterAnexoPorId(anexoId) {
  const id = parseInt(anexoId, 10);
  if (!Number.isFinite(id) || id <= 0) return null;

  const [rows] = await promisePool.query(
    `SELECT id, processo_id, nome_original, caminho_servidor, tipo_anexo
     FROM processos_anexos WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

function tokenValidoParaAnexo(token, anexoId) {
  return verifyReportToken(token, TOKEN_SCOPE, anexoId);
}

async function resolverArquivoPublico(anexoId, token) {
  if (!tokenValidoParaAnexo(token, anexoId)) {
    const err = new Error("Link inválido ou expirado.");
    err.statusCode = 403;
    throw err;
  }

  const anexo = await obterAnexoPorId(anexoId);
  if (!anexo) {
    const err = new Error("Anexo não encontrado.");
    err.statusCode = 404;
    throw err;
  }

  const filePath = resolverCaminhoFisicoAnexo(anexo.caminho_servidor);
  if (!filePath || !fs.existsSync(filePath)) {
    const err = new Error("Arquivo não encontrado no servidor.");
    err.statusCode = 404;
    throw err;
  }

  return {
    anexo,
    filePath,
    mime: mimeFromFilename(anexo.nome_original || filePath),
  };
}

module.exports = {
  TOKEN_SCOPE,
  obterAnexoPorId,
  resolverArquivoPublico,
  resolverCaminhoFisicoAnexo,
  mimeFromFilename,
};
