const path = require("path");
const fs = require("fs/promises");
const ejs = require("ejs");
const playwright = require("playwright");
const { PDFDocument } = require("pdf-lib");
const { loadReportStyles, loadCompanyLogoDataUri, loadServicoDetailsPdfStyles } = require("./reportTheme.helper");
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

function formatReportDateShort(date = new Date()) {
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Maceio" });
}

function buildDocumentCode(processo, referenceId, options = {}) {
  const { prefix = "LV-SRV" } = options;
  const slug = String(processo || referenceId || "000")
    .trim()
    .replace(/\//g, "-")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9\-]/g, "");
  return `${prefix}-${slug || referenceId || "000"}`;
}

function buildFleetDocumentCode(inspecaoId, placa) {
  const slug = String(placa || inspecaoId || "000")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9\-]/g, "");
  return buildDocumentCode(slug, inspecaoId, { prefix: "LV-FRT" });
}

function buildTransformerDocumentCode(checklistId, numeroSerie) {
  const slug = String(numeroSerie || checklistId || "000")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9\-]/g, "");
  return buildDocumentCode(slug, checklistId, { prefix: "LV-TRF" });
}

function buildReformadoDocumentCode(testeId, numeroSerie) {
  const slug = String(numeroSerie || testeId || "000")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9\-]/g, "");
  return buildDocumentCode(slug, testeId, { prefix: "LV-REF" });
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

function buildFooterOnlyTemplate(docCode = "") {
  const footerStyle = `font-family: ${PDF_FONT}; font-size: 8px; color: #475569; width: 100%;`;
  const docLabel = docCode ? `${escapeHtml(docCode)} · ` : "";
  return `
    <div style="${footerStyle} padding: 0 10mm; height: 12mm; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #94a3b8;">
      <span>${docLabel}${BRAND.company} · ${BRAND.system} · Uso Interno</span>
      <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
    </div>
  `;
}

/**
 * Envolve fragmento HTML com layout base e tema do sistema.
 */
async function wrapReportHtml(bodyHtml, options = {}) {
  const styles = await loadReportStyles();
  const logoDataUri = await loadCompanyLogoDataUri();
  const {
    title = "Relatório",
    badge = "",
    processo = "",
    referenceId = "",
    generatedAt = formatReportDate(),
    author = "",
    extraMeta = "",
    showFooterNote = true,
    showSignatures = true,
    signaturesOnOwnPage = false,
    landscape = true,
    appendixHtml = "",
  } = options;

  const docCode = buildDocumentCode(processo, referenceId);
  const emissionDate = formatReportDateShort();

  const metaLines = [];
  if (processo) {
    metaLines.push(`<strong>Processo/OS:</strong> ${escapeHtml(processo)}`);
  }
  metaLines.push(`<strong>Emissão:</strong> ${escapeHtml(generatedAt)}`);
  if (author) metaLines.push(`<strong>Responsável:</strong> ${escapeHtml(author)}`);

  const safeTitle = escapeHtml(title);
  const safeBadge = badge ? escapeHtml(badge) : "";
  const reportClasses = [
    "lv-report",
    landscape ? "lv-report--landscape" : "",
    "lv-report--technical",
  ]
    .filter(Boolean)
    .join(" ");

  const logoHtml = logoDataUri
    ? `<img class="lv-report-brand__logo rt-cover__logo" src="${logoDataUri}" alt="${BRAND.company}" />`
    : `<div class="lv-report-brand__logo-fallback">${BRAND.company}</div>`;

  const signaturesClass = signaturesOnOwnPage
    ? "rt-signatures rt-signatures--own-page"
    : "rt-signatures";

  const signaturesHtml =
    showSignatures && author
      ? `
    <div class="${signaturesClass}">
      <div class="rt-signature">
        <div class="rt-signature__line"></div>
        <p class="rt-signature__label">${escapeHtml(author)}</p>
        <p class="rt-signature__role">Responsável Técnico</p>
      </div>
      <div class="rt-signature">
        <div class="rt-signature__line"></div>
        <p class="rt-signature__label">${BRAND.company}</p>
        <p class="rt-signature__role">Gestão Operacional — ${BRAND.system}</p>
      </div>
    </div>`
      : "";

  const footerNoteHtml = showFooterNote
    ? `<p class="lv-report-footer-note">Documento gerado eletronicamente pelo ${BRAND.system}. Reprodução parcial permitida para fins operacionais da ${BRAND.company}.</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle}</title>
  <style>${styles}</style>
</head>
<body class="lv-report-body">
  <div class="${reportClasses}">
    <table class="rt-doc-control" aria-label="Controle documental">
      <tr>
        <td><span>Documento</span><strong>${escapeHtml(docCode)}</strong></td>
        <td><span>Revisão</span><strong>00</strong></td>
        <td><span>Data</span><strong>${escapeHtml(emissionDate)}</strong></td>
        <td><span>Classificação</span><strong>Uso Interno</strong></td>
      </tr>
    </table>

    <header class="rt-cover">
      <div class="rt-cover__brand">
        ${logoHtml}
        <p class="rt-cover__company">${BRAND.company}</p>
      </div>
      <div class="rt-cover__center">
        <p class="rt-cover__kind">Relatório Técnico</p>
        <h1 class="rt-cover__title">${safeTitle}</h1>
        ${safeBadge ? `<p class="rt-cover__module">${safeBadge}</p>` : ""}
      </div>
      <div class="rt-cover__meta">
        ${metaLines.join("<br>")}
        ${extraMeta ? `<br>${extraMeta}` : ""}
      </div>
    </header>

    <main class="lv-report-main">${bodyHtml}</main>

    ${signaturesOnOwnPage ? footerNoteHtml : ""}
    ${signaturesHtml}
    ${signaturesOnOwnPage ? "" : footerNoteHtml}

    ${appendixHtml}
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

async function renderServicoDetailsReport(data = {}) {
  const templatePath = path.join(TEMPLATES_DIR, "servico-details-report.ejs");
  const [reportStyles, logoDataUri] = await Promise.all([
    loadServicoDetailsPdfStyles(),
    loadCompanyLogoDataUri(),
  ]);
  return ejs.renderFile(templatePath, {
    ...data,
    reportStyles,
    logoDataUri,
    formatReportDate,
  });
}

async function htmlToPdf(html, options = {}) {
  const {
    landscape = true,
    format = "A4",
    margin = { top: "8mm", right: "10mm", bottom: "14mm", left: "10mm" },
    headerFooter = true,
    footerOnly = false,
    headerMeta = {},
    docCode = "",
  } = options;

  let browser;
  try {
    browser = await playwright.chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 120000 });

    const pdfOptions = {
      format,
      printBackground: true,
      landscape,
      margin,
    };

    if (footerOnly) {
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.headerTemplate = "<div></div>";
      pdfOptions.footerTemplate = buildFooterOnlyTemplate(docCode);
    } else if (headerFooter) {
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
  formatReportDateShort,
  buildDocumentCode,
  buildFleetDocumentCode,
  buildTransformerDocumentCode,
  buildReformadoDocumentCode,
  buildHeaderFooterTemplates,
  buildFooterOnlyTemplate,
  wrapReportHtml,
  renderReportTemplate,
  renderServicoDetailsReport,
  htmlToPdf,
  mergePdfAttachments,
};
