const fs = require("fs/promises");
const path = require("path");
const { publicDir } = require("../path.helper");

let cachedStyles = null;

/**
 * Retorna o CSS do tema de relatórios inlined para uso em PDF (Playwright setContent).
 * Espelha variables.css + report-theme.css — mesma identidade visual do sistema.
 */
async function loadReportStyles() {
  if (cachedStyles) return cachedStyles;

  const themePath = path.join(publicDir, "static/css/base/report-theme.css");
  cachedStyles = await fs.readFile(themePath, "utf-8");
  return cachedStyles;
}

/** Limpa cache (útil em dev ao editar o CSS). */
function clearReportStylesCache() {
  cachedStyles = null;
}

module.exports = {
  loadReportStyles,
  clearReportStylesCache,
};
