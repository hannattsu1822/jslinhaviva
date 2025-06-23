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
  const servicoAlimentadorModalInput = document.getElementById(
    "servicoAlimentadorModal"
  );
  const servicoEquipamentoModalSelect = document.getElementById(
    "servicoEquipamentoModal"
  );
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
  const servicoEncarregadoDesignadoModalSelect = document.getElementById(
    "servicoEncarregadoDesignadoModal"
  );
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

  let bsModalPreSelecaoServico = null,
    bsModalSelecionarInspecao = null;

  if (modalPreSelecaoServicoEl)
    bsModalPreSelecaoServico = new bootstrap.Modal(modalPreSelecaoServicoEl, {
      backdrop: "static",
      keyboard: false,
    });
  if (modalSelecionarInspecaoEl)
    bsModalSelecionarInspecao = new bootstrap.Modal(modalSelecionarInspecaoEl);

  let subestacoesCache = [],
    usuariosResponsaveisCache = [],
    encarregadosCache = [],
    equipamentosCache = {},
    catalogoDefeitosCache = [],
    inspecoesSelecionadasParaServicoGlobal = [];
  let currentServicoIdParaEdicao = null;

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
      alert(`Erro ao comunicar com o servidor: ${error.message}`);
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
        console.error("Erro ao buscar catálogo de defeitos:", error);
        catalogoDefeitosCache = [];
      }
    }
    return catalogoDefeitosCache;
  }

  async function popularSelectsIniciais() {
    try {
      const [subestacoes, usuariosResp, encarregados] = await Promise.all([
        fetchData("/subestacoes"),
        fetchData("/usuarios-responsaveis-para-servicos"),
        fetchData("/usuarios-encarregados"),
      ]);
      subestacoesCache = subestacoes || [];
      usuariosResponsaveisCache = usuariosResp || [];
      encarregadosCache = encarregados || [];

      [servicoSubestacaoModalSelect, filtroInspecaoSubestacaoParaServicoSelect]
        .filter(Boolean)
        .forEach((select) => {
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
      if (servicoEncarregadoDesignadoModalSelect) {
        servicoEncarregadoDesignadoModalSelect.innerHTML =
          '<option value="">Nenhum</option>';
        encarregadosCache.forEach((user) =>
          servicoEncarregadoDesignadoModalSelect.add(
            new Option(user.nome, user.id)
          )
        );
      }
    } catch (error) {
      console.error("Erro ao popular selects iniciais:", error);
    }
  }

  async function popularSelectEquipamentos(
    subestacaoId,
    equipamentoSelecionadoId = null
  ) {
    if (!servicoEquipamentoModalSelect) return;
    servicoEquipamentoModalSelect.innerHTML =
      '<option value="">Carregando...</option>';
    servicoEquipamentoModalSelect.disabled = true;
    if (!subestacaoId) {
      servicoEquipamentoModalSelect.innerHTML =
        '<option value="">Selecione subestação</option>';
      servicoEquipamentoModalSelect.disabled = false;
      return;
    }
    try {
      if (!equipamentosCache[subestacaoId])
        equipamentosCache[subestacaoId] = await fetchData(
          `/subestacoes/${subestacaoId}/equipamentos`
        );
      const equipamentos = equipamentosCache[subestacaoId] || [];
      servicoEquipamentoModalSelect.innerHTML =
        '<option value="">Nenhum específico</option>';
      equipamentos.forEach((eq) =>
        servicoEquipamentoModalSelect.add(
          new Option(
            `${eq.tag} (${eq.description || eq.model || "Equipamento"})`,
            eq.id
          )
        )
      );
      servicoEquipamentoModalSelect.value = equipamentoSelecionadoId
        ? String(equipamentoSelecionadoId)
        : "";
    } catch (error) {
      servicoEquipamentoModalSelect.innerHTML =
        '<option value="">Erro</option>';
    } finally {
      servicoEquipamentoModalSelect.disabled = false;
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
      !servicoStatusModalSelect ||
      !servicoEncarregadoDesignadoModalSelect ||
      !servicoEquipamentoModalSelect ||
      !listaNomesAnexosModal ||
      !servicoAnexosInput ||
      !anexosExistentesContainer ||
      !listaAnexosExistentes
    )
      return;
    formServico.reset();
    currentServicoIdParaEdicao = null;
    inspecoesSelecionadasParaServicoGlobal = [];
    inspecoesVinculadasContainer.classList.add("d-none");
    listaInspecoesVinculadasComDefeitos.innerHTML = "";
    paginaTitulo.innerHTML = `<span class="material-symbols-outlined fs-1 me-2">playlist_add</span> ${titulo}`;
    servicoStatusModalSelect.value = "PROGRAMADO";
    servicoEncarregadoDesignadoModalSelect.value = "";
    servicoEquipamentoModalSelect.innerHTML =
      '<option value="">Selecione subestação</option>';
    servicoEquipamentoModalSelect.disabled = true;
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
      !servicoAlimentadorModalInput ||
      !servicoDataPrevistaModalInput ||
      !servicoHorarioInicioModalInput ||
      !servicoHorarioFimModalInput ||
      !servicoResponsavelModalSelect ||
      !servicoStatusModalSelect ||
      !servicoEncarregadoDesignadoModalSelect ||
      !servicoSubestacaoModalSelect ||
      !servicoObservacoesConclusaoModalTextarea ||
      !servicoDataConclusaoModalInput ||
      !listaAnexosExistentes ||
      !anexosExistentesContainer
    )
      return;
    try {
      const servico = await fetchData(`/api/servicos-subestacoes/${servicoId}`);
      if (!servico) {
        alert("Serviço não encontrado para edição.");
        configurarFormularioParaServico();
        return;
      }

      paginaTitulo.innerHTML = `<span class="material-symbols-outlined fs-1 me-2">edit_note</span> Editar Serviço ${
        servico.processo || `#${servico.id}`
      }`;
      servicoProcessoModalInput.value = servico.processo || "";
      servicoMotivoModalTextarea.value = servico.motivo || "";
      servicoAlimentadorModalInput.value = servico.alimentador || "";
      servicoDataPrevistaModalInput.value = formatarDataParaInput(
        servico.data_prevista
      );
      servicoHorarioInicioModalInput.value = formatarHoraParaInput(
        servico.horario_inicio
      );
      servicoHorarioFimModalInput.value = formatarHoraParaInput(
        servico.horario_fim
      );
      servicoResponsavelModalSelect.value = String(servico.responsavel_id);
      servicoStatusModalSelect.value = servico.status || "PROGRAMADO";
      servicoEncarregadoDesignadoModalSelect.value =
        servico.encarregado_designado_id
          ? String(servico.encarregado_designado_id)
          : "";
      servicoSubestacaoModalSelect.value = String(servico.subestacao_id);

      await popularSelectEquipamentos(
        servico.subestacao_id,
        servico.equipamento_id
      );
      if (servicoEquipamentoModalSelect)
        servicoEquipamentoModalSelect.value = servico.equipamento_id
          ? String(servico.equipamento_id)
          : "";

      servicoObservacoesConclusaoModalTextarea.value =
        servico.observacoes_conclusao || "";
      servicoDataConclusaoModalInput.value = formatarDataParaInput(
        servico.data_conclusao
      );

      listaAnexosExistentes.innerHTML = "";
      if (servico.anexos && servico.anexos.length > 0) {
        anexosExistentesContainer.classList.remove("d-none");
        servico.anexos.forEach((anx) => {
          const li = document.createElement("li");
          li.className =
            "list-group-item d-flex justify-content-between align-items-center py-1";
          li.innerHTML = `<span><a href="${
            anx.caminho_servidor || "#"
          }" target="_blank"><span class="material-symbols-outlined small align-middle">attach_file</span>${
            anx.nome_original || "Anexo"
          }</a></span><button type="button" class="btn btn-icon text-danger btn-sm remove-anexo-btn" data-anexo-id="${
            anx.id
          }" title="Excluir"><span class="material-symbols-outlined">delete</span></button>`;
          const btnRemove = li.querySelector(".remove-anexo-btn");
          if (btnRemove)
            btnRemove.addEventListener("click", (e) =>
              confirmarExclusaoAnexo(e.currentTarget.dataset.anexoId, li)
            );
          listaAnexosExistentes.appendChild(li);
        });
      } else {
        anexosExistentesContainer.classList.add("d-none");
      }

      if (
        servico.inspecoes_vinculadas &&
        servico.inspecoes_vinculadas.length > 0
      ) {
        inspecoesSelecionadasParaServicoGlobal =
          servico.inspecoes_vinculadas.map((iv) => String(iv.inspecao_id));
        await preencherFormularioComBaseEmMultiplasInspecoes(
          inspecoesSelecionadasParaServicoGlobal,
          servico.mapeamento_defeitos_existentes || []
        );
      }
      atualizarVisibilidadeConclusao();
    } catch (error) {
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

  async function confirmarExclusaoAnexo(anexoId, listItemElement) {
    if (
      !anexoId ||
      !listItemElement ||
      !listaAnexosExistentes ||
      !anexosExistentesContainer
    )
      return;
    if (
      confirm(
        "Excluir este anexo? (Esta ação é apenas visual por enquanto e não será salva até submeter o formulário)"
      )
    ) {
      console.warn(
        `Exclusão visual do anexo ID: ${anexoId}. Backend não foi chamado diretamente para exclusão de anexo individual nesta tela.`
      );
      listItemElement.remove();
      if (listaAnexosExistentes.children.length === 0)
        anexosExistentesContainer.classList.add("d-none");
    }
  }

  if (btnServicoAvulso)
    btnServicoAvulso.addEventListener("click", () => {
      if (bsModalPreSelecaoServico) ocultarModal(bsModalPreSelecaoServico);
      configurarFormularioParaServico();
    });
  if (btnServicoAPartirDeInspecao)
    btnServicoAPartirDeInspecao.addEventListener("click", () => {
      if (bsModalPreSelecaoServico) ocultarModal(bsModalPreSelecaoServico);
      abrirModalSelecaoInspecao();
    });
  if (btnCancelarPreSelecao)
    btnCancelarPreSelecao.addEventListener(
      "click",
      () => (window.location.href = "/pagina-servicos-subestacoes")
    );

  async function abrirModalSelecaoInspecao() {
    if (
      !bsModalSelecionarInspecao ||
      !corpoTabelaSelecaoInspecoes ||
      !nenhumaInspecaoParaSelecaoMsg
    )
      return;
    if (
      filtroInspecaoSubestacaoParaServicoSelect &&
      filtroInspecaoSubestacaoParaServicoSelect.options.length <= 1
    ) {
      if (subestacoesCache.length > 0) {
        filtroInspecaoSubestacaoParaServicoSelect.innerHTML =
          '<option value="">Todas</option>'; // Reset
        subestacoesCache.forEach((sub) =>
          filtroInspecaoSubestacaoParaServicoSelect.add(
            new Option(`${sub.sigla} - ${sub.nome}`, sub.Id)
          )
        );
      } else {
        await popularSelectsIniciais(); // Garante que o filtro de subestação do modal seja populado
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
    if (!corpoTabelaSelecaoInspecoes || !nenhumaInspecaoParaSelecaoMsg) return;
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
      ); // Backend precisa suportar
    try {
      const inspecoes = await fetchData(
        `/inspecoes-subestacoes?${params.toString()}`
      );
      popularTabelaSelecaoInspecoes(inspecoes);
    } catch (error) {
      corpoTabelaSelecaoInspecoes.innerHTML =
        '<tr><td colspan="7" class="text-center text-danger p-3">Erro ao carregar.</td></tr>';
    }
  }

  function popularTabelaSelecaoInspecoes(inspecoes) {
    if (!corpoTabelaSelecaoInspecoes || !nenhumaInspecaoParaSelecaoMsg) return;
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
        countCell.textContent = countAn;
        if (countAn > 0) countCell.classList.add("text-danger", "fw-bold");
      } catch {
        countCell.textContent = "?";
        countCell.title = "Erro contagem.";
      }
    });
  }

  if (selecionarTodasInspecoesCheckbox)
    selecionarTodasInspecoesCheckbox.addEventListener("change", (e) =>
      corpoTabelaSelecaoInspecoes
        .querySelectorAll(".sel-insp-cb")
        .forEach((cb) => (cb.checked = e.target.checked))
    );
  if (btnConfirmarSelecaoInspecoes)
    btnConfirmarSelecaoInspecoes.addEventListener("click", async () => {
      inspecoesSelecionadasParaServicoGlobal = Array.from(
        corpoTabelaSelecaoInspecoes.querySelectorAll(".sel-insp-cb:checked")
      ).map((cb) => cb.dataset.inspecaoId);
      if (
        inspecoesSelecionadasParaServicoGlobal.length === 0 &&
        !currentServicoIdParaEdicao
      ) {
        alert(
          "Selecione ao menos uma inspeção ou cancele para criar um serviço avulso."
        );
        return;
      }
      ocultarModal(bsModalSelecionarInspecao);
      await preencherFormularioComBaseEmMultiplasInspecoes(
        inspecoesSelecionadasParaServicoGlobal,
        currentServicoIdParaEdicao ? [] : []
      ); // Se editando, os defeitos serão carregados depois
    });

  async function preencherFormularioComBaseEmMultiplasInspecoes(
    listaIds,
    defsExistentes = []
  ) {
    if (
      !inspecoesVinculadasContainer ||
      !listaInspecoesVinculadasComDefeitos ||
      !paginaTitulo ||
      !servicoSubestacaoModalSelect ||
      !servicoMotivoModalTextarea ||
      !servicoDataPrevistaModalInput ||
      !servicoProcessoModalInput
    )
      return;

    const tituloBase = currentServicoIdParaEdicao
      ? `Editar Serviço ${
          servicoProcessoModalInput.value || `#${currentServicoIdParaEdicao}`
        }`
      : "Registrar Novo Serviço";
    paginaTitulo.innerHTML = `<span class="material-symbols-outlined fs-1 me-2">playlist_add_check</span> ${tituloBase} a partir de Inspeção(ões)`;

    let primSubId = currentServicoIdParaEdicao
      ? servicoSubestacaoModalSelect.value
      : null;
    let motConcat =
      currentServicoIdParaEdicao && servicoMotivoModalTextarea.value
        ? servicoMotivoModalTextarea.value +
          "\n\nInspeções Vinculadas Adicionalmente/Revisadas:\n"
        : "Serviço gerado a partir da(s) inspeção(ões):\n";
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
      if (!primSubId) primSubId = insp.subestacao_id;

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
      if (!dataMaisRec || dataAtual > dataMaisRec) dataMaisRec = dataAtual;
      // Passa 'false' para readOnly, pois estamos no formulário de registro/edição
      await renderizarItensAnormaisParaInspecao(
        insp,
        listaInspecoesVinculadasComDefeitos,
        defsExistentes,
        false
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
    defsExistentes = [],
    readOnly = false
  ) {
    if (!insp || !insp.gruposDeItens) return;
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
          const defExistente = defsExistentes.find(
            (d) => d.inspecao_item_id === item.id && d.inspecao_id === insp.id
          );
          const itemDiv = document.createElement("div");
          itemDiv.className =
            "item-anormal-servico mb-3 p-2 bg-light rounded border";
          itemDiv.dataset.inspecaoItemId = item.id;
          itemDiv.dataset.inspecaoIdOrigem = insp.id;

          let fotosHtml =
            '<small class="d-block text-muted fst-italic">Sem fotos de evidência.</small>';
          if (item.anexos && item.anexos.length > 0) {
            fotosHtml =
              '<div class="d-flex flex-wrap gap-1 mt-1 item-anormal-fotos">';
            item.anexos.forEach(
              (anx) =>
                (fotosHtml += `<a href="${anx.caminho}" target="_blank"><img src="${anx.caminho}" alt="Evidência" style="width:50px;height:50px;object-fit:cover;border:1px solid #ddd; border-radius:3px;"></a>`)
            );
            fotosHtml += "</div>";
          }

          itemDiv.innerHTML = `
                    <p class="mb-1 small"><strong>Item ${item.num}:</strong> ${
            item.desc
          }</p>
                    ${
                      item.obs
                        ? `<p class="mb-1 small text-danger"><em>Obs. da Inspeção: ${item.obs}</em></p>`
                        : ""
                    }
                    ${fotosHtml}
                    <div class="row gx-2 mt-2">
                        <div class="col-md-7">
                            <label for="cat-def-sel-${
                              item.id
                            }" class="form-label form-label-sm">Código de Defeito (Serviço):*</label>
                            <select id="cat-def-sel-${
                              item.id
                            }" name="catalogo_defeito_id_item_${
            item.id
          }" class="form-select form-select-sm cat-def-sel" required ${
            readOnly ? "disabled" : ""
          }>
                                <option value="">Selecione um código...</option>
                                ${catalogoDefeitosCache
                                  .map(
                                    (def) =>
                                      `<option value="${def.id}" ${
                                        defExistente &&
                                        defExistente.catalogo_defeito_id ==
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
                        <div class="col-md-5">
                            <label for="obs-serv-item-${
                              item.id
                            }" class="form-label form-label-sm">Obs. Específica do Serviço:</label>
                            <input type="text" id="obs-serv-item-${
                              item.id
                            }" name="obs_serv_item_${
            item.id
          }" class="form-control form-control-sm obs-serv-item" placeholder="Opcional" value="${
            defExistente?.observacao_especifica_servico || ""
          }" ${readOnly ? "disabled" : ""}>
                        </div>
                    </div>`;
          divInsp.appendChild(itemDiv);
        }
      });
    });
    if (algumAnormal) containerPai.appendChild(divInsp);
    else {
      divInsp.innerHTML +=
        '<p class="small text-muted fst-italic">Nenhum item anormal identificado nesta inspeção.</p>';
      containerPai.appendChild(divInsp);
    }
  }

  if (btnFiltrarInspecoesParaServico)
    btnFiltrarInspecoesParaServico.addEventListener(
      "click",
      carregarInspecoesParaSelecao
    );
  if (servicoSubestacaoModalSelect)
    servicoSubestacaoModalSelect.addEventListener("change", (e) =>
      popularSelectEquipamentos(
        e.target.value,
        servicoEquipamentoModalSelect?.value
      )
    );
  if (servicoStatusModalSelect)
    servicoStatusModalSelect.addEventListener(
      "change",
      atualizarVisibilidadeConclusao
    );

  function atualizarVisibilidadeConclusao() {
    if (
      !servicoStatusModalSelect ||
      !conclusaoFieldset ||
      !servicoDataConclusaoModalInput
    )
      return;
    const statusSel = servicoStatusModalSelect.value;
    if (statusSel === "CONCLUIDO") {
      conclusaoFieldset.classList.remove("d-none");
      if (
        !servicoDataConclusaoModalInput.value &&
        !currentServicoIdParaEdicao
      ) {
        servicoDataConclusaoModalInput.value = formatarDataParaInput(
          new Date().toISOString()
        );
      }
    } else {
      conclusaoFieldset.classList.add("d-none");
      servicoDataConclusaoModalInput.value = "";
      if (servicoObservacoesConclusaoModalTextarea)
        servicoObservacoesConclusaoModalTextarea.value = "";
    }
  }

  if (servicoAnexosInput && listaNomesAnexosModal)
    servicoAnexosInput.addEventListener("change", () => {
      listaNomesAnexosModal.innerHTML = "";
      if (servicoAnexosInput.files.length > 0)
        Array.from(servicoAnexosInput.files).forEach((f) => {
          const li = document.createElement("li");
          li.className =
            "list-group-item d-flex justify-content-between align-items-center py-1";
          li.innerHTML = `<div><span class="material-symbols-outlined me-1 small align-middle">draft</span>${
            f.name
          }</div><small class="text-muted">${(f.size / 1024).toFixed(
            1
          )}KB</small>`;
          listaNomesAnexosModal.appendChild(li);
        });
    });

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
        servicoDataConclusaoModalInput.focus();
        return;
      }

      let validacaoDefeitosOk = true;
      const mapDefs = [];
      if (inspecoesSelecionadasParaServicoGlobal.length > 0) {
        formData.append(
          "inspecao_ids_vinculadas",
          JSON.stringify(inspecoesSelecionadasParaServicoGlobal)
        );
        if (listaInspecoesVinculadasComDefeitos) {
          listaInspecoesVinculadasComDefeitos
            .querySelectorAll(".item-anormal-servico")
            .forEach((itemEl) => {
              if (!validacaoDefeitosOk) return; // Interrompe iteração se já falhou
              const inspItemId = itemEl.dataset.inspecaoItemId;
              const catDefSelect = itemEl.querySelector(".cat-def-sel");
              const catDefId = catDefSelect ? catDefSelect.value : null;
              const obsServInput = itemEl.querySelector(".obs-serv-item");
              const obsServ = obsServInput ? obsServInput.value : null;

              if (inspItemId && !catDefId) {
                alert(
                  `Um código de defeito deve ser selecionado para cada item anormal vinculado (item ID da inspeção: ${inspItemId}).`
                );
                if (catDefSelect) catDefSelect.focus();
                validacaoDefeitosOk = false;
              } else if (inspItemId && catDefId) {
                mapDefs.push({
                  inspecao_item_id: parseInt(inspItemId),
                  catalogo_defeito_id: parseInt(catDefId),
                  observacao_especifica_servico: obsServ || null,
                });
              }
            });
        }
        if (!validacaoDefeitosOk) return;
        if (mapDefs.length > 0)
          formData.append("mapeamento_defeitos", JSON.stringify(mapDefs));
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
      if (!formData.get("equipamento_id")) formData.set("equipamento_id", "");
      if (!formData.get("encarregado_designado_id"))
        formData.set("encarregado_designado_id", "");
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
        window.location.href = "/pagina-servicos-subestacoes";
      } catch (err) {
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
          "Cancelar e voltar para a listagem? Dados não salvos serão perdidos."
        )
      ) {
        window.location.href = "/pagina-servicos-subestacoes";
      }
    });
  }

  async function init() {
    await popularSelectsIniciais();
    await buscarCatalogoDefeitos();

    const urlParams = new URLSearchParams(window.location.search);
    const servicoIdParaEditarUrl = urlParams.get("editarId");

    if (servicoIdParaEditarUrl) {
      await carregarDadosServicoParaEdicao(servicoIdParaEditarUrl);
    } else {
      if (bsModalPreSelecaoServico) mostrarModal(bsModalPreSelecaoServico);
      else configurarFormularioParaServico();
    }
  }
  init();
});
