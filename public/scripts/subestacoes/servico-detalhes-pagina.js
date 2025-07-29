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
  const btnImprimirPagina = document.getElementById("btnImprimirPagina");
  const btnEditarServicoPagina = document.getElementById(
    "btnEditarServicoPagina"
  );

  const editProcessoInput = document.getElementById("editProcesso");
  const editSubestacaoSelect = document.getElementById("editSubestacao");
  const editTipoOrdemSelect = document.getElementById("editTipoOrdem");
  const editStatusSelect = document.getElementById("editStatus");
  const editPrioridadeSelect = document.getElementById("editPrioridade");
  const editMotivoTextarea = document.getElementById("editMotivo");
  const editResponsavelSelect = document.getElementById("editResponsavel");
  const editDataPrevistaInput = document.getElementById("editDataPrevista");
  const editHorarioInicioInput = document.getElementById("editHorarioInicio");
  const editHorarioFimInput = document.getElementById("editHorarioFim");
  const btnSalvarEdicao = document.getElementById("btnSalvarEdicao");
  const btnCancelarEdicao = document.getElementById("btnCancelarEdicao");
  const btnAdicionarItem = document.getElementById("btnAdicionarItem");
  const btnAdicionarAnexoGeral = document.getElementById(
    "btnAdicionarAnexoGeral"
  );
  const inputAnexoGeral = document.getElementById("inputAnexoGeral");

  const modalAdicionarItemEl = document.getElementById("modalAdicionarItem");
  const formModalItem = document.getElementById("formModalItem");
  const modalItemDescricao = document.getElementById("modalItemDescricao");
  const modalItemTag = document.getElementById("modalItemTag");
  const modalItemDefeitoInput = document.getElementById("modalItemDefeito");
  const modalItemDefeitoId = document.getElementById("modalItemDefeitoId");
  const sugestoesDefeitosDiv = document.getElementById("sugestoesDefeitos");
  const modalItemEquipamentoInput = document.getElementById(
    "modalItemEquipamento"
  );
  const modalItemEquipamentoId = document.getElementById(
    "modalItemEquipamentoId"
  );
  const sugestoesEquipamentosDiv = document.getElementById(
    "sugestoesEquipamentos"
  );
  const btnSalvarNovoItem = document.getElementById("btnSalvarNovoItem");
  const btnAnexarNovoItemModal = document.getElementById(
    "btnAnexarNovoItemModal"
  );
  const modalNovoItemAnexosInput = document.getElementById(
    "modalNovoItemAnexosInput"
  );
  const modalPreviewAnexosNovoItem = document.getElementById(
    "modalPreviewAnexosNovoItem"
  );

  const templateItemCardEdicao = document.getElementById(
    "templateItemCardEdicao"
  );
  const templateAnexoCard = document.getElementById("templateAnexoCard");

  const imageLightboxDetalhesEl = document.getElementById(
    "imageLightboxDetalhes"
  );
  const lightboxImageDetalhesContent = document.getElementById(
    "lightboxImageDetalhesContent"
  );
  const lightboxCloseBtn = imageLightboxDetalhesEl.querySelector(
    ".btn-close-lightbox"
  );

  let serviceDataOriginal = null;
  let serviceDataWorkingCopy = null;
  let itensParaDeletar = new Set();
  let anexosParaDeletar = new Set();
  let novosAnexosMap = new Map();
  let novosAnexosParaItemModal = [];
  let catalogoDefeitosCache = [];
  let catalogoEquipamentosCache = [];

  function getServicoIdFromUrl() {
    const pathParts = window.location.pathname.split("/");
    const id = pathParts[pathParts.length - 2];
    return id && !isNaN(parseInt(id)) ? parseInt(id) : null;
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

  function setupAutocomplete(
    inputElement,
    hiddenIdElement,
    suggestionsDiv,
    sourceData,
    displayFormatter,
    valueKey
  ) {
    inputElement.addEventListener("input", () => {
      const query = inputElement.value.toLowerCase();
      suggestionsDiv.innerHTML = "";
      if (!query) {
        hiddenIdElement.value = "";
        return;
      }

      const filtered = sourceData.filter((item) =>
        displayFormatter(item).toLowerCase().includes(query)
      );

      filtered.forEach((item) => {
        const div = document.createElement("div");
        div.className = "suggestion-item";
        div.innerHTML = displayFormatter(item);
        div.addEventListener("click", () => {
          inputElement.value = displayFormatter(item);
          hiddenIdElement.value = item[valueKey];
          suggestionsDiv.innerHTML = "";
        });
        suggestionsDiv.appendChild(div);
      });
    });

    document.addEventListener("click", (e) => {
      if (
        suggestionsDiv &&
        !inputElement.contains(e.target) &&
        !suggestionsDiv.contains(e.target)
      ) {
        suggestionsDiv.innerHTML = "";
      }
    });
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

  function entrarModoEdicao() {
    document
      .querySelectorAll(".view-mode")
      .forEach((el) => el.classList.add("hidden"));
    document
      .querySelectorAll(".edit-mode")
      .forEach((el) => el.classList.remove("hidden"));
    renderizarPaginaCompleta(serviceDataWorkingCopy, true);
  }

  function sairModoEdicao() {
    serviceDataWorkingCopy = JSON.parse(JSON.stringify(serviceDataOriginal));
    itensParaDeletar.clear();
    anexosParaDeletar.clear();
    novosAnexosMap.clear();

    document
      .querySelectorAll(".view-mode")
      .forEach((el) => el.classList.remove("hidden"));
    document
      .querySelectorAll(".edit-mode")
      .forEach((el) => el.classList.add("hidden"));
    renderizarPaginaCompleta(serviceDataOriginal, false);
  }

  async function popularSelectsEdicao() {
    try {
      const [subestacoes, usuarios, defeitos, equipamentos] = await Promise.all(
        [
          fetchData("/subestacoes"),
          fetchData("/usuarios-responsaveis-para-servicos"),
          fetchData("/api/catalogo-defeitos-servicos"),
          fetchData("/api/catalogo/equipamentos"),
        ]
      );

      catalogoDefeitosCache = defeitos;
      catalogoEquipamentosCache = equipamentos;

      if (editSubestacaoSelect) {
        editSubestacaoSelect.innerHTML =
          '<option value="">Selecione...</option>';
        subestacoes.forEach((sub) => {
          editSubestacaoSelect.add(
            new Option(`${sub.sigla} - ${sub.nome}`, sub.Id)
          );
        });
      }

      if (editResponsavelSelect) {
        editResponsavelSelect.innerHTML =
          '<option value="">Selecione...</option>';
        usuarios.forEach((user) => {
          editResponsavelSelect.add(new Option(user.nome, user.id));
        });
      }
    } catch (error) {
      console.error("Erro ao popular selects para edição:", error);
    }
  }

  function popularFormularioEdicao(servico) {
    editProcessoInput.value = servico.processo || "";
    editSubestacaoSelect.value = servico.subestacao_id;
    editTipoOrdemSelect.value = servico.tipo_ordem || "";
    editStatusSelect.value = servico.status || "PROGRAMADO";
    editPrioridadeSelect.value = servico.prioridade || "MEDIA";
    editMotivoTextarea.value = servico.motivo || "";
    editResponsavelSelect.value = servico.responsavel_id;
    editDataPrevistaInput.value = servico.data_prevista;
    editHorarioInicioInput.value = servico.horario_inicio
      ? servico.horario_inicio.substring(0, 5)
      : "";
    editHorarioFimInput.value = servico.horario_fim
      ? servico.horario_fim.substring(0, 5)
      : "";
  }

  function renderizarPaginaCompleta(servico, isEditMode = false) {
    renderizarInformacoesGerais(servico);
    renderizarItensDeEscopo(servico.itens_escopo || [], isEditMode);
    renderizarAnexos(
      servico.anexos || [],
      listaAnexosServicoPagina,
      "geral",
      isEditMode
    );
  }

  function renderizarInformacoesGerais(servico) {
    if (servicoIdTitulo) servicoIdTitulo.textContent = `#${servico.id}`;
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
  }

  function renderizarItensDeEscopo(itens, isEditMode) {
    containerItensEscopo.innerHTML = "";
    if (itens.length === 0 && !isEditMode) {
      containerItensEscopo.innerHTML =
        "<p class='feedback-message'>Este serviço não possui itens de escopo detalhados.</p>";
      return;
    }

    itens.forEach((item) => {
      const clone = templateItemCardEdicao.content.cloneNode(true);
      const itemCard = clone.querySelector(".service-item-card");
      const itemId = item.item_escopo_id || item.temp_id;
      itemCard.dataset.itemId = itemId;

      itemCard.querySelector(".item-description").textContent =
        item.descricao_item_servico;

      const detailsContainer = itemCard.querySelector(".item-details-grid");
      detailsContainer.innerHTML = `
        <div><strong>Encarregado:</strong><span>${
          item.encarregado_item_nome || "N/A"
        }</span></div>
        <div><strong>Status do Item:</strong><span class="status-badge status-${(
          item.status_item_escopo || "pendente"
        )
          .toLowerCase()
          .replace(/_/g, "")}">${(
        item.status_item_escopo || "PENDENTE"
      ).replace(/_/g, " ")}</span></div>
      `;

      const btnDeleteItem = itemCard.querySelector(".btn-delete-item");
      if (isEditMode) {
        btnDeleteItem.classList.remove("hidden");
      }
      btnDeleteItem.addEventListener("click", () => {
        if (confirm("Tem certeza que deseja excluir este item?")) {
          if (item.item_escopo_id) {
            itensParaDeletar.add(item.item_escopo_id);
          }
          serviceDataWorkingCopy.itens_escopo =
            serviceDataWorkingCopy.itens_escopo.filter(
              (i) => (i.item_escopo_id || i.temp_id) !== itemId
            );
          renderizarItensDeEscopo(serviceDataWorkingCopy.itens_escopo, true);
        }
      });

      const anexosContainer = itemCard.querySelector(".item-anexos-container");
      renderizarAnexos(item.anexos, anexosContainer, itemId, isEditMode);

      const btnAddAnexoItem = itemCard.querySelector(".btn-add-anexo-item");
      if (isEditMode) {
        btnAddAnexoItem.classList.remove("hidden");
      }
      const inputAnexoItem = itemCard.querySelector(".input-anexo-item");
      btnAddAnexoItem.addEventListener("click", () => inputAnexoItem.click());
      inputAnexoItem.addEventListener("change", (e) => {
        handleNovosAnexos(e.target.files, itemId);
        e.target.value = "";
      });

      containerItensEscopo.appendChild(clone);
    });
  }

  function renderAnexo(anexoData, isNewFile = false) {
    const clone = templateAnexoCard.content.cloneNode(true);
    const anexoCard = clone.querySelector(".anexo-preview-card");
    const link = anexoCard.querySelector(".anexo-link");
    const imgPreview = anexoCard.querySelector(".anexo-preview-img");
    const fileIcon = anexoCard.querySelector(".file-icon");
    const fileName = anexoCard.querySelector(".file-name");
    const btnDeleteAnexo = anexoCard.querySelector(".btn-delete-anexo");

    if (isNewFile) {
      fileName.textContent = anexoData.name;
      if (anexoData.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          imgPreview.src = e.target.result;
          imgPreview.classList.remove("hidden");
          fileIcon.classList.add("hidden");
        };
        reader.readAsDataURL(anexoData);
      }
    } else {
      anexoCard.dataset.anexoId = anexoData.id;
      fileName.textContent = anexoData.nome_original;
      link.href = anexoData.caminho_servidor;
      const isImage =
        anexoData.caminho_servidor &&
        anexoData.caminho_servidor.match(/\.(jpe?g|png|gif|webp|heic|heif)$/i);
      if (isImage) {
        imgPreview.src = anexoData.caminho_servidor;
        imgPreview.classList.remove("hidden");
        fileIcon.classList.add("hidden");
        link.addEventListener("click", (e) => {
          if (!e.target.classList.contains("btn-delete-anexo")) {
            e.preventDefault();
            openImageLightbox(anexoData.caminho_servidor);
          }
        });
      }
    }
    return { anexoCard, btnDeleteAnexo };
  }

  function renderizarAnexos(anexos, container, parentId, isEditMode) {
    container.innerHTML = "";
    if (anexos) {
      anexos.forEach((anexo) => {
        const { anexoCard, btnDeleteAnexo } = renderAnexo(anexo, false);
        if (isEditMode) {
          btnDeleteAnexo.classList.remove("hidden");
        }
        btnDeleteAnexo.addEventListener("click", () => {
          if (confirm("Tem certeza que deseja excluir este anexo?")) {
            anexosParaDeletar.add(anexo.id);
            if (parentId === "geral") {
              serviceDataWorkingCopy.anexos =
                serviceDataWorkingCopy.anexos.filter((a) => a.id !== anexo.id);
            } else {
              const item = serviceDataWorkingCopy.itens_escopo.find(
                (i) => (i.item_escopo_id || i.temp_id) === parentId
              );
              if (item)
                item.anexos = item.anexos.filter((a) => a.id !== anexo.id);
            }
            renderizarPaginaCompleta(serviceDataWorkingCopy, true);
          }
        });
        container.appendChild(anexoCard);
      });
    }

    const novosAnexos = novosAnexosMap.get(parentId) || [];
    novosAnexos.forEach((file) => {
      const { anexoCard, btnDeleteAnexo } = renderAnexo(file, true);
      btnDeleteAnexo.classList.remove("hidden");
      btnDeleteAnexo.addEventListener("click", () => {
        const currentFiles = novosAnexosMap.get(parentId) || [];
        novosAnexosMap.set(
          parentId,
          currentFiles.filter((f) => f !== file)
        );
        renderizarPaginaCompleta(serviceDataWorkingCopy, true);
      });
      container.appendChild(anexoCard);
    });
  }

  function handleNovosAnexos(files, parentId) {
    const currentFiles = novosAnexosMap.get(parentId) || [];
    novosAnexosMap.set(parentId, [...currentFiles, ...Array.from(files)]);
    renderizarPaginaCompleta(serviceDataWorkingCopy, true);
  }

  async function carregarDetalhesIniciais() {
    const servicoIdAtual = getServicoIdFromUrl();
    if (!servicoIdAtual) {
      loadingIndicator.classList.add("hidden");
      erroCarregamento.textContent = "ID do serviço não encontrado na URL.";
      erroCarregamento.classList.remove("hidden");
      return;
    }

    loadingIndicator.classList.remove("hidden");
    conteudoDetalhesServico.classList.add("hidden");
    erroCarregamento.classList.add("hidden");

    try {
      const servico = await fetchData(
        `/api/servicos-subestacoes/${servicoIdAtual}`
      );
      serviceDataOriginal = JSON.parse(JSON.stringify(servico));
      serviceDataWorkingCopy = JSON.parse(JSON.stringify(servico));

      renderizarPaginaCompleta(serviceDataOriginal, false);
      popularFormularioEdicao(serviceDataOriginal);

      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("modo") === "editar") {
        entrarModoEdicao();
      }

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

  function renderizarPreviewAnexosNovoItem() {
    modalPreviewAnexosNovoItem.innerHTML = "";
    novosAnexosParaItemModal.forEach((file, index) => {
      const { anexoCard, btnDeleteAnexo } = renderAnexo(file, true);
      btnDeleteAnexo.classList.remove("hidden");
      btnDeleteAnexo.addEventListener("click", () => {
        novosAnexosParaItemModal.splice(index, 1);
        renderizarPreviewAnexosNovoItem();
      });
      modalPreviewAnexosNovoItem.appendChild(anexoCard);
    });
  }

  btnAdicionarItem.addEventListener("click", () => {
    formModalItem.reset();
    novosAnexosParaItemModal = [];
    renderizarPreviewAnexosNovoItem();
    modalAdicionarItemEl.classList.remove("hidden");
  });

  btnSalvarNovoItem.addEventListener("click", () => {
    const novoItem = {
      temp_id: `temp_${Date.now()}`,
      descricao_item_servico: modalItemDescricao.value,
      tag_equipamento_alvo: modalItemTag.value,
      catalogo_defeito_id: modalItemDefeitoId.value || null,
      catalogo_equipamento_id: modalItemEquipamentoId.value || null,
      status_item_escopo: "PENDENTE",
      anexos: [],
    };

    if (novosAnexosParaItemModal.length > 0) {
      novosAnexosMap.set(novoItem.temp_id, novosAnexosParaItemModal);
    }

    serviceDataWorkingCopy.itens_escopo.push(novoItem);
    renderizarItensDeEscopo(serviceDataWorkingCopy.itens_escopo, true);
    modalAdicionarItemEl.classList.add("hidden");
  });

  modalAdicionarItemEl.querySelectorAll(".btn-close-modal").forEach((btn) => {
    btn.addEventListener("click", () =>
      modalAdicionarItemEl.classList.add("hidden")
    );
  });

  btnAnexarNovoItemModal.addEventListener("click", () =>
    modalNovoItemAnexosInput.click()
  );
  modalNovoItemAnexosInput.addEventListener("change", (e) => {
    novosAnexosParaItemModal.push(...Array.from(e.target.files));
    renderizarPreviewAnexosNovoItem();
    e.target.value = "";
  });

  btnAdicionarAnexoGeral.addEventListener("click", () =>
    inputAnexoGeral.click()
  );
  inputAnexoGeral.addEventListener("change", (e) => {
    handleNovosAnexos(e.target.files, "geral");
    e.target.value = "";
  });

  btnEditarServicoPagina.addEventListener("click", entrarModoEdicao);
  btnCancelarEdicao.addEventListener("click", sairModoEdicao);

  btnSalvarEdicao.addEventListener("click", async () => {
    const servicoId = getServicoIdFromUrl();
    if (!servicoId) return;

    const formData = new FormData();

    formData.append("processo", editProcessoInput.value);
    formData.append("subestacao_id", editSubestacaoSelect.value);
    formData.append("motivo", editMotivoTextarea.value);
    formData.append("responsavel_id", editResponsavelSelect.value);
    formData.append("data_prevista", editDataPrevistaInput.value);
    formData.append("horario_inicio", editHorarioInicioInput.value);
    formData.append("horario_fim", editHorarioFimInput.value);
    formData.append("status", editStatusSelect.value);
    formData.append("prioridade", editPrioridadeSelect.value);
    formData.append("tipo_ordem", editTipoOrdemSelect.value);

    formData.append(
      "itensParaDeletar",
      JSON.stringify(Array.from(itensParaDeletar))
    );
    formData.append(
      "anexosParaDeletar",
      JSON.stringify(Array.from(anexosParaDeletar))
    );

    const novosItens = serviceDataWorkingCopy.itens_escopo.filter(
      (item) => item.temp_id
    );
    formData.append("novosItens", JSON.stringify(novosItens));

    novosAnexosMap.forEach((files, parentId) => {
      files.forEach((file) => {
        formData.append(`anexo_${parentId}`, file, file.name);
      });
    });

    btnSalvarEdicao.disabled = true;
    btnSalvarEdicao.innerHTML = "Salvando...";

    try {
      await fetchData(`/api/servicos-subestacoes/${servicoId}`, {
        method: "PUT",
        body: formData,
      });
      alert("Serviço atualizado com sucesso!");

      const url = new URL(window.location);
      url.searchParams.delete("modo");
      window.history.pushState({}, "", url);

      window.location.reload();
    } catch (error) {
      alert(`Falha ao salvar: ${error.message}`);
      btnSalvarEdicao.disabled = false;
      btnSalvarEdicao.innerHTML =
        '<span class="material-symbols-outlined">save</span> Salvar';
    }
  });

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

  async function init() {
    await popularSelectsEdicao();
    await carregarDetalhesIniciais();

    setupAutocomplete(
      modalItemDefeitoInput,
      modalItemDefeitoId,
      sugestoesDefeitosDiv,
      catalogoDefeitosCache,
      (item) => `${item.codigo} - ${item.descricao}`,
      "id"
    );

    setupAutocomplete(
      modalItemEquipamentoInput,
      modalItemEquipamentoId,
      sugestoesEquipamentosDiv,
      catalogoEquipamentosCache,
      (item) => `${item.codigo} - ${item.nome}`,
      "id"
    );
  }

  init();
});
