document.addEventListener("DOMContentLoaded", () => {
  const formChecklistInspecao = document.getElementById(
    "formChecklistInspecao"
  );
  const inspecaoSubestacaoSelect =
    document.getElementById("inspecaoSubestacao");
  const inspecaoResponsavelSelect = document.getElementById(
    "inspecaoResponsavel"
  );
  const checklistItensContainer = document.getElementById(
    "checklistItensContainer"
  );
  const btnSalvarInspecao = document.getElementById("btnSalvarInspecao");
  const btnCancelarChecklist = document.getElementById("btnCancelarChecklist");

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

  const btnAnexarGeral = document.getElementById("btnAnexarGeral");
  const btnFotografarGeral = document.getElementById("btnFotografarGeral");
  const inspecaoAnexosInput = document.getElementById("inspecaoAnexosInput");
  const inspecaoAnexosCameraInput = document.getElementById(
    "inspecaoAnexosCameraInput"
  );
  const listaNomesAnexosInspecao = document.getElementById(
    "listaNomesAnexosInspecao"
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

  let checklistTemplateFromAPI = [];
  let checklistState = {};
  let currentEditingContext = { type: null, id: null };
  let generalAttachments = [];

  function showModal(modalEl) {
    modalEl.style.display = "flex";
    setTimeout(() => {
      modalEl.classList.add("show");
    }, 10);
  }

  function hideModal(modalEl) {
    modalEl.classList.remove("show");
    setTimeout(() => {
      modalEl.style.display = "none";
    }, 200);
  }

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

  function initializeState() {
    checklistState = {
      itens: {},
      medicoes: [],
      equipamentosObservados: [],
    };
    checklistTemplateFromAPI.forEach((grupo) => {
      grupo.itens.forEach((item) => {
        checklistState.itens[item.id] = {
          avaliacao: null,
          observacao_item: "",
          especificacoes: [],
          anexos: [],
        };
      });
    });
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
        }_n" value="N" required autocomplete="off"><label class="btn btn-n" for="item_${
          item.id
        }_n">N</label>
              <input type="radio" class="btn-check" name="item_${
                item.id
              }_avaliacao" id="item_${
          item.id
        }_a" value="A" autocomplete="off"><label class="btn btn-a" for="item_${
          item.id
        }_a">A</label>
              <input type="radio" class="btn-check" name="item_${
                item.id
              }_avaliacao" id="item_${
          item.id
        }_na" value="NA" autocomplete="off"><label class="btn btn-na" for="item_${
          item.id
        }_na">NA</label>
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
    if (context.type === "item") {
      return checklistState.itens[context.id];
    }
    if (context.type === "medicao") {
      return checklistState.medicoes.find((i) => i.temp_id === context.id);
    }
    if (context.type === "equipamentoObservado") {
      return checklistState.equipamentosObservados.find(
        (i) => i.temp_id === context.id
      );
    }
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
    }

    renderizarModal();
    showModal(modalDetalhesItemEl);
  }

  function renderizarModal() {
    const state = getStateObject(currentEditingContext);
    if (!state) return;

    anexosItemContainer.innerHTML = "";
    state.anexos.forEach((anexo) => adicionarBlocoAnexoDOM(anexo));

    if (currentEditingContext.type === "item") {
      containerEspecificacoesItem.innerHTML = "";
      state.especificacoes.forEach((spec) =>
        adicionarBlocoEspecificacaoDOM(spec)
      );
      atualizarDropdownsDeAssociacao();
    }
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
        state.anexos.forEach((anexo) => {
          if (anexo.associado_a === spec.temp_id) {
            anexo.associado_a = "geral";
          }
        });
        renderizarModal();
      });
    containerEspecificacoesItem.appendChild(bloco);
  }

  function adicionarBlocoAnexoDOM(anexo) {
    const clone = templateAnexoItem.content.cloneNode(true);
    const bloco = clone.querySelector(".anexo-item-bloco");
    bloco.querySelector(".anexo-preview-img").src = anexo.previewUrl;
    bloco.querySelector(".anexo-nome-original").textContent = anexo.file.name;
    bloco.querySelector(".btn-remover-anexo").addEventListener("click", () => {
      const state = getStateObject(currentEditingContext);
      state.anexos = state.anexos.filter((a) => a.temp_id !== anexo.temp_id);
      URL.revokeObjectURL(anexo.previewUrl);
      renderizarModal();
    });
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
    anexosItemContainer.appendChild(bloco);
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
      .forEach((bloco, index) => {
        const select = bloco.querySelector(".anexo-associacao-select");
        const anexoState = state.anexos[index];
        select.innerHTML = optionsHtml;
        select.value = anexoState.associado_a;
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

  function handleFiles(files) {
    const state = getStateObject(currentEditingContext);
    if (!state) return;
    for (const file of files) {
      const newAnexo = {
        temp_id: `anexo_${Date.now()}_${Math.random()}`,
        file: file,
        previewUrl: URL.createObjectURL(file),
        associado_a: "geral",
      };
      state.anexos.push(newAnexo);
      adicionarBlocoAnexoDOM(newAnexo);
    }
    if (currentEditingContext.type === "item") {
      atualizarDropdownsDeAssociacao();
    }
    fotosItemInputGeral.value = "";
    fotosItemInputCamera.value = "";
  }

  btnAnexarModal.addEventListener("click", () => fotosItemInputGeral.click());
  btnFotografarModal.addEventListener("click", () =>
    fotosItemInputCamera.click()
  );
  fotosItemInputGeral.addEventListener("change", (e) =>
    handleFiles(e.target.files)
  );
  fotosItemInputCamera.addEventListener("change", (e) =>
    handleFiles(e.target.files)
  );

  btnSalvarDetalhesItem.addEventListener("click", () => {
    if (currentEditingContext.type === "item") {
      const state = getStateObject(currentEditingContext);
      state.observacao_item = itemObservacaoTextarea.value;
      atualizarEstiloBotaoDetalhes(currentEditingContext.id);
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

    const temAnexos = state.anexos.length > 0;
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
      null,
      "verificacao"
    )
  );

  btnAnexarGeral.addEventListener("click", () => inspecaoAnexosInput.click());
  btnFotografarGeral.addEventListener("click", () =>
    inspecaoAnexosCameraInput.click()
  );

  function handleGeneralFiles(event) {
    const newFiles = Array.from(event.target.files);
    generalAttachments.push(...newFiles);
    renderGeneralAttachmentsList();
    event.target.value = "";
  }

  inspecaoAnexosInput.addEventListener("change", handleGeneralFiles);
  inspecaoAnexosCameraInput.addEventListener("change", handleGeneralFiles);

  function renderGeneralAttachmentsList() {
    listaNomesAnexosInspecao.innerHTML = "";
    generalAttachments.forEach((file, index) => {
      const anexo = document.createElement("div");
      anexo.className = "anexo-item-bloco";
      anexo.innerHTML = `
            <img src="${URL.createObjectURL(
              file
            )}" class="anexo-preview-img" alt="Preview">
            <div class="anexo-info">
                <div class="anexo-nome-original">${file.name}</div>
            </div>
            <button type="button" class="btn-remover-anexo" title="Remover anexo">
                <span class="material-symbols-outlined">delete</span>
            </button>
        `;
      anexo
        .querySelector(".btn-remover-anexo")
        .addEventListener("click", () => {
          generalAttachments.splice(index, 1);
          renderGeneralAttachmentsList();
        });
      listaNomesAnexosInspecao.appendChild(anexo);
    });
  }

  formChecklistInspecao.addEventListener("submit", async (event) => {
    event.preventDefault();
    btnSalvarInspecao.disabled = true;
    btnSalvarInspecao.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...`;

    const formData = new FormData();
    const formElements = formChecklistInspecao.elements;
    const simpleFields = [
      "subestacao_id",
      "responsavel_levantamento_id",
      "tipo_inspecao",
      "processo",
      "data_avaliacao",
      "hora_inicial",
      "hora_final",
      "observacoes_gerais",
    ];
    simpleFields.forEach((field) => {
      if (formElements[field] && formElements[field].value) {
        formData.append(field, formElements[field].value);
      }
    });

    const itensParaEnviar = [];
    for (const itemId in checklistState.itens) {
      const state = checklistState.itens[itemId];
      if (state.avaliacao === null) {
        alert(
          `O item "${
            document.querySelector(
              `div[data-item-id="${itemId}"] .item-descricao`
            ).textContent
          }" precisa ser avaliado.`
        );
        btnSalvarInspecao.disabled = false;
        btnSalvarInspecao.innerHTML =
          '<span class="material-symbols-outlined">save</span> Salvar Inspeção';
        return;
      }
      itensParaEnviar.push({
        item_checklist_id: parseInt(itemId),
        avaliacao: state.avaliacao,
        observacao_item: state.observacao_item,
        especificacoes: state.especificacoes.map((s) => ({
          temp_id: s.temp_id,
          descricao_equipamento: s.descricao_equipamento,
          observacao: s.observacao,
        })),
      });

      state.anexos.forEach((anexo) => {
        const fieldName = `item_anexo__${itemId}__${anexo.associado_a}`;
        formData.append(fieldName, anexo.file);
      });
    }
    formData.append("itens", JSON.stringify(itensParaEnviar));

    generalAttachments.forEach((file) => {
      formData.append("anexosInspecao", file);
    });

    const registrosDinamicos = [];

    document
      .querySelectorAll("#containerMedicoesDinamicas .dynamic-row-item")
      .forEach((row) => {
        const tempId = row.dataset.tempId;
        const medicaoState = checklistState.medicoes.find(
          (m) => m.temp_id === tempId
        );

        registrosDinamicos.push({
          originalDataId: tempId,
          categoria_registro: "MEDICAO",
          tipo_especifico: row.querySelector(".tipo-medicao")?.value || null,
          tag_equipamento:
            row.querySelector(".tag-equipamento-medicao")?.value || null,
          valor_texto: row.querySelector(".valor-medido")?.value || null,
          unidade_medida: row.querySelector(".unidade-medida")?.value || null,
          descricao_item: row.querySelector(".obs-medicao")?.value || null,
        });

        if (medicaoState && medicaoState.anexos) {
          medicaoState.anexos.forEach((anexo) => {
            const fieldName = `registro_anexo__${tempId}`;
            formData.append(fieldName, anexo.file);
          });
        }
      });

    document
      .querySelectorAll("#containerEquipamentosObservados .dynamic-row-item")
      .forEach((row) => {
        const tempId = row.dataset.tempId;
        const equipamentoState = checklistState.equipamentosObservados.find(
          (e) => e.temp_id === tempId
        );

        registrosDinamicos.push({
          originalDataId: tempId,
          categoria_registro: "EQUIPAMENTO_OBSERVADO",
          tipo_especifico:
            row.querySelector(".tipo-equipamento-observado")?.value || null,
          tag_equipamento:
            row.querySelector(".tag-equipamento-observado")?.value || null,
          descricao_item:
            row.querySelector(".obs-equipamento-observado")?.value || null,
        });

        if (equipamentoState && equipamentoState.anexos) {
          equipamentoState.anexos.forEach((anexo) => {
            const fieldName = `registro_anexo__${tempId}`;
            formData.append(fieldName, anexo.file);
          });
        }
      });

    if (registrosDinamicos.length > 0) {
      formData.append("registros", JSON.stringify(registrosDinamicos));
    }

    try {
      const result = await fetchData("/inspecoes-subestacoes", {
        method: "POST",
        body: formData,
      });
      alert("Inspeção salva com sucesso!");
      window.location.href = "/pagina-listagem-inspecoes-subestacoes";
    } catch (error) {
      alert(`Falha ao salvar inspeção: ${error.message}`);
    } finally {
      btnSalvarInspecao.disabled = false;
      btnSalvarInspecao.innerHTML =
        '<span class="material-symbols-outlined">save</span> Salvar Inspeção';
    }
  });

  function resetFormularioCompleto() {
    formChecklistInspecao.reset();
    initializeState();
    gerarItensChecklist();
    containerMedicoesDinamicas.innerHTML = "";
    if (nenhumaMedicaoAdicionadaMsg)
      nenhumaMedicaoAdicionadaMsg.style.display = "block";
    containerEquipamentosObservados.innerHTML = "";
    if (nenhumEquipamentoObservadoMsg)
      nenhumEquipamentoObservadoMsg.style.display = "block";
    containerVerificacoesAdicionais.innerHTML = "";
    if (nenhumaVerificacaoAdicionadaMsg)
      nenhumaVerificacaoAdicionadaMsg.style.display = "block";
    generalAttachments = [];
    renderGeneralAttachmentsList();
    document.getElementById("inspecaoDataAvaliacao").value = new Date()
      .toISOString()
      .split("T")[0];
  }

  btnCancelarChecklist.addEventListener("click", () => {
    if (
      confirm(
        "Cancelar e limpar o formulário? Os dados não salvos serão perdidos."
      )
    ) {
      resetFormularioCompleto();
    }
  });

  async function init() {
    try {
      checklistTemplateFromAPI = await fetchData(
        "/api/checklist/modelo/padrao"
      );
      initializeState();
      gerarItensChecklist();
      await popularSelects();
      document.getElementById("inspecaoDataAvaliacao").value = new Date()
        .toISOString()
        .split("T")[0];
    } catch (error) {
      checklistItensContainer.innerHTML = `<div class="alert alert-danger">Falha ao carregar dados iniciais. ${error.message}</div>`;
    }
  }

  init();
});
