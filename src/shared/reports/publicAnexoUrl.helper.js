const {
  createReportToken,
  ANEXO_PUBLICO_TTL_SEC,
} = require("../reportToken.helper");

const TOKEN_SCOPE = "servico_anexo";

function buildBaseUrl(req) {
  const envUrl = process.env.APP_PUBLIC_URL || process.env.APP_URL;
  if (envUrl) return String(envUrl).replace(/\/$/, "");
  const host = req?.get?.("host");
  if (!host) return "";
  return `${req.protocol}://${host}`;
}

function buildPublicAnexoViewUrl(baseUrl, anexoId, token) {
  if (!baseUrl || !anexoId || !token) return "";
  return `${baseUrl}/public/anexo-servico/${anexoId}?token=${encodeURIComponent(token)}`;
}

function createPublicAnexoToken(anexoId) {
  return createReportToken(TOKEN_SCOPE, anexoId, ANEXO_PUBLICO_TTL_SEC);
}

module.exports = {
  TOKEN_SCOPE,
  buildBaseUrl,
  buildPublicAnexoViewUrl,
  createPublicAnexoToken,
};
