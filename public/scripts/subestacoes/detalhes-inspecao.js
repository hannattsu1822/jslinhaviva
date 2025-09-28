document.addEventListener("DOMContentLoaded", () => {
  const inspecaoIdTitulo = document.getElementById("inspecaoIdTitulo");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const erroCarregamento = document.getElementById("erroCarregamento");
  const btnImprimir = document.getElementById("btnImprimir");

  const detalhesContainer = document.getElementById("detalhesContainer");
  const infoGeraisContainer = document.getElementById("infoGeraisContainer");
  const obsGeraisContainer = document.getElementById("obsGeraisContainer");

  const checklistItemsContainer = document.getElementById(
    "checklistItemsContainer"
  );
  const avulsaItemsContainer = document.getElementById("avulsaItemsContainer");

  const medicoesContainer = document.getElementById("medicoesContainer");
  const equipamentosObservadosContainer = document.getElementById(
    "equipamentosObservadosContainer"
  );
  const anexosGeraisContainer = document.getElementById(
    "anexosGeraisContainer"
  );
  const anexosEscritorioContainer = document.getElementById(
    "anexosEscritorioContainer"
  );

  const imageLightboxEl = document.getElementById("imageLightbox");
  const lightboxImage = document.getElementById("lightboxImage");
  const lightboxCloseBtn = imageLightboxEl.querySelector(".btn-close-lightbox");

  const modalTermografia = document.getElementById("modalTermografia");
  const btnAdicionarAnexoTermografia = document.getElementById(
    "btnAdicionarAnexoTermografia"
  );
  const arquivosTermografiaInput = document.getElementById(
    "arquivosTermografiaInput"
  );
  const previewAnexosTermografia = document.getElementById(
    "previewAnexosTermografia"
  );
  const btnSalvarAnexosTermografia = document.getElementById(
    "btnSalvarAnexosTermografia"
  );
  const templateAnexoPreview = document.getElementById("templateAnexoPreview");

  let termografiaFilesToUpload = [];

  function getInspecaoIdFromUrl() {
    const pathParts = window.location.pathname.split("/");
    const id =
      pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];
    return id && !isNaN(parseInt(id, 10)) ? parseInt(id, 10) : null;
  }

  function showLightbox(imageUrl) {
    if (!imageLightboxEl || !lightboxImage) return;
    lightboxImage.src = imageUrl;
    imageLightboxEl.classList.remove("hidden");
  }

  function hideLightbox() {
    if (!imageLightboxEl) return;
    imageLightboxEl.classList.add("hidden");
    lightboxImage.src = "";
  }

  imageLightboxEl.addEventListener("click", (e) => {
    if (e.target === imageLightboxEl) hideLightbox();
  });
  if (lightboxCloseBtn)
    lightboxCloseBtn.addEventListener("click", hideLightbox);

  async function fetchData(url, options = {}) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: `Erro HTTP: ${response.status}` }));
        throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
      }
      return response.status === 204 ? null : await response.json();
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      throw error;
    }
  }

  async function uploadFile(file) {
    const formData = new FormData();
    formData.append("anexo", file);
    const response = await fetch("/api/inspecoes/upload-temporario", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error("Falha no upload do arquivo.");
    return response.json();
  }

  function renderAnexos(anexos, title) {
    if (!anexos || anexos.length === 0) return "";
    let anexosHtml = title ? `<h4 class="anexos-title">${title}</h4>` : "";
    anexosHtml += `<div class="anexos-container">`;
    anexos.forEach((anexo) => {
      if (!anexo || !anexo.caminho_servidor) return;

      const isImage =
        anexo.caminho_servidor.match(/\.(jpeg|jpg|gif|png|webp|heic|heif)$/i) !=
        null;
      const anexoTitle = anexo.descricao_anexo || anexo.nome_original;

      if (isImage) {
        anexosHtml += `
          <div class="anexo-item" data-src="${anexo.caminho_servidor}" title="${anexoTitle}">
            <img src="${anexo.caminho_servidor}" alt="${anexo.nome_original}" loading="lazy">
          </div>`;
      } else {
        anexosHtml += `
          <a href="${anexo.caminho_servidor}" target="_blank" class="anexo-item" title="${anexoTitle}">
            <span class="material-symbols-outlined">description</span>
            <span class="anexo-item-title">${anexo.nome_original}</span>
          </a>`;
      }
    });
    anexosHtml += `</div>`;
    return anexosHtml;
  }

  function renderInfoGerais(inspecaoInfo) {
    const statusClasse = (
      inspecaoInfo.status_inspecao || "desconhecido"
    ).toLowerCase();
    const statusTexto = (
      inspecaoInfo.status_inspecao || "DESCONHECIDO"
    ).replace(/_/g, " ");
    infoGeraisContainer.innerHTML = `
      <div class="detail-card">
        <h2 class="detail-card-header">
          <span class="material-symbols-outlined">info</span>
          Informações Gerais
        </h2>
        <div class="detail-card-body">
          <div class="info-grid">
            <div class="info-item"><strong>Nº Formulário:</strong><p>${
              inspecaoInfo.formulario_inspecao_num || inspecaoInfo.id
            }</p></div>
            <div class="info-item"><strong>Processo:</strong><p>${
              inspecaoInfo.processo || "N/A"
            }</p></div>
            <div class="info-item"><strong>Subestação:</strong><p>${
              inspecaoInfo.subestacao_sigla
            } - ${inspecaoInfo.subestacao_nome}</p></div>
            <div class="info-item"><strong>Responsável:</strong><p>${
              inspecaoInfo.responsavel_nome
            }</p></div>
            <div class="info-item"><strong>Data Avaliação:</strong><p>${
              inspecaoInfo.data_avaliacao_fmt
            }</p></div>
            <div class="info-item"><strong>Horário:</strong><p>${inspecaoInfo.hora_inicial.substring(
              0,
              5
            )} ${
      inspecaoInfo.hora_final
        ? " às " + inspecaoInfo.hora_final.substring(0, 5)
        : ""
    }</p></div>
            <div class="info-item"><strong>Status:</strong><p><span class="status-badge status-${statusClasse}">${statusTexto}</span></p></div>
          </div>
        </div>
      </div>`;
  }

  function renderObsGerais(observacoes) {
    if (!observacoes) {
      obsGeraisContainer.innerHTML = "";
      return;
    }
    obsGeraisContainer.innerHTML = `
      <div class="detail-card">
        <h2 class="detail-card-header">
          <span class="material-symbols-outlined">speaker_notes</span>
          Observações Gerais da Inspeção
        </h2>
        <div class="detail-card-body">
          <p class="obs-gerais">${observacoes}</p>
        </div>
      </div>`;
  }

  function renderChecklist(inspecaoCompleta) {
    const { id: inspecaoId, itens, anexos } = inspecaoCompleta;
    const gruposDeItens = itens.reduce((acc, item) => {
      const grupo = item.nome_grupo || "Itens Diversos";
      (acc[grupo] = acc[grupo] || []).push(item);
      return acc;
    }, {});
    let html = `<div class="detail-card"><h2 class="detail-card-header"><span class="material-symbols-outlined">checklist</span>Itens do Checklist</h2><div class="detail-card-body">`;
    let itemCounter = 1;
    Object.entries(gruposDeItens).forEach(([grupoNome, itensDoGrupo]) => {
      html += `<div class="checklist-group"><h3 class="checklist-group-header">${grupoNome}</h3>`;
      itensDoGrupo.forEach((item) => {
        html += `<div class="checklist-item">
                    <div class="checklist-item-content">
                        <p class="checklist-item-header">
                            <span>${itemCounter++}. ${
          item.descricao_item
        }</span>
                            <span class="avaliacao-badge ${(
                              item.avaliacao || ""
                            ).toLowerCase()}">${item.avaliacao || "N/A"}</span>
                        </p>`;

        const anexosGeraisDoItem = anexos.filter(
          (a) =>
            a.item_resposta_id === item.resposta_id && !a.item_especificacao_id
        );

        html += `<div class="checklist-item-details">`;
        if (item.observacao_item) {
          html += `<p class="item-observation">${item.observacao_item}</p>`;
        }
        if (anexosGeraisDoItem.length > 0) {
          html += renderAnexos(anexosGeraisDoItem, "Anexos Gerais do Item");
        }

        if (item.especificacoes && item.especificacoes.length > 0) {
          item.especificacoes.forEach((spec) => {
            const anexosDaEspecificacao = anexos.filter(
              (a) => a.item_especificacao_id === spec.id
            );
            html += `<div class="especificacao-block">
                        <div class="especificacao-block-content">
                            <p><strong>Equipamento Específico:</strong> ${
                              spec.descricao_equipamento
                            }</p>
                            ${
                              spec.observacao
                                ? `<p><strong>Obs:</strong> ${spec.observacao}</p>`
                                : ""
                            }
                            ${renderAnexos(anexosDaEspecificacao)}
                        </div>
                        <button class="btn btn-sm btn-add-termografia" title="Adicionar Termografia para ${
                          spec.descricao_equipamento
                        }" data-inspecao-id="${inspecaoId}" data-item-id="${
              item.item_checklist_id
            }" data-especificacao-id="${spec.id}" data-item-desc="${
              spec.descricao_equipamento
            }">
                            <span class="material-symbols-outlined">local_fire_department</span>
                        </button>
                     </div>`;
          });
        }
        html += `</div></div>`;
        html += `<div class="checklist-item-actions">
                    <button class="btn btn-sm btn-add-termografia" title="Adicionar Termografia para o item geral" data-inspecao-id="${inspecaoId}" data-item-id="${item.item_checklist_id}" data-item-desc="${item.descricao_item}">
                        <span class="material-symbols-outlined">local_fire_department</span>
                    </button>
                 </div></div>`;
      });
      html += `</div>`;
    });
    html += `</div></div>`;
    checklistItemsContainer.innerHTML = html;
  }

  function renderAvulsaItems(inspecaoCompleta) {
    const { itens_avulsos } = inspecaoCompleta;
    let html = `<div class="detail-card"><h2 class="detail-card-header"><span class="material-symbols-outlined">article</span>Itens da Inspeção Avulsa</h2><div class="detail-card-body">`;
    if (!itens_avulsos || itens_avulsos.length === 0) {
      html += "<p>Nenhum item avulso registrado para esta inspeção.</p>";
    } else {
      itens_avulsos.forEach((item) => {
        html += `
                <div class="avulsa-item-card">
                    <div class="avulsa-item-header">
                        <div class="avulsa-item-header-info">
                            <p class="avulso-equipamento-tag">${
                              item.equipamento
                            } <span class="tag">(${item.tag})</span></p>
                        </div>
                        <span class="avulsa-condicao-badge ${(
                          item.condicao || ""
                        ).toLowerCase()}">${item.condicao || "N/A"}</span>
                    </div>
                    <div class="avulsa-item-body">
                        <p>${item.descricao}</p>
                        ${renderAnexos(item.anexos)}
                    </div>
                </div>
            `;
      });
    }
    html += `</div></div>`;
    avulsaItemsContainer.innerHTML = html;
  }

  function renderRegistrosDinamicos(
    registros,
    todosAnexos,
    container,
    categoria,
    titulo,
    icone
  ) {
    const registrosFiltrados = registros.filter(
      (r) => r.categoria_registro === categoria
    );
    if (registrosFiltrados.length === 0) {
      container.innerHTML = "";
      return;
    }
    let html = `<div class="detail-card"><h2 class="detail-card-header"><span class="material-symbols-outlined">${icone}</span>${titulo}</h2><div class="detail-card-body">`;
    registrosFiltrados.forEach((reg) => {
      html += `<div class="registro-item-block">`;
      if (reg.tipo_especifico)
        html += `<p><strong>Tipo:</strong> ${reg.tipo_especifico.replace(
          /_/g,
          " "
        )}</p>`;
      if (reg.tag_equipamento)
        html += `<p><strong>TAG:</strong> ${reg.tag_equipamento}</p>`;
      if (reg.valor_texto)
        html += `<p><strong>Valor:</strong> ${reg.valor_texto} ${
          reg.unidade_medida || ""
        }</p>`;
      if (reg.descricao_item)
        html += `<p><strong>Observação:</strong> ${reg.descricao_item}</p>`;
      const anexosDoRegistro = todosAnexos.filter(
        (a) => a.registro_id === reg.id
      );
      html += renderAnexos(anexosDoRegistro);
      html += `</div>`;
    });
    html += `</div></div>`;
    container.innerHTML = html;
  }

  function renderAnexosContainer(anexos, container, categoria, titulo, icone) {
    const anexosFiltrados = anexos.filter(
      (a) => a.categoria_anexo === categoria
    );
    if (anexosFiltrados.length === 0) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = `
      <div class="detail-card">
        <h2 class="detail-card-header">
          <span class="material-symbols-outlined">${icone}</span>
          ${titulo}
        </h2>
        <div class="detail-card-body">
          ${renderAnexos(anexosFiltrados)}
        </div>
      </div>`;
  }

  function renderizarDetalhes(inspecaoCompleta) {
    const { anexos, modo_inspecao, ...inspecaoInfo } = inspecaoCompleta;

    if (inspecaoIdTitulo) {
      inspecaoIdTitulo.textContent = `#${
        inspecaoInfo.formulario_inspecao_num || inspecaoInfo.id
      }`;
    }

    renderInfoGerais(inspecaoInfo);
    renderObsGerais(inspecaoInfo.observacoes_gerais);

    if (modo_inspecao && modo_inspecao.toUpperCase() === "AVULSA") {
      renderAvulsaItems(inspecaoCompleta);
      checklistItemsContainer.innerHTML = "";
      medicoesContainer.innerHTML = "";
      equipamentosObservadosContainer.innerHTML = "";
    } else {
      renderChecklist(inspecaoCompleta);
      renderRegistrosDinamicos(
        inspecaoCompleta.registros,
        anexos,
        medicoesContainer,
        "MEDICAO",
        "Medições de Equipamentos",
        "rule"
      );
      renderRegistrosDinamicos(
        inspecaoCompleta.registros,
        anexos,
        equipamentosObservadosContainer,
        "EQUIPAMENTO_OBSERVADO",
        "Equipamentos Observados",
        "visibility"
      );
      avulsaItemsContainer.innerHTML = "";
    }

    renderAnexosContainer(
      anexos,
      anexosGeraisContainer,
      "INSPECAO_GERAL",
      "Anexos Gerais da Inspeção",
      "attach_file"
    );
    renderAnexosContainer(
      anexos,
      anexosEscritorioContainer,
      "ESCRITORIO",
      "Anexos de Escritório",
      "folder_managed"
    );

    detalhesContainer
      .querySelectorAll(".anexo-item[data-src]")
      .forEach((img) => {
        img.addEventListener("click", () => showLightbox(img.dataset.src));
      });

    detalhesContainer.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-add-termografia");
      if (btn) {
        const { inspecaoId, itemId, itemDesc, especificacaoId } = btn.dataset;
        abrirModalTermografia(inspecaoId, itemId, itemDesc, especificacaoId);
      }
    });
  }

  async function carregarDetalhes() {
    const inspecaoId = getInspecaoIdFromUrl();
    if (!inspecaoId) {
      loadingIndicator.classList.add("hidden");
      erroCarregamento.textContent = "ID da inspeção não encontrado na URL.";
      erroCarregamento.classList.remove("hidden");
      return;
    }

    try {
      const inspecaoCompleta = await fetchData(
        `/inspecoes-subestacoes/${inspecaoId}`
      );
      renderizarDetalhes(inspecaoCompleta);
      loadingIndicator.classList.add("hidden");
      detalhesContainer.classList.remove("hidden");
    } catch (error) {
      loadingIndicator.classList.add("hidden");
      erroCarregamento.textContent = `Erro ao carregar detalhes: ${error.message}`;
      erroCarregamento.classList.remove("hidden");
    }
  }

  function abrirModalTermografia(
    inspecaoId,
    itemId,
    itemDesc,
    especificacaoId = null
  ) {
    termografiaFilesToUpload = [];
    document.getElementById("termografiaInspecaoId").value = inspecaoId;
    document.getElementById("termografiaItemId").value = itemId;
    document.getElementById("termografiaEspecificacaoId").value =
      especificacaoId || "";
    document.getElementById("termografiaItemDescricao").textContent = itemDesc;
    previewAnexosTermografia.innerHTML = "";
    modalTermografia.classList.add("show");
  }

  function renderTermografiaPreviews() {
    previewAnexosTermografia.innerHTML = "";
    termografiaFilesToUpload.forEach((anexo, index) => {
      const clone = templateAnexoPreview.content.cloneNode(true);
      const anexoEl = clone.querySelector(".anexo-preview-item");

      const imgPreview = anexoEl.querySelector(".anexo-preview-img");
      const iconDefault = anexoEl.querySelector(".anexo-preview-icon-default");
      const nameEl = anexoEl.querySelector(".anexo-name");
      const statusEl = anexoEl.querySelector(".anexo-status");
      const removeBtn = anexoEl.querySelector(".btn-remover-anexo");

      nameEl.textContent = anexo.originalName;
      imgPreview.src = anexo.previewUrl;
      imgPreview.classList.remove("visually-hidden");
      iconDefault.classList.add("visually-hidden");

      if (anexo.status === "uploading") {
        statusEl.innerHTML =
          '<div class="loading-spinner-small"></div> Carregando...';
        removeBtn.disabled = true;
      } else if (anexo.status === "error") {
        statusEl.textContent = "Falha";
        statusEl.style.color = "red";
        removeBtn.disabled = false;
      } else {
        statusEl.textContent = "Concluído";
        statusEl.style.color = "green";
        removeBtn.disabled = false;
      }

      removeBtn.addEventListener("click", () => {
        termografiaFilesToUpload.splice(index, 1);
        URL.revokeObjectURL(anexo.previewUrl);
        renderTermografiaPreviews();
      });
      previewAnexosTermografia.appendChild(anexoEl);
    });
  }

  btnAdicionarAnexoTermografia.addEventListener("click", () =>
    arquivosTermografiaInput.click()
  );

  arquivosTermografiaInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = "";

    const newAttachments = files.map((file) => ({
      file,
      originalName: file.name,
      previewUrl: URL.createObjectURL(file),
      status: "uploading",
    }));

    termografiaFilesToUpload.push(...newAttachments);
    renderTermografiaPreviews();

    for (const anexo of newAttachments) {
      try {
        const result = await uploadFile(anexo.file);
        anexo.status = "uploaded";
        anexo.tempFileName = result.tempFileName;
      } catch (error) {
        anexo.status = "error";
      }
      renderTermografiaPreviews();
    }
  });

  btnSalvarAnexosTermografia.addEventListener("click", async () => {
    const inspecaoId = document.getElementById("termografiaInspecaoId").value;
    const itemId = document.getElementById("termografiaItemId").value;
    const especificacaoId = document.getElementById(
      "termografiaEspecificacaoId"
    ).value;

    const uploadedFiles = termografiaFilesToUpload.filter(
      (f) => f.status === "uploaded"
    );
    if (uploadedFiles.length === 0) {
      alert(
        "Nenhum arquivo foi carregado com sucesso. Por favor, tente novamente."
      );
      return;
    }

    const payload = {
      anexos: uploadedFiles.map((f) => ({
        tempFileName: f.tempFileName,
        originalName: f.originalName,
      })),
    };

    if (especificacaoId) {
      payload.item_especificacao_id = especificacaoId;
    }

    btnSalvarAnexosTermografia.disabled = true;
    btnSalvarAnexosTermografia.innerHTML = "Salvando...";

    try {
      await fetchData(
        `/inspecoes-subestacoes/${inspecaoId}/item/${itemId}/anexos-termografia`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      alert("Anexos de termografia salvos com sucesso!");
      modalTermografia.classList.remove("show");
      carregarDetalhes();
    } catch (error) {
      alert(`Falha ao salvar anexos: ${error.message}`);
    } finally {
      btnSalvarAnexosTermografia.disabled = false;
      btnSalvarAnexosTermografia.innerHTML =
        '<span class="material-symbols-outlined">save</span> Salvar Anexos';
    }
  });

  modalTermografia
    .querySelectorAll(".btn-close, .btn-close-modal")
    .forEach((btn) => {
      btn.addEventListener("click", () =>
        modalTermografia.classList.remove("show")
      );
    });

  if (btnImprimir) {
    btnImprimir.addEventListener("click", () => window.print());
  }

  carregarDetalhes();
});
