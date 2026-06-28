const { escapeHtml } = require("../htmlEscape.helper");

function statusBadgeClass(status) {
  const normalized = String(status || "")
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (["concluido", "concluído", "aprovado"].includes(normalized)) {
    return "lv-badge--success";
  }
  if (
    ["nao_concluido", "não_concluído", "reprovado", "cancelado"].includes(
      normalized
    )
  ) {
    return "lv-badge--error";
  }
  if (
    ["concluido_com_pendencia", "pendente", "em_andamento"].includes(normalized)
  ) {
    return "lv-badge--warning";
  }
  return "lv-badge--neutral";
}

function renderStatusBadge(label) {
  const text = escapeHtml(String(label || "N/A"));
  const badgeClass = statusBadgeClass(label);
  return `<span class="lv-badge ${badgeClass}">${text}</span>`;
}

function gerarGaleriaHtml(imagens, columns = 4, options = {}) {
  if (!imagens || imagens.length === 0) {
    return '<p class="lv-empty">Nenhum registro fotográfico encontrado.</p>';
  }

  const { technical = false, figureStart = 1 } = options;

  if (technical) {
    let galleryHtml = '<div class="rt-figure-grid">';
    imagens.forEach((img, index) => {
      const figureNum = figureStart + index;
      galleryHtml += `
        <figure class="rt-figure">
          <div class="rt-figure__frame">
            <img src="${img.src}" alt="${escapeHtml(img.nome)}" />
          </div>
          <figcaption>Figura ${figureNum} — ${escapeHtml(img.nome)}</figcaption>
        </figure>`;
    });
    galleryHtml += "</div>";
    return galleryHtml;
  }

  const gridClass =
    columns === 3 ? "lv-photo-grid lv-photo-grid--3col" : "lv-photo-grid";
  let galleryHtml = "";

  for (let i = 0; i < imagens.length; i += columns) {
    const chunk = imagens.slice(i, i + columns);
    galleryHtml += `<div class="${gridClass}">`;
    chunk.forEach((img) => {
      galleryHtml += `
        <div class="lv-photo-item">
          <img src="${img.src}" alt="${escapeHtml(img.nome)}" />
          <p class="lv-photo-item__caption">${escapeHtml(img.nome)}</p>
        </div>`;
    });
    galleryHtml += "</div>";
  }

  return galleryHtml;
}

function gerarListaDocumentosHtml(documentos, emptyMessage) {
  if (!documentos || documentos.length === 0) {
    return `<p class="lv-empty">${escapeHtml(
      emptyMessage || "Nenhum documento encontrado."
    )}</p>`;
  }

  let listHtml = '<ul class="lv-doc-list">';
  documentos.forEach((doc) => {
    const nome =
      typeof doc === "string" ? doc : doc.nomeOriginal || doc.nome_original;
    const tipo = typeof doc === "object" && doc.tipo ? ` (${doc.tipo})` : "";
    listHtml += `<li>${escapeHtml(nome)}${escapeHtml(tipo)}</li>`;
  });
  listHtml += "</ul>";
  return listHtml;
}

function renderInfoItem(label, value, options = false) {
  let fullWidth = false;
  let span = 0;

  if (typeof options === "boolean") {
    fullWidth = options;
  } else if (options && typeof options === "object") {
    fullWidth = Boolean(options.fullWidth);
    span = Number(options.span) || 0;
  }

  const modifiers = [
    fullWidth ? "lv-info-item--full" : "",
    span > 1 ? `lv-info-item--span-${span}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <div class="lv-info-item${modifiers ? ` ${modifiers}` : ""}">
      <span class="lv-info-item__label">${escapeHtml(label)}</span>
      <div class="lv-info-item__value">${value}</div>
    </div>`;
}

function renderStatusRow(label, badgeHtml) {
  return `
    <div class="rt-status-row">
      <span class="rt-status-row__label">${escapeHtml(label)}</span>
      <div class="rt-status-row__value">${badgeHtml}</div>
    </div>`;
}

function applyTemplatePlaceholders(template, data) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.split(`{{${key}}}`).join(value ?? "");
  }
  return result;
}

function renderTextBlock(content) {
  return `<div class="lv-text-block">${content}</div>`;
}

/**
 * Gera páginas individuais para impressão ampliada (fotos e capas de documentos).
 * Inserido após assinaturas no PDF consolidado.
 */
