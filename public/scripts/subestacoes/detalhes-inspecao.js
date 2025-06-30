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
  lightboxCloseBtn.addEventListener("click", hideLightbox);

  async function fetchData(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: `Erro HTTP: ${response.status}` }));
        throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      throw error;
    }
  }

  function renderAnexos(anexos, title) {
    if (!anexos || anexos.length === 0) return "";

    let anexosHtml = title ? `<h4 class="anexos-title">${title}</h4>` : "";
    anexosHtml += `<div class="anexos-container">`;

    anexos.forEach((anexo) => {
      if (!anexo || !anexo.caminho_servidor) return;

      const isImage = anexo.tipo_mime && anexo.tipo_mime.startsWith("image/");
      const anexoTitle = anexo.descricao_anexo || anexo.nome_original;

      if (isImage) {
        anexosHtml += `
          <div class="anexo-item" data-src="${anexo.caminho_servidor}" title="${anexoTitle}">
            <img src="${anexo.caminho_servidor}" alt="${anexo.nome_original}">
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
            <div class="info-item">
              <strong>Nº Formulário:</strong>
              <p>${inspecaoInfo.formulario_inspecao_num || inspecaoInfo.id}</p>
            </div>
            <div class="info-item">
              <strong>Processo:</strong>
              <p>${inspecaoInfo.processo || "N/A"}</p>
            </div>
            <div class="info-item">
              <strong>Subestação:</strong>
              <p>${inspecaoInfo.subestacao_sigla} - ${
      inspecaoInfo.subestacao_nome
    }</p>
            </div>
            <div class="info-item">
              <strong>Responsável:</strong>
              <p>${inspecaoInfo.responsavel_nome}</p>
            </div>
            <div class="info-item">
              <strong>Data Avaliação:</strong>
              <p>${inspecaoInfo.data_avaliacao_fmt}</p>
            </div>
            <div class="info-item">
              <strong>Horário:</strong>
              <p>${inspecaoInfo.hora_inicial.substring(0, 5)} ${
      inspecaoInfo.hora_final
        ? " às " + inspecaoInfo.hora_final.substring(0, 5)
        : ""
    }</p>
            </div>
            <div class="info-item">
              <strong>Status:</strong>
              <p><span class="status-badge status-${statusClasse}">${statusTexto}</span></p>
            </div>
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

  function renderChecklist(itens, todosAnexos) {
    const gruposDeItens = itens.reduce((acc, item) => {
      const grupo = item.nome_grupo || "Itens Diversos";
      (acc[grupo] = acc[grupo] || []).push(item);
      return acc;
    }, {});

    let html = `
      <div class="detail-card">
        <h2 class="detail-card-header">
          <span class="material-symbols-outlined">checklist</span>
          Itens do Checklist
        </h2>
        <div class="detail-card-body">`;

    let itemCounter = 1;
    Object.entries(gruposDeItens).forEach(([grupoNome, itensDoGrupo]) => {
      html += `<div class="checklist-group">
                 <h3 class="checklist-group-header">${grupoNome}</h3>`;
      itensDoGrupo.forEach((item) => {
        html += `
          <div class="checklist-item">
            <p class="checklist-item-header">
              ${itemCounter++}. ${item.descricao_item}
              <span class="avaliacao-badge ${item.avaliacao.toLowerCase()}">${
          item.avaliacao
        }</span>
            </p>`;

        if (item.observacao_item) {
          html += `<p class="item-observation">${item.observacao_item}</p>`;
        }

        const anexosGeraisDoItem = todosAnexos.filter(
          (a) =>
            a.item_resposta_id === item.resposta_id &&
            !a.item_especificacao_id &&
            a.categoria_anexo === "ITEM_ANEXO"
        );
        html += renderAnexos(anexosGeraisDoItem);

        if (item.especificacoes && item.especificacoes.length > 0) {
          item.especificacoes.forEach((spec) => {
            const anexosDaEspecificacao = todosAnexos.filter(
              (a) => a.item_especificacao_id === spec.id
            );
            html += `
              <div class="especificacao-block">
                <p><strong>Equipamento Específico:</strong> ${
                  spec.descricao_equipamento
                }</p>
                ${
                  spec.observacao
                    ? `<p><strong>Obs:</strong> ${spec.observacao}</p>`
                    : ""
                }
                ${renderAnexos(anexosDaEspecificacao)}
              </div>`;
          });
        }
        html += `</div>`;
      });
      html += `</div>`;
    });

    html += `</div></div>`;
    checklistItemsContainer.innerHTML = html;
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

    let html = `
      <div class="detail-card">
        <h2 class="detail-card-header">
          <span class="material-symbols-outlined">${icone}</span>
          ${titulo}
        </h2>
        <div class="detail-card-body">`;

    registrosFiltrados.forEach((reg) => {
      html += `<div class="registro-item-block">`;
      if (reg.tipo_especifico) {
        html += `<p><strong>Tipo:</strong> ${reg.tipo_especifico.replace(
          /_/g,
          " "
        )}</p>`;
      }
      if (reg.tag_equipamento) {
        html += `<p><strong>TAG:</strong> ${reg.tag_equipamento}</p>`;
      }
      if (reg.valor_texto) {
        html += `<p><strong>Valor:</strong> ${reg.valor_texto} ${
          reg.unidade_medida || ""
        }</p>`;
      }
      if (reg.descricao_item) {
        html += `<p><strong>Observação:</strong> ${reg.descricao_item}</p>`;
      }

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
    const { itens, registros, anexos, ...inspecaoInfo } = inspecaoCompleta;

    if (inspecaoIdTitulo) {
      inspecaoIdTitulo.textContent = `#${
        inspecaoInfo.formulario_inspecao_num || inspecaoInfo.id
      }`;
    }

    renderInfoGerais(inspecaoInfo);
    renderObsGerais(inspecaoInfo.observacoes_gerais);
    renderChecklist(itens, anexos);
    renderRegistrosDinamicos(
      registros,
      anexos,
      medicoesContainer,
      "MEDICAO",
      "Medições de Equipamentos",
      "rule"
    );
    renderRegistrosDinamicos(
      registros,
      anexos,
      equipamentosObservadosContainer,
      "EQUIPAMENTO_OBSERVADO",
      "Equipamentos Observados",
      "visibility"
    );
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

  if (btnImprimir) {
    btnImprimir.addEventListener("click", () => window.print());
  }

  carregarDetalhes();
});
