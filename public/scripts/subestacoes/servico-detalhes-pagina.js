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

  const btnEditarServicoPagina = document.getElementById(
    "btnEditarServicoPagina"
  );
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

  let servicoIdAtual = null;

  function getServicoIdFromUrl() {
    const pathParts = window.location.pathname.split("/");
    const id = pathParts[pathParts.length - 2];
    if (id && !isNaN(parseInt(id))) {
      return parseInt(id);
    }
    console.error(
      "Não foi possível extrair o ID do serviço da URL:",
      window.location.pathname
    );
    return null;
  }

  async function fetchData(url, options = {}) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        if (response.status === 403) {
          const errorData = await response
            .json()
            .catch(() => ({ message: "Acesso negado." }));
          throw {
            status: 403,
            message: errorData.message || "Acesso negado a este recurso.",
          };
        }
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
    servicoIdAtual = getServicoIdFromUrl();
    if (!servicoIdAtual) {
      loadingIndicator.classList.add("d-none");
      erroCarregamento.textContent = "ID do serviço não encontrado na URL.";
      erroCarregamento.classList.remove("d-none");
      if (btnEditarServicoPagina) btnEditarServicoPagina.disabled = true;
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

      if (servico.status === "CONCLUIDO") {
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
      } else {
        secaoDetalhesConclusao.classList.add("d-none");
      }

      if (listaAnexosServicoPagina && secaoAnexosServico) {
        listaAnexosServicoPagina.innerHTML = "";
        const anexosGerais = servico.anexos.filter(
          (anx) => anx.categoria_anexo !== "ANEXO_CONCLUSAO"
        );

        if (anexosGerais && anexosGerais.length > 0) {
          anexosGerais.forEach((anexo) => {
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

      renderizarItensDeEscopo(
        servico.itens_escopo || [],
        servico.inspecoes_vinculadas || []
      );

      loadingIndicator.classList.add("d-none");
      conteudoDetalhesServico.classList.remove("d-none");
      if (btnEditarServicoPagina) btnEditarServicoPagina.disabled = false;
    } catch (error) {
      loadingIndicator.classList.add("d-none");
      if (error.status === 403) {
        erroCarregamento.textContent =
          error.message || "Acesso negado a este serviço.";
      } else {
        erroCarregamento.textContent = `Erro ao carregar detalhes do serviço: ${
          error.message || "Erro desconhecido"
        }`;
      }
      erroCarregamento.classList.remove("d-none");
      if (btnEditarServicoPagina) btnEditarServicoPagina.disabled = true;
    }
  }

  function renderizarItensDeEscopo(itensEscopo, inspecoesVinculadas) {
    if (!containerItensEscopo || !secaoItensEscopo) return;

    containerItensEscopo.innerHTML = "";

    if (itensEscopo.length === 0) {
      secaoItensEscopo.classList.add("d-none");
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
        "_",
        " "
      );

      let origemHtml = "";
      if (item.inspecao_item_id) {
        origemHtml = `<div class="item-origin">Origem: Inspeção #${
          item.origem_inspecao_formulario_num || item.origem_inspecao_id
        } - Item ${item.inspecao_item_num}</div>`;
      }

      let equipamentosHtml = "";
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
      } else {
        equipamentosHtml = "<span>Nenhum</span>";
      }

      let fotosHtml = "";
      const inspecaoOrigem = inspecoesVinculadas.find(
        (insp) => insp.inspecao_id === item.origem_inspecao_id
      );
      if (inspecaoOrigem && inspecaoOrigem.anexos_itens_inspecao) {
        const anexosDoItem = inspecaoOrigem.anexos_itens_inspecao.filter(
          (anx) => anx.item_num_associado == item.inspecao_item_num
        );
        if (anexosDoItem.length > 0) {
          fotosHtml =
            '<p class="mt-2 mb-1"><strong>Evidências da Inspeção:</strong></p><div class="d-flex flex-wrap gap-2 item-photos-container">';
          anexosDoItem.forEach((anexo) => {
            fotosHtml += `<img src="${anexo.caminho_servidor}" alt="${anexo.nome_original}" data-src="${anexo.caminho_servidor}" title="${anexo.nome_original}" />`;
          });
          fotosHtml += "</div>";
        }
      }

      itemCard.innerHTML = `
            <div class="item-description">${item.descricao_item_servico}</div>
            ${origemHtml}
            ${
              item.observacao_especifica_servico
                ? `<p class="small text-muted mt-1 mb-2"><em>Obs. Serviço: ${item.observacao_especifica_servico}</em></p>`
                : ""
            }
            <div class="item-details-grid">
                <div class="item-supervisor">
                    <strong>Encarregado:</strong>
                    <span>${
                      item.encarregado_item_nome || "Nenhum designado"
                    }</span>
                </div>
                <div class="item-status">
                    <strong>Status do Item:</strong>
                    <span class="status-badge status-${statusClasse}">${statusTexto}</span>
                </div>
                <div class="item-equipment">
                    <strong>Equipamentos Associados:</strong>
                    <div>${equipamentosHtml}</div>
                </div>
            </div>
            ${fotosHtml}
        `;

      itemCard.querySelectorAll(".item-photos-container img").forEach((img) => {
        img.addEventListener("click", () => openImageLightbox(img.dataset.src));
      });

      containerItensEscopo.appendChild(itemCard);
    });
  }

  if (btnEditarServicoPagina) {
    btnEditarServicoPagina.addEventListener("click", () => {
      if (servicoIdAtual) {
        window.location.href = `/registrar-servico-subestacao?editarId=${servicoIdAtual}`;
      }
    });
  }

  if (btnImprimirPagina) {
    btnImprimirPagina.addEventListener("click", () => {
      window.print();
    });
  }

  carregarDetalhesDoServico();
});