function gerarAnexoImpressaoIndividualHtml(items = [], options = {}) {
  if (!items || items.length === 0) {
    return "";
  }

  const { docCode = "", processo = "" } = options;
  const safeDocCode = escapeHtml(docCode);
  const safeProcesso = processo ? escapeHtml(processo) : "";

  let pagesHtml = `
    <section class="rt-print-appendix lv-page-break">
      <div class="rt-print-appendix__intro">
        <h2 class="rt-print-appendix__title">Anexo — Impressão Individual</h2>
        <p class="rt-print-appendix__desc">
          Páginas a seguir reproduzem cada registro em formato ampliado para
          impressão avulsa. Processo/OS: <strong>${safeProcesso || "N/A"}</strong>
          · Documento: <strong>${safeDocCode || "N/A"}</strong>
        </p>
      </div>`;

  let photoNum = 0;
  let docNum = 0;

  items.forEach((item) => {
    if (item.type === "photo") {
      photoNum += 1;
      pagesHtml += `
      <div class="rt-print-page rt-print-page--photo">
        <header class="rt-print-page__header">
          <span class="rt-print-page__doc">${safeDocCode}</span>
          <span class="rt-print-page__kind">Registro Fotográfico · Figura ${photoNum}</span>
        </header>
        <div class="rt-print-page__body">
          <div class="rt-print-page__frame">
            <img src="${item.src}" alt="${escapeHtml(item.nome)}" />
          </div>
        </div>
        <footer class="rt-print-page__footer">
          <span class="rt-print-page__caption">Figura ${photoNum} — ${escapeHtml(item.nome)}</span>
        </footer>
      </div>`;
    } else if (item.type === "document") {
      docNum += 1;
      pagesHtml += `
      <div class="rt-print-page rt-print-page--document">
        <header class="rt-print-page__header">
          <span class="rt-print-page__doc">${safeDocCode}</span>
          <span class="rt-print-page__kind">Documento Anexo</span>
        </header>
        <div class="rt-print-page__body rt-print-page__body--document">
          <p class="rt-print-page__doc-index">Documento ${docNum}</p>
          <h3 class="rt-print-page__doc-name">${escapeHtml(item.nome)}</h3>
          <p class="rt-print-page__doc-hint">
            O conteúdo integral deste documento segue nas páginas imediatamente posteriores.
          </p>
        </div>
        <footer class="rt-print-page__footer">
          Anexo ${docNum} — ${escapeHtml(item.nome)}
        </footer>
      </div>`;
    }
  });

  pagesHtml += "</section>";
  return pagesHtml;
}

function renderInspecaoStatusBadge(status) {
  const num =
    status === null || status === undefined ? null : Number(status);
  if (num === 1) {
    return '<span class="lv-badge lv-badge--success">Conforme</span>';
  }
  if (num === 0) {
    return '<span class="lv-badge lv-badge--error">Não Conforme</span>';
  }
  return '<span class="lv-badge lv-badge--warning">Não Informado</span>';
}

function gerarTabelaChecklistSingleHtml(items) {
  return `
    <table class="lv-table lv-table--checklist">
      <thead>
        <tr>
          <th class="lv-table__item-col">Item</th>
          <th class="lv-table__status-col">Status</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item) => `
          <tr>
            <td class="lv-table__item-col">${escapeHtml(item.label)}</td>
            <td class="lv-table__status-col">${renderInspecaoStatusBadge(item.value)}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

function gerarTabelaChecklistHtml(items, options = {}) {
  if (!items || items.length === 0) {
    return '<p class="lv-empty">Nenhum item registrado.</p>';
  }

  const { dualColumn = false, minItemsForDual = 8 } = options;

  if (dualColumn && items.length >= minItemsForDual) {
    const mid = Math.ceil(items.length / 2);
    return `<div class="lv-checklist-dual">
      ${gerarTabelaChecklistSingleHtml(items.slice(0, mid))}
      ${gerarTabelaChecklistSingleHtml(items.slice(mid))}
    </div>`;
  }

  return gerarTabelaChecklistSingleHtml(items);
}

function gerarTabelaKeyValueSingleHtml(items, options = {}) {
  const { valueLabel = "Valor", showObs = false } = options;

  return `
    <table class="lv-table lv-table--checklist lv-table--keyvalue">
      <thead>
        <tr>
          <th class="lv-table__item-col">Item</th>
          <th class="lv-table__value-col">${escapeHtml(valueLabel)}</th>
          ${
            showObs
              ? '<th class="lv-table__obs-col">Observações</th>'
              : ""
          }
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item) => `
          <tr>
            <td class="lv-table__item-col">${escapeHtml(item.label)}</td>
            <td class="lv-table__value-col">${escapeHtml(item.value ?? "N/A")}</td>
            ${
              showObs
                ? `<td class="lv-table__obs-col">${item.observacao ? escapeHtml(item.observacao) : "—"}</td>`
                : ""
            }
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

function gerarTabelaKeyValueHtml(items, options = {}) {
  if (!items || items.length === 0) {
    return '<p class="lv-empty">Nenhum item registrado.</p>';
  }

  const { dualColumn = false, minItemsForDual = 8, ...tableOptions } = options;

  if (dualColumn && items.length >= minItemsForDual) {
    const mid = Math.ceil(items.length / 2);
    return `<div class="lv-checklist-dual">
      ${gerarTabelaKeyValueSingleHtml(items.slice(0, mid), tableOptions)}
      ${gerarTabelaKeyValueSingleHtml(items.slice(mid), tableOptions)}
    </div>`;
  }

  return gerarTabelaKeyValueSingleHtml(items, tableOptions);
}

module.exports = {
  statusBadgeClass,
  renderStatusBadge,
  renderInspecaoStatusBadge,
  gerarGaleriaHtml,
  gerarListaDocumentosHtml,
  gerarAnexoImpressaoIndividualHtml,
  gerarTabelaChecklistHtml,
  gerarTabelaKeyValueHtml,
  renderInfoItem,
  renderStatusRow,
  renderTextBlock,
  applyTemplatePlaceholders,
};
