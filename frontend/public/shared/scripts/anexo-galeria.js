(function () {
  const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i;
  const PDF_EXT = /\.pdf$/i;

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
    return anexo?.caminho_servidor || anexo?.url || "";
  }

  function getNome(anexo) {
    return (
      anexo?.nome_original ||
      anexo?.name ||
      anexo?.descricao_anexo ||
      "Anexo"
    );
  }

  function isImage(anexo) {
    const url = getUrl(anexo);
    const mime = anexo?.tipo_mime || anexo?.type || "";
    if (mime.startsWith("image/")) return true;
    return IMAGE_EXT.test(url);
  }

  function isPdf(anexo) {
    const url = getUrl(anexo);
    const mime = anexo?.tipo_mime || anexo?.type || "";
    if (mime === "application/pdf") return true;
    return PDF_EXT.test(url);
  }

  function normalizeList(anexos) {
    if (!Array.isArray(anexos)) return [];
    return anexos
      .filter((a) => a && getUrl(a))
      .map((a) => ({
        url: getUrl(a),
        nome: getNome(a),
        tipo_mime: a.tipo_mime || a.type || "",
        raw: a,
      }));
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

  function renderItem(item) {
    stage.querySelectorAll("img, iframe, .anexo-galeria-arquivo").forEach((el) => {
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
      const iframe = document.createElement("iframe");
      iframe.src = item.url;
      iframe.title = item.nome;
      stage.insertBefore(iframe, btnPrev);
      return;
    }

    const box = document.createElement("div");
    box.className = "anexo-galeria-arquivo";
    box.innerHTML = `
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
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
    stage
      ?.querySelectorAll("img, iframe, .anexo-galeria-arquivo")
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
        open(list, Number.isFinite(parsed) ? parsed : idx);
      });
    });
  }

  window.AnexoGaleria = {
    open,
    close,
    bindContainer,
    normalizeList,
    isImage,
    isPdf,
  };
})();
