document.addEventListener("DOMContentLoaded", function () {
  const servicoId = window.location.pathname.split("/")[3];
  let servicoCache = null;

  const pageTitle = document.getElementById("page-title-processo");
  const infoGeraisContainer = document.getElementById("info-gerais-container");
  const anexosGeraisContainer = document.getElementById(
    "anexos-gerais-container"
  );
  const accordionPontos = document.getElementById("accordion-pontos");

  const modalPontoEl = document.getElementById("modal-ponto");
  const modalPonto = new bootstrap.Modal(modalPontoEl);
  const modalEditarServicoEl = document.getElementById("modal-editar-servico");
  const modalEditarServico = new bootstrap.Modal(modalEditarServicoEl);

  const formPonto = document.getElementById("form-ponto");
  const selectTagDefeito = document.getElementById("id_code_tag");
  const formEditarServico = document.getElementById("form-editar-servico");
  const selectEditCriador = document.getElementById("edit-criador_matricula");

  function renderInfoGerais(servico) {
    const dataFormatada = new Date(servico.data_servico).toLocaleDateString(
      "pt-BR",
      { timeZone: "UTC" }
    );
    const equipe =
      servico.responsaveis_execucao && servico.responsaveis_execucao.length > 0
        ? servico.responsaveis_execucao.map((r) => r.nome).join(", ")
        : '<span class="text-muted">Pendente de atribuição</span>';

    pageTitle.textContent = `Inspeção: ${servico.processo}`;
    infoGeraisContainer.innerHTML = `
      <div class="row">
        <div class="col-md-4 mb-3"><strong>Processo:</strong> <span id="info-processo">${
          servico.processo
        }</span></div>
        <div class="col-md-4 mb-3"><strong>Data Prevista:</strong> <span id="info-data">${dataFormatada}</span></div>
        <div class="col-md-4 mb-3"><strong>Tipo de Ordem:</strong> <span id="info-tipo-ordem">${
          servico.tipo_ordem
        }</span></div>
        <div class="col-md-4 mb-3"><strong>Criador da OS:</strong> <span id="info-criador">${
          servico.nome_criador
        }</span></div>
        <div class="col-md-8 mb-3"><strong>Equipe de Execução:</strong> <span id="info-equipe">${equipe}</span></div>
        <div class="col-md-4 mb-3"><strong>Subestação:</strong> <span id="info-subestacao">${
          servico.subestacao || "N/A"
        }</span></div>
        <div class="col-md-4 mb-3"><strong>Alimentador:</strong> <span id="info-alimentador">${
          servico.alimentador || "N/A"
        }</span></div>
        <div class="col-md-4 mb-3"><strong>Chave Montante:</strong> <span id="info-chave">${
          servico.chave_montante || "N/A"
        }</span></div>
        <div class="col-md-12"><strong>Descrição:</strong> <span id="info-descricao">${
          servico.descricao || "Nenhuma descrição fornecida."
        }</span></div>
      </div>
    `;
  }

  function renderAnexosGerais(anexos) {
    if (!anexos || anexos.length === 0) {
      anexosGeraisContainer.innerHTML =
        '<p class="text-muted mb-0">Nenhum anexo geral para este serviço.</p>';
      return;
    }
    const anexosHtml = anexos
      .map((anexo) => {
        const isImage =
          anexo.tipo_arquivo && anexo.tipo_arquivo.startsWith("image/");
        const url = anexo.caminho_arquivo;
        const nome = anexo.nome_original;

        if (isImage) {
          return `
            <a href="${url}" class="anexo-thumbnail" data-bs-toggle="modal" data-bs-target="#image-viewer-modal" title="${nome}">
                <img src="${url}" alt="${nome}">
            </a>`;
        } else {
          return `
            <a href="${url}" target="_blank" class="anexo-thumbnail" title="${nome}">
                <span class="material-icons">description</span>
                <span class="anexo-thumbnail-caption">${nome}</span>
            </a>`;
        }
      })
      .join("");

    anexosGeraisContainer.innerHTML = `<div class="anexos-list">${anexosHtml}</div>`;
  }

  function renderPontos(pontos) {
    accordionPontos.innerHTML = "";
    if (!pontos || pontos.length === 0) {
      accordionPontos.innerHTML = `<div class="text-center p-5 bg-light rounded" id="no-points-message"><p class="mb-0">Nenhum ponto de inspeção foi registrado para este serviço.</p></div>`;
      return;
    }

    pontos.forEach((ponto) => {
      let anexosHtml =
        '<p class="text-muted">Nenhum anexo para este ponto.</p>';
      if (ponto.anexos && ponto.anexos.length > 0) {
        anexosHtml = ponto.anexos
          .map((anexo) => {
            const isImage =
              anexo.tipo_arquivo && anexo.tipo_arquivo.startsWith("image/");
            const url = anexo.caminho_arquivo;
            const nome = anexo.nome_original;

            if (isImage) {
              return `
                <a href="${url}" class="anexo-thumbnail" data-bs-toggle="modal" data-bs-target="#image-viewer-modal" title="${nome}">
                    <img src="${url}" alt="${nome}">
                </a>`;
            } else {
              return `
                <a href="${url}" target="_blank" class="anexo-thumbnail" title="${nome}">
                    <span class="material-icons">description</span>
                    <span class="anexo-thumbnail-caption">${nome}</span>
                </a>`;
            }
          })
          .join("");
      }

      let mapsButton = "";
      if (ponto.coordenada_y && ponto.coordenada_x) {
        const mapsUrl = `https://www.google.com/maps?q=${ponto.coordenada_y},${ponto.coordenada_x}`;
        mapsButton = `
          <a href="${mapsUrl}" target="_blank" class="btn btn-outline-success btn-sm btn-maps" title="Ver no Google Maps">
            <span class="material-icons">place</span>
            Mapa
          </a>`;
      }

      const pontoHtml = `
        <div class="accordion-item" id="ponto-item-${ponto.id}">
          <h2 class="accordion-header">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-ponto-${
              ponto.id
            }">
              <strong>Ponto #${ponto.id}:</strong>&nbsp;${ponto.tag_code} - ${
        ponto.ponto_defeito
      }
            </button>
          </h2>
          <div id="collapse-ponto-${
            ponto.id
          }" class="accordion-collapse collapse" data-bs-parent="#accordion-pontos">
            <div class="accordion-body">
              <p><strong>Defeito:</strong> ${ponto.descricao_tag}</p>
              <p>
                <strong>Coordenadas:</strong> ${ponto.coordenada_x}, ${
        ponto.coordenada_y
      }
                ${mapsButton}
              </p>
              <p><strong>Observações:</strong> ${
                ponto.observacoes || "Nenhuma."
              }</p>
              <div class="anexos-container mb-3">
                <strong>Anexos:</strong>
                <div class="anexos-list mt-2">${anexosHtml}</div>
              </div>
              <div class="text-end">
                <button class="btn btn-outline-secondary btn-sm btn-gerenciar-anexos" data-ponto-id="${
                  ponto.id
                }">Gerenciar Anexos</button>
                <button class="btn btn-outline-primary btn-sm btn-editar-ponto" data-ponto-dados='${JSON.stringify(
                  ponto
                )}'>Editar Ponto</button>
                <button class="btn btn-outline-danger btn-sm btn-deletar-ponto" data-ponto-id="${
                  ponto.id
                }">Excluir Ponto</button>
              </div>
            </div>
          </div>
        </div>
      `;
      accordionPontos.insertAdjacentHTML("beforeend", pontoHtml);
    });
  }

  async function inicializarPagina() {
    try {
      const [servicoResponse, tagsResponse, responsaveisResponse] =
        await Promise.all([
          fetch(`/inspecoes/api/servicos/${servicoId}/dados`),
          fetch("/inspecoes/api/codigos/tags"),
          fetch("/inspecoes/api/responsaveis"),
        ]);

      if (!servicoResponse.ok) {
        throw new Error("Falha ao carregar os dados do serviço.");
      }
      servicoCache = await servicoResponse.json();

      renderInfoGerais(servicoCache);
      renderAnexosGerais(servicoCache.anexos_gerais);
      renderPontos(servicoCache.pontos);

      const allTags = await tagsResponse.json();
      selectTagDefeito.innerHTML =
        '<option value="" selected disabled>Selecione...</option>';
      allTags.forEach((tag) => {
        const option = new Option(
          `${tag.tag_code} - ${tag.ponto_defeito}`,
          tag.id
        );
        selectTagDefeito.add(option);
      });

      const allResponsaveis = await responsaveisResponse.json();
      selectEditCriador.innerHTML =
        '<option value="" selected disabled>Selecione...</option>';
      allResponsaveis.forEach((user) => {
        const option = new Option(user.nome, user.matricula);
        selectEditCriador.add(option);
      });
    } catch (error) {
      console.error(error);
      document.body.innerHTML = `<div class="alert alert-danger m-4">${error.message}</div>`;
    }
  }

  function abrirModalEditarServico() {
    if (!servicoCache) return;
    formEditarServico.reset();

    document.getElementById("edit-processo").value = servicoCache.processo;
    const dataISO = new Date(servicoCache.data_servico)
      .toISOString()
      .split("T")[0];
    document.getElementById("edit-data_servico").value = dataISO;
    document.getElementById("edit-tipo_ordem").value = servicoCache.tipo_ordem;
    document.getElementById("edit-criador_matricula").value =
      servicoCache.criador_matricula;
    document.getElementById("edit-subestacao").value = servicoCache.subestacao;
    document.getElementById("edit-alimentador").value =
      servicoCache.alimentador;
    document.getElementById("edit-chave_montante").value =
      servicoCache.chave_montante;
    document.getElementById("edit-descricao").value = servicoCache.descricao;

    modalEditarServico.show();
  }

  async function handleSalvarEdicaoServico(event) {
    event.preventDefault();
    const submitButton = document.getElementById("btn-salvar-edicao-servico");
    submitButton.disabled = true;

    const formData = new FormData(formEditarServico);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await fetch(`/inspecoes/api/servicos/${servicoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      alert("Informações do serviço atualizadas com sucesso!");
      location.reload();
    } catch (error) {
      alert(`Erro ao salvar alterações: ${error.message}`);
    } finally {
      submitButton.disabled = false;
      modalEditarServico.hide();
    }
  }

  function abrirModalPontoParaEditar(button) {
    formPonto.reset();
    const pontoDados = JSON.parse(button.dataset.pontoDados);

    document.getElementById("ponto-id").value = pontoDados.id;
    document.getElementById("id_code_tag").value = pontoDados.id_code_tag;
    document.getElementById("coordenada_x").value = pontoDados.coordenada_x;
    document.getElementById("coordenada_y").value = pontoDados.coordenada_y;
    document.getElementById("observacoes").value = pontoDados.observacoes;

    document.getElementById(
      "modal-ponto-title"
    ).textContent = `Editar Ponto #${pontoDados.id}`;
    modalPonto.show();
  }

  async function handleSalvarPonto(event) {
    event.preventDefault();
    const submitButton = document.getElementById("btn-salvar-ponto");
    submitButton.disabled = true;

    const formData = new FormData(formPonto);
    const data = Object.fromEntries(formData.entries());
    const pontoId = data.id;

    if (!pontoId) {
      alert(
        "Erro: ID do ponto não encontrado. Esta função é apenas para edição."
      );
      submitButton.disabled = false;
      return;
    }

    try {
      const response = await fetch(`/inspecoes/api/pontos/${pontoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      alert("Ponto atualizado com sucesso!");
      location.reload();
    } catch (error) {
      alert(`Erro ao salvar ponto: ${error.message}`);
    } finally {
      submitButton.disabled = false;
      modalPonto.hide();
    }
  }

  async function handleDeletarPonto(pontoId) {
    if (
      !confirm(
        `Tem certeza que deseja excluir o Ponto #${pontoId} e todos os seus anexos?`
      )
    ) {
      return;
    }
    try {
      const response = await fetch(`/inspecoes/api/pontos/${pontoId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      alert("Ponto excluído com sucesso!");
      document.getElementById(`ponto-item-${pontoId}`).remove();
    } catch (error) {
      alert(`Erro ao excluir ponto: ${error.message}`);
    }
  }

  document
    .getElementById("btn-editar-servico-header")
    .addEventListener("click", abrirModalEditarServico);
  formEditarServico.addEventListener("submit", handleSalvarEdicaoServico);
  formPonto.addEventListener("submit", handleSalvarPonto);

  document.body.addEventListener("click", function (event) {
    const target = event.target.closest("button");
    if (!target) return;

    if (target.classList.contains("btn-editar-ponto")) {
      abrirModalPontoParaEditar(target);
    }
    if (target.classList.contains("btn-deletar-ponto")) {
      const pontoId = target.dataset.pontoId;
      handleDeletarPonto(pontoId);
    }
    if (target.classList.contains("btn-gerenciar-anexos")) {
      const pontoId = target.dataset.pontoId;
      alert(
        `Funcionalidade "Gerenciar Anexos" para o ponto ${pontoId} ainda não implementada.`
      );
    }
  });

  const imageViewerModal = document.getElementById("image-viewer-modal");
  if (imageViewerModal) {
    imageViewerModal.addEventListener("show.bs.modal", function (event) {
      const triggerElement = event.relatedTarget;
      const imageUrl = triggerElement.getAttribute("href");
      const imageElement = imageViewerModal.querySelector("#image-viewer-img");
      imageElement.setAttribute("src", imageUrl);
    });
  }

  inicializarPagina();
});
