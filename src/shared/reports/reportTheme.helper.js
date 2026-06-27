const fs = require("fs/promises");
const path = require("path");
const { publicDir } = require("../path.helper");

let cachedStyles = null;
let cachedLogoDataUri = null;

const LOGO_PATH = path.join(publicDir, "static/images/brand/sulgipe-logo.png");

/**
 * Retorna o CSS do tema de relatórios inlined para uso em PDF (Playwright setContent).
 */
async function loadReportStyles() {
  if (cachedStyles) return cachedStyles;

  const themePath = path.join(publicDir, "static/css/base/report-theme.css");
  cachedStyles = await fs.readFile(themePath, "utf-8");
  return cachedStyles;
}

/** Logo SULGIPE em base64 para embutir no PDF (sem dependência de URL externa). */
async function loadCompanyLogoDataUri() {
  if (cachedLogoDataUri) return cachedLogoDataUri;

  try {
    const buffer = await fs.readFile(LOGO_PATH);
    cachedLogoDataUri = `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    cachedLogoDataUri = "";
  }
  return cachedLogoDataUri;
}

/** Limpa cache (útil em dev ao editar o CSS ou logo). */
function clearReportStylesCache() {
  cachedStyles = null;
  cachedLogoDataUri = null;
}

module.exports = {
  loadReportStyles,
  loadCompanyLogoDataUri,
  clearReportStylesCache,
};
