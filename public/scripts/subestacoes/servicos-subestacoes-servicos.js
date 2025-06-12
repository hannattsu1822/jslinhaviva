document.addEventListener("DOMContentLoaded", () => {
  const formFiltrosServicos = document.getElementById("formFiltrosServicos");
  const filtroSubestacaoSelect = document.getElementById("filtroSubestacao");
  const filtroStatusServicoSelect = document.getElementById(
    "filtroStatusServico"
  );
  const filtroDataPrevistaDeInput = document.getElementById(
    "filtroDataPrevistaDe"
  );
  const filtroDataPrevistaAteInput = document.getElementById(
    "filtroDataPrevistaAte"
  );
  const filtroProcessoInput = document.getElementById("filtroProcesso");
  const btnLimparFiltrosServicos = document.getElementById(
    "btnLimparFiltrosServicos"
  );

  const corpoTabelaServicos = document.getElementById("corpoTabelaServicos");
  const nenhumServicoMsg = document.getElementById("nenhumServico");
  const btnNovoServico = document.getElementById("btnNovoServico");

  const modalServico = document.getElementById("modalServico");
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
  const closeModalButtons = document.querySelectorAll(
    '.close-modal[data-modal-id="modalServico"]'
  );

  const modalConfirmacaoServico = document.getElementById(
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
  const closeModalConfirmacaoButtons = modalConfirmacaoServico.querySelectorAll(
    '.close-modal[data-modal-id="modalConfirmacaoServico"]'
  );

  const modalDesignarEncarregado = document.getElementById(
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
  const closeModalDesignarEncarregadoButtons =
    modalDesignarEncarregado.querySelectorAll(
      '.close-modal[data-modal-id="modalDesignarEncarregado"]'
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

  function mostrarModal(modalElement) {
    if (modalElement) modalElement.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function ocultarModal(modalElement) {
    if (modalElement) modalElement.classList.add("hidden");
    document.body.style.overflow = "";
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
      const selects = [filtroSubestacaoSelect, servicoSubestacaoModalSelect];
      selects.forEach((select) => {
        if (select === filtroSubestacaoSelect)
          select.innerHTML = '<option value="">Todas</option>';
        else select.innerHTML = '<option value="">Selecione...</option>';
      });

      subestacoes.forEach((sub) => {
        selects.forEach((select) => {
          const option = document.createElement("option");
          option.value = sub.Id;
          option.textContent = `${sub.sigla} - ${sub.nome}`;
          select.appendChild(option.cloneNode(true));
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
      const equipamentos = equipamentosCache[subestacaoId];

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

      if (equipamentoSelecionadoId) {
        servicoEquipamentoModalSelect.value = String(equipamentoSelecionadoId);
      } else {
        servicoEquipamentoModalSelect.value = "";
      }
    } catch (error) {
      console.error("Erro ao carregar equipamentos para modal:", error);
      servicoEquipamentoModalSelect.innerHTML =
        '<option value="">Erro ao carregar</option>';
    } finally {
      servicoEquipamentoModalSelect.disabled = false;
    }
  }

  async function popularSelectResponsaveisModal() {
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
    }
  }

  async function popularSelectEncarregados(
    selectElement,
    selecionadoId = null
  ) {
    try {
      if (encarregadosCache.length === 0) {
        encarregadosCache = await fetchData("/usuarios-encarregados");
      }
      selectElement.innerHTML = '<option value="">Selecione...</option>';
      if (selectElement === servicoEncarregadoDesignadoModalSelect) {
        selectElement.innerHTML = '<option value="">Nenhum</option>';
      }

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
    corpoTabelaServicos.innerHTML =
      '<tr><td colspan="9" style="text-align:center;">Carregando serviços...</td></tr>';
    nenhumServicoMsg.classList.add("hidden");

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
        '<tr><td colspan="9" style="text-align:center; color:red;">Erro ao carregar serviços.</td></tr>';
    }
  }

  function popularTabelaServicos(servicos) {
    corpoTabelaServicos.innerHTML = "";
    if (!servicos || servicos.length === 0) {
      nenhumServicoMsg.classList.remove("hidden");
      return;
    }
    nenhumServicoMsg.classList.add("hidden");

    servicos.forEach((serv) => {
      const tr = document.createElement("tr");
      const statusServico = (serv.status || "").toUpperCase();
      const podeConcluir =
        statusServico !== "CONCLUIDO" && statusServico !== "CANCELADO";
      const podeReabrir =
        statusServico === "CONCLUIDO" || statusServico === "CANCELADO";

      let btnConcluirHtml = `<button class="btn btn-icon" title="Serviço não pode ser concluído" disabled><span class="material-icons-outlined">check_circle_outline</span></button>`;
      if (podeConcluir) {
        btnConcluirHtml = `<button class="btn btn-icon btn-success btn-concluir-servico" data-id="${serv.id}" data-processo="${serv.processo}" title="Concluir Serviço"><span class="material-icons-outlined">check_circle</span></button>`;
      }
      let btnReabrirHtml = `<button class="btn btn-icon" title="Serviço não pode ser reaberto" disabled><span class="material-icons-outlined">history_toggle_off</span></button>`;
      if (podeReabrir) {
        btnReabrirHtml = `<button class="btn btn-icon btn-warning btn-reabrir-servico" data-id="${serv.id}" data-processo="${serv.processo}" title="Reabrir Serviço"><span class="material-icons-outlined">history</span></button>`;
      }

      tr.innerHTML = `
              <td>${serv.processo || "-"}</td>
              <td>${serv.subestacao_sigla || serv.subestacao_id}</td>
              <td title="${serv.motivo}">${(serv.motivo || "").substring(
        0,
        35
      )}${(serv.motivo || "").length > 35 ? "..." : ""}</td>
              <td>${
                serv.data_prevista
                  ? new Date(
                      serv.data_prevista + "T00:00:00"
                    ).toLocaleDateString("pt-BR", { timeZone: "UTC" })
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
              <td><span class="status-badge status-${(
                serv.status || "desconhecido"
              )
                .toLowerCase()
                .replace(/_/g, "")}">${(serv.status || "DESCONHECIDO").replace(
        "_",
        " "
      )}</span></td>
              <td class="actions-column">
                  <button class="btn btn-icon icon-info btn-ver-detalhes" data-id="${
                    serv.id
                  }" title="Ver Detalhes">
                      <span class="material-icons-outlined">visibility</span>
                  </button>
                  ${btnConcluirHtml}
                  ${btnReabrirHtml}
                   <button class="btn btn-icon btn-assign-encarregado" data-id="${
                     serv.id
                   }" data-processo="${serv.processo}" data-encarregado-id="${
        serv.encarregado_designado_id || ""
      }" title="Designar Encarregado">
                      <span class="material-icons-outlined">person_add_alt_1</span>
                  </button>
                  <button class="btn btn-icon icon-primary btn-editar-servico" data-id="${
                    serv.id
                  }" title="Editar Serviço">
                      <span class="material-icons-outlined">edit</span>
                  </button>
                  <button class="btn btn-icon icon-danger btn-excluir-servico" data-id="${
                    serv.id
                  }" data-processo="${serv.processo}" title="Excluir Serviço">
                      <span class="material-icons-outlined">delete</span>
                  </button>
              </td>
          `;

      const btnVerDetalhes = tr.querySelector(".btn-ver-detalhes");
      if (btnVerDetalhes) {
        btnVerDetalhes.addEventListener("click", () =>
          abrirModalServicoParaEdicao(serv.id, true)
        );
      }

      if (podeConcluir) {
        const btnConcluir = tr.querySelector(".btn-concluir-servico");
        if (btnConcluir) {
          btnConcluir.addEventListener("click", (e) =>
            abrirModalConfirmacaoConcluirServico(
              e.currentTarget.dataset.id,
              e.currentTarget.dataset.processo
            )
          );
        }
      }
      if (podeReabrir) {
        const btnReabrir = tr.querySelector(".btn-reabrir-servico");
        if (btnReabrir) {
          btnReabrir.addEventListener("click", (e) =>
            abrirModalConfirmacaoReabrirServico(
              e.currentTarget.dataset.id,
              e.currentTarget.dataset.processo
            )
          );
        }
      }

      const btnDesignar = tr.querySelector(".btn-assign-encarregado");
      if (btnDesignar) {
        btnDesignar.addEventListener("click", (e) =>
          abrirModalDesignarEncarregado(
            e.currentTarget.dataset.id,
            e.currentTarget.dataset.processo,
            e.currentTarget.dataset.encarregadoId
          )
        );
      }

      tr.querySelector(".btn-editar-servico").addEventListener("click", () =>
        abrirModalServicoParaEdicao(serv.id, false)
      );
      tr.querySelector(".btn-excluir-servico").addEventListener("click", (e) =>
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

  if (btnLimparFiltrosServicos) {
    btnLimparFiltrosServicos.addEventListener("click", () => {
      formFiltrosServicos.reset();
      carregarServicos();
    });
  }

  function configurarModalParaNovoServico() {
    formServico.reset();
    servicoIdModalInput.value = "";
    modalServicoTitulo.innerHTML =
      '<span class="material-icons-outlined">playlist_add_check</span> Registrar Novo Serviço';
    servicoStatusModalSelect.value = "PROGRAMADO";
    servicoEncarregadoDesignadoModalSelect.value = "";
    servicoEquipamentoModalSelect.innerHTML =
      '<option value="">Selecione subestação primeiro</option>';
    servicoEquipamentoModalSelect.disabled = true;
    listaNomesAnexosModal.innerHTML = "";
    servicoAnexosInput.value = "";
    anexosExistentesContainer.classList.add("hidden");
    listaAnexosExistentes.innerHTML = "";
    atualizarVisibilidadeConclusao();
    habilitarCamposFormulario(true);
    btnSalvarServicoModal.style.display = "inline-flex";
    const campoNovosAnexos = servicoAnexosInput.closest(".form-group");
    if (campoNovosAnexos) campoNovosAnexos.style.display = "block";
  }

  async function abrirModalServicoParaEdicao(servicoId, readOnly = false) {
    configurarModalParaNovoServico();

    if (readOnly) {
      modalServicoTitulo.innerHTML = `<span class="material-icons-outlined">visibility</span> Detalhes do Serviço`;
    } else {
      modalServicoTitulo.innerHTML = `<span class="material-icons-outlined">edit_note</span> Editar Serviço`;
    }

    try {
      const servico = await fetchData(`/api/servicos-subestacoes/${servicoId}`);
      if (!servico) {
        alert("Serviço não encontrado.");
        ocultarModal(modalServico);
        return;
      }

      modalServicoTitulo.innerHTML = readOnly
        ? `<span class="material-icons-outlined">visibility</span> Detalhes do Serviço #${servico.id}`
        : `<span class="material-icons-outlined">edit_note</span> Editar Serviço #${servico.id}`;

      servicoIdModalInput.value = servico.id;
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
      await popularSelectEquipamentosModal(
        servico.subestacao_id,
        servico.equipamento_id
      );
      if (servico.equipamento_id) {
        servicoEquipamentoModalSelect.value = String(servico.equipamento_id);
      } else {
        servicoEquipamentoModalSelect.value = "";
      }

      servicoObservacoesConclusaoModalTextarea.value =
        servico.observacoes_conclusao || "";
      servicoDataConclusaoModalInput.value = formatarDataParaInput(
        servico.data_conclusao
      );

      listaAnexosExistentes.innerHTML = "";
      if (servico.anexos && servico.anexos.length > 0) {
        anexosExistentesContainer.classList.remove("hidden");
        servico.anexos.forEach((anexo) => {
          const li = document.createElement("li");
          const anexoPath = anexo.caminho_servidor || anexo.caminho || "#";
          const anexoName =
            anexo.nome_original || anexo.nome || "Anexo sem nome";
          const anexoIdDb = anexo.id;

          let anexoDisplay = `<a href="${anexoPath}" target="_blank"><span class="material-icons-outlined">attach_file</span>${anexoName}</a>`;

          li.innerHTML = `${anexoDisplay} 
                                ${
                                  !readOnly && anexoIdDb
                                    ? `<button type="button" class="remove-anexo-btn" data-anexo-id="${anexoIdDb}" title="Excluir anexo"><span class="material-icons-outlined">delete_outline</span></button>`
                                    : ""
                                }`;

          if (!readOnly && anexoIdDb) {
            const removeBtn = li.querySelector(".remove-anexo-btn");
            if (removeBtn) {
              removeBtn.addEventListener("click", (e) => {
                confirmarExclusaoAnexo(e.currentTarget.dataset.anexoId, li);
              });
            }
          }
          listaAnexosExistentes.appendChild(li);
        });
      } else {
        anexosExistentesContainer.classList.add("hidden");
      }

      atualizarVisibilidadeConclusao();
      habilitarCamposFormulario(!readOnly);
      btnSalvarServicoModal.style.display = readOnly ? "none" : "inline-flex";

      const campoNovosAnexos = servicoAnexosInput.closest(".form-group");
      if (campoNovosAnexos) {
        campoNovosAnexos.style.display = readOnly ? "none" : "block";
      }

      mostrarModal(modalServico);
    } catch (error) {
      console.error("Erro ao carregar dados do serviço: ", error);
      alert("Erro ao carregar dados do serviço.");
      ocultarModal(modalServico);
    }
  }

  function habilitarCamposFormulario(habilitar) {
    const formElements = formServico.elements;
    for (let i = 0; i < formElements.length; i++) {
      const element = formElements[i];
      if (
        element.type !== "button" &&
        element.type !== "submit" &&
        !element.classList.contains("close-modal")
      ) {
        element.disabled = !habilitar;
      }
    }
    if (servicoAnexosInput) {
      servicoAnexosInput.disabled = !habilitar;
    }
  }

  async function confirmarExclusaoAnexo(anexoId, listItemElement) {
    if (!anexoId) {
      alert("ID do anexo não encontrado para exclusão.");
      return;
    }
    if (
      confirm(
        "Tem certeza que deseja excluir este anexo? Esta ação não pode ser desfeita."
      )
    ) {
      try {
        alert(
          `API de exclusão de anexo (ID: ${anexoId}) a ser implementada. O anexo não foi realmente excluído do servidor.`
        );
        listItemElement.remove();
        if (listaAnexosExistentes.children.length === 0) {
          anexosExistentesContainer.classList.add("hidden");
        }
      } catch (error) {
        alert(`Falha ao excluir anexo: ${error.message}`);
      }
    }
  }

  if (btnNovoServico) {
    btnNovoServico.addEventListener("click", configurarModalParaNovoServico);
  }

  closeModalButtons.forEach((button) => {
    button.addEventListener("click", () => ocultarModal(modalServico));
  });

  closeModalConfirmacaoButtons.forEach((button) => {
    button.addEventListener("click", () =>
      ocultarModal(modalConfirmacaoServico)
    );
  });

  if (closeModalDesignarEncarregadoButtons) {
    closeModalDesignarEncarregadoButtons.forEach((button) => {
      button.addEventListener("click", () =>
        ocultarModal(modalDesignarEncarregado)
      );
    });
  }

  servicoSubestacaoModalSelect.addEventListener("change", (event) => {
    const equipamentoPreviamenteSelecionado =
      servicoEquipamentoModalSelect.value;
    popularSelectEquipamentosModal(
      event.target.value,
      equipamentoPreviamenteSelecionado
    );
  });

  servicoStatusModalSelect.addEventListener(
    "change",
    atualizarVisibilidadeConclusao
  );

  function atualizarVisibilidadeConclusao() {
    const statusSelecionado = servicoStatusModalSelect.value;
    if (statusSelecionado === "CONCLUIDO") {
      conclusaoFieldset.classList.remove("hidden");
      if (
        !servicoDataConclusaoModalInput.value &&
        servicoIdModalInput.value === ""
      ) {
        servicoDataConclusaoModalInput.value = formatarDataParaInput(
          new Date().toISOString()
        );
      }
    } else {
      conclusaoFieldset.classList.add("hidden");
      servicoDataConclusaoModalInput.value = "";
      servicoObservacoesConclusaoModalTextarea.value = "";
    }
  }

  servicoAnexosInput.addEventListener("change", () => {
    listaNomesAnexosModal.innerHTML = "";
    if (servicoAnexosInput.files.length > 0) {
      for (const file of servicoAnexosInput.files) {
        const li = document.createElement("li");
        li.innerHTML = `<span class="material-icons-outlined">attach_file</span> ${
          file.name
        } (${(file.size / 1024).toFixed(1)} KB)`;
        listaNomesAnexosModal.appendChild(li);
      }
    }
  });

  if (confirmacaoAnexosInput) {
    confirmacaoAnexosInput.addEventListener("change", (event) => {
      listaNomesAnexosConclusao.innerHTML = "";
      if (event.target.files.length > 0) {
        for (const file of event.target.files) {
          const li = document.createElement("li");
          li.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
          listaNomesAnexosConclusao.appendChild(li);
        }
      }
    });
  }

  if (formServico) {
    formServico.addEventListener("submit", async (event) => {
      event.preventDefault();
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
        !formData.get("data_conclusao")
      ) {
        alert("Data de conclusão é obrigatória se o status for CONCLUÍDO.");
        servicoDataConclusaoModalInput.focus();
        return;
      }

      const submitButton = btnSalvarServicoModal;
      const originalButtonHtml = submitButton.innerHTML;
      submitButton.disabled = true;
      submitButton.innerHTML =
        '<span class="material-icons-outlined spin" style="animation: spin 1s linear infinite;">sync</span> Salvando...';

      const style = document.createElement("style");
      style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
      document.head.appendChild(style);

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
        const response = await fetch(url, {
          method: method,
          body: formData,
        });

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
        ocultarModal(modalServico);
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
        if (style && style.parentNode) document.head.removeChild(style);
      }
    });
  }

  function confirmarExclusaoServico(servicoId, processo) {
    modalConfirmacaoServicoTitulo.innerHTML =
      '<span class="material-icons-outlined warning-icon">warning_amber</span> Confirmar Exclusão';
    mensagemConfirmacaoServico.textContent = `Tem certeza que deseja excluir o serviço do processo "${
      processo || servicoId
    }"? Esta ação não pode ser desfeita.`;
    formConfirmacaoConcluirServico.classList.add("hidden");
    btnConfirmarAcaoServico.className = "btn btn-danger";
    btnConfirmarAcaoServico.innerHTML =
      '<span class="material-icons-outlined">delete_forever</span> Excluir';

    idServicoParaAcao = servicoId;
    operacaoConfirmacaoServico = async () => {
      const submitButton = btnConfirmarAcaoServico;
      const originalButtonHtmlInner = submitButton.innerHTML;
      submitButton.disabled = true;
      submitButton.innerHTML =
        '<span class="material-icons-outlined spin" style="animation: spin 1s linear infinite;">sync</span> Excluindo...';

      const style = document.createElement("style");
      style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
      document.head.appendChild(style);

      try {
        await fetchData(`/api/servicos-subestacoes/${idServicoParaAcao}`, {
          method: "DELETE",
        });
        alert("Serviço excluído com sucesso!");
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
        alert(`Falha ao excluir serviço: ${error.message}`);
      } finally {
        ocultarModal(modalConfirmacaoServico);
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonHtmlInner;
        if (style && style.parentNode) document.head.removeChild(style);
        idServicoParaAcao = null;
      }
    };
    mostrarModal(modalConfirmacaoServico);
  }

  function abrirModalConfirmacaoConcluirServico(servicoId, processoServico) {
    idServicoParaAcao = servicoId;
    modalConfirmacaoServicoTitulo.innerHTML =
      '<span class="material-icons-outlined">check_circle_outline</span> Concluir Serviço';
    mensagemConfirmacaoServico.textContent = `Deseja realmente marcar o serviço do processo "${
      processoServico || servicoId
    }" como CONCLUÍDO?`;

    formConfirmacaoConcluirServico.classList.remove("hidden");
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

    btnConfirmarAcaoServico.className = "btn btn-success";
    btnConfirmarAcaoServico.innerHTML =
      '<span class="material-icons-outlined">check_circle</span> Confirmar Conclusão';

    operacaoConfirmacaoServico = handleConcluirServico;
    mostrarModal(modalConfirmacaoServico);
  }

  async function handleConcluirServico() {
    if (!idServicoParaAcao) return;

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
      '<span class="material-icons-outlined spin" style="animation: spin 1s linear infinite;">sync</span> Confirmando...';
    const style = document.createElement("style");
    style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(style);

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
        {
          method: "PUT",
          body: formData,
        }
      );
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Erro ao concluir serviço." }));
        throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
      }
      const result = await response.json();
      alert(result.message || "Serviço concluído com sucesso!");
      ocultarModal(modalConfirmacaoServico);
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
      alert(`Falha ao concluir serviço: ${error.message}`);
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonHtml;
      if (style && style.parentNode) document.head.removeChild(style);
      idServicoParaAcao = null;
    }
  }

  function abrirModalConfirmacaoReabrirServico(servicoId, processoServico) {
    idServicoParaAcao = servicoId;
    modalConfirmacaoServicoTitulo.innerHTML =
      '<span class="material-icons-outlined">history</span> Confirmar Reabertura';
    mensagemConfirmacaoServico.textContent = `Deseja realmente reabrir o serviço do processo "${
      processoServico || servicoId
    }" (voltará para EM ANDAMENTO)?`;
    formConfirmacaoConcluirServico.classList.add("hidden");

    btnConfirmarAcaoServico.className = "btn btn-warning";
    btnConfirmarAcaoServico.innerHTML =
      '<span class="material-icons-outlined">history</span> Confirmar Reabertura';

    operacaoConfirmacaoServico = handleReabrirServico;
    mostrarModal(modalConfirmacaoServico);
  }

  async function handleReabrirServico() {
    if (!idServicoParaAcao) return;
    const submitButton = btnConfirmarAcaoServico;
    const originalButtonHtml = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML =
      '<span class="material-icons-outlined spin" style="animation: spin 1s linear infinite;">sync</span> Reabrindo...';

    const style = document.createElement("style");
    style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
    try {
      const response = await fetch(
        `/api/servicos-subestacoes/${idServicoParaAcao}/reabrir`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
        }
      );
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Erro ao reabrir serviço." }));
        throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
      }
      const result = await response.json();
      alert(result.message || "Serviço reaberto com sucesso!");
      ocultarModal(modalConfirmacaoServico);
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
      alert(`Falha ao reabrir serviço: ${error.message}`);
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonHtml;
      if (style && style.parentNode) document.head.removeChild(style);
      idServicoParaAcao = null;
    }
  }

  async function abrirModalDesignarEncarregado(
    servicoId,
    processoServico,
    encarregadoAtualId
  ) {
    servicoIdParaDesignacaoInput.value = servicoId;
    processoServicoParaDesignacaoSpan.textContent =
      processoServico || servicoId;
    await popularSelectEncarregados(
      selectEncarregadoDesignar,
      encarregadoAtualId
    );
    mostrarModal(modalDesignarEncarregado);
  }

  if (btnSalvarDesignacaoEncarregado) {
    btnSalvarDesignacaoEncarregado.addEventListener("click", async () => {
      const servicoId = servicoIdParaDesignacaoInput.value;
      const encarregadoId = selectEncarregadoDesignar.value;

      const submitButton = btnSalvarDesignacaoEncarregado;
      const originalButtonHtml = submitButton.innerHTML;
      submitButton.disabled = true;
      submitButton.innerHTML =
        '<span class="material-icons-outlined spin" style="animation: spin 1s linear infinite;">sync</span> Salvando...';
      const style = document.createElement("style");
      style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
      document.head.appendChild(style);

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
        ocultarModal(modalDesignarEncarregado);
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
        alert(`Falha ao designar encarregado: ${error.message}`);
      } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonHtml;
        if (style && style.parentNode) document.head.removeChild(style);
      }
    });
  }

  if (btnConfirmarAcaoServico) {
    btnConfirmarAcaoServico.addEventListener("click", () => {
      if (typeof operacaoConfirmacaoServico === "function") {
        operacaoConfirmacaoServico();
      }
    });
  }

  function init() {
    popularFiltroESelectSubestacoes();
    popularSelectResponsaveisModal();
    popularSelectEncarregados(servicoEncarregadoDesignadoModalSelect);
    servicoEquipamentoModalSelect.disabled = true;
    carregarServicos();
  }

  init();
});
