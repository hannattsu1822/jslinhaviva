(function () {
  const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp|svg)$/i;
  const PDF_EXT = /\.pdf$/i;
  const IMAGE_TIPOS = new Set([
    "imagem",
    "foto_conclusao",
    "foto_nao_conclusao",
  ]);

  let overlay = null;
  let stage = null;
  let nomeEl = null;
  let contadorEl = null;
  let btnPrev = null;
  let btnNext = null;
  let items = [];
  let currentIndex = 0;
  let keyHandler = null;

  function getUrl(anexo) {
    return (
      anexo?.url ||
      anexo?.caminho_servidor ||
      anexo?.caminho_arquivo ||
      anexo?.caminho ||
      ""
    );
  }

  function getMime(anexo) {
    const tipo = anexo?.tipo || anexo?.raw?.tipo || "";
    return (
      anexo?.tipo_mime ||
      anexo?.tipo_arquivo ||
      anexo?.type ||
      (typeof tipo === "string" && tipo.includes("/") ? tipo : "") ||
      ""
    );
  }

  function getNome(anexo) {
    return (
      anexo?.nome ||
      anexo?.nome_original ||
      anexo?.nomeOriginal ||
      anexo?.name ||
      anexo?.descricao_anexo ||
      "Anexo"
    );
  }

  function isImage(anexo) {
    const url = getUrl(anexo);
    const mime = getMime(anexo);
    const tipo = anexo?.tipo || anexo?.raw?.tipo || "";
    if (mime.startsWith("image/")) return true;
    if (IMAGE_TIPOS.has(tipo)) return true;
    return IMAGE_EXT.test(url);
  }

  function isPdf(anexo) {
    const url = getUrl(anexo);
    const mime = getMime(anexo);
    if (mime === "application/pdf") return true;
    return PDF_EXT.test(url);
  }

  function normalizeList(anexos) {
    if (!Array.isArray(anexos)) return [];
    return anexos
      .map((a) => ({
        url: getUrl(a),
        nome: getNome(a),
        tipo_mime: getMime(a),
        tipo: a?.tipo || "",
        raw: a,
      }))
      .filter((a) => a.url);
  }

  function escapeAttr(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function renderListHtml(anexos, options = {}) {
    const list = normalizeList(anexos);
    if (!list.length) return options.emptyHtml || "";
    const fileIcon =
      options.fileIcon === "material-icons"
        ? '<span class="material-icons">description</span>'
        : '<span class="material-symbols-outlined">description</span>';

    const itemsHtml = list
      .map((item, index) => {
        const nome = escapeAttr(item.nome);
        const url = escapeAttr(item.url);
        const tipo = escapeAttr(item.tipo_mime);
        const tipoAttr = tipo ? ` data-galeria-tipo="${tipo}"` : "";

        if (isImage(item)) {
          return `<button type="button" class="anexo-thumbnail" data-galeria-index="${index}" data-galeria-url="${url}" data-galeria-nome="${nome}"${tipoAttr} title="${nome}"><img src="${url}" alt="${nome}" loading="lazy"></button>`;
        }

        return `<button type="button" class="anexo-thumbnail anexo-thumbnail--file" data-galeria-index="${index}" data-galeria-url="${url}" data-galeria-nome="${nome}"${tipoAttr} title="${nome}">${fileIcon}<span class="anexo-thumbnail-caption">${item.nome}</span></button>`;
      })
      .join("");

    return `<div class="anexos-list">${itemsHtml}</div>`;
  }

  function ensureDom() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.id = "anexoGaleriaOverlay";
    overlay.className = "anexo-galeria-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="anexo-galeria-panel">
        <div class="anexo-galeria-toolbar">
          <span class="anexo-galeria-nome" id="anexoGaleriaNome"></span>
          <span class="anexo-galeria-contador" id="anexoGaleriaContador"></span>
          <button type="button" class="anexo-galeria-fechar" aria-label="Fechar galeria">&times;</button>
        </div>
        <div class="anexo-galeria-stage" id="anexoGaleriaStage">
          <button type="button" class="anexo-galeria-nav anexo-galeria-nav--prev" aria-label="Anterior">&#8249;</button>
          <button type="button" class="anexo-galeria-nav anexo-galeria-nav--next" aria-label="Próximo">&#8250;</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    stage = overlay.querySelector("#anexoGaleriaStage");
    nomeEl = overlay.querySelector("#anexoGaleriaNome");
    contadorEl = overlay.querySelector("#anexoGaleriaContador");
    btnPrev = overlay.querySelector(".anexo-galeria-nav--prev");
    btnNext = overlay.querySelector(".anexo-galeria-nav--next");

    overlay.querySelector(".anexo-galeria-fechar").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    btnPrev.addEventListener("click", (e) => {
      e.stopPropagation();
      show(currentIndex - 1);
    });
    btnNext.addEventListener("click", (e) => {
      e.stopPropagation();
      show(currentIndex + 1);
    });
  }

  function openPdfExternally(item) {
    window.open(item.url, "_blank", "noopener,noreferrer");
  }

  function renderItem(item) {
    stage.querySelectorAll("img, iframe, .anexo-galeria-arquivo, .anexo-galeria-pdf").forEach((el) => {
      if (!el.classList.contains("anexo-galeria-nav")) el.remove();
    });

    if (isImage(item)) {
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = item.nome;
      stage.insertBefore(img, btnPrev);
      return;
    }

    if (isPdf(item)) {
      openPdfExternally(item);
      const box = document.createElement("div");
      box.className = "anexo-galeria-pdf";
      box.innerHTML = safeHtml`
        <span class="material-symbols-outlined">picture_as_pdf</span>
        <p>${item.nome}</p>
        <p class="anexo-galeria-pdf-hint">O PDF foi aberto em uma nova aba para leitura completa do documento.</p>
        <a href="${item.url}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">
          Abrir PDF novamente
        </a>
      `;
      stage.insertBefore(box, btnPrev);
      overlay?.classList.add("anexo-galeria-overlay--pdf");
      return;
    }

    overlay?.classList.remove("anexo-galeria-overlay--pdf");

    const box = document.createElement("div");
    box.className = "anexo-galeria-arquivo";
    box.innerHTML = safeHtml`
      <span class="material-symbols-outlined">description</span>
      <p>${item.nome}</p>
      <a href="${item.url}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">
        <span class="material-symbols-outlined" style="font-size:1.1rem">open_in_new</span>
        Abrir arquivo
      </a>
    `;
    stage.insertBefore(box, btnPrev);
  }

  function updateNav() {
    const multi = items.length > 1;
    btnPrev.disabled = !multi || currentIndex <= 0;
    btnNext.disabled = !multi || currentIndex >= items.length - 1;
    btnPrev.style.display = multi ? "" : "none";
    btnNext.style.display = multi ? "" : "none";
    contadorEl.textContent = multi
      ? `${currentIndex + 1} / ${items.length}`
      : "";
  }

  function show(index) {
    if (!items.length) return;
    currentIndex = Math.max(0, Math.min(index, items.length - 1));
    const item = items[currentIndex];
    nomeEl.textContent = item.nome;
    if (!isPdf(item)) {
      overlay?.classList.remove("anexo-galeria-overlay--pdf");
    }
    renderItem(item);
    updateNav();
  }

  function bindKeys() {
    if (keyHandler) return;
    keyHandler = (e) => {
      if (!overlay?.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(currentIndex - 1);
      if (e.key === "ArrowRight") show(currentIndex + 1);
    };
    document.addEventListener("keydown", keyHandler);
  }

  function open(anexos, startIndex = 0) {
    items = normalizeList(anexos);
    if (!items.length) return;

    ensureDom();
    bindKeys();
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";
    show(startIndex);
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove("is-open", "anexo-galeria-overlay--pdf");
    document.body.style.overflow = "";
    stage
      ?.querySelectorAll("img, iframe, .anexo-galeria-arquivo, .anexo-galeria-pdf")
      .forEach((el) => el.remove());
  }

  function collectFromDom(container) {
    return [...container.querySelectorAll("[data-galeria-index]")].map((el) => ({
      url: el.dataset.galeriaUrl,
      nome: el.dataset.galeriaNome || el.title || "Anexo",
      tipo_mime: el.dataset.galeriaTipo || "",
    }));
  }

  function bindContainer(container, anexos) {
    if (!container) return;
    const list = anexos ? normalizeList(anexos) : collectFromDom(container);
    if (!list.length) return;

    container.querySelectorAll("[data-galeria-index]").forEach((el, idx) => {
      if (el.dataset.galeriaBound) return;
      el.dataset.galeriaBound = "1";
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const parsed = parseInt(el.dataset.galeriaIndex, 10);
        const index = Number.isFinite(parsed) ? parsed : idx;
        const item = list[index];
        if (isPdf(item) && !list.some(isImage)) {
          openPdfExternally(item);
          return;
        }
        open(list, index);
      });
    });
  }

  function bindAllGalerias(root) {
    const scope = root || document;
    scope
      .querySelectorAll(".anexos-list, .anexos-container, .anexos-galeria-container")
      .forEach((container) => {
        if (container.querySelector("[data-galeria-index]")) {
          bindContainer(container);
        }
      });
  }

  window.AnexoGaleria = {
    open,
    close,
    bindContainer,
    bindAllGalerias,
    renderListHtml,
    normalizeList,
    isImage,
    isPdf,
  };
})();
