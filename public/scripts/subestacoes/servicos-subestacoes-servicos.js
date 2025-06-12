document.addEventListener("DOMContentLoaded", () => {
  const formFiltrosServicos = document.getElementById("formFiltrosServicos");
  const filtroSubestacaoSelect = document.getElementById("filtroSubestacao");
  const btnLimparFiltrosServicos = document.getElementById(
    "btnLimparFiltrosServicos"
  );
  const corpoTabelaServicos = document.getElementById("corpoTabelaServicos");
  const nenhumServicoMsg = document.getElementById("nenhumServico");
  const btnNovoServico = document.getElementById("btnNovoServico");

  const modalServicoEl = document.getElementById("modalServico");
  const modalServicoTitulo = document.getElementById("modalServicoTitulo");
  const formServico = document.getElementById("formServico");
  const servicoIdModalInput = document.getElementById("servicoIdModal");
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
  const btnSalvarServicoModal = document.getElementById(
    "btnSalvarServicoModal"
  );

  const modalConfirmacaoServicoEl = document.getElementById(
    "modalConfirmacaoServico"
  );
  const modalConfirmacaoServicoTitulo = document.getElementById(
    "modalConfirmacaoServicoTitulo"
  );
  const mensagemConfirmacaoServico = document.getElementById(
    "mensagemConfirmacaoServico"
  );
  const formConfirmacaoConcluirServico = document.getElementById(
    "formConfirmacaoConcluirServico"
  );
  const confirmacaoDataConclusaoInput = document.getElementById(
    "confirmacaoDataConclusaoInput"
  );
  const confirmacaoHoraConclusaoInput = document.getElementById(
    "confirmacaoHoraConclusaoInput"
  );
  const confirmacaoObservacoesTextarea = document.getElementById(
    "confirmacaoObservacoesTextarea"
  );
  const confirmacaoAnexosInput = document.getElementById(
    "confirmacaoAnexosInput"
  );
  const listaNomesAnexosConclusao = document.getElementById(
    "listaNomesAnexosConclusao"
  );
  const btnConfirmarAcaoServico = document.getElementById(
    "btnConfirmarAcaoServico"
  );

  const modalDesignarEncarregadoEl = document.getElementById(
    "modalDesignarEncarregado"
  );
  const servicoIdParaDesignacaoInput = document.getElementById(
    "servicoIdParaDesignacao"
  );
  const processoServicoParaDesignacaoSpan = document.getElementById(
    "processoServicoParaDesignacao"
  );
  const selectEncarregadoDesignar = document.getElementById(
    "selectEncarregadoDesignar"
  );
  const btnSalvarDesignacaoEncarregado = document.getElementById(
    "btnSalvarDesignacaoEncarregado"
  );

  let bsModalServico = null;
  let bsModalConfirmacaoServico = null;
  let bsModalDesignarEncarregado = null;

  if (modalServicoEl) bsModalServico = new bootstrap.Modal(modalServicoEl);
  if (modalConfirmacaoServicoEl)
    bsModalConfirmacaoServico = new bootstrap.Modal(modalConfirmacaoServicoEl);
  if (modalDesignarEncarregadoEl)
    bsModalDesignarEncarregado = new bootstrap.Modal(
      modalDesignarEncarregadoEl
    );

  let operacaoConfirmacaoServico = null;
  let idServicoParaAcao = null;
  let subestacoesCache = [];
  let usuariosResponsaveisCache = [];
  let encarregadosCache = [];
  let equipamentosCache = {};

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
    if (!dataISO) return "";
    return dataISO.split("T")[0];
  }
  function formatarHoraParaInput(horaISO) {
    if (!horaISO) return "";
    if (typeof horaISO === "string" && horaISO.includes(":")) {
      return horaISO.substring(0, 5);
    }
    return "";
  }

  async function popularFiltroESelectSubestacoes() {
    try {
      const subestacoes = await fetchData("/subestacoes");
      subestacoesCache = subestacoes;
      const selects = [
        filtroSubestacaoSelect,
        servicoSubestacaoModalSelect,
      ].filter(Boolean);
      selects.forEach((select) => {
        select.innerHTML =
          select === filtroSubestacaoSelect
            ? '<option value="">Todas</option>'
            : '<option value="">Selecione...</option>';
        subestacoes.forEach((sub) => {
          const option = document.createElement("option");
          option.value = sub.Id;
          option.textContent = `${sub.sigla} - ${sub.nome}`;
          select.appendChild(option);
        });
      });
    } catch (error) {
      console.error("Erro ao carregar subestações para filtros/modal:", error);
    }
  }

  async function popularSelectEquipamentosModal(
    subestacaoId,
    equipamentoSelecionadoId = null
  ) {
    if (!servicoEquipamentoModalSelect) return;
    servicoEquipamentoModalSelect.innerHTML =
      '<option value="">Carregando...</option>';
    servicoEquipamentoModalSelect.disabled = true;
    if (!subestacaoId) {
      servicoEquipamentoModalSelect.innerHTML =
        '<option value="">Selecione subestação primeiro</option>';
      servicoEquipamentoModalSelect.disabled = false;
      return;
    }
    try {
      if (!equipamentosCache[subestacaoId]) {
        equipamentosCache[subestacaoId] = await fetchData(
          `/subestacoes/${subestacaoId}/equipamentos`
        );
      }
      const equipamentos = equipamentosCache[subestacaoId] || [];
      servicoEquipamentoModalSelect.innerHTML =
        '<option value="">Nenhum específico</option>';
      equipamentos.forEach((eq) => {
        const option = document.createElement("option");
        option.value = eq.id;
        option.textContent = `${eq.tag} (${
          eq.description || eq.model || "Equipamento"
        })`;
        servicoEquipamentoModalSelect.appendChild(option);
      });
      servicoEquipamentoModalSelect.value = equipamentoSelecionadoId
        ? String(equipamentoSelecionadoId)
        : "";
    } catch (error) {
      console.error("Erro ao carregar equipamentos para modal:", error);
      servicoEquipamentoModalSelect.innerHTML =
        '<option value="">Erro ao carregar</option>';
    } finally {
      servicoEquipamentoModalSelect.disabled = false;
    }
  }

  async function popularSelectResponsaveisModal() {
    if (!servicoResponsavelModalSelect) return;
    try {
      const usuarios = await fetchData("/usuarios-responsaveis-para-servicos");
      usuariosResponsaveisCache = usuarios;
      servicoResponsavelModalSelect.innerHTML =
        '<option value="">Selecione...</option>';
      usuarios.forEach((user) => {
        const option = document.createElement("option");
        option.value = user.id;
        option.textContent = user.nome;
        servicoResponsavelModalSelect.appendChild(option);
      });
    } catch (error) {
      console.error("Erro ao carregar responsáveis para modal:", error);
      servicoResponsavelModalSelect.innerHTML =
        '<option value="">Erro</option>';
    }
  }

  async function popularSelectEncarregados(
    selectElement,
    selecionadoId = null
  ) {
    if (!selectElement) return;
    try {
      if (encarregadosCache.length === 0) {
        encarregadosCache = await fetchData("/usuarios-encarregados");
      }
      selectElement.innerHTML =
        selectElement === servicoEncarregadoDesignadoModalSelect
          ? '<option value="">Nenhum</option>'
          : '<option value="">Selecione...</option>';
      encarregadosCache.forEach((user) => {
        const option = document.createElement("option");
        option.value = user.id;
        option.textContent = user.nome;
        selectElement.appendChild(option);
      });
      if (selecionadoId) {
        selectElement.value = String(selecionadoId);
      }
    } catch (error) {
      selectElement.innerHTML = '<option value="">Erro ao carregar</option>';
      console.error("Erro ao carregar encarregados:", error);
    }
  }

  async function carregarServicos(params = {}) {
    if (!corpoTabelaServicos || !nenhumServicoMsg) return;
    corpoTabelaServicos.innerHTML =
      '<tr><td colspan="9" class="text-center p-5"><div class="spinner-border spinner-border-sm text-primary" role="status"><span class="visually-hidden">Carregando...</span></div> Carregando serviços...</td></tr>';
    nenhumServicoMsg.classList.add("d-none");
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach((key) => {
      if (params[key]) {
        queryParams.append(key, params[key]);
      }
    });
    const url = `/api/servicos-subestacoes${
      queryParams.toString() ? "?" + queryParams.toString() : ""
    }`;
    try {
      const servicos = await fetchData(url);
      popularTabelaServicos(servicos);
    } catch (error) {
      corpoTabelaServicos.innerHTML =
        '<tr><td colspan="9" class="text-center text-danger p-5">Erro ao carregar serviços.</td></tr>';
    }
  }

  function popularTabelaServicos(servicos) {
    if (!corpoTabelaServicos || !nenhumServicoMsg) return;
    corpoTabelaServicos.innerHTML = "";
    if (!servicos || servicos.length === 0) {
      nenhumServicoMsg.classList.remove("d-none");
      return;
    }
    nenhumServicoMsg.classList.add("d-none");
    servicos.forEach((serv) => {
      const tr = document.createElement("tr");
      const statusServico = (serv.status || "").toUpperCase();
      const podeConcluir =
        statusServico !== "CONCLUIDO" && statusServico !== "CANCELADO";
      const podeReabrir =
        statusServico === "CONCLUIDO" || statusServico === "CANCELADO";

      const statusClasseBase = (serv.status || "desconhecido").toLowerCase();
      const statusClasseFinal = statusClasseBase.replace(/_/g, "");
      const statusTextoDisplay = (serv.status || "DESCONHECIDO").replace(
        "_",
        " "
      );

      let btnConcluirHtml = `<button class="btn btn-icon text-muted" title="Serviço não pode ser concluído" disabled><span class="material-symbols-outlined">check_circle</span></button>`;
      if (podeConcluir) {
        btnConcluirHtml = `<button class="btn btn-icon text-success btn-concluir-servico" data-id="${serv.id}" data-processo="${serv.processo}" title="Concluir Serviço"><span class="material-symbols-outlined">check_circle</span></button>`;
      }

      let btnReabrirHtml = `<button class="btn btn-icon text-muted" title="Serviço não pode ser reaberto" disabled><span class="material-symbols-outlined">history</span></button>`;
      if (podeReabrir) {
        btnReabrirHtml = `<button class="btn btn-icon text-warning btn-reabrir-servico" data-id="${serv.id}" data-processo="${serv.processo}" title="Reabrir Serviço"><span class="material-symbols-outlined">history</span></button>`;
      }

      tr.innerHTML = `
          <td>${serv.processo || "-"}</td>
          <td>${serv.subestacao_sigla || serv.subestacao_id}</td>
          <td title="${serv.motivo}">${(serv.motivo || "").substring(0, 35)}${
        (serv.motivo || "").length > 35 ? "..." : ""
      }</td>
          <td>${
            serv.data_prevista
              ? new Date(serv.data_prevista + "T00:00:00").toLocaleDateString(
                  "pt-BR",
                  { timeZone: "UTC" }
                )
              : "-"
          }</td>
          <td>${
            serv.horario_inicio
              ? formatarHoraParaInput(serv.horario_inicio)
              : "-"
          } - ${
        serv.horario_fim ? formatarHoraParaInput(serv.horario_fim) : "-"
      }</td>
          <td>${serv.responsavel_nome || "-"}</td>
          <td>${serv.encarregado_designado_nome || "-"}</td>
          <td class="text-center"><span class="status-badge status-${statusClasseFinal}">${statusTextoDisplay}</span></td>
          <td class="text-center actions-column">
              <button class="btn btn-icon text-info btn-ver-detalhes" data-id="${
                serv.id
              }" title="Ver Detalhes"><span class="material-symbols-outlined">visibility</span></button>
              ${btnConcluirHtml}
              ${btnReabrirHtml}
              <button class="btn btn-icon text-primary btn-assign-encarregado" data-id="${
                serv.id
              }" data-processo="${serv.processo}" data-encarregado-id="${
        serv.encarregado_designado_id || ""
      }" title="Designar Encarregado"><span class="material-symbols-outlined">person_add</span></button>
              <button class="btn btn-icon text-primary btn-editar-servico" data-id="${
                serv.id
              }" title="Editar Serviço"><span class="material-symbols-outlined">edit</span></button>
              <button class="btn btn-icon text-danger btn-excluir-servico" data-id="${
                serv.id
              }" data-processo="${
        serv.processo
      }" title="Excluir Serviço"><span class="material-symbols-outlined">delete</span></button>
          </td>`;
      tr.querySelector(".btn-ver-detalhes")?.addEventListener("click", () =>
        abrirModalServicoParaEdicao(serv.id, true)
      );
      tr.querySelector(".btn-concluir-servico")?.addEventListener(
        "click",
        (e) =>
          abrirModalConfirmacaoConcluirServico(
            e.currentTarget.dataset.id,
            e.currentTarget.dataset.processo
          )
      );
      tr.querySelector(".btn-reabrir-servico")?.addEventListener("click", (e) =>
        abrirModalConfirmacaoReabrirServico(
          e.currentTarget.dataset.id,
          e.currentTarget.dataset.processo
        )
      );
      tr.querySelector(".btn-assign-encarregado")?.addEventListener(
        "click",
        (e) =>
          abrirModalDesignarEncarregado(
            e.currentTarget.dataset.id,
            e.currentTarget.dataset.processo,
            e.currentTarget.dataset.encarregadoId
          )
      );
      tr.querySelector(".btn-editar-servico")?.addEventListener("click", () =>
        abrirModalServicoParaEdicao(serv.id, false)
      );
      tr.querySelector(".btn-excluir-servico")?.addEventListener("click", (e) =>
        confirmarExclusaoServico(
          e.currentTarget.dataset.id,
          e.currentTarget.dataset.processo
        )
      );
      corpoTabelaServicos.appendChild(tr);
    });
  }

  if (formFiltrosServicos) {
    formFiltrosServicos.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(formFiltrosServicos);
      const params = {};
      for (let [key, value] of formData.entries()) {
        const paramKey = key
          .replace(/^filtro/, "")
          .replace(/([A-Z])/g, (match, p1) => `_${p1.toLowerCase()}`);
        if (value)
          params[paramKey.startsWith("_") ? paramKey.substring(1) : paramKey] =
            value;
      }
      carregarServicos(params);
    });
  }
  if (btnLimparFiltrosServicos && formFiltrosServicos) {
    btnLimparFiltrosServicos.addEventListener("click", () => {
      formFiltrosServicos.reset();
      carregarServicos();
    });
  }

  function configurarModalParaNovoServico() {
    if (
      !formServico ||
      !servicoIdModalInput ||
      !modalServicoTitulo ||
      !servicoStatusModalSelect ||
      !servicoEncarregadoDesignadoModalSelect ||
      !servicoEquipamentoModalSelect ||
      !listaNomesAnexosModal ||
      !servicoAnexosInput ||
      !anexosExistentesContainer ||
      !listaAnexosExistentes ||
      !btnSalvarServicoModal
    )
      return;
    formServico.reset();
    servicoIdModalInput.value = "";
    modalServicoTitulo.innerHTML =
      '<span class="material-symbols-outlined me-2">playlist_add_check</span> Registrar Novo Serviço';
    servicoStatusModalSelect.value = "PROGRAMADO";
    servicoEncarregadoDesignadoModalSelect.value = "";
    servicoEquipamentoModalSelect.innerHTML =
      '<option value="">Selecione subestação primeiro</option>';
    servicoEquipamentoModalSelect.disabled = true;
    listaNomesAnexosModal.innerHTML = "";
    servicoAnexosInput.value = "";
    anexosExistentesContainer.classList.add("d-none");
    listaAnexosExistentes.innerHTML = "";
    atualizarVisibilidadeConclusao();
    habilitarCamposFormulario(true);
    btnSalvarServicoModal.style.display = "inline-flex";
    const campoNovosAnexos = servicoAnexosInput.closest(".mb-2");
    if (campoNovosAnexos) campoNovosAnexos.style.display = "block";
    if (bsModalServico) mostrarModal(bsModalServico);
    if (servicoSubestacaoModalSelect) servicoSubestacaoModalSelect.focus();
  }

  async function abrirModalServicoParaEdicao(servicoId, readOnly = false) {
    if (!bsModalServico || !formServico) return;
    configurarModalParaNovoServico();
    if (modalServicoTitulo) {
      modalServicoTitulo.innerHTML = readOnly
        ? `<span class="material-symbols-outlined me-2">visibility</span> Detalhes do Serviço`
        : `<span class="material-symbols-outlined me-2">edit_note</span> Editar Serviço`;
    }
    try {
      const servico = await fetchData(`/api/servicos-subestacoes/${servicoId}`);
      if (!servico) {
        alert("Serviço não encontrado.");
        ocultarModal(bsModalServico);
        return;
      }
      if (modalServicoTitulo)
        modalServicoTitulo.innerHTML = readOnly
          ? `<span class="material-symbols-outlined me-2">visibility</span> Detalhes do Serviço #${servico.id}`
          : `<span class="material-symbols-outlined me-2">edit_note</span> Editar Serviço #${servico.id}`;
      if (servicoIdModalInput) servicoIdModalInput.value = servico.id;
      if (servicoProcessoModalInput)
        servicoProcessoModalInput.value = servico.processo || "";
      if (servicoMotivoModalTextarea)
        servicoMotivoModalTextarea.value = servico.motivo || "";
      if (servicoAlimentadorModalInput)
        servicoAlimentadorModalInput.value = servico.alimentador || "";
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
      if (servicoEncarregadoDesignadoModalSelect)
        servicoEncarregadoDesignadoModalSelect.value =
          servico.encarregado_designado_id
            ? String(servico.encarregado_designado_id)
            : "";
      if (servicoSubestacaoModalSelect)
        servicoSubestacaoModalSelect.value = String(servico.subestacao_id);
      await popularSelectEquipamentosModal(
        servico.subestacao_id,
        servico.equipamento_id
      );
      if (servicoEquipamentoModalSelect && servico.equipamento_id) {
        servicoEquipamentoModalSelect.value = String(servico.equipamento_id);
      } else if (servicoEquipamentoModalSelect) {
        servicoEquipamentoModalSelect.value = "";
      }
      if (servicoObservacoesConclusaoModalTextarea)
        servicoObservacoesConclusaoModalTextarea.value =
          servico.observacoes_conclusao || "";
      if (servicoDataConclusaoModalInput)
        servicoDataConclusaoModalInput.value = formatarDataParaInput(
          servico.data_conclusao
        );
      if (listaAnexosExistentes && anexosExistentesContainer) {
        listaAnexosExistentes.innerHTML = "";
        if (servico.anexos && servico.anexos.length > 0) {
          anexosExistentesContainer.classList.remove("d-none");
          servico.anexos.forEach((anexo) => {
            const li = document.createElement("li");
            li.className =
              "list-group-item d-flex justify-content-between align-items-center py-1";
            const anexoPath = anexo.caminho_servidor || anexo.caminho || "#";
            const anexoName =
              anexo.nome_original || anexo.nome || "Anexo sem nome";
            const anexoIdDb = anexo.id;
            let anexoDisplay = `<a href="${anexoPath}" target="_blank" class="text-decoration-none"><span class="material-symbols-outlined me-1 small align-middle">attach_file</span>${anexoName}</a>`;
            li.innerHTML = `<span>${anexoDisplay}</span> ${
              !readOnly && anexoIdDb
                ? `<button type="button" class="btn btn-icon text-danger btn-sm remove-anexo-btn" data-anexo-id="${anexoIdDb}" title="Excluir anexo"><span class="material-symbols-outlined">delete</span></button>`
                : ""
            }`;
            if (!readOnly && anexoIdDb) {
              li.querySelector(".remove-anexo-btn")?.addEventListener(
                "click",
                (e) =>
                  confirmarExclusaoAnexo(e.currentTarget.dataset.anexoId, li)
              );
            }
            listaAnexosExistentes.appendChild(li);
          });
        } else {
          anexosExistentesContainer.classList.add("d-none");
        }
      }
      atualizarVisibilidadeConclusao();
      habilitarCamposFormulario(!readOnly);
      if (btnSalvarServicoModal)
        btnSalvarServicoModal.style.display = readOnly ? "none" : "inline-flex";
      if (servicoAnexosInput) {
        const campoNovosAnexos = servicoAnexosInput.closest(".mb-2");
        if (campoNovosAnexos) {
          campoNovosAnexos.style.display = readOnly ? "none" : "block";
        }
      }
      mostrarModal(bsModalServico);
    } catch (error) {
      console.error("Erro ao carregar dados do serviço: ", error);
      alert("Erro ao carregar dados do serviço.");
      ocultarModal(bsModalServico);
    }
  }

  function habilitarCamposFormulario(habilitar) {
    if (!formServico) return;
    const formElements = formServico.elements;
    for (let i = 0; i < formElements.length; i++) {
      const element = formElements[i];
      if (
        element.type !== "button" &&
        element.type !== "submit" &&
        !element.classList.contains("btn-close")
      ) {
        element.disabled = !habilitar;
      }
    }
    if (servicoAnexosInput) {
      servicoAnexosInput.disabled = !habilitar;
    }
  }

  async function confirmarExclusaoAnexo(anexoId, listItemElement) {
    if (!anexoId || !listaAnexosExistentes || !anexosExistentesContainer) {
      alert("ID do anexo ou elementos do DOM não encontrados.");
      return;
    }
    if (
      confirm(
        "Tem certeza que deseja excluir este anexo? Esta ação não pode ser desfeita."
      )
    ) {
      try {
        alert(
          `FUNCIONALIDADE PENDENTE: A API de exclusão de anexo (ID: ${anexoId}) precisa ser implementada. O anexo NÃO foi excluído do servidor.`
        );
        listItemElement.remove();
        if (listaAnexosExistentes.children.length === 0) {
          anexosExistentesContainer.classList.add("d-none");
        }
      } catch (error) {
        alert(`Falha ao excluir anexo: ${error.message}`);
      }
    }
  }

  if (btnNovoServico) {
    btnNovoServico.addEventListener("click", configurarModalParaNovoServico);
  }

  if (servicoSubestacaoModalSelect) {
    servicoSubestacaoModalSelect.addEventListener("change", (event) => {
      const equipamentoPreviamenteSelecionado =
        servicoEquipamentoModalSelect?.value;
      popularSelectEquipamentosModal(
        event.target.value,
        equipamentoPreviamenteSelecionado
      );
    });
  }
  if (servicoStatusModalSelect) {
    servicoStatusModalSelect.addEventListener(
      "change",
      atualizarVisibilidadeConclusao
    );
  }

  function atualizarVisibilidadeConclusao() {
    if (
      !servicoStatusModalSelect ||
      !conclusaoFieldset ||
      !servicoDataConclusaoModalInput ||
      !servicoIdModalInput
    )
      return;
    const statusSelecionado = servicoStatusModalSelect.value;
    if (statusSelecionado === "CONCLUIDO") {
      conclusaoFieldset.classList.remove("d-none");
      if (
        !servicoDataConclusaoModalInput.value &&
        (!servicoIdModalInput.value || servicoIdModalInput.value === "")
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

  if (servicoAnexosInput && listaNomesAnexosModal) {
    servicoAnexosInput.addEventListener("change", () => {
      listaNomesAnexosModal.innerHTML = "";
      if (servicoAnexosInput.files.length > 0) {
        for (const file of servicoAnexosInput.files) {
          const li = document.createElement("li");
          li.className =
            "list-group-item d-flex justify-content-between align-items-center py-1";
          li.innerHTML = `<div><span class="material-symbols-outlined me-1 small align-middle">draft</span> ${
            file.name
          }</div> <small class="text-muted">${(file.size / 1024).toFixed(
            1
          )} KB</small>`;
          listaNomesAnexosModal.appendChild(li);
        }
      }
    });
  }

  if (confirmacaoAnexosInput && listaNomesAnexosConclusao) {
    confirmacaoAnexosInput.addEventListener("change", (event) => {
      listaNomesAnexosConclusao.innerHTML = "";
      if (event.target.files.length > 0) {
        for (const file of event.target.files) {
          const li = document.createElement("li");
          li.className =
            "list-group-item d-flex justify-content-between align-items-center py-1";
          li.innerHTML = `<div><span class="material-symbols-outlined me-1 small align-middle">draft</span> ${
            file.name
          }</div> <small class="text-muted">${(file.size / 1024).toFixed(
            1
          )} KB</small>`;
          listaNomesAnexosConclusao.appendChild(li);
        }
      }
    });
  }

  if (formServico) {
    formServico.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (
        !servicoIdModalInput ||
        !btnSalvarServicoModal ||
        !formFiltrosServicos
      )
        return;
      const formData = new FormData(formServico);
      const servicoId = servicoIdModalInput.value;
      if (
        !formData.get("subestacao_id") ||
        !formData.get("processo") ||
        !formData.get("motivo") ||
        !formData.get("data_prevista") ||
        !formData.get("horario_inicio") ||
        !formData.get("horario_fim") ||
        !formData.get("responsavel_id")
      ) {
        alert("Por favor, preencha todos os campos obrigatórios (*).");
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
      const submitButton = btnSalvarServicoModal;
      const originalButtonHtml = submitButton.innerHTML;
      submitButton.disabled = true;
      submitButton.innerHTML =
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...';
      const url = servicoId
        ? `/api/servicos-subestacoes/${servicoId}`
        : "/api/servicos-subestacoes";
      const method = servicoId ? "PUT" : "POST";
      if (!formData.get("equipamento_id")) {
        formData.set("equipamento_id", "");
      }
      if (!formData.get("encarregado_designado_id")) {
        formData.set("encarregado_designado_id", "");
      }
      if (formData.get("status") !== "CONCLUIDO") {
        formData.delete("data_conclusao");
        formData.delete("observacoes_conclusao");
      }
      try {
        const response = await fetch(url, { method: method, body: formData });
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: "Erro desconhecido ao salvar serviço." }));
          throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
        }
        const result = await response.json();
        alert(
          result.message ||
            `Serviço ${servicoId ? "atualizado" : "registrado"} com sucesso!`
        );
        ocultarModal(bsModalServico);
        const currentParams = {};
        new FormData(formFiltrosServicos).forEach((value, key) => {
          const paramKey = key
            .replace(/^filtro/, "")
            .replace(/([A-Z])/g, (match, p1) => `_${p1.toLowerCase()}`);
          if (value)
            currentParams[
              paramKey.startsWith("_") ? paramKey.substring(1) : paramKey
            ] = value;
        });
        carregarServicos(currentParams);
      } catch (error) {
        console.error(
          `Erro ao ${servicoId ? "atualizar" : "registrar"} serviço:`,
          error
        );
        alert(
          `Falha ao ${servicoId ? "atualizar" : "registrar"} serviço: ${
            error.message
          }`
        );
      } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonHtml;
      }
    });
  }

  function confirmarExclusaoServico(servicoId, processo) {
    if (
      !modalConfirmacaoServicoTitulo ||
      !mensagemConfirmacaoServico ||
      !formConfirmacaoConcluirServico ||
      !btnConfirmarAcaoServico ||
      !bsModalConfirmacaoServico
    )
      return;
    const iconElement = modalConfirmacaoServicoTitulo.querySelector(
      ".material-symbols-outlined"
    );
    if (iconElement) {
      iconElement.textContent = "warning";
      iconElement.className = "material-symbols-outlined me-2 text-danger";
    }

    const titleTextNode = Array.from(
      modalConfirmacaoServicoTitulo.childNodes
    ).find(
      (node) =>
        node.nodeType === Node.TEXT_NODE &&
        node.textContent.includes("Confirmar")
    );
    if (titleTextNode) titleTextNode.nodeValue = " Confirmar Exclusão";

    mensagemConfirmacaoServico.textContent = `Tem certeza que deseja excluir o serviço do processo "${
      processo || servicoId
    }"? Esta ação não pode ser desfeita.`;
    formConfirmacaoConcluirServico.classList.add("d-none");
    btnConfirmarAcaoServico.className = "btn btn-sm btn-danger";
    btnConfirmarAcaoServico.innerHTML =
      '<span class="material-symbols-outlined">delete</span> Excluir';
    idServicoParaAcao = servicoId;
    operacaoConfirmacaoServico = async () => {
      const submitButton = btnConfirmarAcaoServico;
      const originalButtonHtmlInner = submitButton.innerHTML;
      submitButton.disabled = true;
      submitButton.innerHTML =
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Excluindo...';
      try {
        await fetchData(`/api/servicos-subestacoes/${idServicoParaAcao}`, {
          method: "DELETE",
        });
        alert("Serviço excluído com sucesso!");
        const currentParams = {};
        if (formFiltrosServicos) {
          new FormData(formFiltrosServicos).forEach((value, key) => {
            const paramKey = key
              .replace(/^filtro/, "")
              .replace(/([A-Z])/g, (match, p1) => `_${p1.toLowerCase()}`);
            if (value)
              currentParams[
                paramKey.startsWith("_") ? paramKey.substring(1) : paramKey
              ] = value;
          });
        }
        carregarServicos(currentParams);
      } catch (error) {
        alert(`Falha ao excluir serviço: ${error.message}`);
      } finally {
        ocultarModal(bsModalConfirmacaoServico);
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonHtmlInner;
        idServicoParaAcao = null;
      }
    };
    mostrarModal(bsModalConfirmacaoServico);
  }

  function abrirModalConfirmacaoConcluirServico(servicoId, processoServico) {
    if (
      !modalConfirmacaoServicoTitulo ||
      !mensagemConfirmacaoServico ||
      !formConfirmacaoConcluirServico ||
      !confirmacaoDataConclusaoInput ||
      !confirmacaoHoraConclusaoInput ||
      !confirmacaoObservacoesTextarea ||
      !confirmacaoAnexosInput ||
      !listaNomesAnexosConclusao ||
      !btnConfirmarAcaoServico ||
      !bsModalConfirmacaoServico
    )
      return;
    idServicoParaAcao = servicoId;
    const iconElement = modalConfirmacaoServicoTitulo.querySelector(
      ".material-symbols-outlined"
    );
    if (iconElement) {
      iconElement.textContent = "check_circle";
      iconElement.className = "material-symbols-outlined me-2 text-success";
    }

    const titleTextNode = Array.from(
      modalConfirmacaoServicoTitulo.childNodes
    ).find(
      (node) =>
        node.nodeType === Node.TEXT_NODE &&
        node.textContent.includes("Confirmar")
    );
    if (titleTextNode) titleTextNode.nodeValue = " Concluir Serviço";

    mensagemConfirmacaoServico.textContent = `Deseja realmente marcar o serviço do processo "${
      processoServico || servicoId
    }" como CONCLUÍDO?`;
    formConfirmacaoConcluirServico.classList.remove("d-none");
    confirmacaoDataConclusaoInput.value = formatarDataParaInput(
      new Date().toISOString()
    );
    const now = new Date();
    confirmacaoHoraConclusaoInput.value = now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    confirmacaoObservacoesTextarea.value = "";
    confirmacaoAnexosInput.value = "";
    listaNomesAnexosConclusao.innerHTML = "";
    btnConfirmarAcaoServico.className = "btn btn-sm btn-success";
    btnConfirmarAcaoServico.innerHTML =
      '<span class="material-symbols-outlined">check_circle</span> Confirmar Conclusão';
    operacaoConfirmacaoServico = handleConcluirServico;
    mostrarModal(bsModalConfirmacaoServico);
  }

  async function handleConcluirServico() {
    if (
      !idServicoParaAcao ||
      !confirmacaoDataConclusaoInput ||
      !confirmacaoHoraConclusaoInput ||
      !confirmacaoObservacoesTextarea ||
      !confirmacaoAnexosInput ||
      !btnConfirmarAcaoServico
    )
      return;
    const dataConclusaoManual = confirmacaoDataConclusaoInput.value;
    const horaConclusaoManual = confirmacaoHoraConclusaoInput.value;
    const observacoesConclusaoManual = confirmacaoObservacoesTextarea.value;
    const anexosConclusao = confirmacaoAnexosInput.files;
    if (!dataConclusaoManual) {
      alert("A data de conclusão é obrigatória.");
      confirmacaoDataConclusaoInput.focus();
      return;
    }
    const submitButton = btnConfirmarAcaoServico;
    const originalButtonHtml = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Confirmando...';
    const formData = new FormData();
    formData.append("data_conclusao_manual", dataConclusaoManual);
    if (horaConclusaoManual) {
      formData.append("hora_conclusao_manual", horaConclusaoManual);
    }
    if (observacoesConclusaoManual) {
      formData.append(
        "observacoes_conclusao_manual",
        observacoesConclusaoManual
      );
    }
    if (anexosConclusao && anexosConclusao.length > 0) {
      for (let i = 0; i < anexosConclusao.length; i++) {
        formData.append("anexos_conclusao_servico", anexosConclusao[i]);
      }
    }
    try {
      const response = await fetch(
        `/api/servicos-subestacoes/${idServicoParaAcao}/concluir`,
        { method: "PUT", body: formData }
      );
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Erro ao concluir serviço." }));
        throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
      }
      const result = await response.json();
      alert(result.message || "Serviço concluído com sucesso!");
      ocultarModal(bsModalConfirmacaoServico);
      const currentParams = {};
      if (formFiltrosServicos) {
        new FormData(formFiltrosServicos).forEach((value, key) => {
          const paramKey = key
            .replace(/^filtro/, "")
            .replace(/([A-Z])/g, (match, p1) => `_${p1.toLowerCase()}`);
          if (value)
            currentParams[
              paramKey.startsWith("_") ? paramKey.substring(1) : paramKey
            ] = value;
        });
      }
      carregarServicos(currentParams);
    } catch (error) {
      alert(`Falha ao concluir serviço: ${error.message}`);
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonHtml;
      idServicoParaAcao = null;
    }
  }

  function abrirModalConfirmacaoReabrirServico(servicoId, processoServico) {
    if (
      !modalConfirmacaoServicoTitulo ||
      !mensagemConfirmacaoServico ||
      !formConfirmacaoConcluirServico ||
      !btnConfirmarAcaoServico ||
      !bsModalConfirmacaoServico
    )
      return;
    idServicoParaAcao = servicoId;
    const iconElement = modalConfirmacaoServicoTitulo.querySelector(
      ".material-symbols-outlined"
    );
    if (iconElement) {
      iconElement.textContent = "history";
      iconElement.className = "material-symbols-outlined me-2 text-warning";
    }

    const titleTextNode = Array.from(
      modalConfirmacaoServicoTitulo.childNodes
    ).find(
      (node) =>
        node.nodeType === Node.TEXT_NODE &&
        node.textContent.includes("Confirmar")
    );
    if (titleTextNode) titleTextNode.nodeValue = " Confirmar Reabertura";

    mensagemConfirmacaoServico.textContent = `Deseja realmente reabrir o serviço do processo "${
      processoServico || servicoId
    }" (voltará para EM ANDAMENTO)?`;
    formConfirmacaoConcluirServico.classList.add("d-none");
    btnConfirmarAcaoServico.className = "btn btn-sm btn-warning";
    btnConfirmarAcaoServico.innerHTML =
      '<span class="material-symbols-outlined">history</span> Confirmar Reabertura';
    operacaoConfirmacaoServico = handleReabrirServico;
    mostrarModal(bsModalConfirmacaoServico);
  }

  async function handleReabrirServico() {
    if (!idServicoParaAcao || !btnConfirmarAcaoServico) return;
    const submitButton = btnConfirmarAcaoServico;
    const originalButtonHtml = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Reabrindo...';
    try {
      const response = await fetch(
        `/api/servicos-subestacoes/${idServicoParaAcao}/reabrir`,
        { method: "PUT", headers: { "Content-Type": "application/json" } }
      );
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Erro ao reabrir serviço." }));
        throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
      }
      const result = await response.json();
      alert(result.message || "Serviço reaberto com sucesso!");
      ocultarModal(bsModalConfirmacaoServico);
      const currentParams = {};
      if (formFiltrosServicos) {
        new FormData(formFiltrosServicos).forEach((value, key) => {
          const paramKey = key
            .replace(/^filtro/, "")
            .replace(/([A-Z])/g, (match, p1) => `_${p1.toLowerCase()}`);
          if (value)
            currentParams[
              paramKey.startsWith("_") ? paramKey.substring(1) : paramKey
            ] = value;
        });
      }
      carregarServicos(currentParams);
    } catch (error) {
      alert(`Falha ao reabrir serviço: ${error.message}`);
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonHtml;
      idServicoParaAcao = null;
    }
  }

  async function abrirModalDesignarEncarregado(
    servicoId,
    processoServico,
    encarregadoAtualId
  ) {
    if (
      !servicoIdParaDesignacaoInput ||
      !processoServicoParaDesignacaoSpan ||
      !selectEncarregadoDesignar ||
      !bsModalDesignarEncarregado
    )
      return;
    servicoIdParaDesignacaoInput.value = servicoId;
    processoServicoParaDesignacaoSpan.textContent =
      processoServico || servicoId;
    await popularSelectEncarregados(
      selectEncarregadoDesignar,
      encarregadoAtualId
    );
    mostrarModal(bsModalDesignarEncarregado);
    selectEncarregadoDesignar.focus();
  }

  if (btnSalvarDesignacaoEncarregado) {
    btnSalvarDesignacaoEncarregado.addEventListener("click", async () => {
      if (!servicoIdParaDesignacaoInput || !selectEncarregadoDesignar) return;
      const servicoId = servicoIdParaDesignacaoInput.value;
      const encarregadoId = selectEncarregadoDesignar.value;
      const submitButton = btnSalvarDesignacaoEncarregado;
      const originalButtonHtml = submitButton.innerHTML;
      submitButton.disabled = true;
      submitButton.innerHTML =
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...';
      try {
        const response = await fetch(
          `/api/servicos-subestacoes/${servicoId}/designar-encarregado`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              encarregado_designado_id: encarregadoId || null,
            }),
          }
        );
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: "Erro ao designar encarregado." }));
          throw new Error(errorData.message || `Erro HTTP ${response.status}`);
        }
        const result = await response.json();
        alert(result.message || "Encarregado designado com sucesso!");
        ocultarModal(bsModalDesignarEncarregado);
        const currentParams = {};
        if (formFiltrosServicos) {
          new FormData(formFiltrosServicos).forEach((value, key) => {
            const paramKey = key
              .replace(/^filtro/, "")
              .replace(/([A-Z])/g, (match, p1) => `_${p1.toLowerCase()}`);
            if (value)
              currentParams[
                paramKey.startsWith("_") ? paramKey.substring(1) : paramKey
              ] = value;
          });
        }
        carregarServicos(currentParams);
      } catch (error) {
        alert(`Falha ao designar encarregado: ${error.message}`);
      } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonHtml;
      }
    });
  }

  if (btnConfirmarAcaoServico && bsModalConfirmacaoServico) {
    btnConfirmarAcaoServico.addEventListener("click", () => {
      if (typeof operacaoConfirmacaoServico === "function") {
        operacaoConfirmacaoServico();
      }
    });
  }

  function init() {
    popularFiltroESelectSubestacoes();
    popularSelectResponsaveisModal();
    if (servicoEncarregadoDesignadoModalSelect) {
      popularSelectEncarregados(servicoEncarregadoDesignadoModalSelect);
    }
    if (servicoEquipamentoModalSelect) {
      servicoEquipamentoModalSelect.disabled = true;
    }
    carregarServicos();
  }
  init();
});
