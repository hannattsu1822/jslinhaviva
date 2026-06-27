const path = require("path");
const fs = require("fs/promises");
const ejs = require("ejs");
const playwright = require("playwright");
const { PDFDocument } = require("pdf-lib");
const { loadReportStyles } = require("./reportTheme.helper");
const { escapeHtml } = require("../htmlEscape.helper");

const REPORTS_DIR = path.join(__dirname);
const TEMPLATES_DIR = path.join(REPORTS_DIR, "templates");

const BRAND = {
  name: "Linha Viva",
  company: "SULGIPE",
  system: "Linha Viva System",
};

const PDF_FONT =
  "'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif";

function formatReportDate(date = new Date()) {
  return date.toLocaleString("pt-BR", { timeZone: "America/Maceio" });
}

function buildHeaderFooterTemplates(meta = {}) {
  const title = escapeHtml(meta.title || "Relatório");
  const subtitle = escapeHtml(meta.subtitle || BRAND.system);

  const headerStyle = `font-family: ${PDF_FONT}; font-size: 9px; color: #64748b; width: 100%;`;
  const headerTemplate = `
    <div style="${headerStyle} padding: 0 12mm; height: 22mm; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, #2d6cb5, #38bdf8); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 11px;">⚡</div>
        <div>
          <div style="font-size: 11px; font-weight: 800; color: #1e56a0; letter-spacing: -0.02em;">${BRAND.name}</div>
          <div style="font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">${BRAND.company}</div>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11px; font-weight: 700; color: #0f172a;">${title}</div>
        <div style="font-size: 9px; color: #64748b;">${subtitle}</div>
      </div>
    </div>
  `;

  const footerTemplate = `
    <div style="${headerStyle} padding: 0 12mm; height: 14mm; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0;">
      <span>Documento gerado automaticamente — ${BRAND.system}</span>
      <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
    </div>
  `;

  return { headerTemplate, footerTemplate };
}

/**
 * Envolve fragmento HTML com layout base e tema do sistema.
 */
async function wrapReportHtml(bodyHtml, options = {}) {
  const styles = await loadReportStyles();
  const {
    title = "Relatório",
    badge = "",
    processo = "",
    generatedAt = formatReportDate(),
    author = "",
    extraMeta = "",
    showFooterNote = true,
  } = options;

  const metaLines = [];
  if (processo) {
    metaLines.push(`<strong>Processo:</strong> ${escapeHtml(processo)}`);
  }
  metaLines.push(`<strong>Gerado em:</strong> ${escapeHtml(generatedAt)}`);
  if (author) metaLines.push(`<strong>Por:</strong> ${escapeHtml(author)}`);
  if (extraMeta) metaLines.push(extraMeta);

  const safeTitle = escapeHtml(title);
  const safeBadge = badge ? escapeHtml(badge) : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle}</title>
  <style>${styles}</style>
</head>
<body class="lv-report-body">
  <div class="lv-report">
    <div class="lv-report__accent-bar"></div>
    <header class="lv-report-header">
      <div class="lv-report-brand">
        <div class="lv-report-brand__icon" aria-hidden="true">⚡</div>
        <div class="lv-report-brand__text">
          <span class="lv-report-brand__name">${BRAND.name}</span>
          <span class="lv-report-brand__system">${BRAND.company} · ${BRAND.system}</span>
        </div>
      </div>
      <div class="lv-report-header__main">
        ${safeBadge ? `<span class="lv-report-header__badge">${safeBadge}</span>` : ""}
        <h1 class="lv-report-header__title">${safeTitle}</h1>
        <div class="lv-report-header__meta">${metaLines.join("<br>")}</div>
      </div>
    </header>
    <main>${bodyHtml}</main>
    ${
      showFooterNote
        ? `<p class="lv-report-footer-note">Este documento foi emitido pelo ${BRAND.system}. Informações sujeitas aos registros operacionais da ${BRAND.company}.</p>`
        : ""
    }
  </div>
</body>
</html>`;
}

async function renderReportTemplate(templateName, data = {}) {
  const templatePath = path.join(TEMPLATES_DIR, templateName);
  const styles = await loadReportStyles();
  return ejs.renderFile(templatePath, {
    ...data,
    reportStyles: styles,
    brand: BRAND,
    formatReportDate,
  });
}

async function htmlToPdf(html, options = {}) {
  const {
    landscape = false,
    format = "A4",
    margin = { top: "28mm", right: "10mm", bottom: "22mm", left: "10mm" },
    headerFooter = true,
    headerMeta = {},
  } = options;

  let browser;
  try {
    browser = await playwright.chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });

    const pdfOptions = {
      format,
      printBackground: true,
      landscape,
      margin,
    };

    if (headerFooter) {
      const { headerTemplate, footerTemplate } =
        buildHeaderFooterTemplates(headerMeta);
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.headerTemplate = headerTemplate;
      pdfOptions.footerTemplate = footerTemplate;
    }

    return await page.pdf(pdfOptions);
  } finally {
    if (browser) await browser.close();
  }
}

async function mergePdfAttachments(basePdfBuffer, attachmentPaths = []) {
  if (!basePdfBuffer || attachmentPaths.length === 0) {
    return basePdfBuffer;
  }

  const mergedPdfDoc = await PDFDocument.load(basePdfBuffer);

  for (const attachmentPath of attachmentPaths) {
    if (!attachmentPath || !require("fs").existsSync(attachmentPath)) continue;
    try {
      const anexoPdfBytes = await fs.readFile(attachmentPath);
      const anexoPdfDoc = await PDFDocument.load(anexoPdfBytes, {
        ignoreEncryption: true,
      });
      const copiedPages = await mergedPdfDoc.copyPages(
        anexoPdfDoc,
        anexoPdfDoc.getPageIndices()
      );
      copiedPages.forEach((p) => mergedPdfDoc.addPage(p));
    } catch (err) {
      console.error(`Falha ao anexar PDF ${attachmentPath}:`, err.message);
    }
  }

  return Buffer.from(await mergedPdfDoc.save());
}

module.exports = {
  BRAND,
  REPORTS_DIR,
  TEMPLATES_DIR,
  formatReportDate,
  buildHeaderFooterTemplates,
  wrapReportHtml,
  renderReportTemplate,
  htmlToPdf,
  mergePdfAttachments,
};
