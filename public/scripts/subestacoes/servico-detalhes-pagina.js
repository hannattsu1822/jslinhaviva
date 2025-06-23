document.addEventListener("DOMContentLoaded", () => {
  const servicoIdTitulo = document.getElementById("servicoIdTitulo");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const conteudoDetalhesServico = document.getElementById(
    "conteudoDetalhesServico"
  );
  const erroCarregamento = document.getElementById("erroCarregamento");

  const detalheProcesso = document.getElementById("detalheProcesso");
  const detalheSubestacao = document.getElementById("detalheSubestacao");
  const detalheStatus = document.getElementById("detalheStatus");
  const detalheMotivo = document.getElementById("detalheMotivo");
  const detalheAlimentador = document.getElementById("detalheAlimentador");
  const detalheEquipamento = document.getElementById("detalheEquipamento");
  const detalheResponsavel = document.getElementById("detalheResponsavel");
  const detalheDataPrevista = document.getElementById("detalheDataPrevista");
  const detalheHorarioPrevisto = document.getElementById(
    "detalheHorarioPrevisto"
  );
  const detalheEncarregado = document.getElementById("detalheEncarregado");

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

  const secaoInspecoesVinculadas = document.getElementById(
    "secaoInspecoesVinculadas"
  );
  const accordionInspecoesVinculadas = document.getElementById(
    "accordionInspecoesVinculadas"
  );

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
    // Assumindo URL como /servicos/{ID}/detalhes-pagina
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
        // Se for 403 (Forbidden), não tratar como erro fatal de "comunicação", mas sim de acesso
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
      throw error; // Re-throw para ser capturado pela função chamadora
    }
  }

  function formatarDataSimples(dataISO) {
    if (!dataISO) return "Não informado";
    const dataObj = new Date(
      dataISO.includes("T") ? dataISO : dataISO + "T00:00:00Z"
    ); // Adicionar Z para UTC
    if (isNaN(dataObj.getTime())) return "Data inválida";
    return dataObj.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  }

  function formatarHoraSimples(hora) {
    if (!hora) return "";
    if (typeof hora === "string" && hora.includes(":")) {
      return hora.substring(0, 5); // HH:mm
    }
    return "Não informado";
  }

  function openImageLightbox(imageUrl) {
    if (lightboxImageDetalhesContent && bsImageLightboxDetalhes) {
      lightboxImageDetalhesContent.src = imageUrl;
      bsImageLightboxDetalhes.show();
    }
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

    if (servicoIdTitulo) servicoIdTitulo.textContent = `#${servicoIdAtual}`; // Título provisório
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
      if (detalheAlimentador)
        detalheAlimentador.textContent = servico.alimentador || "Não informado";
      if (detalheEquipamento)
        detalheEquipamento.textContent = servico.equipamento_tag
          ? `${servico.equipamento_tag}`
          : "Nenhum específico";
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
      if (detalheEncarregado)
        detalheEncarregado.textContent =
          servico.encarregado_designado_nome || "Nenhum";

      if (servico.status === "CONCLUIDO") {
        if (detalheDataConclusao)
          detalheDataConclusao.textContent = formatarDataSimples(
            servico.data_conclusao
          );
        if (detalheHoraConclusao)
          detalheHoraConclusao.textContent = formatarHoraSimples(
            servico.horario_fim
          ); // Assumindo que horario_fim é atualizado na conclusão
        if (detalheObsConclusao)
          detalheObsConclusao.textContent =
            servico.observacoes_conclusao || "Nenhuma";
        secaoDetalhesConclusao.classList.remove("d-none");
      } else {
        secaoDetalhesConclusao.classList.add("d-none");
      }

      if (listaAnexosServicoPagina && secaoAnexosServico) {
        listaAnexosServicoPagina.innerHTML = "";
        if (servico.anexos && servico.anexos.length > 0) {
          servico.anexos.forEach((anexo) => {
            const li = document.createElement("li");
            li.className = "list-group-item d-flex align-items-center";
            const iconName =
              anexo.tipo_mime && anexo.tipo_mime.startsWith("image/")
                ? "image"
                : "draft";
            li.innerHTML = `
                <span class="material-symbols-outlined me-2">${iconName}</span>
                <a href="${
                  anexo.caminho_servidor
                }" target="_blank" class="text-decoration-none flex-grow-1">${
              anexo.nome_original
            }</a>
                <small class="text-muted ms-2">(${(
                  anexo.tamanho / 1024
                ).toFixed(1)} KB) - Cat: ${
              anexo.categoria_anexo
                ? anexo.categoria_anexo.replace(/_/g, " ")
                : "Geral"
            }</small>
            `;
            if (iconName === "image") {
              const linkElement = li.querySelector("a");
              linkElement.addEventListener("click", (e) => {
                e.preventDefault();
                openImageLightbox(anexo.caminho_servidor);
              });
            }
            listaAnexosServicoPagina.appendChild(li);
          });
          secaoAnexosServico.classList.remove("d-none");
        } else {
          secaoAnexosServico.classList.add("d-none");
        }
      }

      renderizarInspecoesVinculadas(
        servico.inspecoes_vinculadas || [],
        servico.mapeamento_defeitos_existentes || [],
        servico
      );

      loadingIndicator.classList.add("d-none");
      conteudoDetalhesServico.classList.remove("d-none");
      if (btnEditarServicoPagina) btnEditarServicoPagina.disabled = false;
    } catch (error) {
      loadingIndicator.classList.add("d-none");
      if (error.status === 403) {
        // Trata erro de acesso negado (Encarregado tentando ver serviço de outro)
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

  function renderizarInspecoesVinculadas(
    inspecoesVinculadas,
    mapeamentoDefeitos,
    servicoPai
  ) {
    if (!accordionInspecoesVinculadas || !secaoInspecoesVinculadas) return;
    accordionInspecoesVinculadas.innerHTML = "";

    if (inspecoesVinculadas.length === 0) {
      secaoInspecoesVinculadas.classList.add("d-none");
      return;
    }
    secaoInspecoesVinculadas.classList.remove("d-none");

    inspecoesVinculadas.forEach((inspecao, index) => {
      const accordionItemId = `insp-accordion-${inspecao.inspecao_id}`;
      const collapseId = `collapse-insp-${inspecao.inspecao_id}`;

      const accordionItem = document.createElement("div");
      accordionItem.className = "accordion-item";
      accordionItem.innerHTML = `
            <h2 class="accordion-header" id="heading-${accordionItemId}">
                <button class="accordion-button ${
                  index === 0 ? "" : "collapsed"
                }" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="${
        index === 0 ? "true" : "false"
      }" aria-controls="${collapseId}">
                    Inspeção #${
                      inspecao.formulario_inspecao_num || inspecao.inspecao_id
                    } (${inspecao.subestacao_sigla || "N/A"}) - Data: ${
        inspecao.data_avaliacao_fmt || "N/A"
      }
                </button>
            </h2>
            <div id="${collapseId}" class="accordion-collapse collapse ${
        index === 0 ? "show" : ""
      }" aria-labelledby="heading-${accordionItemId}" data-bs-parent="#accordionInspecoesVinculadas">
                <div class="accordion-body">
                    <p class="small text-muted">Itens anormais desta inspeção associados a este serviço:</p>
                    <div id="itens-anormais-inspecao-${
                      inspecao.inspecao_id
                    }" class="list-group">
                        Carregando itens...
                    </div>
                </div>
            </div>
        `;
      accordionInspecoesVinculadas.appendChild(accordionItem);

      const containerItensAnormais = accordionItem.querySelector(
        `#itens-anormais-inspecao-${inspecao.inspecao_id}`
      );
      let itensMapeadosRenderizados = 0;

      if (mapeamentoDefeitos && mapeamentoDefeitos.length > 0) {
        mapeamentoDefeitos
          .filter((defeito) => defeito.inspecao_id === inspecao.inspecao_id)
          .forEach((defeitoMapeado) => {
            const itemAnormalDiv = document.createElement("div");
            itemAnormalDiv.className =
              "list-group-item list-group-item-action flex-column align-items-start mb-2 p-2 border rounded";

            let fotosHtml =
              '<p class="small text-muted mb-1"><em>Sem fotos de evidência para este item na inspeção.</em></p>';

            // Achar as fotos corretas para este item específico da inspeção.
            // A API agora anexa 'anexos_itens_inspecao' diretamente ao objeto 'inspecao' na lista de 'inspecoes_vinculadas'.
            const anexosDoItemOriginal =
              inspecao.anexos_itens_inspecao?.filter(
                (anx) =>
                  anx.item_num_associado == defeitoMapeado.inspecao_item_num
              ) || [];

            if (anexosDoItemOriginal.length > 0) {
              fotosHtml =
                '<div class="d-flex flex-wrap gap-1 mt-1 mb-2 item-anormal-fotos-detalhes">';
              anexosDoItemOriginal.forEach((anexo) => {
                fotosHtml += `
                            <a href="${anexo.caminho_servidor}" data-image-src="${anexo.caminho_servidor}" title="${anexo.nome_original}" class="link-foto-anormalidade">
                                <img src="${anexo.caminho_servidor}" alt="${anexo.nome_original}" style="width: 60px; height: 60px; object-fit: cover; border: 1px solid #ccc; cursor: pointer;">
                            </a>`;
              });
              fotosHtml += "</div>";
            }

            itemAnormalDiv.innerHTML = `
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1 small"><strong>Item da Inspeção:</strong> ${
                          defeitoMapeado.inspecao_item_num
                        }. ${
              defeitoMapeado.inspecao_item_descricao ||
              "Descrição não disponível"
            }</h6>
                    </div>
                    <p class="mb-1 small"><strong>Código Defeito (Catálogo):</strong> ${
                      defeitoMapeado.defeito_codigo || "N/A"
                    } - ${defeitoMapeado.defeito_descricao || "N/A"}</p>
                    ${
                      defeitoMapeado.observacao_especifica_servico
                        ? `<p class="mb-1 small"><strong>Obs. para este Serviço:</strong> <em>${defeitoMapeado.observacao_especifica_servico}</em></p>`
                        : ""
                    }
                    ${fotosHtml}
                `;

            itemAnormalDiv
              .querySelectorAll(".link-foto-anormalidade")
              .forEach((link) => {
                link.addEventListener("click", function (e) {
                  e.preventDefault();
                  openImageLightbox(this.dataset.imageSrc);
                });
              });

            if (itensMapeadosRenderizados === 0)
              containerItensAnormais.innerHTML = "";
            containerItensAnormais.appendChild(itemAnormalDiv);
            itensMapeadosRenderizados++;
          });
      }

      if (itensMapeadosRenderizados === 0) {
        let msgPadrao =
          "Nenhum item anormal desta inspeção foi explicitamente mapeado para um defeito neste serviço.";
        // Você pode adicionar uma lógica aqui para verificar se a inspeção original tinha itens anormais
        // consultando `servicoPai.detalhes_completos_inspecoes[inspecao.inspecao_id].itens_anormais.length === 0` (se você popular essa estrutura)
        containerItensAnormais.innerHTML = `<p class="small fst-italic text-muted p-2">${msgPadrao}</p>`;
      }
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
