document.addEventListener("DOMContentLoaded", () => {
  const modalPreSelecaoInspecaoEl = document.getElementById(
    "modalPreSelecaoInspecao"
  );
  const btnInspecaoNormal = document.getElementById("btnInspecaoNormal");
  const btnInspecaoAvulsa = document.getElementById("btnInspecaoAvulsa");
  const btnCancelarPreSelecao = document.getElementById(
    "btnCancelarPreSelecao"
  );

  const paginaTitulo = document.getElementById("paginaTitulo");
  const formChecklistInspecao = document.getElementById(
    "formChecklistInspecao"
  );
  const inspecaoSubestacaoSelect =
    document.getElementById("inspecaoSubestacao");
  const inspecaoResponsavelSelect = document.getElementById(
    "inspecaoResponsavel"
  );
  const tipoInspecaoSelect = document.getElementById("tipoInspecao");
  const btnSalvarInspecao = document.getElementById("btnSalvarInspecao");
  const btnCancelarChecklist = document.getElementById("btnCancelarChecklist");
  const btnSalvarGerarServico = document.getElementById(
    "btnSalvarGerarServico"
  );

  const checklistContainer = document.getElementById("checklistContainer");
  const formInspecaoAvulsaContainer = document.getElementById(
    "formInspecaoAvulsaContainer"
  );

  const checklistItensContainer = document.getElementById(
    "checklistItensContainer"
  );
  const btnAdicionarMedicao = document.getElementById("btnAdicionarMedicao");
  const containerMedicoesDinamicas = document.getElementById(
    "containerMedicoesDinamicas"
  );
  const templateLinhaMedicao = document.getElementById("templateLinhaMedicao");
  const nenhumaMedicaoAdicionadaMsg = document.getElementById(
    "nenhumaMedicaoAdicionada"
  );
  const btnAdicionarEquipamentoObservado = document.getElementById(
    "btnAdicionarEquipamentoObservado"
  );
  const containerEquipamentosObservados = document.getElementById(
    "containerEquipamentosObservados"
  );
  const templateLinhaEquipamento = document.getElementById(
    "templateLinhaEquipamento"
  );
  const nenhumEquipamentoObservadoMsg = document.getElementById(
    "nenhumEquipamentoObservado"
  );
  const btnAdicionarVerificacao = document.getElementById(
    "btnAdicionarVerificacao"
  );
  const containerVerificacoesAdicionais = document.getElementById(
    "containerVerificacoesAdicionais"
  );
  const templateLinhaVerificacaoAdicional = document.getElementById(
    "templateLinhaVerificacaoAdicional"
  );
  const nenhumaVerificacaoAdicionadaMsg = document.getElementById(
    "nenhumaVerificacaoAdicionada"
  );

  const btnAdicionarEquipamentoAvulso = document.getElementById(
    "btnAdicionarEquipamentoAvulso"
  );
  const containerEquipamentosAvulsos = document.getElementById(
    "containerEquipamentosAvulsos"
  );
  const nenhumEquipamentoAvulsoMsg = document.getElementById(
    "nenhumEquipamentoAvulso"
  );
  const templateLinhaEquipamentoAvulso = document.getElementById(
    "templateLinhaEquipamentoAvulso"
  );

  const btnAnexarGeral = document.getElementById("btnAnexarGeral");
  const btnFotografarGeral = document.getElementById("btnFotografarGeral");
  const inspecaoAnexosInput = document.getElementById("inspecaoAnexosInput");
  const inspecaoAnexosCameraInput = document.getElementById(
    "inspecaoAnexosCameraInput"
  );
  const listaNomesAnexosInspecao = document.getElementById(
    "listaNomesAnexosInspecao"
  );
  const anexosGeraisExistentesContainer = document.getElementById(
    "anexosGeraisExistentesContainer"
  );

  const modalDetalhesItemEl = document.getElementById("modalDetalhesItem");
  const itemDetalhesModalDescricao = document.getElementById(
    "itemDetalhesModalDescricao"
  );
  const itemObservacaoTextarea = document.getElementById(
    "itemObservacaoTextarea"
  );
  const fotosItemInputGeral = document.getElementById("fotosItemInputGeral");
  const fotosItemInputCamera = document.getElementById("fotosItemInputCamera");
  const btnAnexarModal = document.getElementById("btnAnexarModal");
  const btnFotografarModal = document.getElementById("btnFotografarModal");
  const especificacoesFieldset = document.getElementById(
    "especificacoesFieldset"
  );
  const modalObservacaoContainer = document.getElementById(
    "modalObservacaoContainer"
  );
  const containerEspecificacoesItem = document.getElementById(
    "containerEspecificacoesItem"
  );
  const btnAdicionarEspecificacao = document.getElementById(
    "btnAdicionarEspecificacao"
  );
  const btnSalvarDetalhesItem = document.getElementById(
    "btnSalvarDetalhesItem"
  );
  const templateEspecificacaoItem = document.getElementById(
    "templateEspecificacaoItem"
  );
  const templateAnexoItem = document.getElementById("templateAnexoItem");
  const anexosItemContainer = document.getElementById("anexosItemContainer");

  const modalAnexosAvulsosEl = document.getElementById("modalAnexosAvulsos");
  const itemAvulsoModalDescricao = document.getElementById(
    "itemAvulsoModalDescricao"
  );
  const btnAnexarAvulsoModal = document.getElementById("btnAnexarAvulsoModal");
  const btnFotografarAvulsoModal = document.getElementById(
    "btnFotografarAvulsoModal"
  );
  const fotosItemAvulsoInputGeral = document.getElementById(
    "fotosItemAvulsoInputGeral"
  );
  const fotosItemAvulsoInputCamera = document.getElementById(
    "fotosItemAvulsoInputCamera"
  );
  const anexosItemAvulsoContainer = document.getElementById(
    "anexosItemAvulsoContainer"
  );
  const anexosAvulsosExistentesContainer = document.getElementById(
    "anexosAvulsosExistentesContainer"
  );
  const templateAnexoExistente = document.getElementById(
    "templateAnexoExistente"
  );

  let currentInspectionType = null;
  let isEditMode = false;
  let editInspecaoId = null;
  let checklistTemplateFromAPI = [];
  let checklistState = {};
  let avulsoItems = [];
  let currentEditingContext = { type: null, id: null };
  let generalAttachments = [];
  let modalAttachments = [];
  let anexosParaDeletar = [];

  const urlParams = new URLSearchParams(window.location.search);
  editInspecaoId = urlParams.get("editarId");
  isEditMode = !!editInspecaoId;

  async function uploadFile(file) {
    const formData = new FormData();
    formData.append("anexo", file);

    try {
      const response = await fetch("/api/inspecoes/upload-temporario", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Erro de comunicação com o servidor." }));
        throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Falha no upload:", error);
      throw error;
    }
  }

  if (isEditMode) {
    hidePreSelectionModal();
    carregarDadosParaEdicao(editInspecaoId);
  } else {
    showModal(modalPreSelecaoInspecaoEl);
  }

  function showModal(modalEl) {
    if (modalEl) modalEl.style.display = "flex";
  }

  function hideModal(modalEl) {
    if (modalEl) modalEl.style.display = "none";
  }

  function hidePreSelectionModal() {
    if (modalPreSelecaoInspecaoEl)
      modalPreSelecaoInspecaoEl.style.display = "none";
  }

  btnInspecaoNormal.addEventListener("click", () => {
    currentInspectionType = "checklist";
    paginaTitulo.innerHTML = `<span class="material-symbols-outlined">checklist_rtl</span> Checklist de Inspeção Padrão`;
    hidePreSelectionModal();
    checklistContainer.classList.remove("hidden");
    formInspecaoAvulsaContainer.classList.add("hidden");
    initChecklistForm();
  });

  btnInspecaoAvulsa.addEventListener("click", () => {
    currentInspectionType = "avulsa";
    paginaTitulo.innerHTML = `<span class="material-symbols-outlined">post_add</span> Inspeção Avulsa`;
    tipoInspecaoSelect.value = "AVULSA";
    hidePreSelectionModal();
    checklistContainer.classList.add("hidden");
    formInspecaoAvulsaContainer.classList.remove("hidden");
    initCommonFields();
  });

  btnCancelarPreSelecao.addEventListener("click", () => {
    window.location.href = "/subestacoes-dashboard";
  });

  if (modalDetalhesItemEl) {
    modalDetalhesItemEl.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("modal") ||
        e.target.classList.contains("btn-close") ||
        e.target.closest(".btn-close") ||
        e.target.classList.contains("btn-close-modal")
      ) {
        hideModal(modalDetalhesItemEl);
      }
    });
  }

  if (modalAnexosAvulsosEl) {
    modalAnexosAvulsosEl
      .querySelectorAll(".btn-close, .btn-close-modal")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const item = avulsoItems.find(
            (i) => i.temp_id === currentEditingContext.id
          );
          if (item) {
            item.anexos = [...modalAttachments];
          }
          hideModal(modalAnexosAvulsosEl);
          renderAvulsoItems();
        });
      });
  }

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
      alert(`Erro: ${error.message}`);
      throw error;
    }
  }

  async function popularSelects() {
    try {
      const [subestacoes, usuarios] = await Promise.all([
        fetchData("/subestacoes"),
        fetchData("/usuarios-responsaveis-para-servicos"),
      ]);
      inspecaoSubestacaoSelect.innerHTML =
        '<option value="">Selecione...</option>';
      subestacoes.forEach((sub) => {
        inspecaoSubestacaoSelect.innerHTML += `<option value="${sub.Id}">${sub.sigla} - ${sub.nome}</option>`;
      });
      inspecaoResponsavelSelect.innerHTML =
        '<option value="">Selecione...</option>';
      usuarios.forEach((user) => {
        inspecaoResponsavelSelect.innerHTML += `<option value="${user.id}">${user.nome}</option>`;
      });
    } catch (error) {
      console.error("Erro ao popular selects:", error);
    }
  }

  async function initCommonFields() {
    await popularSelects();
    if (!isEditMode) {
      document.getElementById("inspecaoDataAvaliacao").value = new Date()
        .toISOString()
        .split("T")[0];
    }
  }

  async function carregarDadosParaEdicao(id) {
    paginaTitulo.innerHTML = `<span class="material-symbols-outlined">edit</span> Editando Inspeção #${id}`;
    btnSalvarInspecao.innerHTML =
      '<span class="material-symbols-outlined">save</span> Salvar Alterações';

    try {
      const inspecao = await fetchData(`/inspecoes-subestacoes/${id}`);
      await initCommonFields();

      formChecklistInspecao.elements.subestacao_id.value =
        inspecao.subestacao_id;
      formChecklistInspecao.elements.responsavel_levantamento_id.value =
        inspecao.responsavel_levantamento_id;
      formChecklistInspecao.elements.tipo_inspecao.value =
        inspecao.tipo_inspecao;
      formChecklistInspecao.elements.processo.value = inspecao.processo || "";
      formChecklistInspecao.elements.data_avaliacao.value =
        inspecao.data_avaliacao;
      formChecklistInspecao.elements.hora_inicial.value = inspecao.hora_inicial;
      formChecklistInspecao.elements.hora_final.value =
        inspecao.hora_final || "";
      formChecklistInspecao.elements.observacoes_gerais.value =
        inspecao.observacoes_gerais || "";

      currentInspectionType = inspecao.modo_inspecao.toLowerCase();

      if (currentInspectionType === "checklist") {
        paginaTitulo.innerHTML = `<span class="material-symbols-outlined">edit</span> Editando Inspeção Padrão #${id}`;
        checklistContainer.classList.remove("hidden");
        formInspecaoAvulsaContainer.classList.add("hidden");
        await initChecklistForm(inspecao);
      } else if (currentInspectionType === "avulsa") {
        paginaTitulo.innerHTML = `<span class="material-symbols-outlined">edit</span> Editando Inspeção Avulsa #${id}`;
        checklistContainer.classList.add("hidden");
        formInspecaoAvulsaContainer.classList.remove("hidden");
        avulsoItems = inspecao.itens_avulsos.map((item) => ({
          ...item,
          temp_id: item.id,
          anexos: [],
          anexos_existentes: item.anexos || [],
        }));
        renderAvulsoItems();
        checkAnormalidades();
      }

      const anexosGeraisExistentes = inspecao.anexos.filter(
        (a) => a.categoria_anexo === "INSPECAO_GERAL"
      );
      renderAnexosExistentes(
        anexosGeraisExistentes,
        anexosGeraisExistentesContainer
      );
    } catch (error) {
      alert(`Erro ao carregar dados da inspeção para edição: ${error.message}`);
      window.location.href = "/pagina-listagem-inspecoes-subestacoes";
    }
  }

  function checkAnormalidades() {
    const temAnormal = avulsoItems.some((item) => item.condicao === "Anormal");
    btnSalvarGerarServico.classList.toggle("hidden", !temAnormal);
  }

  function renderAvulsoItemPreviews(item, container) {
    container.innerHTML = "";
    if (item.anexos && item.anexos.length > 0) {
      item.anexos.forEach((anexo) => {
        const img = document.createElement("img");
        img.src = anexo.previewUrl;
        img.className = "avulso-anexo-thumbnail";
        img.title = anexo.originalName;
        container.appendChild(img);
      });
    }
  }

  function renderAvulsoItems() {
    containerEquipamentosAvulsos.innerHTML = "";
    if (avulsoItems.length === 0) {
      nenhumEquipamentoAvulsoMsg.style.display = "block";
      return;
    }
    nenhumEquipamentoAvulsoMsg.style.display = "none";

    avulsoItems.forEach((item, index) => {
      const clone = templateLinhaEquipamentoAvulso.content.cloneNode(true);
      const itemEl = clone.querySelector(".avulso-item");
      itemEl.dataset.tempId = item.temp_id;

      const equipamentoInput = itemEl.querySelector(
        ".avulso-equipamento-input"
      );
      const tagInput = itemEl.querySelector(".avulso-tag-input");
      const descricaoTextarea = itemEl.querySelector(
        ".avulso-descricao-textarea"
      );
      const previewContainer = itemEl.querySelector(
        ".avulso-anexos-preview-container"
      );

      equipamentoInput.value = item.equipamento;
      tagInput.value = item.tag;
      descricaoTextarea.value = item.descricao;

      equipamentoInput.addEventListener(
        "input",
        (e) => (item.equipamento = e.target.value)
      );
      tagInput.addEventListener("input", (e) => (item.tag = e.target.value));
      descricaoTextarea.addEventListener(
        "input",
        (e) => (item.descricao = e.target.value)
      );

      const radios = itemEl.querySelectorAll(".avulso-condicao-radio");
      radios.forEach((radio) => {
        const radioId = `avulso_condicao_${item.temp_id}_${radio.value}`;
        radio.id = radioId;
        radio.name = `avulso_condicao_${item.temp_id}`;
        radio.nextElementSibling.setAttribute("for", radioId);
        if (radio.value === item.condicao) {
          radio.checked = true;
        }
        radio.addEventListener("change", (e) => {
          item.condicao = e.target.value;
          checkAnormalidades();
        });
      });

      itemEl
        .querySelector(".btn-remover-linha")
        .addEventListener("click", () => {
          avulsoItems.splice(index, 1);
          renderAvulsoItems();
          checkAnormalidades();
        });

      itemEl
        .querySelector(".btn-anexar-avulso")
        .addEventListener("click", () => {
          abrirModalAnexosAvulsos(item.temp_id);
        });

      renderAvulsoItemPreviews(item, previewContainer);
      containerEquipamentosAvulsos.appendChild(itemEl);
    });
  }

  btnAdicionarEquipamentoAvulso.addEventListener("click", () => {
    avulsoItems.push({
      temp_id: `avulso_${Date.now()}`,
      equipamento: "",
      tag: "",
      condicao: null,
      descricao: "",
      anexos: [],
      anexos_existentes: [],
    });
    renderAvulsoItems();
  });

  function abrirModalAnexosAvulsos(tempId) {
    currentEditingContext = { type: "avulso", id: tempId };
    const item = avulsoItems.find((i) => i.temp_id === tempId);
    if (!item) return;

    itemAvulsoModalDescricao.textContent = `Anexos para: ${
      item.equipamento || "Novo Equipamento"
    }`;
    modalAttachments = [...item.anexos];
    renderAnexosExistentes(
      item.anexos_existentes,
      anexosAvulsosExistentesContainer
    );
    renderAnexosModal();
    showModal(modalAnexosAvulsosEl);
  }

  function renderAnexosModal() {
    const container =
      currentEditingContext.type === "avulso"
        ? anexosItemAvulsoContainer
        : anexosItemContainer;
    container.innerHTML = "";
    modalAttachments.forEach((anexo, index) => {
      const clone = templateAnexoItem.content.cloneNode(true);
      const bloco = clone.querySelector(".anexo-item-bloco");

      bloco.querySelector(".anexo-preview-img").src = anexo.previewUrl;
      bloco.querySelector(".anexo-nome-original").textContent =
        anexo.originalName;

      const statusEl = document.createElement("div");
      statusEl.className = "anexo-status";
      bloco.querySelector(".anexo-info").appendChild(statusEl);

      const removeBtn = bloco.querySelector(".btn-remover-anexo");
      removeBtn.addEventListener("click", () => {
        modalAttachments.splice(index, 1);
        URL.revokeObjectURL(anexo.previewUrl);
        renderAnexosModal();
      });

      if (anexo.status === "uploading") {
        statusEl.innerHTML =
          '<div class="loading-spinner-small"></div> Carregando...';
        removeBtn.disabled = true;
      } else if (anexo.status === "error") {
        statusEl.textContent = "Falha no upload";
        statusEl.style.color = "red";
        removeBtn.disabled = false;
      } else {
        statusEl.textContent = "Concluído";
        statusEl.style.color = "green";
        removeBtn.disabled = false;
      }

      const select = bloco.querySelector(".anexo-associacao-select");
      if (currentEditingContext.type === "item") {
        select.style.display = "block";
        select.addEventListener(
          "change",
          (e) => (anexo.associado_a = e.target.value)
        );
      } else {
        select.style.display = "none";
      }

      container.appendChild(bloco);
    });
    if (currentEditingContext.type === "item") {
      atualizarDropdownsDeAssociacao();
    }
  }

  async function handleModalFiles(files) {
    const newAttachments = Array.from(files).map((file) => ({
      temp_id: `anexo_${Date.now()}_${Math.random()}`,
      file: file,
      previewUrl: URL.createObjectURL(file),
      originalName: file.name,
      status: "uploading",
      associado_a: "geral",
    }));

    modalAttachments.push(...newAttachments);
    renderAnexosModal();

    for (const anexo of newAttachments) {
      try {
        const result = await uploadFile(anexo.file);
        anexo.status = "uploaded";
        anexo.tempFileName = result.tempFileName;
      } catch (error) {
        anexo.status = "error";
      }
      renderAnexosModal();
    }

    fotosItemAvulsoInputGeral.value = "";
    fotosItemAvulsoInputCamera.value = "";
    fotosItemInputGeral.value = "";
    fotosItemInputCamera.value = "";
  }

  btnAnexarAvulsoModal.addEventListener("click", () =>
    fotosItemAvulsoInputGeral.click()
  );
  btnFotografarAvulsoModal.addEventListener("click", () =>
    fotosItemAvulsoInputCamera.click()
  );
  fotosItemAvulsoInputGeral.addEventListener("change", (e) =>
    handleModalFiles(e.target.files)
  );
  fotosItemAvulsoInputCamera.addEventListener("change", (e) =>
    handleModalFiles(e.target.files)
  );

  async function initChecklistForm(inspecaoParaEditar = null) {
    if (!inspecaoParaEditar) {
      await initCommonFields();
    }

    checklistTemplateFromAPI = await fetchData("/api/checklist/modelo/padrao");

    checklistState = {
      itens: {},
      medicoes: [],
      equipamentosObservados: [],
      verificacoesAdicionais: [],
    };

    if (inspecaoParaEditar) {
      inspecaoParaEditar.itens.forEach((itemEditado) => {
        checklistState.itens[itemEditado.item_checklist_id] = {
          avaliacao: itemEditado.avaliacao,
          observacao_item: itemEditado.observacao_item || "",
          especificacoes:
            itemEditado.especificacoes.map((e) => ({ ...e, temp_id: e.id })) ||
            [],
          anexos: [],
          anexos_existentes:
            inspecaoParaEditar.anexos.filter(
              (a) => a.item_resposta_id === itemEditado.resposta_id
            ) || [],
        };
      });
    } else {
      checklistTemplateFromAPI.forEach((grupo) => {
        grupo.itens.forEach((item) => {
          checklistState.itens[item.id] = {
            avaliacao: null,
            observacao_item: "",
            especificacoes: [],
            anexos: [],
            anexos_existentes: [],
          };
        });
      });
    }

    gerarItensChecklist();

    if (inspecaoParaEditar) {
      Object.keys(checklistState.itens).forEach((itemId) => {
        atualizarEstiloBotaoDetalhes(itemId);
      });
    }
  }

  function gerarItensChecklist() {
    checklistItensContainer.innerHTML = "";
    let itemCounter = 1;
    checklistTemplateFromAPI.forEach((grupo) => {
      const grupoSection = document.createElement("div");
      grupoSection.className = "checklist-grupo";
      grupoSection.innerHTML = `<div class="checklist-grupo-header"><h3><span class="material-symbols-outlined">${
        grupo.icone || "inventory_2"
      }</span> ${grupo.nome_grupo}</h3></div>`;
      const itensList = document.createElement("div");
      grupo.itens.forEach((item) => {
        const itemState = checklistState.itens[item.id];
        const itemDiv = document.createElement("div");
        itemDiv.className = "checklist-item";
        itemDiv.setAttribute("data-item-id", item.id);
        itemDiv.innerHTML = `
          <div class="item-numero">${itemCounter++}.</div>
          <div class="item-descricao">${item.descricao_item}</div>
          <div class="item-controls">
            <div class="item-avaliacao btn-group" role="group">
              <input type="radio" class="btn-check" name="item_${
                item.id
              }_avaliacao" id="item_${
          item.id
        }_n" value="N" required autocomplete="off" ${
          itemState.avaliacao === "N" ? "checked" : ""
        }><label class="btn btn-n" for="item_${item.id}_n">N</label>
              <input type="radio" class="btn-check" name="item_${
                item.id
              }_avaliacao" id="item_${
          item.id
        }_a" value="A" autocomplete="off" ${
          itemState.avaliacao === "A" ? "checked" : ""
        }><label class="btn btn-a" for="item_${item.id}_a">A</label>
              <input type="radio" class="btn-check" name="item_${
                item.id
              }_avaliacao" id="item_${
          item.id
        }_na" value="NA" autocomplete="off" ${
          itemState.avaliacao === "NA" ? "checked" : ""
        }><label class="btn btn-na" for="item_${item.id}_na">NA</label>
            </div>
            <button type="button" class="btn btn-detalhes-item" title="Adicionar Observação e Anexos">
              <span class="material-symbols-outlined feedback-icon">attachment</span>
              Anexar/Obs
            </button>
          </div>`;
        itemDiv
          .querySelector(".btn-detalhes-item")
          .addEventListener("click", () =>
            abrirModalParaItem({
              type: "item",
              id: item.id,
              desc: item.descricao_item,
            })
          );
        itemDiv
          .querySelectorAll(`input[name="item_${item.id}_avaliacao"]`)
          .forEach((radio) => {
            radio.addEventListener("change", (e) => {
              checklistState.itens[item.id].avaliacao = e.target.value;
              atualizarEstiloBotaoDetalhes(item.id);
            });
          });
        itensList.appendChild(itemDiv);
      });
      grupoSection.appendChild(itensList);
      checklistItensContainer.appendChild(grupoSection);
    });
  }

  function getStateObject(context) {
    if (context.type === "item") return checklistState.itens[context.id];
    if (context.type === "medicao")
      return checklistState.medicoes.find((i) => i.temp_id === context.id);
    if (context.type === "equipamentoObservado")
      return checklistState.equipamentosObservados.find(
        (i) => i.temp_id === context.id
      );
    return null;
  }

  function abrirModalParaItem(context) {
    currentEditingContext = context;
    itemDetalhesModalDescricao.textContent = `Item: ${context.desc}`;
    const isChecklistItem = context.type === "item";
    especificacoesFieldset.style.display = isChecklistItem ? "block" : "none";
    modalObservacaoContainer.style.display = isChecklistItem ? "block" : "none";
    const state = getStateObject(context);
    if (!state) return;
    if (isChecklistItem) {
      itemObservacaoTextarea.value = state.observacao_item;
      containerEspecificacoesItem.innerHTML = "";
      state.especificacoes.forEach((spec) =>
        adicionarBlocoEspecificacaoDOM(spec)
      );
    }
    modalAttachments = [...state.anexos];
    renderAnexosExistentes(state.anexos_existentes, anexosItemContainer);
    renderAnexosModal();
    showModal(modalDetalhesItemEl);
  }

  function adicionarBlocoEspecificacaoDOM(spec) {
    const clone = templateEspecificacaoItem.content.cloneNode(true);
    const bloco = clone.querySelector(".especificacao-item-bloco");
    bloco.setAttribute("data-temp-id", spec.temp_id);
    const descInput = bloco.querySelector(".descricao-equipamento-input");
    const obsInput = bloco.querySelector(".observacao-especificacao-input");
    descInput.value = spec.descricao_equipamento;
    obsInput.value = spec.observacao;
    descInput.addEventListener("input", (e) => {
      spec.descricao_equipamento = e.target.value;
      atualizarDropdownsDeAssociacao();
    });
    obsInput.addEventListener(
      "input",
      (e) => (spec.observacao = e.target.value)
    );
    bloco
      .querySelector(".btn-remover-especificacao")
      .addEventListener("click", () => {
        const state = getStateObject(currentEditingContext);
        state.especificacoes = state.especificacoes.filter(
          (s) => s.temp_id !== spec.temp_id
        );
        modalAttachments.forEach((anexo) => {
          if (anexo.associado_a === spec.temp_id) anexo.associado_a = "geral";
        });
        bloco.remove();
        atualizarDropdownsDeAssociacao();
      });
    containerEspecificacoesItem.appendChild(bloco);
  }

  function atualizarDropdownsDeAssociacao() {
    const state = getStateObject(currentEditingContext);
    if (!state || currentEditingContext.type !== "item") return;
    const optionsHtml =
      '<option value="geral">Anexo Geral do Item</option>' +
      state.especificacoes
        .map(
          (spec) =>
            `<option value="${spec.temp_id}">${
              spec.descricao_equipamento || "Equipamento sem nome"
            }</option>`
        )
        .join("");
    anexosItemContainer
      .querySelectorAll(".anexo-item-bloco")
      .forEach((bloco) => {
        const select = bloco.querySelector(".anexo-associacao-select");
        const anexoOriginalName = bloco.querySelector(
          ".anexo-nome-original"
        ).textContent;
        const anexoState = modalAttachments.find(
          (a) => a.originalName === anexoOriginalName
        );
        if (select && anexoState) {
          const currentValue = select.value;
          select.innerHTML = optionsHtml;
          select.value = state.especificacoes.some(
            (s) => s.temp_id === currentValue
          )
            ? currentValue
            : "geral";
          anexoState.associado_a = select.value;
        }
      });
  }

  btnAdicionarEspecificacao.addEventListener("click", () => {
    const state = getStateObject(currentEditingContext);
    const newSpec = {
      temp_id: `spec_${Date.now()}`,
      descricao_equipamento: "",
      observacao: "",
    };
    state.especificacoes.push(newSpec);
    adicionarBlocoEspecificacaoDOM(newSpec);
    atualizarDropdownsDeAssociacao();
  });

  btnAnexarModal.addEventListener("click", () => fotosItemInputGeral.click());
  btnFotografarModal.addEventListener("click", () =>
    fotosItemInputCamera.click()
  );
  fotosItemInputGeral.addEventListener("change", (e) =>
    handleModalFiles(e.target.files)
  );
  fotosItemInputCamera.addEventListener("change", (e) =>
    handleModalFiles(e.target.files)
  );

  btnSalvarDetalhesItem.addEventListener("click", () => {
    const state = getStateObject(currentEditingContext);
    if (state) {
      state.anexos = [...modalAttachments];
      if (currentEditingContext.type === "item") {
        state.observacao_item = itemObservacaoTextarea.value;
        atualizarEstiloBotaoDetalhes(currentEditingContext.id);
      }
    }
    hideModal(modalDetalhesItemEl);
  });

  function atualizarEstiloBotaoDetalhes(itemId) {
    const itemDiv = document.querySelector(
      `.checklist-item[data-item-id="${itemId}"]`
    );
    if (!itemDiv) return;
    const btn = itemDiv.querySelector(".btn-detalhes-item");
    const icon = btn.querySelector(".feedback-icon");
    const state = checklistState.itens[itemId];
    btn.classList.remove("normal", "anormal", "na");
    if (state.avaliacao === "N") btn.classList.add("normal");
    else if (state.avaliacao === "A") btn.classList.add("anormal");
    else if (state.avaliacao === "NA") btn.classList.add("na");
    const temAnexos =
      state.anexos.length > 0 || state.anexos_existentes.length > 0;
    icon.classList.toggle("visible", temAnexos);
  }

  function adicionarNovaLinha(
    container,
    template,
    nenhumMsg,
    itemClass,
    stateArray,
    typeName
  ) {
    if (!container || !template) return;
    const clone = template.content.cloneNode(true);
    const novaLinha = clone.querySelector(itemClass);
    const tempId = `${typeName}_${Date.now()}`;
    novaLinha.setAttribute("data-temp-id", tempId);
    if (stateArray) {
      const novoItemState = { temp_id: tempId, anexos: [] };
      stateArray.push(novoItemState);
    }
    if (nenhumMsg) nenhumMsg.style.display = "none";
    container.appendChild(novaLinha);
    novaLinha
      .querySelector(".btn-remover-linha")
      .addEventListener("click", () => {
        if (stateArray) {
          const indexToRemove = stateArray.findIndex(
            (i) => i.temp_id === tempId
          );
          if (indexToRemove > -1) stateArray.splice(indexToRemove, 1);
        }
        novaLinha.remove();
        if (container.querySelectorAll(itemClass).length === 0 && nenhumMsg) {
          nenhumMsg.style.display = "block";
        }
      });
    if (
      itemClass === ".dynamic-row-item" &&
      novaLinha.querySelector(".tipo-medicao")
    ) {
      const tipoSelect = novaLinha.querySelector(".tipo-medicao");
      const unidadeInput = novaLinha.querySelector(".unidade-medida");
      tipoSelect.addEventListener("change", () => {
        switch (tipoSelect.value) {
          case "TEMPERATURA_OLEO":
          case "TEMPERATURA_ENROLAMENTO":
            unidadeInput.value = "°C";
            break;
          case "NIVEL_OLEO":
          case "BATERIA_MONITOR":
            unidadeInput.value = "%";
            break;
          case "CONTADOR_OPERACOES":
            unidadeInput.value = "Qtd";
            break;
          default:
            unidadeInput.value = "";
        }
      });
    }
    const btnAnexar = novaLinha.querySelector(".btn-anexar-dinamico");
    if (btnAnexar) {
      btnAnexar.addEventListener("click", () => {
        abrirModalParaItem({
          type: typeName,
          id: tempId,
          desc: `Anexos para ${typeName}`,
        });
      });
    }
  }

  btnAdicionarMedicao.addEventListener("click", () =>
    adicionarNovaLinha(
      containerMedicoesDinamicas,
      templateLinhaMedicao,
      nenhumaMedicaoAdicionadaMsg,
      ".dynamic-row-item",
      checklistState.medicoes,
      "medicao"
    )
  );
  btnAdicionarEquipamentoObservado.addEventListener("click", () =>
    adicionarNovaLinha(
      containerEquipamentosObservados,
      templateLinhaEquipamento,
      nenhumEquipamentoObservadoMsg,
      ".dynamic-row-item",
      checklistState.equipamentosObservados,
      "equipamentoObservado"
    )
  );
  btnAdicionarVerificacao.addEventListener("click", () =>
    adicionarNovaLinha(
      containerVerificacoesAdicionais,
      templateLinhaVerificacaoAdicional,
      nenhumaVerificacaoAdicionadaMsg,
      ".dynamic-row-item",
      checklistState.verificacoesAdicionais,
      "verificacao"
    )
  );

  btnAnexarGeral.addEventListener("click", () => inspecaoAnexosInput.click());
  btnFotografarGeral.addEventListener("click", () =>
    inspecaoAnexosCameraInput.click()
  );

  async function handleGeneralFiles(event) {
    const files = Array.from(event.target.files);
    event.target.value = "";

    const newAttachments = files.map((file) => ({
      temp_id: `anexo_${Date.now()}_${Math.random()}`,
      file: file,
      previewUrl: URL.createObjectURL(file),
      originalName: file.name,
      status: "uploading",
    }));

    generalAttachments.push(...newAttachments);
    renderGeneralAttachmentsList();

    for (const anexo of newAttachments) {
      try {
        const result = await uploadFile(anexo.file);
        anexo.status = "uploaded";
        anexo.tempFileName = result.tempFileName;
      } catch (error) {
        anexo.status = "error";
      }
      renderGeneralAttachmentsList();
    }
  }

  inspecaoAnexosInput.addEventListener("change", handleGeneralFiles);
  inspecaoAnexosCameraInput.addEventListener("change", handleGeneralFiles);

  function renderGeneralAttachmentsList() {
    listaNomesAnexosInspecao.innerHTML = "";
    generalAttachments.forEach((anexo, index) => {
      const anexoEl = document.createElement("div");
      anexoEl.className = "anexo-item-bloco";
      anexoEl.innerHTML = `
        <img src="${anexo.previewUrl}" class="anexo-preview-img" alt="Preview">
        <div class="anexo-info">
            <div class="anexo-nome-original">${anexo.originalName}</div>
            <div class="anexo-status"></div>
        </div>
        <button type="button" class="btn-remover-anexo" title="Remover anexo">
            <span class="material-symbols-outlined">delete</span>
        </button>`;

      const statusEl = anexoEl.querySelector(".anexo-status");
      const removeBtn = anexoEl.querySelector(".btn-remover-anexo");

      if (anexo.status === "uploading") {
        statusEl.innerHTML = '<div class="loading-spinner-small"></div>';
        removeBtn.disabled = true;
      } else if (anexo.status === "error") {
        statusEl.textContent = "Falha no upload";
        statusEl.style.color = "red";
        removeBtn.disabled = false;
      } else {
        statusEl.textContent = "Concluído";
        statusEl.style.color = "green";
        removeBtn.disabled = false;
      }

      removeBtn.addEventListener("click", () => {
        generalAttachments.splice(index, 1);
        renderGeneralAttachmentsList();
      });
      listaNomesAnexosInspecao.appendChild(anexoEl);
    });
  }

  function renderAnexosExistentes(anexos, container) {
    container.innerHTML = "";
    if (!anexos || anexos.length === 0) return;

    anexos.forEach((anexo) => {
      const clone = templateAnexoExistente.content.cloneNode(true);
      const itemEl = clone.querySelector(".anexo-existente-item");
      const linkEl = itemEl.querySelector(".anexo-existente-link");
      const nomeEl = itemEl.querySelector(".anexo-existente-nome");
      const btnRemover = itemEl.querySelector(".btn-remover-anexo-existente");

      linkEl.href = anexo.caminho_servidor;
      nomeEl.textContent = anexo.nome_original;

      btnRemover.addEventListener("click", () => {
        if (itemEl.classList.toggle("marcado-para-remocao")) {
          anexosParaDeletar.push(anexo.id);
        } else {
          const index = anexosParaDeletar.indexOf(anexo.id);
          if (index > -1) {
            anexosParaDeletar.splice(index, 1);
          }
        }
      });

      container.appendChild(itemEl);
    });
  }

  formChecklistInspecao.addEventListener("submit", async (event) => {
    event.preventDefault();
    btnSalvarInspecao.disabled = true;
    btnSalvarInspecao.innerHTML = `Salvando...`;

    const formElements = formChecklistInspecao.elements;
    const payload = {
      subestacao_id: formElements.subestacao_id.value,
      responsavel_levantamento_id:
        formElements.responsavel_levantamento_id.value,
      tipo_inspecao: formElements.tipo_inspecao.value,
      processo: formElements.processo.value,
      data_avaliacao: formElements.data_avaliacao.value,
      hora_inicial: formElements.hora_inicial.value,
      hora_final: formElements.hora_final.value,
      observacoes_gerais: formElements.observacoes_gerais.value,
      inspection_mode: currentInspectionType,
    };

    if (isEditMode) {
      payload.anexos_para_deletar = anexosParaDeletar;
    }

    if (currentInspectionType === "checklist") {
      payload.checklist_items = Object.entries(checklistState.itens).map(
        ([itemId, itemData]) => ({
          item_checklist_id: itemId,
          avaliacao: itemData.avaliacao,
          observacao_item: itemData.observacao_item,
          especificacoes: itemData.especificacoes,
          anexos: itemData.anexos
            .filter((a) => a.status === "uploaded")
            .map((a) => ({
              tempFileName: a.tempFileName,
              originalName: a.originalName,
              associado_a: a.associado_a,
            })),
        })
      );

      const getDynamicRowData = (container, categoria, stateArray) => {
        const items = [];
        container.querySelectorAll(".dynamic-row-item").forEach((row) => {
          const temp_id = row.dataset.tempId;
          const stateItem = stateArray.find((i) => i.temp_id === temp_id);
          items.push({
            categoria: categoria,
            tipo: row.querySelector(
              ".tipo-medicao, .tipo-equipamento-observado"
            )?.value,
            tag: row.querySelector(
              ".tag-equipamento-medicao, .tag-equipamento-observado"
            )?.value,
            valor: row.querySelector(".valor-medido")?.value,
            unidade: row.querySelector(".unidade-medida")?.value,
            obs: row.querySelector(".obs-medicao, .obs-equipamento-observado")
              ?.value,
            anexos: stateItem.anexos
              .filter((a) => a.status === "uploaded")
              .map((a) => ({
                tempFileName: a.tempFileName,
                originalName: a.originalName,
              })),
          });
        });
        return items;
      };

      payload.registros_dinamicos = [
        ...getDynamicRowData(
          containerMedicoesDinamicas,
          "MEDICAO",
          checklistState.medicoes
        ),
        ...getDynamicRowData(
          containerEquipamentosObservados,
          "EQUIPAMENTO_OBSERVADO",
          checklistState.equipamentosObservados
        ),
      ];
    } else if (currentInspectionType === "avulsa") {
      payload.avulsa_items = avulsoItems.map((item) => ({
        temp_id: item.temp_id,
        equipamento: item.equipamento,
        tag: item.tag,
        condicao: item.condicao,
        descricao: item.descricao,
        anexos: item.anexos
          .filter((a) => a.status === "uploaded")
          .map((a) => ({
            tempFileName: a.tempFileName,
            originalName: a.originalName,
          })),
      }));
    }

    payload.anexosGerais = generalAttachments
      .filter((a) => a.status === "uploaded")
      .map((a) => ({
        tempFileName: a.tempFileName,
        originalName: a.originalName,
      }));

    const url = isEditMode
      ? `/inspecoes-subestacoes/${editInspecaoId}`
      : "/inspecoes-subestacoes";
    const method = isEditMode ? "PUT" : "POST";

    try {
      await fetchData(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      alert(`Inspeção ${isEditMode ? "atualizada" : "salva"} com sucesso!`);
      window.location.href = "/pagina-listagem-inspecoes-subestacoes";
    } catch (error) {
      alert(`Falha ao salvar inspeção: ${error.message}`);
    } finally {
      btnSalvarInspecao.disabled = false;
      btnSalvarInspecao.innerHTML = `<span class="material-symbols-outlined">save</span> ${
        isEditMode ? "Salvar Alterações" : "Salvar Inspeção"
      }`;
    }
  });

  btnCancelarChecklist.addEventListener("click", () => {
    if (
      confirm(
        "Cancelar e limpar o formulário? Os dados não salvos serão perdidos."
      )
    ) {
      window.location.href = "/pagina-listagem-inspecoes-subestacoes";
    }
  });
});
