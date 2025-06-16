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

  const inspecaoAnexosInput = document.getElementById("inspecaoAnexosInput");
  const listaNomesAnexosInspecao = document.getElementById(
    "listaNomesAnexosInspecao"
  );
  let selectedGeneralFiles = [];

  const modalJustificativaEl = document.getElementById(
    "modalJustificativaAnormalidade"
  );
  const itemAnormalDescricaoP = document.getElementById("itemAnormalDescricao");
  const justificativaTextarea = document.getElementById(
    "justificativaAnormalidadeTextarea"
  );
  const fotoAnormalidadeInput = document.getElementById(
    "fotoAnormalidadeInput"
  );
  const fotoAnormalidadeNomeP = document.getElementById("fotoAnormalidadeNome");
  const fotoAnormalidadePreview = document.getElementById(
    "fotoAnormalidadePreview"
  );
  const fotoAnormalidadePreviewContainer = document.getElementById(
    "fotoAnormalidadePreviewContainer"
  );
  const btnDeleteFotoAnormalidade = document.getElementById(
    "btnDeleteFotoAnormalidade"
  );
  const btnSalvarJustificativa = document.getElementById(
    "btnSalvarJustificativa"
  );

  let bsModalJustificativa = null;
  if (modalJustificativaEl) {
    bsModalJustificativa = new bootstrap.Modal(modalJustificativaEl);
  }

  let currentItemAnormalElement = null;
  let itemAnormalData = {};

  const checklistTemplate = [
    {
      grupo: "Barramentos 69 e 13,8 kV",
      icon: "electrical_services",
      itens: [
        {
          num: 1,
          desc: "Condições das estruturas de concreto armado quanto à existência de ferragens expostas e ferrugens.",
        },
        {
          num: 2,
          desc: "Condições de conservação das estruturas metálicas, ferragens, etc.",
        },
        {
          num: 3,
          desc: "Condições dos Isoladores: trincas, corrosões, sinais de curto circuito.",
        },
        {
          num: 4,
          desc: "Conexões dos cabos de descarga dos pára-raios à malha de terra e estado de conservação.",
        },
        { num: 5, desc: "Existência e estado de conservação dos TP's e TC's." },
        {
          num: 6,
          desc: "Existência e condições dos pontos de medição da malha de terra.",
        },
        {
          num: 7,
          desc: "Inexistência de ninhos de pássaros, cupins, maribondos, etc.",
        },
        { num: 8, desc: "Existência e estado de conservação dos para-raios." },
        { num: 9, desc: "Ausência de pontos quentes nas conexões." },
      ],
    },
    {
      grupo: "Chaves Seccionadoras e Fusíveis",
      icon: "power_settings_new",
      itens: [
        { num: 10, desc: "Inexistência de trincas nos isoladores." },
        {
          num: 11,
          desc: "Existência e estado de conservação do cabo de interligação dos equipamentos à malha de terra.",
        },
        { num: 12, desc: "Estado da codificação operacional." },
        {
          num: 13,
          desc: "Estado de conservação da pintura, chaparia, além da ausência de sujeira.",
        },
        {
          num: 14,
          desc: "Estado e sinalização dos varões de comando das chaves de manobra.",
        },
        { num: 15, desc: "Inexistência de elos fusíveis queimados." },
        { num: 16, desc: "Ausência de pontos quentes nas conexões." },
      ],
    },
    {
      grupo: "Transformadores de Força e Auxiliares",
      icon: "transform",
      itens: [
        { num: 17, desc: "Inexistência de vazamentos de óleo." },
        {
          num: 18,
          desc: "Estado de conservação da pintura, chaparia, além da ausência de sujeira.",
        },
        { num: 19, desc: "Indicadores de níveis de óleo." },
        { num: 20, desc: "Inexistência de trincas nas buchas." },
        {
          num: 21,
          desc: "Existência e estado de conservação do cabo de interligação dos equipamentos à malha de terra.",
        },
        { num: 22, desc: "Estado da codificação operacional." },
        {
          num: 23,
          desc: "Cor da sílica gel e existência de óleo no copo de respiração.",
        },
        {
          num: 24,
          desc: "Estado de conservação e teste – via comando manual – da ventilação forçada do transformador de força.",
        },
        {
          num: 25,
          desc: "Existência e funcionamento da tomada de força presente no painel.",
        },
        {
          num: 26,
          desc: "Condições das interligações das fiações das réguas de conexões dos equipamentos.",
        },
        {
          num: 27,
          desc: "Existência e funcionamento da iluminação interna no painel.",
        },
        { num: 28, desc: "Condições dos disjuntores e fusíveis nos painéis." },
        {
          num: 29,
          desc: "Inexistência de ninhos de pássaros, cupins, maribondos, etc.",
        },
      ],
    },
    {
      grupo: "Religadores e Disjuntores",
      icon: "bolt",
      itens: [
        { num: 30, desc: "Inexistência de vazamentos de óleo." },
        {
          num: 31,
          desc: "Estado de conservação da pintura, chaparia, além da ausência de sujeira.",
        },
        { num: 32, desc: "Indicadores de níveis de óleo." },
        { num: 33, desc: "Inexistência de trincas nas buchas." },
        {
          num: 34,
          desc: "Existência e estado de conservação do cabo de interligação dos equipamentos à malha de terra.",
        },
        { num: 35, desc: "Estado da codificação operacional." },
        {
          num: 36,
          desc: "Existência e funcionamento da tomada de força presente no painel.",
        },
        {
          num: 37,
          desc: "Condições das interligações das fiações das réguas de conexões dos equipamentos.",
        },
        {
          num: 38,
          desc: "Existência e funcionamento da iluminação interna no painel.",
        },
        { num: 39, desc: "Condições dos disjuntores e fusíveis no painel." },
        {
          num: 40,
          desc: "Existência, condições e adequação dos protetores de buchas.",
        },
        {
          num: 41,
          desc: "Estado de conservação dos contadores de operação religador. (Anotar o número de operação).",
        },
        { num: 42, desc: "Existência e estado de conservação dos para-raios." },
        {
          num: 43,
          desc: "Inexistência de ninhos de pássaros, cupins, maribondos, etc.",
        },
        { num: 44, desc: "Ausência de pontos quentes nas conexões." },
      ],
    },
    {
      grupo: "Banco de Capacitores",
      icon: "storage",
      itens: [
        { num: 45, desc: "Estado de consevarção da chave a óleo." },
        { num: 46, desc: "Inexistência de vazamentos de óleo." },
        {
          num: 47,
          desc: "Estado de conservação da pintura, chaparia dos equipamentos em geral, além da ausência de sujeira.",
        },
        {
          num: 48,
          desc: "Inexistência de trincas nas buchas e nos isoladores.",
        },
        {
          num: 49,
          desc: "Existência e estado de conservação do cabo de interligação dos equipamentos à malha de terra.",
        },
        { num: 50, desc: "Estado da codificação operacional." },
        { num: 51, desc: "Inexistência de elos fusíveis queimados." },
        {
          num: 52,
          desc: "Existencia e estado de conservação da chave terra (31H1-7).",
        },
        { num: 53, desc: "Existência e estado de conservação dos para-raios." },
        {
          num: 54,
          desc: "Inexistência de ninhos de pássaros, cupins, maribondos, etc.",
        },
        { num: 55, desc: "Ausência de pontos quentes nas conexões." },
      ],
    },
  ];

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
    if (inspecaoDataAvaliacaoInput) {
      inspecaoDataAvaliacaoInput.value = new Date().toISOString().split("T")[0];
    }
  }

  function gerarItensChecklist() {
    if (!checklistItensContainer) return;
    checklistItensContainer.innerHTML = "";
    itemAnormalData = {};
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
            <div class="item-numero">${item.num}.</div>
            <div class="item-descricao">${item.desc}</div>
            <div class="item-avaliacao btn-group" role="group" aria-label="Avaliação do item ${item.num}">
                <input type="radio" class="btn-check" name="item_${item.num}_avaliacao" id="item_${item.num}_n" value="N" required autocomplete="off">
                <label class="btn btn-sm btn-outline-success" for="item_${item.num}_n">N</label>

                <input type="radio" class="btn-check" name="item_${item.num}_avaliacao" id="item_${item.num}_a" value="A" autocomplete="off">
                <label class="btn btn-sm btn-outline-danger" for="item_${item.num}_a">A</label>

                <input type="radio" class="btn-check" name="item_${item.num}_avaliacao" id="item_${item.num}_na" value="NA" autocomplete="off">
                <label class="btn btn-sm btn-outline-secondary" for="item_${item.num}_na">NA</label>
            </div>
        `;

        const radios = itemDiv.querySelectorAll(
          `input[name="item_${item.num}_avaliacao"]`
        );
        radios.forEach((radio) => {
          radio.addEventListener("change", (event) => {
            const descElement = itemDiv.querySelector(".item-descricao");
            if (descElement) {
              descElement.classList.remove(
                "anormal-justificada",
                "anormal-com-foto"
              );
            }
            handleAvaliacaoChange(
              event,
              itemDiv,
              itemDiv.querySelector(".item-descricao")
            );
          });
        });
        itensList.appendChild(itemDiv);
      });
      grupoSection.appendChild(itensList);
      checklistItensContainer.appendChild(grupoSection);
    });
  }

  function handleAvaliacaoChange(event, itemElement, itemDescElement) {
    const selectedValue = event.target.value;
    const itemNum = itemElement.getAttribute("data-item-num");
    const itemDescText = itemElement.getAttribute("data-item-desc");

    if (selectedValue === "A") {
      currentItemAnormalElement = itemElement;
      if (itemAnormalDescricaoP)
        itemAnormalDescricaoP.textContent = `Item ${itemNum}: ${itemDescText}`;
      if (justificativaTextarea)
        justificativaTextarea.value =
          itemAnormalData[`item_${itemNum}_obs`] || "";
      if (fotoAnormalidadeInput) fotoAnormalidadeInput.value = null;

      const currentFile = itemAnormalData[`item_${itemNum}_fotoFile`];
      if (currentFile) {
        if (fotoAnormalidadeNomeP)
          fotoAnormalidadeNomeP.textContent = currentFile.name;
        if (fotoAnormalidadePreview)
          fotoAnormalidadePreview.src = URL.createObjectURL(currentFile);
        if (fotoAnormalidadePreview)
          fotoAnormalidadePreview.style.display = "block";
        if (btnDeleteFotoAnormalidade)
          btnDeleteFotoAnormalidade.style.display = "inline-flex";
        if (fotoAnormalidadePreviewContainer)
          fotoAnormalidadePreviewContainer.style.display = "flex";
      } else {
        if (fotoAnormalidadeNomeP)
          fotoAnormalidadeNomeP.textContent = "Nenhuma foto selecionada.";
        if (fotoAnormalidadePreview) {
          fotoAnormalidadePreview.src = "#";
          fotoAnormalidadePreview.style.display = "none";
        }
        if (btnDeleteFotoAnormalidade)
          btnDeleteFotoAnormalidade.style.display = "none";
        if (fotoAnormalidadePreviewContainer)
          fotoAnormalidadePreviewContainer.style.display = "none";
      }
      if (bsModalJustificativa) {
        mostrarModal(bsModalJustificativa);
        if (justificativaTextarea) {
          setTimeout(() => {
            justificativaTextarea.focus();
          }, 150);
        }
      }
    } else {
      delete itemAnormalData[`item_${itemNum}_obs`];
      delete itemAnormalData[`item_${itemNum}_fotoFile`];
      if (itemDescElement) {
        itemDescElement.classList.remove(
          "anormal-justificada",
          "anormal-com-foto"
        );
      }
    }
  }

  if (fotoAnormalidadeInput) {
    fotoAnormalidadeInput.addEventListener("change", (event) => {
      if (currentItemAnormalElement) {
        const itemNum = currentItemAnormalElement.getAttribute("data-item-num");
        const file = event.target.files[0];
        if (file) {
          if (file.type.startsWith("image/")) {
            itemAnormalData[`item_${itemNum}_fotoFile`] = file;
            if (fotoAnormalidadeNomeP)
              fotoAnormalidadeNomeP.textContent = file.name;
            const reader = new FileReader();
            reader.onload = (e) => {
              if (fotoAnormalidadePreview)
                fotoAnormalidadePreview.src = e.target.result;
              if (fotoAnormalidadePreview)
                fotoAnormalidadePreview.style.display = "block";
              if (btnDeleteFotoAnormalidade)
                btnDeleteFotoAnormalidade.style.display = "inline-flex";
              if (fotoAnormalidadePreviewContainer)
                fotoAnormalidadePreviewContainer.style.display = "flex";
            };
            reader.readAsDataURL(file);
          } else {
            alert(
              "Por favor, selecione um arquivo de imagem válido (jpg, png, etc)."
            );
            fotoAnormalidadeInput.value = null;
            delete itemAnormalData[`item_${itemNum}_fotoFile`];
            if (fotoAnormalidadeNomeP)
              fotoAnormalidadeNomeP.textContent = "Nenhuma foto selecionada.";
            if (fotoAnormalidadePreview) {
              fotoAnormalidadePreview.src = "#";
              fotoAnormalidadePreview.style.display = "none";
            }
            if (btnDeleteFotoAnormalidade)
              btnDeleteFotoAnormalidade.style.display = "none";
            if (fotoAnormalidadePreviewContainer)
              fotoAnormalidadePreviewContainer.style.display = "none";
          }
        } else {
          delete itemAnormalData[`item_${itemNum}_fotoFile`];
          if (fotoAnormalidadeNomeP)
            fotoAnormalidadeNomeP.textContent = "Nenhuma foto selecionada.";
          if (fotoAnormalidadePreview) {
            fotoAnormalidadePreview.src = "#";
            fotoAnormalidadePreview.style.display = "none";
          }
          if (btnDeleteFotoAnormalidade)
            btnDeleteFotoAnormalidade.style.display = "none";
          if (fotoAnormalidadePreviewContainer)
            fotoAnormalidadePreviewContainer.style.display = "none";
        }
      }
    });

    const modalFileInputWrapper = fotoAnormalidadeInput.closest(
      ".file-input-modern-wrapper"
    );
    if (modalFileInputWrapper) {
      modalFileInputWrapper.addEventListener("dragover", (event) => {
        event.preventDefault();
        modalFileInputWrapper.classList.add("dragover");
      });
      modalFileInputWrapper.addEventListener("dragleave", () => {
        modalFileInputWrapper.classList.remove("dragover");
      });
      modalFileInputWrapper.addEventListener("drop", (event) => {
        event.preventDefault();
        modalFileInputWrapper.classList.remove("dragover");
        if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
          fotoAnormalidadeInput.files = event.dataTransfer.files;
          fotoAnormalidadeInput.dispatchEvent(
            new Event("change", { bubbles: true })
          );
        }
      });
    }
  }

  if (btnDeleteFotoAnormalidade) {
    btnDeleteFotoAnormalidade.addEventListener("click", () => {
      if (currentItemAnormalElement) {
        const itemNum = currentItemAnormalElement.getAttribute("data-item-num");
        delete itemAnormalData[`item_${itemNum}_fotoFile`];
        if (fotoAnormalidadeInput) fotoAnormalidadeInput.value = null;
        if (fotoAnormalidadePreview) {
          fotoAnormalidadePreview.src = "#";
          fotoAnormalidadePreview.style.display = "none";
        }
        btnDeleteFotoAnormalidade.style.display = "none";
        if (fotoAnormalidadePreviewContainer)
          fotoAnormalidadePreviewContainer.style.display = "none";
        if (fotoAnormalidadeNomeP)
          fotoAnormalidadeNomeP.textContent = "Nenhuma foto selecionada.";
        const descElement =
          currentItemAnormalElement.querySelector(".item-descricao");
        if (descElement) descElement.classList.remove("anormal-com-foto");
      }
    });
  }

  if (btnSalvarJustificativa) {
    btnSalvarJustificativa.addEventListener("click", () => {
      if (
        currentItemAnormalElement &&
        justificativaTextarea &&
        fotoAnormalidadeInput
      ) {
        const itemNum = currentItemAnormalElement.getAttribute("data-item-num");
        const justificativa = justificativaTextarea.value.trim();
        const fotoFile = itemAnormalData[`item_${itemNum}_fotoFile`];
        const descElement =
          currentItemAnormalElement.querySelector(".item-descricao");

        if (!justificativa) {
          alert("Forneça uma justificativa para a anormalidade.");
          justificativaTextarea.focus();
          return;
        }
        if (!fotoFile) {
          alert("Uma foto de evidência é obrigatória para itens anormais.");
          return;
        }

        itemAnormalData[`item_${itemNum}_obs`] = justificativa;

        if (descElement) {
          if (justificativa) descElement.classList.add("anormal-justificada");
          else descElement.classList.remove("anormal-justificada");

          if (fotoFile) descElement.classList.add("anormal-com-foto");
          else descElement.classList.remove("anormal-com-foto");
        }
        if (bsModalJustificativa) ocultarModal(bsModalJustificativa);
      }
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
    const wrapper = inspecaoAnexosInput.closest(".file-input-modern-wrapper");
    if (wrapper) {
      wrapper.addEventListener("dragover", (event) => {
        event.preventDefault();
        wrapper.classList.add("dragover");
      });
      wrapper.addEventListener("dragleave", () => {
        wrapper.classList.remove("dragover");
      });
      wrapper.addEventListener("drop", (event) => {
        event.preventDefault();
        wrapper.classList.remove("dragover");
        if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
          inspecaoAnexosInput.files = event.dataTransfer.files;
          inspecaoAnexosInput.dispatchEvent(
            new Event("change", { bubbles: true })
          );
        }
      });
    }
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

    if (
      nenhumaMedicaoAdicionadaMsg &&
      !nenhumaMedicaoAdicionadaMsg.classList.contains("d-none")
    ) {
      nenhumaMedicaoAdicionadaMsg.classList.add("d-none");
    }

    containerMedicoesDinamicas.appendChild(novaLinha);

    const btnRemover = novaLinha.querySelector(".btn-remover-medicao");
    btnRemover.addEventListener("click", () => {
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
        case "OUTRO":
          inputUnidade.value = "";
          inputUnidade.placeholder = "Unidade";
          inputValor.placeholder = "Valor";
          break;
        default:
          inputUnidade.value = "";
          inputUnidade.placeholder = "Unidade";
          inputValor.placeholder = "Valor";
      }
    });
  }

  if (btnAdicionarMedicao) {
    btnAdicionarMedicao.addEventListener("click", adicionarNovaLinhaMedicao);
  }

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
          if (dadosCabecalho[key] || typeof dadosCabecalho[key] === "number") {
            formData.append(key, dadosCabecalho[key]);
          } else if (dadosCabecalho[key] === null) {
            formData.append(key, "");
          }
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
        if (!avaliacao) {
          todosItensAvaliados = false;
        }

        const itemData = {
          item_num: parseInt(itemNum),
          grupo_item: itemDiv
            .closest(".checklist-grupo")
            ?.getAttribute("data-grupo"),
          descricao_item_original: itemDiv.getAttribute("data-item-desc"),
          avaliacao: avaliacao,
          observacao_item: itemAnormalData[`item_${itemNum}_obs`] || null,
        };
        itensChecklistArray.push(itemData);
        if (avaliacao === "A") {
          const fotoFile = itemAnormalData[`item_${itemNum}_fotoFile`];
          const obs = itemAnormalData[`item_${itemNum}_obs`];
          if (!fotoFile || !obs) {
            todosItensAnormaisCompletos = false;
            itemDiv.classList.add("item-incompleto-erro");
            setTimeout(
              () => itemDiv.classList.remove("item-incompleto-erro"),
              3000
            );
          } else {
            itemDiv.classList.remove("item-incompleto-erro");
            formData.append(`foto_item_${itemNum}`, fotoFile, fotoFile.name);
          }
        }
      });
      if (!todosItensAvaliados) {
        alert("Todos os itens do checklist devem ser avaliados (N, A ou NA).");
        const primeiroNaoAvaliado = Array.from(checklistItems).find(
          (itemDiv) => {
            const itemNum = itemDiv.getAttribute("data-item-num");
            return !itemDiv.querySelector(
              `input[name="item_${itemNum}_avaliacao"]:checked`
            );
          }
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
          "Existem itens anormais sem justificativa e/ou foto. Verifique os itens destacados em vermelho."
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

      const medicoesDinamicas = [];
      const linhasMedicao = containerMedicoesDinamicas.querySelectorAll(
        ".medicao-dinamica-item"
      );
      let todasMedicoesValidas = true;
      linhasMedicao.forEach((linha) => {
        const tipo = linha.querySelector(".tipo-medicao").value;
        const tag = linha
          .querySelector(".tag-equipamento-medicao")
          .value.trim();
        const valor = linha.querySelector(".valor-medido").value.trim();
        const unidade = linha.querySelector(".unidade-medida").value.trim();
        const obs = linha.querySelector(".obs-medicao").value.trim();

        if (!tipo || !valor) {
          alert(
            "Para cada medição adicionada, o Tipo de Medição e o Valor Lido são obrigatórios."
          );
          linha.querySelector(".tipo-medicao").focus();
          todasMedicoesValidas = false;
          return;
        }

        medicoesDinamicas.push({
          tipo_medicao: tipo,
          tag_equipamento: tag || null,
          valor_medido: valor,
          unidade_medida: unidade || null,
          observacao: obs || null,
        });
      });

      if (!todasMedicoesValidas) {
        return;
      }

      if (medicoesDinamicas.length > 0) {
        formData.append("medicoes", JSON.stringify(medicoesDinamicas));
      }

      selectedGeneralFiles.forEach((file) => {
        formData.append("anexosInspecao", file);
      });

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
        formChecklistInspecao.reset();
        limparMedicoesDinamicas();

        preencherDataAtual();
        gerarItensChecklist();
        if (listaNomesAnexosInspecao) listaNomesAnexosInspecao.innerHTML = "";
        selectedGeneralFiles = [];
        if (inspecaoFormularioNumDisplay)
          inspecaoFormularioNumDisplay.value = "Será gerado ao salvar";
        if (inspecaoSubestacaoSelect) inspecaoSubestacaoSelect.focus();
      } catch (error) {
        alert(`Falha ao salvar inspeção: ${error.message}`);
      } finally {
        btnSalvarInspecao.disabled = false;
        btnSalvarInspecao.innerHTML =
          '<span class="material-symbols-outlined">save</span> Salvar Inspeção';
      }
    });
  }
  if (btnCancelarChecklist) {
    btnCancelarChecklist.addEventListener("click", () => {
      if (
        confirm(
          "Cancelar e limpar o formulário? Os dados não salvos serão perdidos."
        )
      ) {
        if (formChecklistInspecao) formChecklistInspecao.reset();
        limparMedicoesDinamicas();

        preencherDataAtual();
        gerarItensChecklist();
        if (inspecaoSubestacaoSelect) inspecaoSubestacaoSelect.focus();
        if (listaNomesAnexosInspecao) listaNomesAnexosInspecao.innerHTML = "";
        selectedGeneralFiles = [];
        if (fotoAnormalidadePreview) {
          fotoAnormalidadePreview.src = "#";
          fotoAnormalidadePreview.style.display = "none";
        }
        if (btnDeleteFotoAnormalidade)
          btnDeleteFotoAnormalidade.style.display = "none";
        if (fotoAnormalidadePreviewContainer)
          fotoAnormalidadePreviewContainer.style.display = "none";
        if (fotoAnormalidadeNomeP)
          fotoAnormalidadeNomeP.textContent = "Nenhuma foto selecionada.";
        if (inspecaoFormularioNumDisplay)
          inspecaoFormularioNumDisplay.value = "Será gerado ao salvar";
      }
    });
  }

  if (modalJustificativaEl) {
    modalJustificativaEl.addEventListener("hidden.bs.modal", () => {
      if (currentItemAnormalElement) {
        const itemNum = currentItemAnormalElement.getAttribute("data-item-num");
        const isAnormalidadeSalva =
          itemAnormalData[`item_${itemNum}_obs`] &&
          itemAnormalData[`item_${itemNum}_fotoFile`];
        const radioAnormalChecked = currentItemAnormalElement.querySelector(
          `input[name="item_${itemNum}_avaliacao"][value="A"]:checked`
        );

        if (radioAnormalChecked && !isAnormalidadeSalva) {
          const radioN = currentItemAnormalElement.querySelector(
            `input[name="item_${itemNum}_avaliacao"][value="N"]`
          );
          const radioAnteriorOuN =
            radioN ||
            currentItemAnormalElement.querySelector(
              `input[name="item_${itemNum}_avaliacao"]:not([value="A"])`
            );

          if (radioAnteriorOuN) {
            radioAnteriorOuN.checked = true;
            radioAnteriorOuN.dispatchEvent(
              new Event("change", { bubbles: true })
            );
          } else {
            radioAnormalChecked.checked = false;
            radioAnormalChecked.dispatchEvent(
              new Event("change", { bubbles: true })
            );
          }
        }
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
  }
  init();
});
