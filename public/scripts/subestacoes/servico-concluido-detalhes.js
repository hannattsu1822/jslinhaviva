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
  const detalhePrioridade = document.getElementById("detalhePrioridade");
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
  const lightboxCloseBtn = imageLightboxDetalhesEl.querySelector(
    ".btn-close-lightbox"
  );

  let servicoIdAtual = null;

  function getServicoIdFromUrl() {
    const pathParts = window.location.pathname.split("/");
    const id = pathParts[pathParts.length - 2];
    if (id && !isNaN(parseInt(id))) {
      return parseInt(id);
    }
    return null;
  }

  function openImageLightbox(imageUrl) {
    if (lightboxImageDetalhesContent && imageLightboxDetalhesEl) {
      lightboxImageDetalhesContent.src = imageUrl;
      imageLightboxDetalhesEl.classList.remove("hidden");
    }
  }

  function hideLightbox() {
    if (imageLightboxDetalhesEl) {
      imageLightboxDetalhesEl.classList.add("hidden");
    }
  }

  if (imageLightboxDetalhesEl) {
    imageLightboxDetalhesEl.addEventListener("click", (e) => {
      if (e.target === imageLightboxDetalhesEl) {
        hideLightbox();
      }
    });
  }
  if (lightboxCloseBtn) {
    lightboxCloseBtn.addEventListener("click", hideLightbox);
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

  function createAnexoCard(anexo) {
    const cardLink = document.createElement("a");
    cardLink.className = "anexo-preview-card";
    cardLink.href = anexo.caminho_servidor;
    cardLink.target = "_blank";
    cardLink.title = `Abrir ${anexo.nome_original}`;

    const isImage = anexo.tipo_mime && anexo.tipo_mime.startsWith("image/");

    let thumbnailHtml = `<span class="material-symbols-outlined file-icon">description</span>`;
    if (isImage) {
      thumbnailHtml = `<img src="${anexo.caminho_servidor}" alt="Preview de ${anexo.nome_original}" class="anexo-preview-img" />`;
      cardLink.addEventListener("click", (e) => {
        e.preventDefault();
        openImageLightbox(anexo.caminho_servidor);
      });
    }

    cardLink.innerHTML = `
      <div class="anexo-thumbnail">${thumbnailHtml}</div>
      <div class="file-info">
          <span class="file-name">${anexo.nome_original}</span>
      </div>
    `;
    return cardLink;
  }

  async function carregarDetalhesDoServico() {
    const servicoIdAtual = getServicoIdFromUrl();
    if (!servicoIdAtual) {
      loadingIndicator.classList.add("hidden");
      erroCarregamento.textContent = "ID do serviço não encontrado na URL.";
      erroCarregamento.classList.remove("hidden");
      return;
    }

    if (servicoIdTitulo) servicoIdTitulo.textContent = `#${servicoIdAtual}`;
    loadingIndicator.classList.remove("hidden");
    conteudoDetalhesServico.classList.add("hidden");
    erroCarregamento.classList.add("hidden");

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
        const statusCls = (servico.status || "desconhecido").toLowerCase();
        const statusTxt = (servico.status || "DESCONHECIDO").replace(/_/g, " ");
        detalheStatus.innerHTML = `<span class="status-badge status-${statusCls}">${statusTxt}</span>`;
      }

      if (detalhePrioridade) {
        const prioridade = servico.prioridade || "MEDIA";
        const prioridadeClasse = `prioridade-${prioridade.toLowerCase()}`;
        detalhePrioridade.innerHTML = `<span class="prioridade-badge ${prioridadeClasse}">${prioridade}</span>`;
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

      if (servico.status === "CONCLUIDO" || servico.status === "CANCELADO") {
        secaoDetalhesConclusao.classList.remove("hidden");
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
      }

      if (listaAnexosServicoPagina && secaoAnexosServico) {
        listaAnexosServicoPagina.innerHTML = "";
        if (servico.anexos && servico.anexos.length > 0) {
          servico.anexos.forEach((anexo) => {
            const card = createAnexoCard(anexo);
            listaAnexosServicoPagina.appendChild(card);
          });
          secaoAnexosServico.classList.remove("hidden");
        }
      }

      renderizarItensDeEscopo(servico.itens_escopo || []);

      loadingIndicator.classList.add("hidden");
      conteudoDetalhesServico.classList.remove("hidden");
    } catch (error) {
      loadingIndicator.classList.add("hidden");
      erroCarregamento.textContent = `Erro ao carregar detalhes do serviço: ${
        error.message || "Erro desconhecido"
      }`;
      erroCarregamento.classList.remove("hidden");
    }
  }

  function renderizarItensDeEscopo(itensEscopo) {
    if (!containerItensEscopo || !secaoItensEscopo) return;
    containerItensEscopo.innerHTML = "";
    if (itensEscopo.length === 0) {
      containerItensEscopo.innerHTML =
        "<p class='feedback-message'>Este serviço não possui itens de escopo detalhados.</p>";
      secaoItensEscopo.classList.remove("hidden");
      return;
    }
    secaoItensEscopo.classList.remove("hidden");

    itensEscopo.forEach((item) => {
      const itemCard = document.createElement("div");
      itemCard.className = "service-item-card";

      const statusClasse = (item.status_item_escopo || "pendente")
        .toLowerCase()
        .replace(/_/g, "");
      const statusTexto = (item.status_item_escopo || "PENDENTE").replace(
        /_/g,
        " "
      );
      const dataConclusaoItemFmt = formatarDataHora(item.data_conclusao_item);

      let origemHtml = item.inspecao_item_id
        ? `<div class="item-origin">Origem: Inspeção #${
            item.origem_inspecao_formulario_num || item.origem_inspecao_id
          }</div>`
        : '<div class="item-origin">Origem: Serviço Avulso</div>';

      let anexosHtml = "";
      if (item.anexos && item.anexos.length > 0) {
        anexosHtml =
          '<p class="item-anexos-title"><strong>Anexos de Conclusão do Item:</strong></p><div class="item-anexos-container">';
        item.anexos.forEach((anexo) => {
          anexosHtml += `<img src="${anexo.caminho_servidor}" alt="${anexo.nome_original}" class="item-anexo-img" onclick="openImageLightbox('${anexo.caminho_servidor}')" title="${anexo.nome_original}" />`;
        });
        anexosHtml += "</div>";
      }

      itemCard.innerHTML = `
            <p class="item-description">${item.descricao_item_servico}</p>
            ${origemHtml}
            <div class="item-details-grid">
                <div><strong>Encarregado:</strong><span>${
                  item.encarregado_item_nome || "N/A"
                }</span></div>
                <div><strong>Status do Item:</strong><span class="status-badge status-${statusClasse}">${statusTexto}</span></div>
                <div><strong>Data Conclusão do Item:</strong><span>${dataConclusaoItemFmt}</span></div>
            </div>
            ${
              item.observacoes_conclusao_item
                ? `<div class="item-obs-conclusao"><p><strong>Observações de Conclusão do Item:</strong></p><p>${item.observacoes_conclusao_item}</p></div>`
                : ""
            }
            ${anexosHtml}
        `;
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
