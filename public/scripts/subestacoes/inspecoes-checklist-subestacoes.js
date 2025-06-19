document.addEventListener("DOMContentLoaded", () => {
  const formChecklistInspecao = document.getElementById(
    "formChecklistInspecao"
  );
  const inspecaoSubestacaoSelect =
    document.getElementById("inspecaoSubestacao");
  const inspecaoResponsavelSelect = document.getElementById(
    "inspecaoResponsavel"
  );
  const inspecaoDataAvaliacaoInput = document.getElementById(
    "inspecaoDataAvaliacao"
  );
  const inspecaoFormularioNumDisplay = document.getElementById(
    "inspecaoFormularioNumDisplay"
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

  const inspecaoAnexosInput = document.getElementById("inspecaoAnexosInput");
  const listaNomesAnexosInspecao = document.getElementById(
    "listaNomesAnexosInspecao"
  );
  let selectedGeneralFiles = [];

  const modalDetalhesItemEl = document.getElementById("modalDetalhesItem");
  const itemDetalhesModalDescricaoP = document.getElementById(
    "itemDetalhesModalDescricao"
  );
  const itemObservacaoTextarea = document.getElementById(
    "itemObservacaoTextarea"
  );
  const fotosItemInput = document.getElementById("fotosItemInput");
  const fotosItemPreviewContainer = document.getElementById(
    "fotosItemPreviewContainer"
  );
  const fotosItemCountP = document.getElementById("fotosItemCount");
  const fotosItemLabelHelper = document.getElementById("fotosItemLabelHelper");
  const btnSalvarDetalhesItem = document.getElementById(
    "btnSalvarDetalhesItem"
  );
  const templateFotoItemPreview = document.getElementById(
    "templateFotoItemPreview"
  );

  let bsModalDetalhesItem = null;
  if (modalDetalhesItemEl) {
    bsModalDetalhesItem = new bootstrap.Modal(modalDetalhesItemEl);
  }

  let currentItemEditingElement = null;
  let itemEvidencesData = {};
  let medicoesDinamicas_linhaFotos = {};
  let equipamentosObservados_linhaFotos = {};

  const MAX_FOTOS_POR_ITEM = 10;
  const MAX_FOTOS_POR_MEDICAO = 5;
  const MAX_FOTOS_POR_EQUIPAMENTO_OBS = 5;

  const checklistTemplateOriginal = [
    {
      grupo: "Barramentos 69 e 13,8 kV",
      icon: "electrical_services",
      itens: [
        {
          desc: "Condições das estruturas de concreto armado quanto à existência de ferragens expostas e ferrugens.",
        },
        {
          desc: "Condições de conservação das estruturas metálicas, ferragens, etc.",
        },
        {
          desc: "Condições dos Isoladores: trincas, corrosões, sinais de curto circuito.",
        },
        {
          desc: "Conexões dos cabos de descarga dos pára-raios à malha de terra e estado de conservação.",
        },
        { desc: "Existência e estado de conservação dos TP's e TC's." },
        {
          desc: "Existência e condições dos pontos de medição da malha de terra.",
        },
        {
          desc: "Inexistência de ninhos de pássaros, cupins, maribondos, etc.",
        },
        { desc: "Existência e estado de conservação dos para-raios." },
        { desc: "Ausência de pontos quentes nas conexões." },
      ],
    },
    {
      grupo: "Chaves Seccionadoras e Fusíveis",
      icon: "power_settings_new",
      itens: [
        { desc: "Inexistência de trincas nos isoladores." },
        {
          desc: "Existência e estado de conservação do cabo de interligação dos equipamentos à malha de terra.",
        },
        { desc: "Estado da codificação operacional." },
        {
          desc: "Estado de conservação da pintura, chaparia, além da ausência de sujeira.",
        },
        {
          desc: "Estado e sinalização dos varões de comando das chaves de manobra.",
        },
        { desc: "Inexistência de elos fusíveis queimados." },
        { desc: "Ausência de pontos quentes nas conexões." },
        {
          desc: "Verificar sinais de curto-circuito nos contatos e isoladores.",
        },
        { desc: "Inexistência de ninhos, cupins, maribondos e etc." },
      ],
    },
    {
      grupo: "Transformadores de Força e Auxiliares",
      icon: "transform",
      itens: [
        { desc: "Inexistência de vazamentos de óleo." },
        {
          desc: "Estado de conservação da pintura, chaparia, além da ausência de sujeira.",
        },
        { desc: "Indicadores de níveis de óleo." },
        { desc: "Temperatura do Óleo." },
        { desc: "Temperatura do Enrolamento." },
        { desc: "Inexistência de trincas nas buchas." },
        {
          desc: "Existência e estado de conservação do cabo de interligação dos equipamentos à malha de terra.",
        },
        { desc: "Estado da codificação operacional." },
        {
          desc: "Cor da sílica gel e existência de óleo no copo de respiração.",
        },
        {
          desc: "Estado de conservação e teste – via comando manual – da ventilação forçada do transformador de força.",
        },
        {
          desc: "Existência e funcionamento da tomada de força presente no painel.",
        },
        { desc: "Existência e funcionamento da iluminação interna no painel." },
        { desc: "Condições das Fiações, Disjuntores e Fusíveis no Painel." },
        { desc: "Avaliação dos Protetores de Buchas." },
        {
          desc: "Inexistência de ninhos de pássaros, cupins, maribondos, etc.",
        },
      ],
    },
    {
      grupo: "Religadores e Disjuntores",
      icon: "bolt",
      itens: [
        { desc: "Inexistência de vazamento de óleo ou gás." },
        {
          desc: "Estado de conservação da pintura, chaparia, além da ausência de sujeira.",
        },
        { desc: "Indicadores de nível de óleo/gás." },
        { desc: "Inexistência de trincas nas buchas." },
        {
          desc: "Existência e estado de conservação do cabo de interligação dos equipamentos à malha de terra.",
        },
        { desc: "Estado da codificação operacional." },
        {
          desc: "Existência e funcionamento da tomada de força presente no painel.",
        },
        { desc: "Condições das fiações, disjuntores e fusíveis no painel." },
        { desc: "Existência e funcionamento da iluminação interna no painel." },
        { desc: "Avaliação dos protetores de buchas." },
        {
          desc: "Estado de conservação dos contadores de operação religador. (Anotar o número de operação).",
        },
        { desc: "Existência e estado de conservação dos para-raios." },
        {
          desc: "Inexistência de ninhos de pássaros, cupins, maribondos, etc.",
        },
        { desc: "Ausência de pontos quentes nas conexões." },
      ],
    },
    {
      grupo: "Banco de Capacitores",
      icon: "storage",
      itens: [
        { desc: "Estado de conservação da chave de acionamento." },
        { desc: "Inexistência de vazamentos de óleo." },
        {
          desc: "Estado de conservação da pintura, chaparia dos equipamentos em geral, além da ausência de sujeira.",
        },
        { desc: "Inexistência de trincas nas buchas e nos isoladores." },
        {
          desc: "Existência e estado de conservação do cabo de interligação dos equipamentos à malha de terra.",
        },
        { desc: "Estado da codificação operacional." },
        { desc: "Inexistência de elos fusíveis queimados." },
        { desc: "Existencia e estado de conservação da chave terra." },
        { desc: "Existência e estado de conservação dos para-raios." },
        {
          desc: "Inexistência de ninhos de pássaros, cupins, maribondos, etc.",
        },
        { desc: "Ausência de pontos quentes nas conexões." },
      ],
    },
  ];

  function numerarItensChecklist(template) {
    let contadorGlobalItens = 1;
    return template.map((grupo) => ({
      ...grupo,
      itens: grupo.itens.map((item) => ({
        ...item,
        num: contadorGlobalItens++,
      })),
    }));
  }
  const checklistTemplate = numerarItensChecklist(checklistTemplateOriginal);

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
      if (response.status === 204) return null;
      return await response.json();
    } catch (error) {
      alert(`Erro: ${error.message}`);
      throw error;
    }
  }

  function mostrarModal(bsModalInstance) {
    if (bsModalInstance) bsModalInstance.show();
  }
  function ocultarModal(bsModalInstance) {
    if (bsModalInstance) bsModalInstance.hide();
  }

  async function popularSelectSubestacoes() {
    if (!inspecaoSubestacaoSelect) return;
    try {
      const subestacoes = await fetchData("/subestacoes");
      inspecaoSubestacaoSelect.innerHTML =
        '<option value="">Selecione...</option>';
      subestacoes.forEach((sub) => {
        const option = document.createElement("option");
        option.value = sub.Id;
        option.textContent = `${sub.sigla} - ${sub.nome}`;
        inspecaoSubestacaoSelect.appendChild(option);
      });
    } catch (error) {
      inspecaoSubestacaoSelect.innerHTML = '<option value="">Erro</option>';
    }
  }

  async function popularSelectResponsaveis() {
    if (!inspecaoResponsavelSelect) return;
    try {
      const usuarios = await fetchData("/usuarios-responsaveis-para-servicos");
      inspecaoResponsavelSelect.innerHTML =
        '<option value="">Selecione...</option>';
      usuarios.forEach((user) => {
        const option = document.createElement("option");
        option.value = user.id;
        option.textContent = user.nome;
        inspecaoResponsavelSelect.appendChild(option);
      });
    } catch (error) {
      inspecaoResponsavelSelect.innerHTML = '<option value="">Erro</option>';
    }
  }

  function preencherDataAtual() {
    if (inspecaoDataAvaliacaoInput)
      inspecaoDataAvaliacaoInput.value = new Date().toISOString().split("T")[0];
  }

  function gerarItensChecklist() {
    if (!checklistItensContainer) return;
    checklistItensContainer.innerHTML = "";
    itemEvidencesData = {};
    checklistTemplate.forEach((grupo) => {
      const grupoSection = document.createElement("div");
      grupoSection.className = "checklist-grupo mb-3";
      grupoSection.setAttribute("data-grupo", grupo.grupo);
      const grupoHeader = document.createElement("div");
      grupoHeader.className = "checklist-grupo-header p-2";
      grupoHeader.innerHTML = `<h3><span class="material-symbols-outlined">${
        grupo.icon || "inventory_2"
      }</span> ${grupo.grupo}</h3>`;
      grupoSection.appendChild(grupoHeader);
      const itensList = document.createElement("div");
      grupo.itens.forEach((item) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "checklist-item p-2";
        itemDiv.setAttribute("data-item-num", item.num);
        itemDiv.setAttribute("data-item-desc", item.desc);
        itemDiv.innerHTML = `
            <div class="item-main-content">
                <div class="item-numero">${item.num}.</div>
                <div class="item-descricao">${item.desc}</div>
            </div>
            <div class="item-controls">
                <div class="item-avaliacao btn-group" role="group" aria-label="Avaliação do item ${item.num}">
                    <input type="radio" class="btn-check" name="item_${item.num}_avaliacao" id="item_${item.num}_n" value="N" required autocomplete="off">
                    <label class="btn btn-sm btn-outline-success" for="item_${item.num}_n">N</label>
                    <input type="radio" class="btn-check" name="item_${item.num}_avaliacao" id="item_${item.num}_a" value="A" autocomplete="off">
                    <label class="btn btn-sm btn-outline-danger" for="item_${item.num}_a">A</label>
                    <input type="radio" class="btn-check" name="item_${item.num}_avaliacao" id="item_${item.num}_na" value="NA" autocomplete="off">
                    <label class="btn btn-sm btn-outline-secondary" for="item_${item.num}_na">NA</label>
                </div>
                <div class="item-actions mt-1">
                    <button type="button" class="btn btn-sm btn-outline-primary btn-detalhes-item" title="Adicionar/Ver Observação e Fotos">
                        <span class="material-symbols-outlined">add_comment</span> Anexar/Obs
                    </button>
                </div>
            </div>
            <div class="item-feedback-icons">
                <span class="material-symbols-outlined obs-icon d-none" title="Observação adicionada">comment</span>
                <span class="material-symbols-outlined fotos-icon d-none" title="Fotos adicionadas">photo_library</span>
            </div>`;
        itemDiv
          .querySelector(".btn-detalhes-item")
          .addEventListener("click", () => abrirModalParaItem(itemDiv));
        const radios = itemDiv.querySelectorAll(
          `input[name="item_${item.num}_avaliacao"]`
        );
        radios.forEach((radio) => {
          radio.addEventListener("change", () => {
            atualizarEstiloBotaoDetalhes(itemDiv);
          });
        });
        itensList.appendChild(itemDiv);
      });
      grupoSection.appendChild(itensList);
      checklistItensContainer.appendChild(grupoSection);
    });
  }

  function abrirModalParaItem(itemElement) {
    currentItemEditingElement = itemElement;
    const itemNum = itemElement.getAttribute("data-item-num");
    const itemDesc = itemElement.getAttribute("data-item-desc");
    const avaliacaoAtualRadio = itemElement.querySelector(
      `input[name="item_${itemNum}_avaliacao"]:checked`
    );
    const avaliacaoAtual = avaliacaoAtualRadio
      ? avaliacaoAtualRadio.value
      : null;
    if (itemDetalhesModalDescricaoP)
      itemDetalhesModalDescricaoP.textContent = `Item ${itemNum}: ${
        itemDesc || "Descrição não disponível"
      }`;
    if (itemObservacaoTextarea) {
      itemObservacaoTextarea.value =
        itemEvidencesData[`item_${itemNum}_obs`] || "";
      itemObservacaoTextarea.placeholder =
        "Descreva a observação ou justificativa aqui...";
    }
    if (fotosItemLabelHelper) {
      fotosItemLabelHelper.textContent =
        avaliacaoAtual === "A"
          ? "(Obrigatória se Anormal, máx. 10 fotos)"
          : "(Opcional, máx. 10 fotos)";
    }
    renderizarFotosItemModal(itemNum);
    if (bsModalDetalhesItem) mostrarModal(bsModalDetalhesItem);
  }

  function renderizarFotosItemModal(itemNum) {
    if (
      !fotosItemPreviewContainer ||
      !fotosItemCountP ||
      !templateFotoItemPreview
    )
      return;
    fotosItemPreviewContainer.innerHTML = "";
    const fotosKey = `item_${itemNum}_fotos`;
    const currentFiles = itemEvidencesData[fotosKey] || [];
    currentFiles.forEach((file, index) => {
      const previewClone = templateFotoItemPreview.content.cloneNode(true);
      const img = previewClone.querySelector(".foto-preview-item-img");
      const btnDelete = previewClone.querySelector(
        ".btn-delete-foto-item-preview"
      );
      img.src = URL.createObjectURL(file);
      img.onload = () => URL.revokeObjectURL(img.src);
      btnDelete.addEventListener("click", () => {
        itemEvidencesData[fotosKey].splice(index, 1);
        renderizarFotosItemModal(itemNum);
      });
      fotosItemPreviewContainer.appendChild(previewClone);
    });
    fotosItemCountP.textContent = `${currentFiles.length} de ${MAX_FOTOS_POR_ITEM} fotos selecionadas.`;
    if (fotosItemInput) fotosItemInput.value = null;
  }

  if (fotosItemInput) {
    fotosItemInput.addEventListener("change", (event) => {
      if (!currentItemEditingElement) return;
      const itemNum = currentItemEditingElement.getAttribute("data-item-num");
      const fotosKey = `item_${itemNum}_fotos`;
      const currentFiles = itemEvidencesData[fotosKey] || [];
      const newFiles = Array.from(event.target.files);
      if (currentFiles.length + newFiles.length > MAX_FOTOS_POR_ITEM) {
        alert(
          `Você pode adicionar no máximo ${MAX_FOTOS_POR_ITEM} fotos por item.`
        );
        fotosItemInput.value = null;
        return;
      }
      newFiles.forEach((file) => {
        if (file.type.startsWith("image/")) {
          if (!itemEvidencesData[fotosKey]) itemEvidencesData[fotosKey] = [];
          itemEvidencesData[fotosKey].push(file);
        } else {
          alert("Por favor, selecione apenas arquivos de imagem.");
        }
      });
      renderizarFotosItemModal(itemNum);
    });
  }

  if (btnSalvarDetalhesItem) {
    btnSalvarDetalhesItem.addEventListener("click", () => {
      if (!currentItemEditingElement || !itemObservacaoTextarea) return;
      const itemNum = currentItemEditingElement.getAttribute("data-item-num");
      const obsKey = `item_${itemNum}_obs`;
      const fotosKey = `item_${itemNum}_fotos`;
      const observacao = itemObservacaoTextarea.value.trim();
      const fotos = itemEvidencesData[fotosKey] || [];
      const avaliacaoRadio = currentItemEditingElement.querySelector(
        `input[name="item_${itemNum}_avaliacao"]:checked`
      );
      const avaliacao = avaliacaoRadio ? avaliacaoRadio.value : null;
      if (!avaliacaoRadio) {
        alert(
          "Uma avaliação (N, A, ou NA) deve estar selecionada para salvar detalhes."
        );
        return;
      }
      if (avaliacao === "A") {
        if (!observacao) {
          alert("A observação é obrigatória para itens anormais.");
          itemObservacaoTextarea.focus();
          return;
        }
        if (fotos.length === 0) {
          alert("Pelo menos uma foto é obrigatória para itens anormais.");
          return;
        }
      }
      itemEvidencesData[obsKey] = observacao;
      if (bsModalDetalhesItem) ocultarModal(bsModalDetalhesItem);
      atualizarIndicadoresVisuaisItem(currentItemEditingElement);
      atualizarEstiloBotaoDetalhes(currentItemEditingElement);
    });
  }

  function atualizarEstiloBotaoDetalhes(itemElement) {
    if (!itemElement) return;
    const btnDetalhes = itemElement.querySelector(".btn-detalhes-item");
    const itemNum = itemElement.getAttribute("data-item-num");
    const avaliacaoRadio = itemElement.querySelector(
      `input[name="item_${itemNum}_avaliacao"]:checked`
    );
    const isAnormal =
      avaliacaoRadio && avaliacaoRadio.value === "A" && avaliacaoRadio.checked;
    const temDados =
      itemEvidencesData[`item_${itemNum}_obs`] ||
      (itemEvidencesData[`item_${itemNum}_fotos`] &&
        itemEvidencesData[`item_${itemNum}_fotos`].length > 0);
    btnDetalhes.classList.remove(
      "btn-outline-primary",
      "btn-primary",
      "btn-danger"
    );
    if (isAnormal) {
      btnDetalhes.classList.add("btn-danger");
      btnDetalhes.innerHTML =
        '<span class="material-symbols-outlined">warning</span> Anexar/Obs (Anormal)';
    } else {
      btnDetalhes.classList.add(
        temDados ? "btn-primary" : "btn-outline-primary"
      );
      const avaliacaoTexto = avaliacaoRadio ? `(${avaliacaoRadio.value})` : "";
      btnDetalhes.innerHTML = `<span class="material-symbols-outlined">add_comment</span> Anexar/Obs ${avaliacaoTexto
        .replace("(N)", "(Normal)")
        .replace("(NA)", "(N/A)")}`;
    }
  }

  function atualizarIndicadoresVisuaisItem(itemElement) {
    if (!itemElement) return;
    const itemNum = itemElement.getAttribute("data-item-num");
    const obsKey = `item_${itemNum}_obs`;
    const fotosKey = `item_${itemNum}_fotos`;
    const temObs = !!itemEvidencesData[obsKey];
    const temFotos = (itemEvidencesData[fotosKey] || []).length > 0;
    const obsIcon = itemElement.querySelector(".obs-icon");
    const fotosIcon = itemElement.querySelector(".fotos-icon");
    if (obsIcon)
      temObs
        ? obsIcon.classList.remove("d-none")
        : obsIcon.classList.add("d-none");
    if (fotosIcon)
      temFotos
        ? fotosIcon.classList.remove("d-none")
        : fotosIcon.classList.add("d-none");
  }

  if (modalDetalhesItemEl) {
    modalDetalhesItemEl.addEventListener("hidden.bs.modal", () => {
      if (currentItemEditingElement) {
        atualizarIndicadoresVisuaisItem(currentItemEditingElement);
        atualizarEstiloBotaoDetalhes(currentItemEditingElement);
      }
      if (fotosItemInput) fotosItemInput.value = null;
      if (fotosItemPreviewContainer) fotosItemPreviewContainer.innerHTML = "";
      if (fotosItemCountP)
        fotosItemCountP.textContent = `0 de ${MAX_FOTOS_POR_ITEM} fotos selecionadas.`;
      currentItemEditingElement = null;
    });
  }

  function renderGeneralAttachmentsList() {
    if (!listaNomesAnexosInspecao) return;
    listaNomesAnexosInspecao.innerHTML = "";
    selectedGeneralFiles.forEach((file, index) => {
      const li = document.createElement("li");
      li.className =
        "list-group-item d-flex justify-content-between align-items-center";
      const fileIcon = document.createElement("span");
      fileIcon.className = "material-symbols-outlined me-2 file-preview-icon";
      fileIcon.textContent = file.type.startsWith("image/") ? "image" : "draft";
      const fileNameSpan = document.createElement("span");
      fileNameSpan.className = "file-name flex-grow-1 text-truncate";
      fileNameSpan.textContent = file.name;
      const fileSizeSpan = document.createElement("small");
      fileSizeSpan.className = "text-muted ms-2";
      fileSizeSpan.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className =
        "btn btn-icon text-danger btn-sm btn-delete-anexo";
      deleteButton.setAttribute("data-file-index", index);
      deleteButton.title = "Remover anexo";
      deleteButton.innerHTML =
        '<span class="material-symbols-outlined">delete</span>';
      li.appendChild(fileIcon);
      li.appendChild(fileNameSpan);
      li.appendChild(fileSizeSpan);
      li.appendChild(deleteButton);
      listaNomesAnexosInspecao.appendChild(li);
    });
  }

  if (inspecaoAnexosInput) {
    inspecaoAnexosInput.addEventListener("change", (event) => {
      selectedGeneralFiles = Array.from(event.target.files);
      if (selectedGeneralFiles.length > 10) {
        alert("Você pode selecionar no máximo 10 arquivos gerais.");
        selectedGeneralFiles = selectedGeneralFiles.slice(0, 10);
        const dataTransfer = new DataTransfer();
        selectedGeneralFiles.forEach((file) => dataTransfer.items.add(file));
        event.target.files = dataTransfer.files;
      }
      renderGeneralAttachmentsList();
    });
  }

  if (listaNomesAnexosInspecao) {
    listaNomesAnexosInspecao.addEventListener("click", (event) => {
      const button = event.target.closest(".btn-delete-anexo");
      if (button) {
        const indexToRemove = parseInt(
          button.getAttribute("data-file-index"),
          10
        );
        selectedGeneralFiles.splice(indexToRemove, 1);
        const newFileList = new DataTransfer();
        selectedGeneralFiles.forEach((file) => newFileList.items.add(file));
        if (inspecaoAnexosInput) inspecaoAnexosInput.files = newFileList.files;
        renderGeneralAttachmentsList();
      }
    });
  }

  function adicionarNovaLinhaMedicao() {
    if (!templateLinhaMedicao || !containerMedicoesDinamicas) return;
    const clone = templateLinhaMedicao.content.cloneNode(true);
    const novaLinha = clone.querySelector(".medicao-dinamica-item");
    const medicaoDomIndex = containerMedicoesDinamicas.querySelectorAll(
      ".medicao-dinamica-item"
    ).length;
    novaLinha.setAttribute("data-dom-index", medicaoDomIndex);

    // Adiciona uma entrada no array de dados para esta linha, com um ID único para as fotos
    // Assim, mesmo se linhas forem removidas, o ID das fotos permanece ligado ao seu conjunto de dados original.
    const medicaoDataId = `med_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 5)}`;
    novaLinha.setAttribute("data-medicao-id", medicaoDataId);
    medicoesDinamicas_linhaFotos[medicaoDataId] = [];

    if (
      nenhumaMedicaoAdicionadaMsg &&
      !nenhumaMedicaoAdicionadaMsg.classList.contains("d-none")
    ) {
      nenhumaMedicaoAdicionadaMsg.classList.add("d-none");
    }
    containerMedicoesDinamicas.appendChild(novaLinha);

    const btnRemover = novaLinha.querySelector(".btn-remover-medicao");
    btnRemover.addEventListener("click", () => {
      const idDaLinha = novaLinha.getAttribute("data-medicao-id");
      delete medicoesDinamicas_linhaFotos[idDaLinha]; // Remove os dados das fotos
      novaLinha.remove();
      if (
        containerMedicoesDinamicas.querySelectorAll(".medicao-dinamica-item")
          .length === 0 &&
        nenhumaMedicaoAdicionadaMsg
      ) {
        nenhumaMedicaoAdicionadaMsg.classList.remove("d-none");
      }
    });

    const selectTipoMedicao = novaLinha.querySelector(".tipo-medicao");
    const inputUnidade = novaLinha.querySelector(".unidade-medida");
    const inputValor = novaLinha.querySelector(".valor-medido");
    selectTipoMedicao.addEventListener("change", function () {
      inputValor.type = "text";
      inputValor.step = "any";
      inputValor.min = "";
      inputValor.max = "";
      switch (this.value) {
        case "TEMPERATURA_TRAFO":
        case "TEMPERATURA_OLEO":
        case "TEMPERATURA_ENROLAMENTO":
          inputUnidade.value = "°C";
          inputValor.type = "number";
          inputValor.step = "0.1";
          inputValor.placeholder = "Ex: 75.5";
          break;
        case "CONTADOR_RELIGADOR":
          inputUnidade.value = "qnt";
          inputValor.type = "number";
          inputValor.step = "1";
          inputValor.placeholder = "Ex: 123";
          break;
        case "BATERIA_MONITOR":
          inputUnidade.value = "%";
          inputValor.type = "number";
          inputValor.step = "1";
          inputValor.min = "0";
          inputValor.max = "100";
          inputValor.placeholder = "Ex: 80";
          break;
        case "NIVEL_OLEO":
          inputUnidade.value = "%";
          inputValor.placeholder = "Ex: Normal ou 75";
          break;
        default:
          inputUnidade.value = "";
          inputUnidade.placeholder = "Unidade";
          inputValor.placeholder = "Valor";
          break;
      }
    });
    const fotosInputMedicao = novaLinha.querySelector(".foto-medicao-input");
    fotosInputMedicao.addEventListener("change", function (event) {
      const idDaLinha = novaLinha.getAttribute("data-medicao-id");
      let currentFotos = medicoesDinamicas_linhaFotos[idDaLinha] || [];
      const newFiles = Array.from(event.target.files);
      if (currentFotos.length + newFiles.length > MAX_FOTOS_POR_MEDICAO) {
        alert(
          `Você pode adicionar no máximo ${MAX_FOTOS_POR_MEDICAO} fotos por medição.`
        );
        this.value = null;
        return;
      }
      newFiles.forEach((file) => {
        if (file.type.startsWith("image/")) currentFotos.push(file);
        else alert("Selecione apenas arquivos de imagem para medições.");
      });
      medicoesDinamicas_linhaFotos[idDaLinha] = currentFotos;
      renderizarFotosLinhaDinamica(
        novaLinha,
        medicoesDinamicas_linhaFotos[idDaLinha],
        ".fotos-medicao-preview-container",
        ".fotos-medicao-count",
        MAX_FOTOS_POR_MEDICAO,
        fotosInputMedicao
      );
    });
    renderizarFotosLinhaDinamica(
      novaLinha,
      [],
      ".fotos-medicao-preview-container",
      ".fotos-medicao-count",
      MAX_FOTOS_POR_MEDICAO,
      fotosInputMedicao
    );
  }

  function adicionarNovaLinhaEquipamentoObservado() {
    if (!templateLinhaEquipamento || !containerEquipamentosObservados) return;
    const clone = templateLinhaEquipamento.content.cloneNode(true);
    const novaLinha = clone.querySelector(".equipamento-observado-item");
    const equipamentoDataId = `equip_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 5)}`;
    novaLinha.setAttribute("data-equipamento-id", equipamentoDataId);
    equipamentosObservados_linhaFotos[equipamentoDataId] = [];

    if (
      nenhumEquipamentoObservadoMsg &&
      !nenhumEquipamentoObservadoMsg.classList.contains("d-none")
    ) {
      nenhumEquipamentoObservadoMsg.classList.add("d-none");
    }
    containerEquipamentosObservados.appendChild(novaLinha);
    const btnRemover = novaLinha.querySelector(
      ".btn-remover-equipamento-observado"
    );
    btnRemover.addEventListener("click", () => {
      const idDaLinha = novaLinha.getAttribute("data-equipamento-id");
      delete equipamentosObservados_linhaFotos[idDaLinha];
      novaLinha.remove();
      if (
        containerEquipamentosObservados.querySelectorAll(
          ".equipamento-observado-item"
        ).length === 0 &&
        nenhumEquipamentoObservadoMsg
      ) {
        nenhumEquipamentoObservadoMsg.classList.remove("d-none");
      }
    });
    const fotosInput = novaLinha.querySelector(".fotos-equipamento-input");
    fotosInput.addEventListener("change", function (event) {
      const idDaLinha = novaLinha.getAttribute("data-equipamento-id");
      let currentFotos = equipamentosObservados_linhaFotos[idDaLinha] || [];
      const newFiles = Array.from(event.target.files);
      if (
        currentFotos.length + newFiles.length >
        MAX_FOTOS_POR_EQUIPAMENTO_OBS
      ) {
        alert(
          `Você pode adicionar no máximo ${MAX_FOTOS_POR_EQUIPAMENTO_OBS} fotos por equipamento.`
        );
        this.value = null;
        return;
      }
      newFiles.forEach((file) => {
        if (file.type.startsWith("image/")) currentFotos.push(file);
        else alert("Selecione apenas arquivos de imagem.");
      });
      equipamentosObservados_linhaFotos[idDaLinha] = currentFotos;
      renderizarFotosLinhaDinamica(
        novaLinha,
        equipamentosObservados_linhaFotos[idDaLinha],
        ".fotos-equipamento-preview-container",
        ".fotos-equipamento-count",
        MAX_FOTOS_POR_EQUIPAMENTO_OBS,
        fotosInput
      );
    });
    renderizarFotosLinhaDinamica(
      novaLinha,
      [],
      ".fotos-equipamento-preview-container",
      ".fotos-equipamento-count",
      MAX_FOTOS_POR_EQUIPAMENTO_OBS,
      fotosInput
    );
  }

  function renderizarFotosLinhaDinamica(
    linhaElement,
    listaDeArquivos,
    previewSelector,
    countSelector,
    maxFotos,
    inputElement
  ) {
    const previewContainer = linhaElement.querySelector(previewSelector);
    const countElement = linhaElement.querySelector(countSelector);
    if (!previewContainer || !countElement || !templateFotoItemPreview) return;
    previewContainer.innerHTML = "";

    listaDeArquivos.forEach((file, fileIndex) => {
      const previewClone = templateFotoItemPreview.content.cloneNode(true);
      const img = previewClone.querySelector(".foto-preview-item-img");
      const btnDelete = previewClone.querySelector(
        ".btn-delete-foto-item-preview"
      );
      img.src = URL.createObjectURL(file);
      img.onload = () => URL.revokeObjectURL(img.src);
      btnDelete.addEventListener("click", () => {
        listaDeArquivos.splice(fileIndex, 1);
        renderizarFotosLinhaDinamica(
          linhaElement,
          listaDeArquivos,
          previewSelector,
          countSelector,
          maxFotos,
          inputElement
        );
      });
      previewContainer.appendChild(previewClone);
    });
    countElement.textContent = `${listaDeArquivos.length} de ${maxFotos} fotos selecionadas.`;
    if (inputElement) {
      inputElement.disabled = listaDeArquivos.length >= maxFotos;
      if (listaDeArquivos.length < maxFotos && inputElement.value)
        inputElement.value = null;
    }
  }

  function adicionarNovaLinhaVerificacaoAdicional() {
    if (!templateLinhaVerificacaoAdicional || !containerVerificacoesAdicionais)
      return;
    const clone = templateLinhaVerificacaoAdicional.content.cloneNode(true);
    const novaLinha = clone.querySelector(".verificacao-adicional-item");
    if (
      nenhumaVerificacaoAdicionadaMsg &&
      !nenhumaVerificacaoAdicionadaMsg.classList.contains("d-none")
    ) {
      nenhumaVerificacaoAdicionadaMsg.classList.add("d-none");
    }
    containerVerificacoesAdicionais.appendChild(novaLinha);
    const btnRemover = novaLinha.querySelector(
      ".btn-remover-verificacao-adicional"
    );
    btnRemover.addEventListener("click", () => {
      novaLinha.remove();
      if (
        containerVerificacoesAdicionais.querySelectorAll(
          ".verificacao-adicional-item"
        ).length === 0 &&
        nenhumaVerificacaoAdicionadaMsg
      ) {
        nenhumaVerificacaoAdicionadaMsg.classList.remove("d-none");
      }
    });
  }

  if (btnAdicionarMedicao)
    btnAdicionarMedicao.addEventListener("click", adicionarNovaLinhaMedicao);
  if (btnAdicionarEquipamentoObservado)
    btnAdicionarEquipamentoObservado.addEventListener(
      "click",
      adicionarNovaLinhaEquipamentoObservado
    );
  if (btnAdicionarVerificacao)
    btnAdicionarVerificacao.addEventListener(
      "click",
      adicionarNovaLinhaVerificacaoAdicional
    );

  function limparMedicoesDinamicas() {
    if (containerMedicoesDinamicas) {
      containerMedicoesDinamicas.innerHTML = "";
      if (nenhumaMedicaoAdicionadaMsg) {
        const p = document.createElement("p");
        p.id = "nenhumaMedicaoAdicionada";
        p.className = "text-muted text-center";
        p.textContent = "Nenhuma medição adicionada ainda.";
        containerMedicoesDinamicas.appendChild(p);
      }
    }
    medicoesDinamicas_linhaFotos = {};
  }
  function limparEquipamentosObservados() {
    if (containerEquipamentosObservados) {
      containerEquipamentosObservados.innerHTML = "";
      if (nenhumEquipamentoObservadoMsg) {
        const p = document.createElement("p");
        p.id = "nenhumEquipamentoObservado";
        p.className = "text-muted text-center";
        p.textContent = "Nenhum equipamento observado adicionado ainda.";
        containerEquipamentosObservados.appendChild(p);
      }
    }
    equipamentosObservados_linhaFotos = {};
  }
  function limparVerificacoesAdicionais() {
    if (containerVerificacoesAdicionais) {
      containerVerificacoesAdicionais.innerHTML = "";
      if (nenhumaVerificacaoAdicionadaMsg) {
        const p = document.createElement("p");
        p.id = "nenhumaVerificacaoAdicionada";
        p.className = "text-muted text-center";
        p.textContent = "Nenhum ponto de verificação adicionado ainda.";
        containerVerificacoesAdicionais.appendChild(p);
      }
    }
  }

  if (formChecklistInspecao) {
    formChecklistInspecao.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!btnSalvarInspecao) return;
      const formData = new FormData();
      const dadosCabecalho = {
        subestacao_id: inspecaoSubestacaoSelect?.value,
        responsavel_levantamento_id: inspecaoResponsavelSelect?.value,
        data_avaliacao: inspecaoDataAvaliacaoInput?.value,
        hora_inicial: document.getElementById("inspecaoHoraInicial")?.value,
        hora_final: document.getElementById("inspecaoHoraFinal")?.value || null,
        status_inspecao: "EM_ANDAMENTO",
        observacoes_gerais: document.getElementById("inspecaoObservacoesGerais")
          ?.value,
      };
      if (
        !dadosCabecalho.subestacao_id ||
        !dadosCabecalho.responsavel_levantamento_id ||
        !dadosCabecalho.data_avaliacao ||
        !dadosCabecalho.hora_inicial
      ) {
        alert("Preencha os campos obrigatórios (*) do cabeçalho.");
        return;
      }
      for (const key in dadosCabecalho) {
        if (dadosCabecalho[key] !== null && dadosCabecalho[key] !== undefined) {
          if (dadosCabecalho[key] || typeof dadosCabecalho[key] === "number")
            formData.append(key, dadosCabecalho[key]);
          else if (dadosCabecalho[key] === null) formData.append(key, "");
        }
      }
      let todosItensAvaliados = true;
      let todosItensAnormaisCompletos = true;
      const itensChecklistArray = [];
      const checklistItems = document.querySelectorAll(".checklist-item");
      if (checklistItems.length === 0) {
        alert("Nenhum item de checklist encontrado para registrar.");
        return;
      }

      checklistItems.forEach((itemDiv) => {
        const itemNum = itemDiv.getAttribute("data-item-num");
        const avaliacaoRadio = itemDiv.querySelector(
          `input[name="item_${itemNum}_avaliacao"]:checked`
        );
        const avaliacao = avaliacaoRadio ? avaliacaoRadio.value : null;
        if (!avaliacao) todosItensAvaliados = false;
        const obsKey = `item_${itemNum}_obs`;
        const fotosKey = `item_${itemNum}_fotos`;
        const observacaoItem = itemEvidencesData[obsKey] || null;
        const fotosItem = itemEvidencesData[fotosKey] || [];
        itensChecklistArray.push({
          item_num: parseInt(itemNum),
          grupo_item: itemDiv
            .closest(".checklist-grupo")
            ?.getAttribute("data-grupo"),
          descricao_item_original: itemDiv.getAttribute("data-item-desc"),
          avaliacao: avaliacao,
          observacao_item: observacaoItem,
        });
        if (avaliacao === "A") {
          if (!observacaoItem || fotosItem.length === 0) {
            todosItensAnormaisCompletos = false;
            itemDiv.classList.add("item-incompleto-erro");
            setTimeout(
              () => itemDiv.classList.remove("item-incompleto-erro"),
              3000
            );
          } else {
            itemDiv.classList.remove("item-incompleto-erro");
          }
        }
        fotosItem.forEach((fotoFile) =>
          formData.append(`foto_item_${itemNum}`, fotoFile, fotoFile.name)
        );
      });

      if (!todosItensAvaliados) {
        alert("Todos os itens do checklist devem ser avaliados (N, A ou NA).");
        const primeiroNaoAvaliado = Array.from(checklistItems).find(
          (itemDiv) =>
            !itemDiv.querySelector(
              `input[name="item_${itemDiv.getAttribute(
                "data-item-num"
              )}_avaliacao"]:checked`
            )
        );
        if (primeiroNaoAvaliado)
          primeiroNaoAvaliado.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        return;
      }
      if (!todosItensAnormaisCompletos) {
        alert(
          "Existem itens anormais sem observação e/ou foto. Verifique os itens destacados."
        );
        const primeiroIncompleto = document.querySelector(
          ".item-incompleto-erro"
        );
        if (primeiroIncompleto)
          primeiroIncompleto.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        return;
      }
      formData.append("itens", JSON.stringify(itensChecklistArray));

      const medicoesParaEnviar = [];
      let todasMedicoesValidas = true;
      document
        .querySelectorAll(".medicao-dinamica-item")
        .forEach((linhaDOM, indexDOM) => {
          const tipo = linhaDOM.querySelector(".tipo-medicao").value;
          const tag = linhaDOM
            .querySelector(".tag-equipamento-medicao")
            .value.trim();
          const valor = linhaDOM.querySelector(".valor-medido").value.trim();
          const unidade = linhaDOM
            .querySelector(".unidade-medida")
            .value.trim();
          const obs = linhaDOM.querySelector(".obs-medicao").value.trim();
          if (!tipo || !valor) {
            alert(
              `Para a medição #${
                indexDOM + 1
              }, o Tipo de Medição e o Valor Lido são obrigatórios.`
            );
            linhaDOM.querySelector(".tipo-medicao").focus();
            todasMedicoesValidas = false;
            return;
          }
          const dataMedicaoId = linhaDOM.getAttribute("data-medicao-id");
          medicoesParaEnviar.push({
            originalDataId: dataMedicaoId,
            tipo_medicao: tipo,
            tag_equipamento: tag || null,
            valor_medido: valor,
            unidade_medida: unidade || null,
            observacao: obs || null,
          });
          const fotosMedicao =
            medicoesDinamicas_linhaFotos[dataMedicaoId] || [];
          fotosMedicao.forEach((fotoFile) =>
            formData.append(
              `foto_medicao_${dataMedicaoId}`,
              fotoFile,
              fotoFile.name
            )
          );
        });
      if (!todasMedicoesValidas) return;
      if (medicoesParaEnviar.length > 0)
        formData.append("medicoes", JSON.stringify(medicoesParaEnviar));

      const equipamentosObservadosParaEnviar = [];
      let todosEquipamentosValidos = true;
      document
        .querySelectorAll(".equipamento-observado-item")
        .forEach((linhaDOM, indexDOM) => {
          const tipo = linhaDOM.querySelector(
            ".tipo-equipamento-observado"
          ).value;
          const tag = linhaDOM
            .querySelector(".tag-equipamento-observado")
            .value.trim();
          const obs = linhaDOM
            .querySelector(".obs-equipamento-observado")
            .value.trim();
          if (!tipo) {
            alert(
              `Para o equipamento observado #${
                indexDOM + 1
              }, o Tipo de Equipamento é obrigatório.`
            );
            linhaDOM.querySelector(".tipo-equipamento-observado").focus();
            todosEquipamentosValidos = false;
            return;
          }
          const dataEquipId = linhaDOM.getAttribute("data-equipamento-id");
          equipamentosObservadosParaEnviar.push({
            originalDataId: dataEquipId,
            tipo_equipamento: tipo,
            tag_equipamento: tag || null,
            observacao: obs || null,
          });
          const fotosEquipamento =
            equipamentosObservados_linhaFotos[dataEquipId] || [];
          fotosEquipamento.forEach((fotoFile) =>
            formData.append(
              `foto_equip_obs_${dataEquipId}`,
              fotoFile,
              fotoFile.name
            )
          );
        });
      if (!todosEquipamentosValidos) return;
      if (equipamentosObservadosParaEnviar.length > 0)
        formData.append(
          "equipamentos_observados",
          JSON.stringify(equipamentosObservadosParaEnviar)
        );

      const verificacoesAdicionaisParaEnviar = [];
      let todasVerificacoesValidas = true;
      document
        .querySelectorAll(".verificacao-adicional-item")
        .forEach((linhaDOM, indexDOM) => {
          const itemVerificado = linhaDOM
            .querySelector(".item-verificado-adicional")
            .value.trim();
          const estadoItem = linhaDOM.querySelector(
            ".estado-item-adicional"
          ).value;
          const numFormRef = linhaDOM
            .querySelector(".num-formulario-anterior-adicional")
            .value.trim();
          const detalhesObs = linhaDOM
            .querySelector(".detalhes-obs-adicional")
            .value.trim();
          if (!itemVerificado || !estadoItem) {
            alert(
              `Para o ponto de verificação #${
                indexDOM + 1
              }, 'Item Verificado' e 'Estado' são obrigatórios.`
            );
            linhaDOM.querySelector(".item-verificado-adicional").focus();
            todasVerificacoesValidas = false;
            return;
          }
          verificacoesAdicionaisParaEnviar.push({
            item_verificado: itemVerificado,
            estado_item: estadoItem,
            num_formulario_referencia: numFormRef || null,
            detalhes_observacao: detalhesObs || null,
          });
        });
      if (!todasVerificacoesValidas) return;
      if (verificacoesAdicionaisParaEnviar.length > 0)
        formData.append(
          "verificacoes_adicionais",
          JSON.stringify(verificacoesAdicionaisParaEnviar)
        );

      selectedGeneralFiles.forEach((file) =>
        formData.append("anexosInspecao", file)
      );
      btnSalvarInspecao.disabled = true;
      btnSalvarInspecao.innerHTML =
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...';
      try {
        const response = await fetch("/inspecoes-subestacoes", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: "Erro desconhecido ao salvar." }));
          throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
        }
        const result = await response.json();
        alert(
          result.message +
            (result.formulario_inspecao_num
              ? ` Nº da Inspeção: ${result.formulario_inspecao_num}`
              : "")
        );
        resetFormularioCompleto();
      } catch (error) {
        alert(`Falha ao salvar inspeção: ${error.message}`);
      } finally {
        btnSalvarInspecao.disabled = false;
        btnSalvarInspecao.innerHTML =
          '<span class="material-symbols-outlined">save</span> Salvar Inspeção';
      }
    });
  }

  function resetFormularioCompleto() {
    if (formChecklistInspecao) formChecklistInspecao.reset();
    itemEvidencesData = {};
    medicoesDinamicas_linhaFotos = {};
    equipamentosObservados_linhaFotos = {};
    verificacoesAdicionaisData = []; // Mantido para dados textuais, pois não têm fotos
    limparMedicoesDinamicas();
    limparEquipamentosObservados();
    limparVerificacoesAdicionais();
    preencherDataAtual();
    gerarItensChecklist();
    if (listaNomesAnexosInspecao) listaNomesAnexosInspecao.innerHTML = "";
    selectedGeneralFiles = [];
    if (inspecaoAnexosInput) inspecaoAnexosInput.value = null;
    if (inspecaoFormularioNumDisplay)
      inspecaoFormularioNumDisplay.value = "Será gerado ao salvar";
    if (inspecaoSubestacaoSelect) inspecaoSubestacaoSelect.focus();
  }

  if (btnCancelarChecklist) {
    btnCancelarChecklist.addEventListener("click", () => {
      if (
        confirm(
          "Cancelar e limpar o formulário? Os dados não salvos serão perdidos."
        )
      ) {
        resetFormularioCompleto();
      }
    });
  }

  function init() {
    popularSelectSubestacoes();
    popularSelectResponsaveis();
    gerarItensChecklist();
    preencherDataAtual();
    if (inspecaoFormularioNumDisplay)
      inspecaoFormularioNumDisplay.value = "Será gerado ao salvar";
    if (btnAdicionarMedicao)
      btnAdicionarMedicao.addEventListener("click", adicionarNovaLinhaMedicao);
    if (btnAdicionarEquipamentoObservado)
      btnAdicionarEquipamentoObservado.addEventListener(
        "click",
        adicionarNovaLinhaEquipamentoObservado
      );
    if (btnAdicionarVerificacao)
      btnAdicionarVerificacao.addEventListener(
        "click",
        adicionarNovaLinhaVerificacaoAdicional
      );
  }
  init();
});
