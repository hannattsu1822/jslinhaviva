document.addEventListener("DOMContentLoaded", () => {
  const formFiltrosServicos = document.getElementById("formFiltrosServicos");
  const filtroSubestacaoSelect = document.getElementById("filtroSubestacao");
  const btnLimparFiltrosServicos = document.getElementById(
    "btnLimparFiltrosServicos"
  );
  const corpoTabelaServicos = document.getElementById("corpoTabelaServicos");
  const nenhumServicoMsg = document.getElementById("nenhumServico");
  const btnNovoServico = document.getElementById("btnNovoServico");

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

  let bsModalConfirmacaoServico = null;
  let bsModalDesignarEncarregado = null;

  if (modalConfirmacaoServicoEl)
    bsModalConfirmacaoServico = new bootstrap.Modal(modalConfirmacaoServicoEl);
  if (modalDesignarEncarregadoEl)
    bsModalDesignarEncarregado = new bootstrap.Modal(
      modalDesignarEncarregadoEl
    );

  let operacaoConfirmacaoServico = null;
  let idServicoParaAcao = null;
  let subestacoesCache = [];
  let encarregadosCache = [];

  async function fetchData(url, options = {}) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: `Erro HTTP: ${response.status}` }));
        console.error(
          `[fetchData] Erro na resposta para ${url}:`,
          response.status,
          errorData
        );
        throw new Error(
          errorData.message || `Erro HTTP: ${response.status} em ${url}`
        );
      }
      if (response.status === 204) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error(`[fetchData] Exceção ao buscar dados de ${url}:`, error);
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
    if (typeof horaISO === "string" && horaISO.includes(":"))
      return horaISO.substring(0, 5);
    return "";
  }

  async function popularFiltroSubestacoes() {
    if (!filtroSubestacaoSelect) {
      console.warn(
        "[popularFiltroSubestacoes] Select de filtro de subestação não encontrado no DOM."
      );
      return;
    }
    try {
      subestacoesCache = (await fetchData("/subestacoes")) || [];
      filtroSubestacaoSelect.innerHTML = '<option value="">Todas</option>';
      subestacoesCache.forEach((sub) =>
        filtroSubestacaoSelect.add(
          new Option(`${sub.sigla} - ${sub.nome}`, sub.Id)
        )
      );
    } catch (error) {
      console.error(
        "[popularFiltroSubestacoes] Erro ao carregar subestações para filtro:",
        error
      );
      if (filtroSubestacaoSelect)
        filtroSubestacaoSelect.innerHTML =
          '<option value="">Erro ao carregar</option>';
    }
  }

  async function popularSelectEncarregadosParaDesignacao(selecionadoId = null) {
    if (!selectEncarregadoDesignar) {
      console.warn(
        "[popularSelectEncarregadosParaDesignacao] Select de designar encarregado não encontrado no DOM."
      );
      return;
    }
    try {
      if (encarregadosCache.length === 0)
        encarregadosCache = (await fetchData("/usuarios-encarregados")) || [];
      selectEncarregadoDesignar.innerHTML = '<option value="">Nenhum</option>';
      encarregadosCache.forEach((user) =>
        selectEncarregadoDesignar.add(new Option(user.nome, user.id))
      );
      if (
        selecionadoId &&
        selecionadoId !== "null" &&
        selecionadoId !== "undefined" &&
        selecionadoId !== ""
      ) {
        selectEncarregadoDesignar.value = String(selecionadoId);
      } else {
        selectEncarregadoDesignar.value = "";
      }
    } catch (error) {
      if (selectEncarregadoDesignar)
        selectEncarregadoDesignar.innerHTML =
          '<option value="">Erro ao carregar</option>';
      console.error(
        "[popularSelectEncarregadosParaDesignacao] Erro ao carregar encarregados:",
        error
      );
    }
  }

  async function carregarServicos(params = {}) {
    const corpoTabelaServicosLocal = document.getElementById(
      "corpoTabelaServicos"
    );
    const nenhumServicoMsgLocal = document.getElementById("nenhumServico");

    if (!corpoTabelaServicosLocal || !nenhumServicoMsgLocal) {
      console.error(
        "[carregarServicos] Elementos da tabela (corpoTabelaServicos ou nenhumServicoMsg) não encontrados no DOM!"
      );
      return;
    }
    corpoTabelaServicosLocal.innerHTML =
      '<tr><td colspan="10" class="text-center p-5"><div class="spinner-border spinner-border-sm text-primary" role="status"><span class="visually-hidden">Carregando...</span></div> Carregando serviços...</td></tr>';
    nenhumServicoMsgLocal.classList.add("d-none");
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach((key) => {
      if (params[key]) queryParams.append(key, params[key]);
    });

    const url = `/api/servicos-subestacoes?${queryParams.toString()}`;
    try {
      const servicos = await fetchData(url);
      popularTabelaServicos(servicos);
    } catch (error) {
      console.error(
        "[carregarServicos] Erro na chamada fetchData ou ao popular tabela:",
        error
      );
      if (corpoTabelaServicosLocal) {
        corpoTabelaServicosLocal.innerHTML =
          '<tr><td colspan="10" class="text-center text-danger p-5">Erro ao carregar os serviços. Verifique o console.</td></tr>';
      }
    }
  }

  function popularTabelaServicos(servicos) {
    const corpoTabelaServicosLocal = document.getElementById(
      "corpoTabelaServicos"
    );
    const nenhumServicoMsgLocal = document.getElementById("nenhumServico");

    if (!corpoTabelaServicosLocal || !nenhumServicoMsgLocal) {
      console.error(
        "[popularTabelaServicos] Elementos da tabela não encontrados no DOM ao tentar popular!"
      );
      return;
    }
    corpoTabelaServicosLocal.innerHTML = "";
    if (!servicos || servicos.length === 0) {
      nenhumServicoMsgLocal.classList.remove("d-none");
      return;
    }
    nenhumServicoMsgLocal.classList.add("d-none");

    servicos.forEach((serv) => {
      const tr = document.createElement("tr");
      const statusServ = (serv.status || "").toUpperCase();
      const podeConc = statusServ !== "CONCLUIDO" && statusServ !== "CANCELADO";
      const podeReab = statusServ === "CONCLUIDO" || statusServ === "CANCELADO";
      const statusCls = (serv.status || "desconhecido")
        .toLowerCase()
        .replace(/_/g, "");
      const statusTxt = (serv.status || "DESCONHECIDO").replace("_", " ");
      const btnConcHtml = `<button class="btn btn-icon text-${
        podeConc ? "success" : "muted"
      } btn-concluir-servico" data-id="${serv.id}" data-processo="${
        serv.processo
      }" title="Concluir" ${
        !podeConc ? "disabled" : ""
      }><span class="material-symbols-outlined">check_circle</span></button>`;
      const btnReabHtml = `<button class="btn btn-icon text-${
        podeReab ? "warning" : "muted"
      } btn-reabrir-servico" data-id="${serv.id}" data-processo="${
        serv.processo
      }" title="Reabrir" ${
        !podeReab ? "disabled" : ""
      }><span class="material-symbols-outlined">history</span></button>`;
      const dataPrevistaFormatada = serv.data_prevista
        ? new Date(serv.data_prevista + "T00:00:00Z").toLocaleDateString(
            "pt-BR",
            { timeZone: "UTC" }
          )
        : "-";

      tr.innerHTML = `
          <td class="text-center">${serv.id || "-"}</td>
          <td>${serv.processo || "-"}</td>
          <td>${serv.subestacao_sigla || serv.subestacao_id || "-"}</td>
          <td title="${serv.motivo || ""}">${(serv.motivo || "").substring(
        0,
        35
      )}${(serv.motivo || "").length > 35 ? "..." : ""}</td>
          <td>${dataPrevistaFormatada}</td>
          <td>${formatarHoraParaInput(serv.horario_inicio) || "-"} - ${
        formatarHoraParaInput(serv.horario_fim) || "-"
      }</td>
          <td>${serv.responsavel_nome || "-"}</td>
          <td>${serv.encarregado_designado_nome || "-"}</td>
          <td class="text-center"><span class="status-badge status-${statusCls}">${statusTxt}</span></td>
          <td class="text-center actions-column">
              <button class="btn btn-icon text-info btn-ver-detalhes" data-id="${
                serv.id
              }" title="Ver Detalhes"><span class="material-symbols-outlined">visibility</span></button>
              ${btnConcHtml}
              ${btnReabHtml}
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

      const btnVerDetalhes = tr.querySelector(".btn-ver-detalhes");
      if (btnVerDetalhes)
        btnVerDetalhes.addEventListener("click", (e) =>
          window.open(
            `/servicos/${e.currentTarget.dataset.id}/detalhes-pagina`,
            "_blank"
          )
        );

      const btnEditarServico = tr.querySelector(".btn-editar-servico");
      if (btnEditarServico)
        btnEditarServico.addEventListener(
          "click",
          (e) =>
            (window.location.href = `/registrar-servico-subestacao?editarId=${e.currentTarget.dataset.id}`)
        );

      const btnConcluir = tr.querySelector(".btn-concluir-servico");
      if (btnConcluir)
        btnConcluir.addEventListener("click", (e) =>
          abrirModalConfirmacaoConcluirServico(
            e.currentTarget.dataset.id,
            e.currentTarget.dataset.processo
          )
        );

      const btnReabrir = tr.querySelector(".btn-reabrir-servico");
      if (btnReabrir)
        btnReabrir.addEventListener("click", (e) =>
          abrirModalConfirmacaoReabrirServico(
            e.currentTarget.dataset.id,
            e.currentTarget.dataset.processo
          )
        );

      const btnAssignEncarregado = tr.querySelector(".btn-assign-encarregado");
      if (btnAssignEncarregado)
        btnAssignEncarregado.addEventListener("click", (e) =>
          abrirModalDesignarEncarregado(
            e.currentTarget.dataset.id,
            e.currentTarget.dataset.processo,
            e.currentTarget.dataset.encarregadoId
          )
        );

      const btnExcluir = tr.querySelector(".btn-excluir-servico");
      if (btnExcluir)
        btnExcluir.addEventListener("click", (e) =>
          confirmarExclusaoServico(
            e.currentTarget.dataset.id,
            e.currentTarget.dataset.processo
          )
        );

      if (corpoTabelaServicosLocal) corpoTabelaServicosLocal.appendChild(tr);
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

  if (btnNovoServico) {
    btnNovoServico.addEventListener("click", () => {
      window.location.href = "/registrar-servico-subestacao";
    });
  }

  function confirmarExclusaoServico(servicoId, processo) {
    if (
      !modalConfirmacaoServicoTitulo ||
      !mensagemConfirmacaoServico ||
      !formConfirmacaoConcluirServico ||
      !btnConfirmarAcaoServico ||
      !bsModalConfirmacaoServico
    ) {
      console.error(
        "[confirmarExclusaoServico] Elementos do modal de confirmação de exclusão não encontrados."
      );
      return;
    }
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
        console.error(`[operacaoConfirmacaoServico - Excluir] Erro:`, error);
        alert(`Falha ao excluir serviço: ${error.message}`);
      } finally {
        if (bsModalConfirmacaoServico) ocultarModal(bsModalConfirmacaoServico);
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonHtmlInner;
        idServicoParaAcao = null;
      }
    };
    if (bsModalConfirmacaoServico) mostrarModal(bsModalConfirmacaoServico);
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
    ) {
      console.error(
        "[abrirModalConfirmacaoConcluirServico] Elementos do modal de conclusão não encontrados."
      );
      return;
    }

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
    if (confirmacaoAnexosInput) confirmacaoAnexosInput.value = "";
    if (listaNomesAnexosConclusao) listaNomesAnexosConclusao.innerHTML = "";
    btnConfirmarAcaoServico.className = "btn btn-sm btn-success";
    btnConfirmarAcaoServico.innerHTML =
      '<span class="material-symbols-outlined">check_circle</span> Confirmar Conclusão';
    operacaoConfirmacaoServico = handleConcluirServico;
    if (bsModalConfirmacaoServico) mostrarModal(bsModalConfirmacaoServico);
  }

  async function handleConcluirServico() {
    if (
      !idServicoParaAcao ||
      !confirmacaoDataConclusaoInput ||
      !confirmacaoHoraConclusaoInput ||
      !confirmacaoObservacoesTextarea ||
      !confirmacaoAnexosInput ||
      !btnConfirmarAcaoServico
    ) {
      console.error(
        "[handleConcluirServico] Campos necessários para concluir não encontrados."
      );
      return;
    }
    const dataConclusaoManual = confirmacaoDataConclusaoInput.value;
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
    if (confirmacaoHoraConclusaoInput.value)
      formData.append(
        "hora_conclusao_manual",
        confirmacaoHoraConclusaoInput.value
      );
    if (confirmacaoObservacoesTextarea.value)
      formData.append(
        "observacoes_conclusao_manual",
        confirmacaoObservacoesTextarea.value
      );

    if (
      confirmacaoAnexosInput.files &&
      confirmacaoAnexosInput.files.length > 0
    ) {
      for (let i = 0; i < confirmacaoAnexosInput.files.length; i++) {
        formData.append(
          "anexos_conclusao_servico",
          confirmacaoAnexosInput.files[i]
        );
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
      if (bsModalConfirmacaoServico) ocultarModal(bsModalConfirmacaoServico);
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
      console.error(`[handleConcluirServico] Erro ao concluir:`, error);
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
    ) {
      console.error(
        "[abrirModalConfirmacaoReabrirServico] Elementos do modal de reabertura não encontrados."
      );
      return;
    }
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
    if (bsModalConfirmacaoServico) mostrarModal(bsModalConfirmacaoServico);
  }

  async function handleReabrirServico() {
    if (!idServicoParaAcao || !btnConfirmarAcaoServico) {
      console.error(
        "[handleReabrirServico] ID do serviço para ação não encontrado."
      );
      return;
    }
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
      if (bsModalConfirmacaoServico) ocultarModal(bsModalConfirmacaoServico);
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
      console.error(`[handleReabrirServico] Erro ao reabrir:`, error);
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
    ) {
      console.error(
        "[abrirModalDesignarEncarregado] Elementos do modal de designação não encontrados."
      );
      return;
    }
    servicoIdParaDesignacaoInput.value = servicoId;
    processoServicoParaDesignacaoSpan.textContent =
      processoServico || servicoId;
    await popularSelectEncarregadosParaDesignacao(encarregadoAtualId);
    mostrarModal(bsModalDesignarEncarregado);
    if (selectEncarregadoDesignar) selectEncarregadoDesignar.focus();
  }

  if (btnSalvarDesignacaoEncarregado) {
    btnSalvarDesignacaoEncarregado.addEventListener("click", async () => {
      if (!servicoIdParaDesignacaoInput || !selectEncarregadoDesignar) {
        console.error(
          "[btnSalvarDesignacaoEncarregado] Inputs necessários não encontrados."
        );
        return;
      }
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
        if (bsModalDesignarEncarregado)
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
        console.error(
          `[btnSalvarDesignacaoEncarregado] Erro ao salvar designação:`,
          error
        );
        alert(`Falha ao designar encarregado: ${error.message}`);
      } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonHtml;
      }
    });
  }

  if (confirmacaoAnexosInput && listaNomesAnexosConclusao) {
    confirmacaoAnexosInput.addEventListener("change", (event) => {
      listaNomesAnexosConclusao.innerHTML = "";
      if (event.target.files.length > 0) {
        Array.from(event.target.files).forEach((file) => {
          const li = document.createElement("li");
          li.className =
            "list-group-item d-flex justify-content-between align-items-center py-1";
          li.innerHTML = `<div><span class="material-symbols-outlined me-1 small align-middle">draft</span>${
            file.name
          }</div><small class="text-muted">${(file.size / 1024).toFixed(
            1
          )}KB</small>`;
          listaNomesAnexosConclusao.appendChild(li);
        });
      }
    });
  }

  if (btnConfirmarAcaoServico && bsModalConfirmacaoServico) {
    btnConfirmarAcaoServico.addEventListener("click", () => {
      if (typeof operacaoConfirmacaoServico === "function") {
        operacaoConfirmacaoServico();
      } else {
        console.warn(
          "[btnConfirmarAcaoServico] operacaoConfirmacaoServico não é uma função no momento do clique."
        );
      }
    });
  }

  async function init() {
    await popularFiltroSubestacoes();
    await carregarServicos();
  }
  init();
});
