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
    servicoIdAtual = getServicoIdFromUrl();
    if (!servicoIdAtual) {
      loadingIndicator.classList.add("hidden");
      erroCarregamento.textContent = "ID do serviço não encontrado na URL.";
      erroCarregamento.classList.remove("hidden");
      if (btnEditarServicoPagina) btnEditarServicoPagina.disabled = true;
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
          secaoAnexosServico.classList.remove("hidden");
        }
      }

      renderizarItensDeEscopo(servico.itens_escopo || []);

      loadingIndicator.classList.add("hidden");
      conteudoDetalhesServico.classList.remove("hidden");
      if (btnEditarServicoPagina) btnEditarServicoPagina.disabled = false;
    } catch (error) {
      loadingIndicator.classList.add("hidden");
      erroCarregamento.textContent = `Erro ao carregar detalhes do serviço: ${
        error.message || "Erro desconhecido"
      }`;
      erroCarregamento.classList.remove("hidden");
      if (btnEditarServicoPagina) btnEditarServicoPagina.disabled = true;
    }
  }

  function renderizarItensDeEscopo(itensEscopo) {
    if (!containerItensEscopo || !secaoItensEscopo) return;
    containerItensEscopo.innerHTML = "";
    if (itensEscopo.length === 0) {
      secaoItensEscopo.classList.add("hidden");
      return;
    }
    secaoItensEscopo.classList.remove("hidden");

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

      let origemHtml = item.inspecao_item_id
        ? `<div class="item-origin">Origem: Inspeção #${
            item.origem_inspecao_formulario_num || item.origem_inspecao_id
          }</div>`
        : '<div class="item-origin">Origem: Serviço Avulso</div>';

      let anexosHtml = "";
      if (item.anexos && item.anexos.length > 0) {
        anexosHtml += '<div class="item-anexos-container">';
        item.anexos.forEach((anexo) => {
          const isImage =
            anexo.caminho_servidor &&
            anexo.caminho_servidor.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null;
          if (isImage) {
            const anexoElement = document.createElement("img");
            anexoElement.src = anexo.caminho_servidor;
            anexoElement.alt = anexo.nome_original;
            anexoElement.className = "item-anexo-img";
            anexoElement.title = anexo.nome_original;
            anexoElement.onclick = () =>
              openImageLightbox(anexo.caminho_servidor);
            anexosHtml += anexoElement.outerHTML;
          }
        });
        anexosHtml += "</div>";
      }

      itemCard.innerHTML = `
            <p class="item-description">${item.descricao_item_servico}</p>
            ${origemHtml}
            <div class="item-details-grid">
                <div><strong>Equipamento:</strong><span>${
                  item.catalogo_equipamento_nome || "N/A"
                }</span></div>
                <div><strong>TAG Alvo:</strong><span>${
                  item.tag_equipamento_alvo || "N/A"
                }</span></div>
                <div><strong>Defeito:</strong><span>${
                  item.defeito_codigo
                    ? `${item.defeito_codigo} - ${item.defeito_descricao}`
                    : "N/A"
                }</span></div>
                <div><strong>Encarregado:</strong><span>${
                  item.encarregado_item_nome || "Nenhum designado"
                }</span></div>
                <div><strong>Status do Item:</strong><span class="status-badge status-${statusClasse}">${statusTexto}</span></div>
            </div>
            ${anexosHtml}
        `;
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
