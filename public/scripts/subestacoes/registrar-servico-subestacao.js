document.addEventListener("DOMContentLoaded", () => {
  const paginaTitulo = document.getElementById("paginaTitulo");
  const formServico = document.getElementById("formServico");
  const servicoSubestacaoSelect = document.getElementById("servicoSubestacao");
  const servicoResponsavelSelect =
    document.getElementById("servicoResponsavel");
  const servicoPrioridadeSelect = document.getElementById("servicoPrioridade");
  const btnAbrirModalItem = document.getElementById("btnAbrirModalItem");
  const listaItensDeServico = document.getElementById("listaItensDeServico");
  const msgNenhumItem = document.getElementById("msgNenhumItem");
  const btnSalvarServico = document.getElementById("btnSalvarServico");
  const btnCancelarServico = document.getElementById("btnCancelarServico");

  const btnAnexarGeral = document.getElementById("btnAnexarGeral");
  const btnFotografarGeral = document.getElementById("btnFotografarGeral");
  const anexosGeraisInput = document.getElementById("anexosGeraisInput");
  const anexosGeraisCameraInput = document.getElementById(
    "anexosGeraisCameraInput"
  );
  const previewAnexosGerais = document.getElementById("previewAnexosGerais");

  const modalPreSelecaoServicoEl = document.getElementById(
    "modalPreSelecaoServico"
  );
  const btnServicoAvulso = document.getElementById("btnServicoAvulso");
  const btnServicoAPartirDeInspecao = document.getElementById(
    "btnServicoAPartirDeInspecao"
  );
  const btnCancelarPreSelecao = document.getElementById(
    "btnCancelarPreSelecao"
  );

  const modalAdicionarItemEl = document.getElementById("modalAdicionarItem");
  const modalItemTitulo = document.getElementById("modalItemTitulo");
  const formModalItem = document.getElementById("formModalItem");
  const modalItemTempIdInput = document.getElementById("modalItemTempId");

  const modalItemDefeitoInput = document.getElementById("modalItemDefeito");
  const modalItemDefeitoIdInput = document.getElementById("modalItemDefeitoId");
  const sugestoesDefeitosDiv = document.getElementById("sugestoesDefeitos");

  const modalItemEquipamentoInput = document.getElementById(
    "modalItemEquipamento"
  );
  const modalItemEquipamentoIdInput = document.getElementById(
    "modalItemEquipamentoId"
  );
  const sugestoesEquipamentosDiv = document.getElementById(
    "sugestoesEquipamentos"
  );

  const modalItemTagInput = document.getElementById("modalItemTag");
  const modalItemDescricaoTextarea =
    document.getElementById("modalItemDescricao");

  const btnAnexarItemModal = document.getElementById("btnAnexarItemModal");
  const btnFotografarItemModal = document.getElementById(
    "btnFotografarItemModal"
  );
  const modalItemAnexosInput = document.getElementById("modalItemAnexos");
  const modalItemCameraInput = document.getElementById("modalItemCamera");
  const modalPreviewAnexosItemDiv = document.getElementById(
    "modalPreviewAnexosItem"
  );
  const btnSalvarItemModal = document.getElementById("btnSalvarItemModal");

  const modalSelecionarInspecaoEl = document.getElementById(
    "modalSelecionarInspecao"
  );
  const filtroInspecaoSubestacaoSelect = document.getElementById(
    "filtroInspecaoSubestacao"
  );
  const filtroInspecaoStatusSelect = document.getElementById(
    "filtroInspecaoStatus"
  );
  const btnFiltrarInspecoes = document.getElementById("btnFiltrarInspecoes");
  const corpoTabelaInspecoes = document.getElementById("corpoTabelaInspecoes");
  const nenhumaInspecaoEncontrada = document.getElementById(
    "nenhumaInspecaoEncontrada"
  );
  const selecionarTodasInspecoes = document.getElementById(
    "selecionarTodasInspecoes"
  );
  const btnConfirmarSelecaoInspecoes = document.getElementById(
    "btnConfirmarSelecaoInspecoes"
  );

  const templateAnexoPreview = document.getElementById("templateAnexoPreview");
  const templateItemAnormal = document.getElementById("templateItemAnormal");

  let subestacoesCache = [];
  let usuariosResponsaveisCache = [];
  let catalogoDefeitosCache = [];
  let catalogoEquipamentosCache = [];

  let itensDeServico = [];
  let modalAnexosTemporarios = [];
  let anexosGeraisFinais = [];

  function mostrarModal(modalEl) {
    if (modalEl) modalEl.classList.remove("hidden");
  }

  function ocultarModal(modalEl) {
    if (modalEl) modalEl.classList.add("hidden");
  }

  document
    .querySelectorAll(
      ".modal-overlay .btn-close, .modal-overlay .btn-close-modal"
    )
    .forEach((btn) => {
      btn.addEventListener("click", () =>
        ocultarModal(btn.closest(".modal-overlay"))
      );
    });

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
      alert(`Erro ao comunicar com o servidor: ${error.message}.`);
      throw error;
    }
  }

  async function buscarCatalogos() {
    try {
      [catalogoDefeitosCache, catalogoEquipamentosCache] = await Promise.all([
        fetchData("/api/catalogo-defeitos-servicos"),
        fetchData("/api/catalogo/equipamentos"),
      ]);
    } catch (error) {
      console.error("Erro fatal ao carregar catálogos iniciais:", error);
      alert("Não foi possível carregar os dados essenciais para o formulário.");
    }
  }

  async function popularSelectsIniciais() {
    try {
      const [subestacoes, usuariosResp] = await Promise.all([
        fetchData("/subestacoes"),
        fetchData("/usuarios-responsaveis-para-servicos"),
      ]);
      subestacoesCache = subestacoes || [];
      usuariosResponsaveisCache = usuariosResp || [];

      [servicoSubestacaoSelect, filtroInspecaoSubestacaoSelect].forEach(
        (select) => {
          if (!select) return;
          const isFilter = select === filtroInspecaoSubestacaoSelect;
          select.innerHTML = isFilter
            ? '<option value="">Todas</option>'
            : '<option value="">Selecione...</option>';
          subestacoesCache.forEach((sub) =>
            select.add(new Option(`${sub.sigla} - ${sub.nome}`, sub.Id))
          );
        }
      );

      servicoResponsavelSelect.innerHTML =
        '<option value="">Selecione...</option>';
      usuariosResponsaveisCache.forEach((user) =>
        servicoResponsavelSelect.add(new Option(user.nome, user.id))
      );
    } catch (error) {
      console.error("Erro ao popular selects iniciais:", error);
    }
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

  function abrirModalParaNovoItem() {
    salvarEstadoDosItensNaTela();
    formModalItem.reset();
    modalItemTempIdInput.value = `temp_${Date.now()}`;
    modalItemTitulo.innerHTML = `<span class="material-symbols-outlined">add_task</span> Adicionar Item de Serviço`;
    btnSalvarItemModal.innerHTML = `<span class="material-symbols-outlined">check</span> Adicionar Item`;
    modalAnexosTemporarios = [];
    renderizarPreviewAnexos(modalAnexosTemporarios, modalPreviewAnexosItemDiv);
    mostrarModal(modalAdicionarItemEl);
  }

  function salvarEstadoDosItensNaTela() {
    document
      .querySelectorAll("#listaItensDeServico .item-card-anormal")
      .forEach((card) => {
        const tempId = card.dataset.tempId;
        const itemNoArray = itensDeServico.find((i) => i.temp_id === tempId);
        if (itemNoArray) {
          itemNoArray.defeito_id = card.querySelector(".defeito-id").value;
          itemNoArray.equipamento_id =
            card.querySelector(".equipamento-id").value;
          itemNoArray.tag = card.querySelector(".tag-alvo").value;
          itemNoArray.defeito_texto = card.querySelector(
            ".defeito-autocomplete"
          ).value;
          itemNoArray.equipamento_texto = card.querySelector(
            ".equipamento-autocomplete"
          ).value;
        }
      });
  }

  function renderizarItensDeServico() {
    listaItensDeServico.innerHTML = "";
    if (itensDeServico.length === 0) {
      msgNenhumItem.classList.remove("hidden");
      return;
    }
    msgNenhumItem.classList.add("hidden");

    itensDeServico.forEach((item) => {
      if (item.tipo === "avulso") {
        renderizarItemAvulso(item);
      } else if (item.tipo === "inspecao") {
        renderizarItemAnormal(item);
      }
    });
  }

  function renderizarItemAvulso(item) {
    const itemCard = document.createElement("div");
    itemCard.className = "item-card";
    itemCard.dataset.tempId = item.temp_id;

    itemCard.innerHTML = `
        <div class="item-card-content">
          <p class="item-card-title">${item.descricao}</p>
          <p class="item-card-details">
            <strong>Defeito:</strong> ${item.defeito_texto || "N/A"} <br>
            <strong>Equipamento:</strong> ${item.equipamento_texto} (${
      item.tag
    })
          </p>
        </div>
        <div class="item-card-actions">
          <button type="button" class="btn delete" title="Remover Item">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      `;

    const anexosContainer = document.createElement("div");
    anexosContainer.className = "anexos-preview-container item-anexos-preview";
    itemCard.querySelector(".item-card-content").appendChild(anexosContainer);
    renderizarPreviewAnexos(item.anexos, anexosContainer, true, item.temp_id);

    itemCard.querySelector(".delete").addEventListener("click", () => {
      if (confirm("Tem certeza que deseja remover este item?")) {
        itensDeServico = itensDeServico.filter(
          (i) => i.temp_id !== item.temp_id
        );
        renderizarItensDeServico();
      }
    });

    listaItensDeServico.appendChild(itemCard);
  }

  function renderizarItemAnormal(item) {
    const clone = templateItemAnormal.content.cloneNode(true);
    const itemAnormalCard = clone.querySelector(".item-card-anormal");
    itemAnormalCard.dataset.tempId = item.temp_id;
    itemAnormalCard.querySelector(
      ".origem-inspecao"
    ).textContent = `Origem: Inspeção #${item.origem.formulario_inspecao_num} (${item.origem.subestacao_sigla})`;
    itemAnormalCard.querySelector(".item-anormal-descricao").textContent =
      item.descricao;

    const defeitoInput = itemAnormalCard.querySelector(".defeito-autocomplete");
    const defeitoIdInput = itemAnormalCard.querySelector(".defeito-id");
    const defeitoSuggestions = itemAnormalCard.querySelectorAll(
      ".autocomplete-suggestions"
    )[0];
    setupAutocomplete(
      defeitoInput,
      defeitoIdInput,
      defeitoSuggestions,
      catalogoDefeitosCache,
      (d) => `${d.codigo} - ${d.descricao}`,
      "id"
    );
    if (item.defeito_id) {
      defeitoIdInput.value = item.defeito_id;
      defeitoInput.value = item.defeito_texto;
    }

    const equipamentoInput = itemAnormalCard.querySelector(
      ".equipamento-autocomplete"
    );
    const equipamentoIdInput = itemAnormalCard.querySelector(".equipamento-id");
    const equipamentoSuggestions = itemAnormalCard.querySelectorAll(
      ".autocomplete-suggestions"
    )[1];
    setupAutocomplete(
      equipamentoInput,
      equipamentoIdInput,
      equipamentoSuggestions,
      catalogoEquipamentosCache,
      (e) => `${e.codigo} - ${e.nome}`,
      "id"
    );
    if (item.equipamento_id) {
      equipamentoIdInput.value = item.equipamento_id;
      equipamentoInput.value = item.equipamento_texto;
    }

    const tagInput = itemAnormalCard.querySelector(".tag-alvo");
    if (item.tag) {
      tagInput.value = item.tag;
    }

    const anexosOrigemContainer = itemAnormalCard.querySelector(
      ".anexos-origem-container"
    );
    if (item.origem.anexos && item.origem.anexos.length > 0) {
      item.origem.anexos.forEach((anexo) => {
        const img = document.createElement("img");
        img.src = anexo.caminho_servidor;
        img.alt = anexo.nome_original;
        img.title = anexo.nome_original;
        img.className = "anexo-origem-img";
        anexosOrigemContainer.appendChild(img);
      });
    } else {
      anexosOrigemContainer.innerHTML =
        '<p class="sem-anexos-msg">Sem anexos na inspeção de origem.</p>';
    }

    listaItensDeServico.appendChild(itemAnormalCard);
  }

  function renderizarPreviewAnexos(
    listaDeArquivos,
    container,
    isItemCard = false,
    itemTempId = null
  ) {
    container.innerHTML = "";
    listaDeArquivos.forEach((file, index) => {
      const clone = templateAnexoPreview.content.cloneNode(true);
      const anexoItem = clone.querySelector(".anexo-preview-item");
      const imgPreview = anexoItem.querySelector(".anexo-preview-img");
      const iconDefault = anexoItem.querySelector(".file-icon");

      anexoItem.querySelector(".file-name").textContent = file.name;
      anexoItem.querySelector(".file-size").textContent = `${(
        file.size / 1024
      ).toFixed(1)} KB`;

      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          imgPreview.src = e.target.result;
          imgPreview.classList.remove("hidden");
          iconDefault.classList.add("hidden");
        };
        reader.readAsDataURL(file);
      } else {
        imgPreview.classList.add("hidden");
        iconDefault.classList.remove("hidden");
      }

      anexoItem.querySelector(".btn-remove").addEventListener("click", () => {
        listaDeArquivos.splice(index, 1);
        if (isItemCard) {
          const itemPai = itensDeServico.find((i) => i.temp_id === itemTempId);
          if (itemPai) {
            itemPai.anexos = listaDeArquivos;
          }
          renderizarItensDeServico();
        } else {
          renderizarPreviewAnexos(listaDeArquivos, container);
        }
      });

      container.appendChild(anexoItem);
    });
  }

  function adicionarArquivos(files, lista, container) {
    lista.push(...Array.from(files));
    renderizarPreviewAnexos(lista, container);
  }

  btnAnexarItemModal.addEventListener("click", () =>
    modalItemAnexosInput.click()
  );
  btnFotografarItemModal.addEventListener("click", () =>
    modalItemCameraInput.click()
  );
  modalItemAnexosInput.addEventListener("change", (e) =>
    adicionarArquivos(
      e.target.files,
      modalAnexosTemporarios,
      modalPreviewAnexosItemDiv
    )
  );
  modalItemCameraInput.addEventListener("change", (e) =>
    adicionarArquivos(
      e.target.files,
      modalAnexosTemporarios,
      modalPreviewAnexosItemDiv
    )
  );

  btnAnexarGeral.addEventListener("click", () => anexosGeraisInput.click());
  btnFotografarGeral.addEventListener("click", () =>
    anexosGeraisCameraInput.click()
  );
  anexosGeraisInput.addEventListener("change", (e) =>
    adicionarArquivos(e.target.files, anexosGeraisFinais, previewAnexosGerais)
  );
  anexosGeraisCameraInput.addEventListener("change", (e) =>
    adicionarArquivos(e.target.files, anexosGeraisFinais, previewAnexosGerais)
  );

  btnSalvarItemModal.addEventListener("click", () => {
    salvarEstadoDosItensNaTela();
    if (
      !modalItemTagInput.value.trim() ||
      !modalItemDescricaoTextarea.value.trim()
    ) {
      alert("A TAG do equipamento e a Descrição da tarefa são obrigatórias.");
      return;
    }

    const novoItem = {
      tipo: "avulso",
      temp_id: modalItemTempIdInput.value,
      defeito_id: modalItemDefeitoIdInput.value || null,
      equipamento_id: modalItemEquipamentoIdInput.value || null,
      tag: modalItemTagInput.value.trim(),
      descricao: modalItemDescricaoTextarea.value.trim(),
      defeito_texto: modalItemDefeitoInput.value,
      equipamento_texto: modalItemEquipamentoInput.value,
      anexos: [...modalAnexosTemporarios],
    };

    itensDeServico.push(novoItem);
    renderizarItensDeServico();
    ocultarModal(modalAdicionarItemEl);
  });

  btnAbrirModalItem.addEventListener("click", abrirModalParaNovoItem);

  async function carregarInspecoesParaSelecao() {
    const subestacaoId = filtroInspecaoSubestacaoSelect.value;
    const status = filtroInspecaoStatusSelect.value;
    const params = new URLSearchParams({
      subestacao_id: subestacaoId,
      status_inspecao: status,
    });

    corpoTabelaInspecoes.innerHTML =
      '<tr><td colspan="5">Buscando...</td></tr>';
    nenhumaInspecaoEncontrada.classList.add("hidden");

    try {
      const inspecoes = await fetchData(
        `/inspecoes-subestacoes?${params.toString()}`
      );
      corpoTabelaInspecoes.innerHTML = "";
      if (inspecoes.length === 0) {
        nenhumaInspecaoEncontrada.classList.remove("hidden");
        return;
      }
      inspecoes.forEach((insp) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
                  <td><input type="checkbox" class="inspecao-checkbox" data-id="${
                    insp.id
                  }"></td>
                  <td>${insp.formulario_inspecao_num}</td>
                  <td>${insp.subestacao_sigla}</td>
                  <td>${new Date(insp.data_avaliacao).toLocaleDateString(
                    "pt-BR"
                  )}</td>
                  <td>${insp.responsavel_nome}</td>
              `;
        corpoTabelaInspecoes.appendChild(tr);
      });
    } catch (error) {
      corpoTabelaInspecoes.innerHTML =
        '<tr><td colspan="5" class="text-danger">Erro ao carregar inspeções.</td></tr>';
    }
  }

  function inverterDescricaoParaAnormalidade(descricao) {
    const mapaInversoes = {
      "Inexistência de": "Presença de",
      "Ausência de": "Presença de",
      "Bom estado de": "Mau estado de",
      "Boas condições de": "Más condições de",
      "Correto funcionamento de": "Falha no funcionamento de",
      "Nível adequado de": "Nível inadequado de",
      "Limpeza de": "Sujeira em",
    };

    for (const [chave, valor] of Object.entries(mapaInversoes)) {
      if (descricao.startsWith(chave)) {
        return descricao.replace(chave, valor);
      }
    }
    return `Verificar/Corrigir: ${descricao}`;
  }

  async function handleConfirmarSelecaoInspecoes() {
    salvarEstadoDosItensNaTela();
    const idsSelecionados = Array.from(
      corpoTabelaInspecoes.querySelectorAll(".inspecao-checkbox:checked")
    ).map((cb) => cb.dataset.id);
    if (idsSelecionados.length === 0) {
      alert("Selecione pelo menos uma inspeção.");
      return;
    }

    try {
      btnConfirmarSelecaoInspecoes.disabled = true;
      btnConfirmarSelecaoInspecoes.innerHTML = "Buscando detalhes...";

      const detalhesInspecoes = await fetchData(
        "/api/inspecoes/detalhes-para-servico",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inspecao_ids: idsSelecionados }),
        }
      );

      detalhesInspecoes.forEach((insp) => {
        insp.itens_anormais.forEach((itemAnormal) => {
          const temEspecificacoes =
            itemAnormal.especificacoes && itemAnormal.especificacoes.length > 0;
          const descricaoAnormalidade = inverterDescricaoParaAnormalidade(
            itemAnormal.descricao_item
          );

          if (temEspecificacoes) {
            itemAnormal.especificacoes.forEach((esp) => {
              const itemEspecifico = {
                tipo: "inspecao",
                temp_id: `insp_${insp.id}_${itemAnormal.resposta_id}_esp_${esp.id}`,
                descricao: `${descricaoAnormalidade} (Equipamento: ${esp.descricao_equipamento})`,
                origem: {
                  inspecao_id: insp.id,
                  formulario_inspecao_num: insp.formulario_inspecao_num,
                  subestacao_sigla: insp.subestacao_sigla,
                  resposta_id: itemAnormal.resposta_id,
                  especificacao_id: esp.id,
                  anexos: esp.anexos || [],
                },
                anexos: [],
              };
              if (
                !itensDeServico.some(
                  (i) => i.temp_id === itemEspecifico.temp_id
                )
              ) {
                itensDeServico.push(itemEspecifico);
              }
            });
          } else {
            const itemGeral = {
              tipo: "inspecao",
              temp_id: `insp_${insp.id}_${itemAnormal.resposta_id}_geral`,
              descricao: descricaoAnormalidade,
              origem: {
                inspecao_id: insp.id,
                formulario_inspecao_num: insp.formulario_inspecao_num,
                subestacao_sigla: insp.subestacao_sigla,
                resposta_id: itemAnormal.resposta_id,
                especificacao_id: null,
                anexos: itemAnormal.anexos_gerais || [],
              },
              anexos: [],
            };
            if (!itensDeServico.some((i) => i.temp_id === itemGeral.temp_id)) {
              itensDeServico.push(itemGeral);
            }
          }
        });
      });
      renderizarItensDeServico();
      ocultarModal(modalSelecionarInspecaoEl);
    } catch (error) {
      alert("Erro ao buscar detalhes das inspeções selecionadas.");
    } finally {
      btnConfirmarSelecaoInspecoes.disabled = false;
      btnConfirmarSelecaoInspecoes.innerHTML =
        '<span class="material-symbols-outlined">task</span> Gerar Itens a Partir da Seleção';
    }
  }

  btnFiltrarInspecoes.addEventListener("click", carregarInspecoesParaSelecao);
  btnConfirmarSelecaoInspecoes.addEventListener(
    "click",
    handleConfirmarSelecaoInspecoes
  );
  selecionarTodasInspecoes.addEventListener("change", (e) => {
    corpoTabelaInspecoes
      .querySelectorAll(".inspecao-checkbox")
      .forEach((cb) => (cb.checked = e.target.checked));
  });

  formServico.addEventListener("submit", async (e) => {
    e.preventDefault();
    salvarEstadoDosItensNaTela();

    if (itensDeServico.length === 0) {
      alert("Adicione pelo menos um item de serviço antes de salvar.");
      return;
    }

    const formData = new FormData();
    formData.append("subestacao_id", formServico.elements.subestacao_id.value);
    formData.append("processo", formServico.elements.processo.value);
    formData.append("tipo_ordem", formServico.elements.tipo_ordem.value);
    formData.append("motivo", formServico.elements.motivo.value);
    formData.append(
      "responsavel_id",
      formServico.elements.responsavel_id.value
    );
    formData.append("status", formServico.elements.status.value);
    formData.append("prioridade", formServico.elements.prioridade.value);
    formData.append("data_prevista", formServico.elements.data_prevista.value);
    formData.append(
      "horario_inicio",
      formServico.elements.horario_inicio.value
    );
    formData.append("horario_fim", formServico.elements.horario_fim.value);

    const itensParaEnviar = itensDeServico.map((item) => {
      if (item.tipo === "avulso") {
        return {
          temp_id: item.temp_id,
          catalogo_defeito_id: item.defeito_id,
          catalogo_equipamento_id: item.equipamento_id,
          tag_equipamento_alvo: item.tag,
          descricao_item_servico: item.descricao,
        };
      } else {
        const itemServico = {
          temp_id: item.temp_id,
          inspecao_item_id: item.origem.resposta_id,
          catalogo_defeito_id: item.defeito_id || null,
          catalogo_equipamento_id: item.equipamento_id || null,
          tag_equipamento_alvo: item.tag,
          descricao_item_servico: item.descricao,
        };
        if (item.origem.especificacao_id) {
          itemServico.inspecao_especificacao_id = item.origem.especificacao_id;
        }
        return itemServico;
      }
    });
    formData.append("itens_escopo", JSON.stringify(itensParaEnviar));

    itensDeServico.forEach((item) => {
      if (item.tipo === "avulso") {
        item.anexos.forEach((file) => {
          formData.append(`item_anexo__${item.temp_id}`, file, file.name);
        });
      }
    });

    anexosGeraisFinais.forEach((file) => {
      formData.append("anexosGerais", file, file.name);
    });

    btnSalvarServico.disabled = true;
    btnSalvarServico.innerHTML = `<span class="material-symbols-outlined spin">sync</span> Salvando...`;

    try {
      const result = await fetchData("/api/servicos-subestacoes", {
        method: "POST",
        body: formData,
      });
      alert(result.message || "Serviço registrado com sucesso!");
      window.location.href = "/pagina-servicos-subestacoes";
    } catch (error) {
      alert(`Falha ao salvar o serviço: ${error.message}`);
    } finally {
      btnSalvarServico.disabled = false;
      btnSalvarServico.innerHTML = `<span class="material-symbols-outlined">save</span> Salvar Serviço`;
    }
  });

  if (btnCancelarServico) {
    btnCancelarServico.addEventListener("click", () => {
      if (confirm("Cancelar e voltar? Dados não salvos serão perdidos.")) {
        window.location.href = "/pagina-servicos-subestacoes";
      }
    });
  }

  if (btnServicoAvulso) {
    btnServicoAvulso.addEventListener("click", () => {
      ocultarModal(modalPreSelecaoServicoEl);
    });
  }

  if (btnServicoAPartirDeInspecao) {
    btnServicoAPartirDeInspecao.addEventListener("click", () => {
      ocultarModal(modalPreSelecaoServicoEl);
      mostrarModal(modalSelecionarInspecaoEl);
      carregarInspecoesParaSelecao();
    });
  }

  if (btnCancelarPreSelecao) {
    btnCancelarPreSelecao.addEventListener(
      "click",
      () => (window.location.href = "/subestacoes-dashboard")
    );
  }

  async function init() {
    await buscarCatalogos();
    await popularSelectsIniciais();

    setupAutocomplete(
      modalItemDefeitoInput,
      modalItemDefeitoIdInput,
      sugestoesDefeitosDiv,
      catalogoDefeitosCache,
      (item) => `${item.codigo} - ${item.descricao}`,
      "id"
    );

    setupAutocomplete(
      modalItemEquipamentoInput,
      modalItemEquipamentoIdInput,
      sugestoesEquipamentosDiv,
      catalogoEquipamentosCache,
      (item) => `${item.codigo} - ${item.nome}`,
      "id"
    );

    const urlParams = new URLSearchParams(window.location.search);
    const servicoIdParaEditarUrl = urlParams.get("editarId");

    if (servicoIdParaEditarUrl) {
      console.log("Modo de edição ainda não implementado.");
    } else {
      mostrarModal(modalPreSelecaoServicoEl);
    }
  }

  init();
});
