document.addEventListener("DOMContentLoaded", () => {
  const servicoIdTitulo = document.getElementById("servicoIdTitulo");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const conteudoDetalhesServico = document.getElementById(
    "conteudoDetalhesServico"
  );
  const erroCarregamento = document.getElementById("erroCarregamento");

  const detalheProcesso = document.getElementById("detalheProcesso");
  const detalheSubestacao = document.getElementById("detalheSubestacao");
  const detalheTipoOrdem = document.getElementById("detalheTipoOrdem");
  const detalheStatus = document.getElementById("detalheStatus");
  const detalheMotivo = document.getElementById("detalheMotivo");
  const detalheResponsavel = document.getElementById("detalheResponsavel");
  const detalheDataPrevista = document.getElementById("detalheDataPrevista");
  const detalheHorarioPrevisto = document.getElementById(
    "detalheHorarioPrevisto"
  );

  const secaoDetalhesConclusao = document.getElementById(
    "secaoDetalhesConclusao"
  );
  const detalheDataConclusao = document.getElementById("detalheDataConclusao");
  const detalheHoraConclusao = document.getElementById("detalheHoraConclusao");
  const detalheObsConclusao = document.getElementById("detalheObsConclusao");

  const secaoAnexosServico = document.getElementById("secaoAnexosServico");
  const listaAnexosServicoPagina = document.getElementById(
    "listaAnexosServicoPagina"
  );

  const secaoItensEscopo = document.getElementById("secaoItensEscopo");
  const containerItensEscopo = document.getElementById("containerItensEscopo");

  const btnImprimirPagina = document.getElementById("btnImprimirPagina");

  const imageLightboxDetalhesEl = document.getElementById(
    "imageLightboxDetalhes"
  );
  const lightboxImageDetalhesContent = document.getElementById(
    "lightboxImageDetalhesContent"
  );
  let bsImageLightboxDetalhes = null;
  if (imageLightboxDetalhesEl) {
    bsImageLightboxDetalhes = new bootstrap.Modal(imageLightboxDetalhesEl);
  }

  function getServicoIdFromUrl() {
    const pathParts = window.location.pathname.split("/");
    const id = pathParts[pathParts.length - 2];
    if (id && !isNaN(parseInt(id))) {
      return parseInt(id);
    }
    return null;
  }

  async function fetchData(url, options = {}) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: `Erro HTTP: ${response.status}` }));
        throw new Error(
          errorData.message || `Erro HTTP: ${response.status} em ${url}`
        );
      }
      return response.status === 204 ? null : await response.json();
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      throw error;
    }
  }

  function getIconForFileType(fileName) {
    const extension = fileName.split(".").pop().toLowerCase();
    if (
      ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"].includes(extension)
    )
      return "image";
    if (extension === "pdf") return "picture_as_pdf";
    if (["doc", "docx"].includes(extension)) return "article";
    if (["xls", "xlsx", "csv"].includes(extension)) return "assessment";
    return "draft";
  }

  function formatarDataSimples(dataISO) {
    if (!dataISO) return "Não informado";
    const dataObj = new Date(
      dataISO.includes("T") ? dataISO : dataISO + "T00:00:00Z"
    );
    if (isNaN(dataObj.getTime())) return "Data inválida";
    return dataObj.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  }

  function formatarDataHora(dataISO) {
    if (!dataISO) return "Não informado";
    const dataObj = new Date(dataISO);
    if (isNaN(dataObj.getTime())) return "Data inválida";
    return dataObj.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }

  function formatarHoraSimples(hora) {
    if (!hora) return "";
    if (typeof hora === "string" && hora.includes(":")) {
      return hora.substring(0, 5);
    }
    return "Não informado";
  }

  function openImageLightbox(imageUrl) {
    if (lightboxImageDetalhesContent && bsImageLightboxDetalhes) {
      lightboxImageDetalhesContent.src = imageUrl;
      bsImageLightboxDetalhes.show();
    }
  }

  function createAnexoCard(anexo) {
    const cardDiv = document.createElement("a");
    cardDiv.className = "anexo-preview-card text-decoration-none";
    cardDiv.href = anexo.caminho_servidor;
    cardDiv.target = "_blank";
    cardDiv.title = `Abrir ${anexo.nome_original}`;

    const iconName = getIconForFileType(anexo.nome_original);
    let thumbnailHtml = `<span class="material-symbols-outlined">${iconName}</span>`;

    if (iconName === "image") {
      thumbnailHtml = `<img src="${anexo.caminho_servidor}" alt="Preview de ${anexo.nome_original}" />`;
      cardDiv.addEventListener("click", (e) => {
        e.preventDefault();
        openImageLightbox(anexo.caminho_servidor);
      });
    }

    cardDiv.innerHTML = `
      <div class="anexo-thumbnail">${thumbnailHtml}</div>
      <div class="anexo-info">
          <div class="file-name text-decoration-underline">${anexo.nome_original}</div>
      </div>
    `;
    return cardDiv;
  }

  async function carregarDetalhesDoServico() {
    const servicoIdAtual = getServicoIdFromUrl();
    if (!servicoIdAtual) {
      loadingIndicator.classList.add("d-none");
      erroCarregamento.textContent = "ID do serviço não encontrado na URL.";
      erroCarregamento.classList.remove("d-none");
      return;
    }

    if (servicoIdTitulo) servicoIdTitulo.textContent = `#${servicoIdAtual}`;
    loadingIndicator.classList.remove("d-none");
    conteudoDetalhesServico.classList.add("d-none");
    erroCarregamento.classList.add("d-none");

    try {
      const servico = await fetchData(
        `/api/servicos-subestacoes/${servicoIdAtual}`
      );

      if (servicoIdTitulo)
        servicoIdTitulo.textContent = `Nº ${servico.processo || servico.id}`;
      if (detalheProcesso)
        detalheProcesso.textContent = servico.processo || "Não informado";
      if (detalheSubestacao)
        detalheSubestacao.textContent = `${servico.subestacao_sigla || ""} - ${
          servico.subestacao_nome || "Não informado"
        }`;
      if (detalheTipoOrdem)
        detalheTipoOrdem.textContent = servico.tipo_ordem || "Não informado";
      if (detalheStatus) {
        const statusClasseBase = (
          servico.status || "desconhecido"
        ).toLowerCase();
        const statusClasseFinal = statusClasseBase.replace(/_/g, "");
        const statusTextoDisplay = (servico.status || "DESCONHECIDO").replace(
          "_",
          " "
        );
        detalheStatus.innerHTML = `<span class="status-badge status-${statusClasseFinal}">${statusTextoDisplay}</span>`;
      }
      if (detalheMotivo)
        detalheMotivo.textContent = servico.motivo || "Não informado";
      if (detalheResponsavel)
        detalheResponsavel.textContent =
          servico.responsavel_nome || "Não informado";
      if (detalheDataPrevista)
        detalheDataPrevista.textContent = formatarDataSimples(
          servico.data_prevista
        );
      if (detalheHorarioPrevisto)
        detalheHorarioPrevisto.textContent = `${formatarHoraSimples(
          servico.horario_inicio
        )} às ${formatarHoraSimples(servico.horario_fim)}`;

      if (detalheDataConclusao)
        detalheDataConclusao.textContent = formatarDataSimples(
          servico.data_conclusao
        );
      if (detalheHoraConclusao)
        detalheHoraConclusao.textContent = formatarHoraSimples(
          servico.horario_fim
        );
      if (detalheObsConclusao)
        detalheObsConclusao.textContent =
          servico.observacoes_conclusao || "Nenhuma";
      secaoDetalhesConclusao.classList.remove("d-none");

      if (listaAnexosServicoPagina && secaoAnexosServico) {
        listaAnexosServicoPagina.innerHTML = "";
        if (servico.anexos && servico.anexos.length > 0) {
          servico.anexos.forEach((anexo) => {
            const card = createAnexoCard(anexo);
            listaAnexosServicoPagina.appendChild(card);
          });
          secaoAnexosServico.classList.remove("d-none");
        } else {
          listaAnexosServicoPagina.innerHTML =
            "<p class='text-muted'>Nenhum anexo geral para este serviço.</p>";
          secaoAnexosServico.classList.remove("d-none");
        }
      }

      renderizarItensDeEscopo(servico.itens_escopo || []);

      loadingIndicator.classList.add("d-none");
      conteudoDetalhesServico.classList.remove("d-none");
    } catch (error) {
      loadingIndicator.classList.add("d-none");
      erroCarregamento.textContent = `Erro ao carregar detalhes do serviço: ${
        error.message || "Erro desconhecido"
      }`;
      erroCarregamento.classList.remove("d-none");
    }
  }

  function renderizarItensDeEscopo(itensEscopo) {
    if (!containerItensEscopo || !secaoItensEscopo) return;
    containerItensEscopo.innerHTML = "";
    if (itensEscopo.length === 0) {
      containerItensEscopo.innerHTML =
        "<p class='text-muted'>Este serviço não possui itens de escopo detalhados.</p>";
      secaoItensEscopo.classList.remove("d-none");
      return;
    }
    secaoItensEscopo.classList.remove("d-none");

    itensEscopo.forEach((item) => {
      const itemCard = document.createElement("div");
      itemCard.className = "service-item-card";

      const statusClasse = (item.status_item_escopo || "pendente")
        .toLowerCase()
        .replace("_", "");
      const statusTexto = (item.status_item_escopo || "PENDENTE").replace(
        /_/g,
        " "
      );
      const dataConclusaoItemFmt = formatarDataHora(item.data_conclusao_item);

      let origemHtml = item.inspecao_item_id
        ? `<div class="item-origin">Origem: Inspeção #${
            item.origem_inspecao_formulario_num || item.origem_inspecao_id
          } - Item ${item.inspecao_item_num}</div>`
        : '<div class="item-origin">Origem: Serviço Avulso</div>';

      let equipamentosHtml = "<span>Nenhum</span>";
      if (
        item.equipamentos_associados &&
        item.equipamentos_associados.length > 0
      ) {
        equipamentosHtml = item.equipamentos_associados
          .map(
            (eq) =>
              `<span class="badge bg-secondary me-1">${
                eq.tag || "ID " + eq.equipamento_id
              }</span>`
          )
          .join("");
      }

      let anexosConclusaoItemHtml = "";
      if (item.anexos_conclusao && item.anexos_conclusao.length > 0) {
        anexosConclusaoItemHtml =
          '<p class="mt-2 mb-1"><strong>Anexos de Conclusão do Item:</strong></p><div class="d-flex flex-wrap gap-2 item-photos-container">';
        item.anexos_conclusao.forEach((anexo) => {
          anexosConclusaoItemHtml += `<img src="${anexo.caminho_servidor}" alt="${anexo.nome_original}" data-src="${anexo.caminho_servidor}" title="${anexo.nome_original}" />`;
        });
        anexosConclusaoItemHtml += "</div>";
      }

      itemCard.innerHTML = `
            <div class="item-description">${item.descricao_item_servico}</div>
            ${origemHtml}
            ${
              item.observacao_especifica_servico
                ? `<p class="small text-muted mt-1 mb-2"><em>Obs. Serviço: ${item.observacao_especifica_servico}</em></p>`
                : ""
            }
            <div class="item-details-grid mt-3">
                <div class="item-supervisor"><strong>Encarregado:</strong><span>${
                  item.encarregado_item_nome || "N/A"
                }</span></div>
                <div class="item-status"><strong>Status do Item:</strong><span class="status-badge status-${statusClasse}">${statusTexto}</span></div>
                <div class="item-equipment"><strong>Equipamentos:</strong><div>${equipamentosHtml}</div></div>
                <div class="item-conclusion-date"><strong>Data Conclusão do Item:</strong><span>${dataConclusaoItemFmt}</span></div>
            </div>
            ${
              item.observacoes_conclusao_item
                ? `<div class="mt-2"><p class="mb-1"><strong>Observações de Conclusão do Item:</strong></p><p class="small fst-italic bg-light p-2 rounded">${item.observacoes_conclusao_item}</p></div>`
                : ""
            }
            ${anexosConclusaoItemHtml}
        `;

      itemCard.querySelectorAll(".item-photos-container img").forEach((img) => {
        img.addEventListener("click", () => openImageLightbox(img.dataset.src));
      });

      containerItensEscopo.appendChild(itemCard);
    });
  }

  if (btnImprimirPagina) {
    btnImprimirPagina.addEventListener("click", () => {
      window.print();
    });
  }

  carregarDetalhesDoServico();
});
