document.addEventListener("DOMContentLoaded", () => {
  const paginaTitulo = document.getElementById("paginaTitulo");
  const formServico = document.getElementById("formServico");

  const servicoSubestacaoModalSelect = document.getElementById(
    "servicoSubestacaoModal"
  );
  const servicoProcessoModalInput = document.getElementById(
    "servicoProcessoModal"
  );
  const servicoMotivoModalTextarea =
    document.getElementById("servicoMotivoModal");
  const servicoDataPrevistaModalInput = document.getElementById(
    "servicoDataPrevistaModal"
  );
  const servicoHorarioInicioModalInput = document.getElementById(
    "servicoHorarioInicioModal"
  );
  const servicoHorarioFimModalInput = document.getElementById(
    "servicoHorarioFimModal"
  );
  const servicoResponsavelModalSelect = document.getElementById(
    "servicoResponsavelModal"
  );
  const servicoStatusModalSelect =
    document.getElementById("servicoStatusModal");
  const servicoAnexosInput = document.getElementById("servicoAnexosInput");
  const listaNomesAnexosModal = document.getElementById(
    "listaNomesAnexosModal"
  );
  const anexosExistentesContainer = document.getElementById(
    "anexosExistentesContainer"
  );
  const listaAnexosExistentes = document.getElementById(
    "listaAnexosExistentes"
  );
  const conclusaoFieldset = document.getElementById("conclusaoFieldset");
  const servicoDataConclusaoModalInput = document.getElementById(
    "servicoDataConclusaoModal"
  );
  const servicoObservacoesConclusaoModalTextarea = document.getElementById(
    "servicoObservacoesConclusaoModal"
  );
  const btnSalvarServicoForm = document.getElementById("btnSalvarServicoForm");
  const btnCancelarServicoForm = document.getElementById(
    "btnCancelarServicoForm"
  );

  const inspecoesVinculadasContainer = document.getElementById(
    "inspecoesVinculadasContainer"
  );
  const listaInspecoesVinculadasComDefeitos = document.getElementById(
    "listaInspecoesVinculadasComDefeitos"
  );

  const itensServicoAvulsoContainer = document.getElementById(
    "itensServicoAvulsoContainer"
  );
  const btnAdicionarItemServicoAvulso = document.getElementById(
    "btnAdicionarItemServicoAvulso"
  );
  const listaItensServicoAvulso = document.getElementById(
    "listaItensServicoAvulso"
  );

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

  const modalSelecionarInspecaoEl = document.getElementById(
    "modalSelecionarInspecao"
  );
  const filtroInspecaoSubestacaoParaServicoSelect = document.getElementById(
    "filtroInspecaoSubestacaoParaServico"
  );
  const filtroInspecaoStatusParaServicoSelect = document.getElementById(
    "filtroInspecaoStatusParaServico"
  );
  const filtroInspecaoFormularioParaServicoInput = document.getElementById(
    "filtroInspecaoFormularioParaServico"
  );
  const btnFiltrarInspecoesParaServico = document.getElementById(
    "btnFiltrarInspecoesParaServico"
  );
  const corpoTabelaSelecaoInspecoes = document.getElementById(
    "corpoTabelaSelecaoInspecoes"
  );
  const nenhumaInspecaoParaSelecaoMsg = document.getElementById(
    "nenhumaInspecaoParaSelecaoMsg"
  );
  const selecionarTodasInspecoesCheckbox = document.getElementById(
    "selecionarTodasInspecoesCheckbox"
  );
  const btnConfirmarSelecaoInspecoes = document.getElementById(
    "btnConfirmarSelecaoInspecoes"
  );

  const modalSelecionarEquipamentoItemEl = document.getElementById(
    "modalSelecionarEquipamentoItem"
  );
  const selectEquipamentoParaItem = document.getElementById(
    "selectEquipamentoParaItem"
  );
  const btnConfirmarSelecaoEquipamentoItem = document.getElementById(
    "btnConfirmarSelecaoEquipamentoItem"
  );
  let currentItemEscopoElementParaAdicionarEquip = null;
  let currentSubestacaoIdParaSelecaoEquip = null;

  let bsModalPreSelecaoServico = null,
    bsModalSelecionarInspecao = null,
    bsModalSelecionarEquipamentoItem = null;

  if (modalPreSelecaoServicoEl)
    bsModalPreSelecaoServico = new bootstrap.Modal(modalPreSelecaoServicoEl, {
      backdrop: "static",
      keyboard: false,
    });
  if (modalSelecionarInspecaoEl)
    bsModalSelecionarInspecao = new bootstrap.Modal(modalSelecionarInspecaoEl);
  if (modalSelecionarEquipamentoItemEl)
    bsModalSelecionarEquipamentoItem = new bootstrap.Modal(
      modalSelecionarEquipamentoItemEl
    );

  let subestacoesCache = [],
    usuariosResponsaveisCache = [],
    encarregadosCache = [],
    equipamentosCache = {},
    catalogoDefeitosCache = [],
    inspecoesSelecionadasParaServicoGlobal = [];
  let currentServicoIdParaEdicao = null;
  let selectedFiles = [];

  function getIconForFileType(fileName) {
    const extension = fileName.split(".").pop().toLowerCase();
    if (
      ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"].includes(extension)
    ) {
      return "image";
    }
    if (extension === "pdf") {
      return "picture_as_pdf";
    }
    if (["doc", "docx"].includes(extension)) {
      return "article";
    }
    if (["xls", "xlsx", "csv"].includes(extension)) {
      return "assessment";
    }
    return "draft";
  }

  async function fetchData(url, options = {}) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: `Erro HTTP: ${response.status}` }));
        console.error(
          `[fetchData] Erro na resposta para ${url}: Status ${response.status}`,
          errorData
        );
        throw new Error(
          errorData.message || `Erro HTTP: ${response.status} em ${url}`
        );
      }
      return response.status === 204 ? null : await response.json();
    } catch (error) {
      console.error(`[fetchData] Exceção ao buscar dados de ${url}:`, error);
      alert(
        `Erro ao comunicar com o servidor: ${error.message}. Verifique o console para detalhes.`
      );
      throw error;
    }
  }

  function mostrarModal(bsModalInstance) {
    if (bsModalInstance) bsModalInstance.show();
  }
  function ocultarModal(bsModalInstance) {
    if (bsModalInstance) bsModalInstance.hide();
  }
  function formatarDataParaInput(dataISO) {
    return dataISO ? dataISO.split("T")[0] : "";
  }
  function formatarHoraParaInput(horaISO) {
    return typeof horaISO === "string" && horaISO.includes(":")
      ? horaISO.substring(0, 5)
      : "";
  }

  async function buscarCatalogoDefeitos() {
    if (catalogoDefeitosCache.length === 0) {
      try {
        catalogoDefeitosCache =
          (await fetchData("/api/catalogo-defeitos-servicos")) || [];
      } catch (error) {
        console.error(
          "[buscarCatalogoDefeitos] Erro ao buscar catálogo:",
          error
        );
        catalogoDefeitosCache = [];
      }
    }
    return catalogoDefeitosCache;
  }

  async function popularSelectsIniciais() {
    try {
      const [subestacoes, usuariosResp, usuariosEncarregadosInspetores] =
        await Promise.all([
          fetchData("/subestacoes"),
          fetchData("/usuarios-responsaveis-para-servicos"),
          fetchData("/usuarios-encarregados-e-inspetores"),
        ]);
      subestacoesCache = subestacoes || [];
      usuariosResponsaveisCache = usuariosResp || [];
      encarregadosCache = usuariosEncarregadosInspetores || [];

      [servicoSubestacaoModalSelect, filtroInspecaoSubestacaoParaServicoSelect]
        .filter(Boolean)
        .forEach((select) => {
          if (!select) return;
          const eFiltro = select === filtroInspecaoSubestacaoParaServicoSelect;
          select.innerHTML = eFiltro
            ? '<option value="">Todas</option>'
            : '<option value="">Selecione...</option>';
          subestacoesCache.forEach((sub) =>
            select.add(new Option(`${sub.sigla} - ${sub.nome}`, sub.Id))
          );
        });
      if (servicoResponsavelModalSelect) {
        servicoResponsavelModalSelect.innerHTML =
          '<option value="">Selecione...</option>';
        usuariosResponsaveisCache.forEach((user) =>
          servicoResponsavelModalSelect.add(new Option(user.nome, user.id))
        );
      }
    } catch (error) {
      console.error("[popularSelectsIniciais] Erro:", error);
    }
  }

  async function popularSelectEquipamentosParaItem(
    subestacaoId,
    selectElement
  ) {
    if (!selectElement) {
      console.warn(
        "[popularSelectEquipamentosParaItem] Select de equipamento para item não fornecido."
      );
      return;
    }
    selectElement.innerHTML = '<option value="">Carregando...</option>';
    selectElement.disabled = true;
    if (!subestacaoId) {
      selectElement.innerHTML =
        '<option value="">Subestação não definida para buscar equipamentos</option>';
      selectElement.disabled = false;
      return;
    }
    try {
      if (!equipamentosCache[subestacaoId]) {
        equipamentosCache[subestacaoId] = await fetchData(
          `/subestacoes/${subestacaoId}/equipamentos`
        );
      }
      const equipamentos = equipamentosCache[subestacaoId] || [];
      selectElement.innerHTML =
        '<option value="">Selecione um equipamento...</option>';
      equipamentos.forEach((eq) =>
        selectElement.add(
          new Option(
            `${eq.tag} (${eq.description || eq.model || "Equipamento"})`,
            eq.id
          )
        )
      );
    } catch (error) {
      selectElement.innerHTML =
        '<option value="">Erro ao carregar equipamentos</option>';
      console.error("[popularSelectEquipamentosParaItem] Erro:", error);
    } finally {
      if (selectElement) selectElement.disabled = false;
    }
  }

  function configurarFormularioParaServico(
    titulo = "Registrar Novo Serviço Avulso"
  ) {
    if (
      !formServico ||
      !paginaTitulo ||
      !inspecoesVinculadasContainer ||
      !listaInspecoesVinculadasComDefeitos ||
      !itensServicoAvulsoContainer ||
      !listaItensServicoAvulso ||
      !servicoStatusModalSelect ||
      !listaNomesAnexosModal ||
      !servicoAnexosInput ||
      !anexosExistentesContainer ||
      !listaAnexosExistentes
    ) {
      console.error(
        "[configurarFormularioParaServico] Elemento(s) do DOM não encontrado(s)."
      );
      return;
    }
    formServico.reset();
    selectedFiles = [];
    currentServicoIdParaEdicao = null;
    inspecoesSelecionadasParaServicoGlobal = [];
    inspecoesVinculadasContainer.classList.add("d-none");
    listaInspecoesVinculadasComDefeitos.innerHTML = "";
    itensServicoAvulsoContainer.classList.add("d-none");
    listaItensServicoAvulso.innerHTML = "";

    paginaTitulo.innerHTML = `<span class="material-symbols-outlined fs-1 me-2">playlist_add</span> ${titulo}`;
    servicoStatusModalSelect.value = "PROGRAMADO";

    listaNomesAnexosModal.innerHTML = "";
    servicoAnexosInput.value = "";
    anexosExistentesContainer.classList.add("d-none");
    listaAnexosExistentes.innerHTML = "";

    atualizarVisibilidadeConclusao();
    habilitarCamposFormulario(true);
    const campoAnexos = servicoAnexosInput.closest(".mb-2");
    if (campoAnexos) campoAnexos.style.display = "block";

    if (servicoSubestacaoModalSelect) servicoSubestacaoModalSelect.focus();
  }

  async function carregarDadosServicoParaEdicao(servicoId) {
    configurarFormularioParaServico(`Editar Serviço`);
    currentServicoIdParaEdicao = servicoId;

    if (
      !paginaTitulo ||
      !servicoProcessoModalInput ||
      !servicoMotivoModalTextarea ||
      !servicoDataPrevistaModalInput ||
      !servicoHorarioInicioModalInput ||
      !servicoHorarioFimModalInput ||
      !servicoResponsavelModalSelect ||
      !servicoStatusModalSelect ||
      !servicoSubestacaoModalSelect ||
      !servicoObservacoesConclusaoModalTextarea ||
      !servicoDataConclusaoModalInput ||
      !listaAnexosExistentes ||
      !anexosExistentesContainer ||
      !inspecoesVinculadasContainer ||
      !itensServicoAvulsoContainer
    ) {
      console.error(
        "[carregarDadosServicoParaEdicao] Elemento(s) do DOM não encontrado(s)."
      );
      return;
    }
    try {
      const servico = await fetchData(`/api/servicos-subestacoes/${servicoId}`);
      if (!servico) {
        alert("Serviço não encontrado para edição.");
        configurarFormularioParaServico();
        return;
      }

      if (paginaTitulo)
        paginaTitulo.innerHTML = `<span class="material-symbols-outlined fs-1 me-2">edit_note</span> Editar Serviço ${
          servico.processo || `#${servico.id}`
        }`;
      if (servicoProcessoModalInput)
        servicoProcessoModalInput.value = servico.processo || "";
      if (servicoMotivoModalTextarea)
        servicoMotivoModalTextarea.value = servico.motivo || "";
      if (servicoDataPrevistaModalInput)
        servicoDataPrevistaModalInput.value = formatarDataParaInput(
          servico.data_prevista
        );
      if (servicoHorarioInicioModalInput)
        servicoHorarioInicioModalInput.value = formatarHoraParaInput(
          servico.horario_inicio
        );
      if (servicoHorarioFimModalInput)
        servicoHorarioFimModalInput.value = formatarHoraParaInput(
          servico.horario_fim
        );
      if (servicoResponsavelModalSelect)
        servicoResponsavelModalSelect.value = String(servico.responsavel_id);
      if (servicoStatusModalSelect)
        servicoStatusModalSelect.value = servico.status || "PROGRAMADO";
      if (servicoSubestacaoModalSelect)
        servicoSubestacaoModalSelect.value = String(servico.subestacao_id);
      if (servicoSubestacaoModalSelect)
        servicoSubestacaoModalSelect.dispatchEvent(new Event("change"));

      if (servicoObservacoesConclusaoModalTextarea)
        servicoObservacoesConclusaoModalTextarea.value =
          servico.observacoes_conclusao || "";
      if (servicoDataConclusaoModalInput)
        servicoDataConclusaoModalInput.value = formatarDataParaInput(
          servico.data_conclusao
        );

      if (listaAnexosExistentes) listaAnexosExistentes.innerHTML = "";
      if (servico.anexos && servico.anexos.length > 0) {
        if (anexosExistentesContainer)
          anexosExistentesContainer.classList.remove("d-none");
        servico.anexos.forEach((anexo) => {
          const card = createAnexoPreviewCard({
            id: anexo.id,
            name: anexo.nome_original,
            size: anexo.tamanho,
            path: anexo.caminho_servidor,
            type: anexo.tipo_mime,
          });
          if (listaAnexosExistentes) listaAnexosExistentes.appendChild(card);
        });
      } else {
        if (anexosExistentesContainer)
          anexosExistentesContainer.classList.add("d-none");
      }

      if (
        servico.inspecoes_vinculadas &&
        servico.inspecoes_vinculadas.length > 0
      ) {
        inspecoesSelecionadasParaServicoGlobal =
          servico.inspecoes_vinculadas.map((iv) => String(iv.inspecao_id));
        if (itensServicoAvulsoContainer)
          itensServicoAvulsoContainer.classList.add("d-none");
        if (inspecoesVinculadasContainer)
          inspecoesVinculadasContainer.classList.remove("d-none");
        await preencherFormularioComBaseEmMultiplasInspecoes(
          inspecoesSelecionadasParaServicoGlobal,
          servico.itens_escopo || []
        );
      } else if (servico.itens_escopo && servico.itens_escopo.length > 0) {
        if (inspecoesVinculadasContainer)
          inspecoesVinculadasContainer.classList.add("d-none");
        if (itensServicoAvulsoContainer)
          itensServicoAvulsoContainer.classList.remove("d-none");
        renderizarItensDeServicoAvulso(servico.itens_escopo);
      } else {
        if (inspecoesVinculadasContainer)
          inspecoesVinculadasContainer.classList.add("d-none");
        if (itensServicoAvulsoContainer)
          itensServicoAvulsoContainer.classList.remove("d-none");
        if (
          listaItensServicoAvulso &&
          listaItensServicoAvulso.children.length === 0 &&
          btnAdicionarItemServicoAvulso
        )
          adicionarNovaLinhaItemServicoAvulso();
      }
      atualizarVisibilidadeConclusao();
    } catch (error) {
      console.error("[carregarDadosServicoParaEdicao] Erro:", error);
      alert("Erro ao carregar dados do serviço para edição.");
      configurarFormularioParaServico();
    }
  }

  function habilitarCamposFormulario(habilitar) {
    if (!formServico) return;
    Array.from(formServico.elements).forEach((el) => {
      if (
        el.type !== "button" &&
        el.type !== "submit" &&
        !el.classList.contains("btn-close")
      )
        el.disabled = !habilitar;
    });
    if (servicoAnexosInput) servicoAnexosInput.disabled = !habilitar;
  }

  async function confirmarExclusaoAnexo(anexoId, cardElement) {
    if (
      !anexoId ||
      !cardElement ||
      !listaAnexosExistentes ||
      !anexosExistentesContainer
    )
      return;
    if (
      confirm(
        "Excluir este anexo? A remoção será permanente ao salvar as alterações do serviço."
      )
    ) {
      cardElement.remove();
      if (listaAnexosExistentes.children.length === 0) {
        anexosExistentesContainer.classList.add("d-none");
      }
    }
  }

  function createAnexoPreviewCard(anexo, index = -1) {
    const cardDiv = document.createElement("div");
    cardDiv.className = "anexo-preview-card";

    const isNewFile = !!anexo.fileObject;
    const iconName = getIconForFileType(anexo.name || anexo.nome_original);
    let thumbnailHtml = `<span class="material-symbols-outlined">${iconName}</span>`;

    if (iconName === "image") {
      const imageUrl = isNewFile
        ? URL.createObjectURL(anexo.fileObject)
        : anexo.path;
      thumbnailHtml = `<img src="${imageUrl}" alt="Preview de ${anexo.name}" />`;
    }

    cardDiv.innerHTML = `
        <div class="anexo-thumbnail">${thumbnailHtml}</div>
        <div class="anexo-info">
            <div class="file-name" title="${anexo.name}">${anexo.name}</div>
            <div class="file-size">${(anexo.size / 1024).toFixed(1)} KB</div>
        </div>
        <button type="button" class="btn btn-danger btn-sm btn-remove-anexo" title="Remover anexo">
            <span class="material-symbols-outlined">close</span>
        </button>
    `;

    const removeButton = cardDiv.querySelector(".btn-remove-anexo");
    removeButton.addEventListener("click", () => {
      if (isNewFile) {
        selectedFiles.splice(index, 1);
        const dataTransfer = new DataTransfer();
        selectedFiles.forEach((file) => dataTransfer.items.add(file));
        servicoAnexosInput.files = dataTransfer.files;
        renderNovosAnexosPreviews();
      } else {
        confirmarExclusaoAnexo(anexo.id, cardDiv);
      }
    });

    if (iconName === "image" && !isNewFile) {
      const thumbnailAnchor = document.createElement("a");
      thumbnailAnchor.href = anexo.path;
      thumbnailAnchor.target = "_blank";
      thumbnailAnchor.innerHTML =
        cardDiv.querySelector(".anexo-thumbnail").innerHTML;
      cardDiv.querySelector(".anexo-thumbnail").innerHTML = "";
      cardDiv.querySelector(".anexo-thumbnail").appendChild(thumbnailAnchor);
    }
    return cardDiv;
  }

  function renderNovosAnexosPreviews() {
    if (!listaNomesAnexosModal) return;
    listaNomesAnexosModal.innerHTML = "";

    selectedFiles.forEach((file, index) => {
      const card = createAnexoPreviewCard(
        {
          name: file.name,
          size: file.size,
          type: file.type,
          fileObject: file,
        },
        index
      );
      listaNomesAnexosModal.appendChild(card);
    });
  }

  if (servicoAnexosInput && listaNomesAnexosModal) {
    servicoAnexosInput.addEventListener("change", () => {
      const newFiles = Array.from(servicoAnexosInput.files);
      if (selectedFiles.length + newFiles.length > 5) {
        alert("Você só pode anexar um total de 5 arquivos.");
        servicoAnexosInput.value = "";
        return;
      }
      selectedFiles.push(...newFiles);
      const dataTransfer = new DataTransfer();
      selectedFiles.forEach((file) => dataTransfer.items.add(file));
      servicoAnexosInput.files = dataTransfer.files;
      renderNovosAnexosPreviews();
    });
  }

  if (btnServicoAvulso) {
    btnServicoAvulso.addEventListener("click", () => {
      if (bsModalPreSelecaoServico) ocultarModal(bsModalPreSelecaoServico);
      configurarFormularioParaServico("Registrar Novo Serviço Avulso");
      if (inspecoesVinculadasContainer)
        inspecoesVinculadasContainer.classList.add("d-none");
      if (itensServicoAvulsoContainer)
        itensServicoAvulsoContainer.classList.remove("d-none");
      if (
        listaItensServicoAvulso &&
        listaItensServicoAvulso.children.length === 0 &&
        btnAdicionarItemServicoAvulso
      )
        adicionarNovaLinhaItemServicoAvulso();
    });
  }

  if (btnServicoAPartirDeInspecao) {
    btnServicoAPartirDeInspecao.addEventListener("click", () => {
      if (bsModalPreSelecaoServico) ocultarModal(bsModalPreSelecaoServico);
      abrirModalSelecaoInspecao();
      if (itensServicoAvulsoContainer)
        itensServicoAvulsoContainer.classList.add("d-none");
      if (inspecoesVinculadasContainer)
        inspecoesVinculadasContainer.classList.remove("d-none");
    });
  }
  if (btnCancelarPreSelecao) {
    btnCancelarPreSelecao.addEventListener(
      "click",
      () => (window.location.href = "/subestacoes-dashboard")
    );
  }

  async function abrirModalSelecaoInspecao() {
    if (
      !bsModalSelecionarInspecao ||
      !corpoTabelaSelecaoInspecoes ||
      !nenhumaInspecaoParaSelecaoMsg
    ) {
      console.warn(
        "[abrirModalSelecaoInspecao] Elementos do modal de seleção de inspeção não encontrados."
      );
      return;
    }
    if (
      filtroInspecaoSubestacaoParaServicoSelect &&
      filtroInspecaoSubestacaoParaServicoSelect.options.length <= 1
    ) {
      if (subestacoesCache.length > 0) {
        filtroInspecaoSubestacaoParaServicoSelect.innerHTML =
          '<option value="">Todas</option>';
        subestacoesCache.forEach((sub) =>
          filtroInspecaoSubestacaoParaServicoSelect.add(
            new Option(`${sub.sigla} - ${sub.nome}`, sub.Id)
          )
        );
      } else {
        await popularSelectsIniciais();
      }
    }
    corpoTabelaSelecaoInspecoes.innerHTML =
      '<tr><td colspan="7" class="text-center p-3">Carregando...</td></tr>';
    nenhumaInspecaoParaSelecaoMsg.classList.add("d-none");
    if (selecionarTodasInspecoesCheckbox)
      selecionarTodasInspecoesCheckbox.checked = false;
    mostrarModal(bsModalSelecionarInspecao);
    if (filtroInspecaoStatusParaServicoSelect)
      filtroInspecaoStatusParaServicoSelect.value = "CONCLUIDA";
    await carregarInspecoesParaSelecao();
  }

  async function carregarInspecoesParaSelecao() {
    if (!corpoTabelaSelecaoInspecoes || !nenhumaInspecaoParaSelecaoMsg) {
      console.warn(
        "[carregarInspecoesParaSelecao] Elementos da tabela de seleção não encontrados."
      );
      return;
    }
    corpoTabelaSelecaoInspecoes.innerHTML =
      '<tr><td colspan="7" class="text-center p-3">Buscando...</td></tr>';
    nenhumaInspecaoParaSelecaoMsg.classList.add("d-none");
    const params = new URLSearchParams();
    if (
      filtroInspecaoSubestacaoParaServicoSelect &&
      filtroInspecaoSubestacaoParaServicoSelect.value
    )
      params.append(
        "subestacao_id",
        filtroInspecaoSubestacaoParaServicoSelect.value
      );
    if (
      filtroInspecaoStatusParaServicoSelect &&
      filtroInspecaoStatusParaServicoSelect.value
    )
      params.append(
        "status_inspecao",
        filtroInspecaoStatusParaServicoSelect.value
      );
    if (
      filtroInspecaoFormularioParaServicoInput &&
      filtroInspecaoFormularioParaServicoInput.value
    )
      params.append(
        "formulario_inspecao_num_like",
        filtroInspecaoFormularioParaServicoInput.value
      );
    try {
      const inspecoes = await fetchData(
        `/inspecoes-subestacoes?${params.toString()}`
      );
      popularTabelaSelecaoInspecoes(inspecoes);
    } catch (error) {
      if (corpoTabelaSelecaoInspecoes)
        corpoTabelaSelecaoInspecoes.innerHTML =
          '<tr><td colspan="7" class="text-center text-danger p-3">Erro ao carregar inspeções.</td></tr>';
      console.error("[carregarInspecoesParaSelecao] Erro:", error);
    }
  }

  function popularTabelaSelecaoInspecoes(inspecoes) {
    if (!corpoTabelaSelecaoInspecoes || !nenhumaInspecaoParaSelecaoMsg) {
      console.warn(
        "[popularTabelaSelecaoInspecoes] Elementos da tabela de seleção não encontrados."
      );
      return;
    }
    corpoTabelaSelecaoInspecoes.innerHTML = "";
    if (!inspecoes || inspecoes.length === 0) {
      nenhumaInspecaoParaSelecaoMsg.classList.remove("d-none");
      return;
    }
    nenhumaInspecaoParaSelecaoMsg.classList.add("d-none");
    inspecoes.forEach(async (insp) => {
      const tr = document.createElement("tr");
      const dataFmt = insp.data_avaliacao
        ? new Date(insp.data_avaliacao + "T00:00:00Z").toLocaleDateString(
            "pt-BR",
            { timeZone: "UTC" }
          )
        : "-";
      const stTxt = (insp.status_inspecao || "N/A").replace("_", " ");
      const stCls = (insp.status_inspecao || "desconhecido")
        .toLowerCase()
        .replace(/_/g, "");
      const isChecked = inspecoesSelecionadasParaServicoGlobal.includes(
        String(insp.id)
      );
      tr.innerHTML = `<td class="text-center"><input type="checkbox" class="form-check-input sel-insp-cb" data-inspecao-id="${
        insp.id
      }" ${isChecked ? "checked" : ""}></td><td class="text-center">${
        insp.formulario_inspecao_num || insp.id
      }</td><td>${
        insp.subestacao_sigla || "-"
      }</td><td class="text-center">${dataFmt}</td><td>${
        insp.responsavel_nome || "-"
      }</td><td class="text-center"><span class="status-badge status-${stCls}">${stTxt}</span></td><td class="text-center items-anormais-count">...</td>`;
      corpoTabelaSelecaoInspecoes.appendChild(tr);
      const countCell = tr.querySelector(".items-anormais-count");
      try {
        const detInsp = await fetchData(`/inspecoes-subestacoes/${insp.id}`);
        let countAn = 0;
        if (detInsp && detInsp.gruposDeItens)
          Object.values(detInsp.gruposDeItens).forEach((g) => {
            if (Array.isArray(g))
              g.forEach((i) => {
                if (i.avaliacao === "A") countAn++;
              });
          });
        if (countCell) countCell.textContent = countAn;
        if (countAn > 0 && countCell)
          countCell.classList.add("text-danger", "fw-bold");
      } catch {
        if (countCell) {
          countCell.textContent = "?";
          countCell.title = "Erro ao obter contagem.";
        }
      }
    });
  }

  if (selecionarTodasInspecoesCheckbox) {
    selecionarTodasInspecoesCheckbox.addEventListener("change", (e) => {
      if (corpoTabelaSelecaoInspecoes)
        corpoTabelaSelecaoInspecoes
          .querySelectorAll(".sel-insp-cb")
          .forEach((cb) => (cb.checked = e.target.checked));
    });
  }
  if (btnConfirmarSelecaoInspecoes) {
    btnConfirmarSelecaoInspecoes.addEventListener("click", async () => {
      if (corpoTabelaSelecaoInspecoes) {
        inspecoesSelecionadasParaServicoGlobal = Array.from(
          corpoTabelaSelecaoInspecoes.querySelectorAll(".sel-insp-cb:checked")
        ).map((cb) => cb.dataset.inspecaoId);
      } else {
        inspecoesSelecionadasParaServicoGlobal = [];
      }

      if (
        inspecoesSelecionadasParaServicoGlobal.length === 0 &&
        !currentServicoIdParaEdicao
      ) {
        alert(
          "Selecione ao menos uma inspeção ou cancele para criar um serviço avulso."
        );
        return;
      }
      if (bsModalSelecionarInspecao) ocultarModal(bsModalSelecionarInspecao);
      await preencherFormularioComBaseEmMultiplasInspecoes(
        inspecoesSelecionadasParaServicoGlobal,
        currentServicoIdParaEdicao ? [] : []
      );
    });
  }

  async function preencherFormularioComBaseEmMultiplasInspecoes(
    listaIds,
    itensEscopoExistentes = []
  ) {
    if (
      !inspecoesVinculadasContainer ||
      !listaInspecoesVinculadasComDefeitos ||
      !paginaTitulo ||
      !servicoSubestacaoModalSelect ||
      !servicoMotivoModalTextarea ||
      !servicoDataPrevistaModalInput ||
      !servicoProcessoModalInput
    ) {
      console.error(
        "[preencherFormularioComBaseEmMultiplasInspecoes] Elemento(s) DOM não encontrado(s) para preenchimento."
      );
      return;
    }
    const tituloBase =
      currentServicoIdParaEdicao && servicoProcessoModalInput.value
        ? `Editar Serviço ${servicoProcessoModalInput.value}`
        : currentServicoIdParaEdicao
        ? `Editar Serviço #${currentServicoIdParaEdicao}`
        : "Registrar Novo Serviço";
    if (paginaTitulo)
      paginaTitulo.innerHTML = `<span class="material-symbols-outlined fs-1 me-2">playlist_add_check</span> ${tituloBase} a partir de Inspeção(ões)`;

    let primSubId =
      currentServicoIdParaEdicao && servicoSubestacaoModalSelect.value
        ? servicoSubestacaoModalSelect.value
        : null;
    let motConcat =
      currentServicoIdParaEdicao && servicoMotivoModalTextarea.value
        ? servicoMotivoModalTextarea.value
        : "Serviço gerado a partir da(s) inspeção(ões):\n";
    if (
      currentServicoIdParaEdicao &&
      servicoMotivoModalTextarea.value &&
      listaIds.length > 0 &&
      !servicoMotivoModalTextarea.value.includes(
        "Inspeções Vinculadas Adicionalmente"
      )
    ) {
      motConcat += "\n\nInspeções Vinculadas Adicionalmente/Revisadas:\n";
    }

    let dataMaisRec =
      currentServicoIdParaEdicao && servicoDataPrevistaModalInput.value
        ? new Date(servicoDataPrevistaModalInput.value + "T00:00:00Z")
        : null;

    const promDetInsps = listaIds.map((id) =>
      fetchData(`/inspecoes-subestacoes/${id}`)
    );
    const detInsps = await Promise.all(promDetInsps);

    listaInspecoesVinculadasComDefeitos.innerHTML = "";
    inspecoesVinculadasContainer.classList.remove("d-none");
    await buscarCatalogoDefeitos();

    for (const insp of detInsps) {
      if (!insp) continue;
      if (!primSubId && !servicoSubestacaoModalSelect.value)
        primSubId = insp.subestacao_id;

      const infoInsp = `- Insp. #${
        insp.formulario_inspecao_num || insp.id
      } (Sub: ${insp.subestacao_sigla}, Data: ${
        insp.data_avaliacao_fmt || formatarDataParaInput(insp.data_avaliacao)
      })\n`;
      if (!motConcat.includes(infoInsp)) {
        motConcat += infoInsp;
        if (insp.observacoes_gerais)
          motConcat += `  Obs. Gerais da Insp.: ${insp.observacoes_gerais}\n`;
      }
      const dataAtual = new Date(insp.data_avaliacao + "T00:00:00Z");
      if (!isNaN(dataAtual.getTime())) {
        if (!dataMaisRec || dataAtual > dataMaisRec) dataMaisRec = dataAtual;
      }
      await renderizarItensAnormaisParaInspecao(
        insp,
        listaInspecoesVinculadasComDefeitos,
        itensEscopoExistentes
      );
    }
    if (
      servicoSubestacaoModalSelect &&
      primSubId &&
      !servicoSubestacaoModalSelect.value
    ) {
      servicoSubestacaoModalSelect.value = String(primSubId);
      servicoSubestacaoModalSelect.dispatchEvent(
        new Event("change", { bubbles: true })
      );
    }
    if (servicoMotivoModalTextarea)
      servicoMotivoModalTextarea.value = motConcat.trim();
    if (
      servicoDataPrevistaModalInput &&
      dataMaisRec &&
      !isNaN(dataMaisRec.getTime()) &&
      !servicoDataPrevistaModalInput.value
    )
      servicoDataPrevistaModalInput.value = dataMaisRec
        .toISOString()
        .split("T")[0];
    if (servicoProcessoModalInput && !currentServicoIdParaEdicao)
      servicoProcessoModalInput.focus();
  }

  async function renderizarItensAnormaisParaInspecao(
    insp,
    containerPai,
    itensEscopoExistentes = []
  ) {
    if (!insp?.gruposDeItens || !containerPai) return;
    const divInsp = document.createElement("div");
    divInsp.className =
      "inspecao-detalhes-bloco mb-3 p-3 border rounded shadow-sm";
    divInsp.innerHTML = `<h6 class="mb-2 small text-primary fw-bold">Inspeção #${
      insp.formulario_inspecao_num || insp.id
    } (${insp.subestacao_sigla})</h6>`;
    let algumAnormal = false;

    Object.values(insp.gruposDeItens).forEach((g) => {
      if (!Array.isArray(g)) return;
      g.forEach((item) => {
        if (item.avaliacao === "A") {
          algumAnormal = true;
          const itemEscopoExistente = itensEscopoExistentes.find(
            (ie) =>
              ie.inspecao_item_id === item.id &&
              ie.origem_inspecao_id === insp.id
          );
          const itemDiv = document.createElement("div");
          itemDiv.className =
            "item-anormal-servico mb-3 p-2 bg-light rounded border";
          itemDiv.dataset.inspecaoItemId = item.id;
          itemDiv.dataset.inspecaoIdOrigem = insp.id;
          itemDiv.dataset.subestacaoIdOrigemInspecao = insp.subestacao_id;

          let fotosHtml =
            '<small class="d-block text-muted fst-italic">Sem fotos.</small>';
          if (item.anexos?.length) {
            fotosHtml =
              '<div class="d-flex flex-wrap gap-1 mt-1 item-anormal-fotos">';
            item.anexos.forEach(
              (anx) =>
                (fotosHtml += `<a href="${anx.caminho}" target="_blank"><img src="${anx.caminho}" alt="Evidência" style="width:50px;height:50px;object-fit:cover;border:1px solid #ddd; border-radius:3px;"></a>`)
            );
            fotosHtml += "</div>";
          }

          let equipamentosAssociadosHtml = `<div class="mt-2"><small>Equipamentos associados:</small><ul class="list-unstyled list-inline lista-equipamentos-item-escopo" data-inspecao-item-id="${item.id}">`;
          const equipamentosDesteItem =
            itemEscopoExistente?.equipamentos_associados || [];
          equipamentosDesteItem.forEach((eq) => {
            equipamentosAssociadosHtml += `<li class="list-inline-item badge bg-secondary me-1 mb-1">${
              eq.tag || `ID ${eq.equipamento_id}`
            }<button type="button" class="btn-close btn-close-white btn-sm ms-1 btn-remover-equip-item" data-equip-id="${
              eq.equipamento_id
            }"></button></li>`;
          });
          if (equipamentosDesteItem.length === 0)
            equipamentosAssociadosHtml +=
              '<li class="list-inline-item"><small class="text-muted fst-italic">Nenhum</small></li>';
          equipamentosAssociadosHtml += `</ul></div>`;

          itemDiv.innerHTML = `
                    <p class="mb-1 small"><strong>Item ${item.num}:</strong> ${
            item.desc
          }</p>
                    ${
                      item.obs
                        ? `<p class="mb-1 small text-danger"><em>Obs. Inspeção: ${item.obs}</em></p>`
                        : ""
                    }
                    ${fotosHtml}
                    <div class="row gx-2 mt-2">
                        <div class="col-md-8"> 
                            <label for="cat-def-sel-insp-${
                              item.id
                            }" class="form-label form-label-sm">Código de Defeito:*</label>
                            <select id="cat-def-sel-insp-${
                              item.id
                            }" name="catalogo_defeito_id_item_${
            item.id
          }" class="form-select form-select-sm cat-def-sel" required>
                                <option value="">Selecione...</option>
                                ${catalogoDefeitosCache
                                  .map(
                                    (def) =>
                                      `<option value="${def.id}" ${
                                        itemEscopoExistente &&
                                        itemEscopoExistente.catalogo_defeito_id ==
                                          def.id
                                          ? "selected"
                                          : ""
                                      }>${
                                        def.codigo
                                      } - ${def.descricao.substring(
                                        0,
                                        60
                                      )}...</option>`
                                  )
                                  .join("")}
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label for="status-item-insp-${
                              item.id
                            }" class="form-label form-label-sm">Status Item:</label>
                            <input type="text" id="status-item-insp-${
                              item.id
                            }" name="status_item_escopo_${
            item.id
          }" class="form-control form-control-sm" value="${
            itemEscopoExistente?.status_item_escopo || "PENDENTE"
          }" readonly title="Status inicial do item. Encarregado e status são gerenciados após registro.">
                        </div>
                    </div>
                    <div class="row gx-2 mt-2">
                         <div class="col-12">
                            <label for="obs-serv-item-${
                              item.id
                            }" class="form-label form-label-sm">Obs. Específica do Serviço (para este item):</label>
                            <input type="text" id="obs-serv-item-${
                              item.id
                            }" name="obs_serv_item_${
            item.id
          }" class="form-control form-control-sm obs-serv-item" placeholder="Opcional" value="${
            itemEscopoExistente?.observacao_especifica_servico || ""
          }">
                        </div>
                    </div>
                    <div class="row gx-2 mt-2">
                        <div class="col-12">
                            ${equipamentosAssociadosHtml}
                            <button type="button" class="btn btn-outline-primary btn-sm mt-1 btn-adicionar-equip-item" data-item-type="inspecao" data-item-id-ref="${
                              item.id
                            }" data-subestacao-id-origem="${
            insp.subestacao_id
          }">
                                <span class="material-symbols-outlined small-icon">add</span> Associar Equipamento
                            </button>
                        </div>
                    </div>`;
          if (divInsp) divInsp.appendChild(itemDiv);
        }
      });
    });
    if (algumAnormal && containerPai) {
      containerPai.appendChild(divInsp);
      divInsp
        .querySelectorAll(".btn-adicionar-equip-item")
        .forEach((btn) =>
          btn.addEventListener("click", handleAbrirModalAdicionarEquipamento)
        );
      divInsp
        .querySelectorAll(".btn-remover-equip-item")
        .forEach((btn) =>
          btn.addEventListener("click", handleRemoverEquipamentoDeItem)
        );
    } else if (containerPai) {
      divInsp.innerHTML +=
        '<p class="small text-muted fst-italic">Nenhum item anormal identificado nesta inspeção.</p>';
      containerPai.appendChild(divInsp);
    }
  }

  function renderizarItensDeServicoAvulso(itensAvulsos = []) {
    if (!listaItensServicoAvulso || !itensServicoAvulsoContainer) {
      console.warn(
        "[renderizarItensDeServicoAvulso] Elementos DOM para itens avulsos não encontrados."
      );
      return;
    }
    listaItensServicoAvulso.innerHTML = "";
    itensServicoAvulsoContainer.classList.remove("d-none");

    if (itensAvulsos.length === 0 && !currentServicoIdParaEdicao) {
      adicionarNovaLinhaItemServicoAvulso();
    } else {
      itensAvulsos.forEach((itemData) =>
        adicionarNovaLinhaItemServicoAvulso(itemData)
      );
    }

    if (
      listaItensServicoAvulso.children.length === 0 &&
      itensServicoAvulsoContainer.classList.contains("d-none") === false &&
      btnAdicionarItemServicoAvulso
    ) {
      adicionarNovaLinhaItemServicoAvulso();
    }
  }

  let itemAvulsoCounter = 0;
  function adicionarNovaLinhaItemServicoAvulso(itemData = null) {
    if (
      !listaItensServicoAvulso ||
      !catalogoDefeitosCache ||
      !servicoSubestacaoModalSelect
    ) {
      console.warn(
        "[adicionarNovaLinhaItemServicoAvulso] Elementos DOM ou caches necessários não encontrados."
      );
      return;
    }
    itemAvulsoCounter++;
    const itemId = `avulso_${itemAvulsoCounter}`;
    const subestacaoIdAtual = servicoSubestacaoModalSelect.value;

    const itemDiv = document.createElement("div");
    itemDiv.className =
      "item-servico-avulso mb-3 p-3 border rounded shadow-sm bg-light";
    itemDiv.dataset.itemAvulsoId = itemId;
    itemDiv.dataset.subestacaoIdOrigem = subestacaoIdAtual;

    let equipamentosAssociadosHtml = `<div class="mt-2"><small>Equipamentos associados:</small><ul class="list-unstyled list-inline lista-equipamentos-item-escopo" data-item-avulso-id="${itemId}">`;
    const equipamentosDoItem = itemData?.equipamentos_associados || [];
    equipamentosDoItem.forEach((eq) => {
      equipamentosAssociadosHtml += `<li class="list-inline-item badge bg-secondary me-1 mb-1">${
        eq.tag || `ID ${eq.equipamento_id}`
      }<button type="button" class="btn-close btn-close-white btn-sm ms-1 btn-remover-equip-item" data-equip-id="${
        eq.equipamento_id
      }"></button></li>`;
    });
    if (equipamentosDoItem.length === 0)
      equipamentosAssociadosHtml +=
        '<li class="list-inline-item"><small class="text-muted fst-italic">Nenhum</small></li>';
    equipamentosAssociadosHtml += `</ul></div>`;

    itemDiv.innerHTML = `
        <div class="row gx-2">
            <div class="col-md-5">
                <label for="cat-def-sel-${itemId}" class="form-label form-label-sm">Código de Defeito (Catálogo):</label>
                <select id="cat-def-sel-${itemId}" name="catalogo_defeito_id_${itemId}" class="form-select form-select-sm cat-def-sel">
                    <option value="">Selecione ou descreva manualmente...</option>
                    ${catalogoDefeitosCache
                      .map(
                        (def) =>
                          `<option value="${def.id}" ${
                            itemData && itemData.catalogo_defeito_id == def.id
                              ? "selected"
                              : ""
                          }>${def.codigo} - ${def.descricao.substring(
                            0,
                            50
                          )}...</option>`
                      )
                      .join("")}
                </select>
            </div>
            <div class="col-md-7">
                <label for="desc-manual-${itemId}" class="form-label form-label-sm">Descrição Detalhada do Item:*</label>
                <textarea id="desc-manual-${itemId}" name="descricao_manual_item_${itemId}" class="form-control form-control-sm desc-manual-item" rows="2" placeholder="Descreva o defeito ou tarefa" required>${
      itemData?.descricao_item_servico || ""
    }</textarea>
            </div>
        </div>
        <div class="row gx-2 mt-2">
             <div class="col-md-9">
                <label for="obs-serv-item-${itemId}" class="form-label form-label-sm">Observação Específica do Item:</label>
                <input type="text" id="obs-serv-item-${itemId}" name="obs_serv_item_${itemId}" class="form-control form-control-sm obs-serv-item" placeholder="Opcional" value="${
      itemData?.observacao_especifica_servico || ""
    }">
            </div>
            <div class="col-md-3">
                <label for="status-item-avulso-${itemId}" class="form-label form-label-sm">Status Item:</label>
                <input type="text" id="status-item-avulso-${itemId}" name="status_item_escopo_${itemId}" class="form-control form-control-sm" value="PENDENTE" readonly title="Status inicial. Encarregado e status são gerenciados após registro.">
            </div>
        </div>
        <div class="row gx-2 mt-2">
            <div class="col-12">
                ${equipamentosAssociadosHtml}
                <button type="button" class="btn btn-outline-primary btn-sm mt-1 btn-adicionar-equip-item" data-item-type="avulso" data-item-id-ref="${itemId}" data-subestacao-id-origem="${subestacaoIdAtual}">
                     <span class="material-symbols-outlined small-icon">add</span> Associar Equipamento
                </button>
            </div>
        </div>
        <div class="text-end mt-2">
            <button type="button" class="btn btn-outline-danger btn-sm btn-remover-item-avulso" title="Remover este item de serviço">
                <span class="material-symbols-outlined small-icon">delete</span> Remover Item
            </button>
        </div>
    `;
    if (listaItensServicoAvulso) listaItensServicoAvulso.appendChild(itemDiv);
    const btnAddEquip = itemDiv.querySelector(".btn-adicionar-equip-item");
    if (btnAddEquip)
      btnAddEquip.addEventListener(
        "click",
        handleAbrirModalAdicionarEquipamento
      );

    const btnRemItem = itemDiv.querySelector(".btn-remover-item-avulso");
    if (btnRemItem)
      btnRemItem.addEventListener("click", () => {
        itemDiv.remove();
        if (
          listaItensServicoAvulso &&
          listaItensServicoAvulso.children.length === 0 &&
          btnAdicionarItemServicoAvulso
        )
          adicionarNovaLinhaItemServicoAvulso();
      });

    itemDiv
      .querySelectorAll(".btn-remover-equip-item")
      .forEach((btn) =>
        btn.addEventListener("click", handleRemoverEquipamentoDeItem)
      );
  }

  function handleAbrirModalAdicionarEquipamento(event) {
    currentItemEscopoElementParaAdicionarEquip = event.target.closest(
      ".item-anormal-servico, .item-servico-avulso"
    );
    if (!currentItemEscopoElementParaAdicionarEquip) {
      console.error(
        "Elemento pai do item de escopo não encontrado ao tentar adicionar equipamento."
      );
      return;
    }
    currentSubestacaoIdParaSelecaoEquip =
      currentItemEscopoElementParaAdicionarEquip.dataset.subestacaoIdOrigem;

    if (
      !currentSubestacaoIdParaSelecaoEquip &&
      servicoSubestacaoModalSelect &&
      servicoSubestacaoModalSelect.value
    ) {
      currentSubestacaoIdParaSelecaoEquip = servicoSubestacaoModalSelect.value;
    }

    if (!currentSubestacaoIdParaSelecaoEquip) {
      alert(
        "Selecione primeiro uma subestação para o serviço para poder associar equipamentos."
      );
      return;
    }
    if (bsModalSelecionarEquipamentoItem && selectEquipamentoParaItem) {
      popularSelectEquipamentosParaItem(
        currentSubestacaoIdParaSelecaoEquip,
        selectEquipamentoParaItem
      );
      mostrarModal(bsModalSelecionarEquipamentoItem);
    } else {
      console.error("Modal ou select de equipamento para item não encontrado.");
    }
  }

  function handleAdicionarEquipamentoAoItem() {
    if (
      !currentItemEscopoElementParaAdicionarEquip ||
      !selectEquipamentoParaItem ||
      !selectEquipamentoParaItem.value
    ) {
      alert("Selecione um equipamento.");
      return;
    }
    const equipamentoId = selectEquipamentoParaItem.value;
    const equipamentoTexto =
      selectEquipamentoParaItem.options[selectEquipamentoParaItem.selectedIndex]
        .text;
    const listaEquipContainer =
      currentItemEscopoElementParaAdicionarEquip.querySelector(
        ".lista-equipamentos-item-escopo"
      );

    if (!listaEquipContainer) {
      console.error(
        "Container de lista de equipamentos não encontrado para o item."
      );
      return;
    }

    const msgNenhum = listaEquipContainer.querySelector("li small.text-muted");
    if (
      msgNenhum &&
      msgNenhum.parentElement &&
      msgNenhum.parentElement.textContent.includes("Nenhum")
    ) {
      msgNenhum.parentElement.remove();
    }

    if (
      listaEquipContainer.querySelector(
        `li button[data-equip-id="${equipamentoId}"]`
      )
    ) {
      alert("Este equipamento já foi adicionado a este item.");
      return;
    }

    const li = document.createElement("li");
    li.className = "list-inline-item badge bg-secondary me-1 mb-1";
    li.innerHTML = `${equipamentoTexto}<button type="button" class="btn-close btn-close-white btn-sm ms-1 btn-remover-equip-item" data-equip-id="${equipamentoId}"></button>`;
    const btnRemEquip = li.querySelector(".btn-remover-equip-item");
    if (btnRemEquip)
      btnRemEquip.addEventListener("click", handleRemoverEquipamentoDeItem);
    listaEquipContainer.appendChild(li);

    if (bsModalSelecionarEquipamentoItem)
      ocultarModal(bsModalSelecionarEquipamentoItem);
  }
  if (btnConfirmarSelecaoEquipamentoItem)
    btnConfirmarSelecaoEquipamentoItem.addEventListener(
      "click",
      handleAdicionarEquipamentoAoItem
    );

  function handleRemoverEquipamentoDeItem(event) {
    const liToRemove = event.target.closest("li");
    const ulParent = liToRemove.parentElement;
    liToRemove.remove();
    if (ulParent && ulParent.children.length === 0) {
      ulParent.innerHTML =
        '<li class="list-inline-item"><small class="text-muted fst-italic">Nenhum</small></li>';
    }
  }
  if (btnFiltrarInspecoesParaServico)
    btnFiltrarInspecoesParaServico.addEventListener(
      "click",
      carregarInspecoesParaSelecao
    );
  if (servicoSubestacaoModalSelect)
    servicoSubestacaoModalSelect.addEventListener("change", () => {});
  if (servicoStatusModalSelect)
    servicoStatusModalSelect.addEventListener(
      "change",
      atualizarVisibilidadeConclusao
    );
  function atualizarVisibilidadeConclusao() {
    if (!conclusaoFieldset || !servicoStatusModalSelect) return;
    if (servicoStatusModalSelect.value === "CONCLUIDO") {
      conclusaoFieldset.classList.remove("d-none");
    } else {
      conclusaoFieldset.classList.add("d-none");
    }
  }

  if (btnAdicionarItemServicoAvulso)
    btnAdicionarItemServicoAvulso.addEventListener("click", () =>
      adicionarNovaLinhaItemServicoAvulso()
    );
  if (formServico && btnSalvarServicoForm)
    btnSalvarServicoForm.addEventListener("click", () => {
      if (formServico) formServico.requestSubmit();
    });

  if (formServico)
    formServico.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(formServico);
      const servId = currentServicoIdParaEdicao;
      if (
        !formData.get("subestacao_id") ||
        !formData.get("processo") ||
        !formData.get("motivo") ||
        !formData.get("data_prevista") ||
        !formData.get("horario_inicio") ||
        !formData.get("horario_fim") ||
        !formData.get("responsavel_id")
      ) {
        alert("Preencha os campos obrigatórios (*).");
        return;
      }
      if (
        formData.get("status") === "CONCLUIDO" &&
        !formData.get("data_conclusao") &&
        servicoDataConclusaoModalInput
      ) {
        alert("Data de conclusão é obrigatória se o status for CONCLUÍDO.");
        if (servicoDataConclusaoModalInput)
          servicoDataConclusaoModalInput.focus();
        return;
      }

      let validacaoItensOk = true;
      const itensEscopoParaEnviar = [];

      if (
        inspecoesSelecionadasParaServicoGlobal.length > 0 &&
        listaInspecoesVinculadasComDefeitos
      ) {
        formData.append(
          "inspecao_ids_vinculadas",
          JSON.stringify(inspecoesSelecionadasParaServicoGlobal)
        );
        listaInspecoesVinculadasComDefeitos
          .querySelectorAll(".item-anormal-servico")
          .forEach((itemEl) => {
            if (!validacaoItensOk) return;
            const inspItemId = itemEl.dataset.inspecaoItemId;
            const catDefSelect = itemEl.querySelector(".cat-def-sel");
            const catDefId = catDefSelect ? catDefSelect.value : null;
            const obsServInput = itemEl.querySelector(".obs-serv-item");
            const obsServ = obsServInput ? obsServInput.value : null;
            const descOriginalInspecao =
              itemEl
                .querySelector("p.small strong")
                ?.parentElement.textContent.replace(/^Item \d+:\s*/, "")
                .trim() || "Item de inspeção";
            const statusItemInput = itemEl.querySelector(
              'input[name^="status_item_escopo_"]'
            );
            const statusItem = statusItemInput
              ? statusItemInput.value
              : "PENDENTE";

            let equipamentosAssociadosIds = [];
            itemEl
              .querySelectorAll(
                ".lista-equipamentos-item-escopo li button.btn-remover-equip-item"
              )
              .forEach((btn) => {
                if (btn.dataset.equipId)
                  equipamentosAssociadosIds.push(parseInt(btn.dataset.equipId));
              });

            if (inspItemId && !catDefId) {
              alert(
                `Um código de defeito deve ser selecionado para o item anormal de inspeção: "${descOriginalInspecao.substring(
                  0,
                  50
                )}...".`
              );
              if (catDefSelect) catDefSelect.focus();
              validacaoItensOk = false;
              return;
            } else if (inspItemId && catDefId) {
              itensEscopoParaEnviar.push({
                inspecao_item_id: parseInt(inspItemId),
                catalogo_defeito_id: parseInt(catDefId),
                descricao_item_servico: descOriginalInspecao,
                observacao_especifica_servico: obsServ || null,
                encarregado_item_id: null,
                status_item_escopo: statusItem,
                equipamentos_associados: equipamentosAssociadosIds,
              });
            }
          });
      }
      if (!validacaoItensOk) return;

      if (listaItensServicoAvulso) {
        listaItensServicoAvulso
          .querySelectorAll(".item-servico-avulso")
          .forEach((itemEl) => {
            if (!validacaoItensOk) return;
            const catDefSelect = itemEl.querySelector(".cat-def-sel");
            const catDefId = catDefSelect ? catDefSelect.value : null;
            const descManualInput = itemEl.querySelector(".desc-manual-item");
            const descManual = descManualInput
              ? descManualInput.value.trim()
              : "";
            const obsServInput = itemEl.querySelector(".obs-serv-item");
            const obsServ = obsServInput ? obsServInput.value : null;
            const statusItemInput = itemEl.querySelector(
              'input[name^="status_item_escopo_"]'
            );
            const statusItem = statusItemInput
              ? statusItemInput.value
              : "PENDENTE";

            let equipamentosAssociadosIds = [];
            itemEl
              .querySelectorAll(
                ".lista-equipamentos-item-escopo li button.btn-remover-equip-item"
              )
              .forEach((btn) => {
                if (btn.dataset.equipId)
                  equipamentosAssociadosIds.push(parseInt(btn.dataset.equipId));
              });

            if (!descManual && !catDefId) {
              if (
                listaItensServicoAvulso.children.length === 1 &&
                descManual === "" &&
                !catDefId
              ) {
              } else {
                alert(
                  "Para itens de serviço avulsos, forneça uma descrição detalhada ou selecione um código de defeito."
                );
                if (descManualInput) descManualInput.focus();
                else if (catDefSelect) catDefSelect.focus();
                validacaoItensOk = false;
                return;
              }
            }
            if (descManual || catDefId) {
              itensEscopoParaEnviar.push({
                inspecao_item_id: null,
                catalogo_defeito_id: catDefId ? parseInt(catDefId) : null,
                descricao_item_servico: descManual,
                observacao_especifica_servico: obsServ || null,
                encarregado_item_id: null,
                status_item_escopo: statusItem,
                equipamentos_associados: equipamentosAssociadosIds,
              });
            }
          });
      }
      if (!validacaoItensOk) return;

      if (
        inspecoesSelecionadasParaServicoGlobal.length === 0 &&
        itensEscopoParaEnviar.length === 0 &&
        !currentServicoIdParaEdicao
      ) {
        const motivoGeral = formData.get("motivo")?.trim();
        if (!motivoGeral || motivoGeral.length < 10) {
          alert(
            "Nenhum item de escopo foi definido para este novo serviço e o motivo geral é muito breve. Adicione itens de uma inspeção, itens avulsos, ou detalhe melhor o motivo geral do serviço."
          );
          return;
        }
      }
      if (itensEscopoParaEnviar.length > 0)
        formData.append("itens_escopo", JSON.stringify(itensEscopoParaEnviar));
      else if (
        inspecoesSelecionadasParaServicoGlobal.length > 0 &&
        itensEscopoParaEnviar.length === 0
      ) {
      }

      const submitBtn = btnSalvarServicoForm;
      const origBtnHtml = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm"></span> Salvando...';
      const url = servId
        ? `/api/servicos-subestacoes/${servId}`
        : "/api/servicos-subestacoes";
      const method = servId ? "PUT" : "POST";

      if (formData.get("status") !== "CONCLUIDO") {
        formData.delete("data_conclusao");
        formData.delete("observacoes_conclusao");
      }

      try {
        const resp = await fetch(url, { method: method, body: formData });
        if (!resp.ok) {
          const errD = await resp
            .json()
            .catch(() => ({ message: "Erro ao salvar serviço." }));
          throw new Error(errD.message || `Erro HTTP: ${resp.status}`);
        }
        const res = await resp.json();
        alert(
          res.message ||
            `Serviço ${servId ? "atualizado" : "registrado"} com sucesso!`
        );
        window.location.href = "/subestacoes-dashboard";
      } catch (err) {
        console.error("Erro ao salvar serviço:", err);
        alert(`Falha ao salvar serviço: ${err.message}`);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnHtml;
      }
    });

  if (btnCancelarServicoForm) {
    btnCancelarServicoForm.addEventListener("click", () => {
      if (
        confirm(
          "Cancelar e voltar para o dashboard de subestações? Dados não salvos serão perdidos."
        )
      ) {
        window.location.href = "/subestacoes-dashboard";
      }
    });
  }

  async function init() {
    await popularSelectsIniciais();
    await buscarCatalogoDefeitos();

    const urlParams = new URLSearchParams(window.location.search);
    const servicoIdParaEditarUrl = urlParams.get("editarId");

    if (servicoIdParaEditarUrl) {
      if (itensServicoAvulsoContainer)
        itensServicoAvulsoContainer.classList.add("d-none");
      if (inspecoesVinculadasContainer)
        inspecoesVinculadasContainer.classList.add("d-none");
      await carregarDadosServicoParaEdicao(servicoIdParaEditarUrl);
    } else {
      if (bsModalPreSelecaoServico) mostrarModal(bsModalPreSelecaoServico);
      else {
        configurarFormularioParaServico();
        if (inspecoesVinculadasContainer)
          inspecoesVinculadasContainer.classList.add("d-none");
        if (itensServicoAvulsoContainer && btnAdicionarItemServicoAvulso) {
          itensServicoAvulsoContainer.classList.remove("d-none");
          if (
            listaItensServicoAvulso &&
            listaItensServicoAvulso.children.length === 0
          ) {
            adicionarNovaLinhaItemServicoAvulso();
          }
        }
      }
    }
  }
  init();
});
