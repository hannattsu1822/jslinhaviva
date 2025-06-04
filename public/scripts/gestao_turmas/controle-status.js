document.addEventListener("DOMContentLoaded", () => {
  const formNovoStatus = document.getElementById("formNovoStatus");
  const formFiltros = document.getElementById("formFiltros");
  const tabelaStatusBody = document.querySelector("#tabelaStatus tbody");
  const loadingMessage = document.getElementById("loadingMessage");
  const noResultsMessage = document.getElementById("noResultsMessage");

  const selectSelecaoTurmaForm = document.getElementById("selecaoTurmaForm"); // Novo select de turma no formulário
  const selectFuncionario = document.getElementById("funcionario");

  const selectTipoStatus = document.getElementById("tipoStatus");
  const selectFiltroTipoStatus = document.getElementById("filtroTipoStatus");
  const selectFiltroTurma = document.getElementById("filtroTurma");
  const filtroTurmaContainer = document.getElementById("filtroTurmaContainer");
  const editStatusIdInput = document.getElementById("editStatusId");
  const btnSalvarStatus = document.getElementById("btnSalvarStatus");
  const btnCancelarEdicao = document.getElementById("btnCancelarEdicao");
  const btnLimparFiltros = document.getElementById("btnLimparFiltros");
  const toastElement = document.getElementById("toast");

  let userData = null;
  let toastTimeout;
  let todosOsFuncionariosCache = []; // Cache para todos os funcionários

  function showToast(message, type = "success") {
    if (toastTimeout) clearTimeout(toastTimeout);
    toastElement.textContent = message;
    toastElement.className = "toast show";
    if (type === "error") {
      toastElement.classList.add("error");
    } else if (type === "success") {
      toastElement.classList.add("success");
    }

    toastTimeout = setTimeout(() => {
      toastElement.className = "toast";
    }, 3500);
  }

  async function fetchAPI(url, options = {}) {
    try {
      const response = await fetch(url, options);
      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          responseData.message || `Erro ${response.status} ao acessar ${url}`
        );
      }
      return responseData;
    } catch (error) {
      console.error(`Erro na API ${url}:`, error);
      showToast(
        error.message || "Erro de comunicação com o servidor.",
        "error"
      );
      throw error;
    }
  }

  async function fetchInitialData() {
    try {
      [userData, todosOsFuncionariosCache, tiposStatus] = await Promise.all([
        fetchAPI("/api/user-info"),
        fetchAPI("/api/turmas"),
        fetchAPI("/api/status-tipos"),
      ]);

      populateTiposStatusDropdowns(tiposStatus);
      configureUiBasedOnRole(); // Configura filtros e o formulário de novo status
    } catch (error) {
      showToast("Erro ao carregar dados iniciais da página.", "error");
    }
  }

  function configureUiBasedOnRole() {
    if (!userData || !userData.cargo) {
      populateSelecaoTurmaForm();
      return;
    }
    const privilegedRoles = [
      "ADMIN",
      "Gerente",
      "Inspetor",
      "Engenheiro",
      "Técnico",
    ];
    const isPrivileged =
      privilegedRoles.includes(userData.cargo) ||
      (userData.turma_encarregado &&
        userData.turma_encarregado.toString() === "2193");

    if (isPrivileged) {
      filtroTurmaContainer.style.display = "block";
      populateTurmasFilter(todosOsFuncionariosCache); // Para filtros
      populateSelecaoTurmaForm(todosOsFuncionariosCache, null); // Para formulário de novo status, permite selecionar qualquer turma
    } else {
      filtroTurmaContainer.style.display = "none";
      populateSelecaoTurmaForm(
        todosOsFuncionariosCache,
        userData.turma_encarregado
      ); // Para formulário, limita à turma do encarregado
      if (userData.turma_encarregado) {
        selectSelecaoTurmaForm.value = userData.turma_encarregado;
        selectSelecaoTurmaForm.dispatchEvent(new Event("change")); // Dispara a carga de funcionários
        // selectSelecaoTurmaForm.disabled = true; // Opcional: desabilitar se só pode gerenciar a própria turma
      }
    }
  }

  function populateTurmasFilter(funcionarios) {
    // Para a seção de filtros da tabela
    const turmasUnicasMap = new Map();
    funcionarios.forEach((t) => {
      if (t.turma_encarregado) {
        if (!turmasUnicasMap.has(t.turma_encarregado)) {
          const encarregadoInfo = funcionarios.find(
            (enc) =>
              enc.matricula === t.turma_encarregado &&
              (enc.cargo === "Encarregado" ||
                enc.cargo === "Gerente" ||
                enc.cargo === "ADMIN")
          );
          turmasUnicasMap.set(
            t.turma_encarregado,
            encarregadoInfo
              ? `${t.turma_encarregado} (${encarregadoInfo.nome})`
              : t.turma_encarregado
          );
        }
      }
    });

    const turmasOrdenadas = [...turmasUnicasMap.entries()].sort((a, b) =>
      String(a[1]).localeCompare(String(b[1]))
    );

    selectFiltroTurma.innerHTML = '<option value="">Todas as Turmas</option>';
    turmasOrdenadas.forEach(([value, text]) => {
      selectFiltroTurma.add(new Option(text, value));
    });
  }

  function populateSelecaoTurmaForm(funcionarios, turmaEspecifica = null) {
    // Para o formulário de novo status
    const turmasUnicasMap = new Map();

    let turmasConsideradas = funcionarios;
    if (turmaEspecifica) {
      // Se um Encarregado não privilegiado, só mostra sua turma
      turmasConsideradas = funcionarios.filter(
        (f) => f.turma_encarregado === turmaEspecifica
      );
      if (turmasConsideradas.length > 0) {
        // Adiciona a turma específica ao mapa
        const encarregadoInfo = funcionarios.find(
          (enc) =>
            enc.matricula === turmaEspecifica &&
            (enc.cargo === "Encarregado" ||
              enc.cargo === "Gerente" ||
              enc.cargo === "ADMIN")
        );
        turmasUnicasMap.set(
          turmaEspecifica,
          encarregadoInfo
            ? `${turmaEspecifica} (${encarregadoInfo.nome})`
            : turmaEspecifica
        );
      }
    } else {
      // Admins e privilegiados veem todas
      funcionarios.forEach((t) => {
        if (t.turma_encarregado) {
          if (!turmasUnicasMap.has(t.turma_encarregado)) {
            const encarregadoInfo = funcionarios.find(
              (enc) =>
                enc.matricula === t.turma_encarregado &&
                (enc.cargo === "Encarregado" ||
                  enc.cargo === "Gerente" ||
                  enc.cargo === "ADMIN")
            );
            turmasUnicasMap.set(
              t.turma_encarregado,
              encarregadoInfo
                ? `${t.turma_encarregado} (${encarregadoInfo.nome})`
                : t.turma_encarregado
            );
          }
        }
      });
    }

    const turmasOrdenadas = [...turmasUnicasMap.entries()].sort((a, b) =>
      String(a[1]).localeCompare(String(b[1]))
    );

    selectSelecaoTurmaForm.innerHTML =
      '<option value="">Selecione uma turma</option>';
    turmasOrdenadas.forEach(([value, text]) => {
      selectSelecaoTurmaForm.add(new Option(text, value));
    });

    if (turmaEspecifica && turmasUnicasMap.has(turmaEspecifica)) {
      selectSelecaoTurmaForm.value = turmaEspecifica;
      // Opcional: desabilitar se o encarregado só puder escolher sua turma
      // selectSelecaoTurmaForm.disabled = true;
      populateFuncionariosPorTurma(turmaEspecifica); // Popula funcionários automaticamente
    } else {
      selectFuncionario.innerHTML =
        '<option value="">Selecione uma turma primeiro</option>';
      selectFuncionario.disabled = true;
    }
  }

  function populateFuncionariosPorTurma(turmaId) {
    selectFuncionario.innerHTML = '<option value="">Carregando...</option>';
    selectFuncionario.disabled = true;

    if (!turmaId) {
      selectFuncionario.innerHTML =
        '<option value="">Selecione uma turma</option>';
      return;
    }

    const funcionariosDaTurma = todosOsFuncionariosCache.filter(
      (f) => f.turma_encarregado === turmaId
    );

    if (funcionariosDaTurma.length === 0) {
      selectFuncionario.innerHTML =
        '<option value="">Nenhum funcionário nesta turma</option>';
      return;
    }

    selectFuncionario.innerHTML =
      '<option value="">Selecione um funcionário</option>';
    funcionariosDaTurma
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .forEach((func) => {
        selectFuncionario.add(
          new Option(`${func.nome} (${func.matricula})`, func.matricula)
        );
      });
    selectFuncionario.disabled = false;
  }

  selectSelecaoTurmaForm.addEventListener("change", function () {
    populateFuncionariosPorTurma(this.value);
  });

  function populateTiposStatusDropdowns(tipos) {
    selectTipoStatus.innerHTML = '<option value="">Selecione um tipo</option>';
    selectFiltroTipoStatus.innerHTML =
      '<option value="">Todos os Tipos</option>';
    tipos.forEach((tipo) => {
      const tipoFormatado = tipo
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      selectTipoStatus.add(new Option(tipoFormatado, tipo));
      selectFiltroTipoStatus.add(new Option(tipoFormatado, tipo));
    });
  }

  async function carregarStatus(filtros = {}) {
    loadingMessage.style.display = "block";
    noResultsMessage.style.display = "none";
    tabelaStatusBody.innerHTML = "";

    const queryParams = new URLSearchParams();
    if (filtros.turma) queryParams.append("turma", filtros.turma);
    if (filtros.matricula) queryParams.append("matricula", filtros.matricula);
    if (filtros.dataInicial)
      queryParams.append("dataInicial", filtros.dataInicial);
    if (filtros.dataFinal) queryParams.append("dataFinal", filtros.dataFinal);
    if (filtros.tipo_status)
      queryParams.append("tipo_status", filtros.tipo_status);

    try {
      const statusRegistros = await fetchAPI(
        `/api/controle-status?${queryParams.toString()}`
      );
      loadingMessage.style.display = "none";
      if (statusRegistros.length === 0) {
        noResultsMessage.style.display = "block";
        return;
      }

      statusRegistros.forEach((reg) => {
        const row = tabelaStatusBody.insertRow();
        row.insertCell().textContent = reg.nome_funcionario || "N/A";
        row.insertCell().textContent = reg.matricula_funcionario;
        row.insertCell().textContent = reg.cargo_funcionario || "N/A";
        row.insertCell().textContent = reg.turma_encarregado || "N/A";
        const tipoStatusFormatado = reg.tipo_status
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        row.insertCell().textContent = tipoStatusFormatado;
        row.insertCell().textContent = reg.data_inicio_formatada;
        row.insertCell().textContent = reg.data_fim_formatada;
        row.insertCell().textContent = reg.observacao || "";
        row.insertCell().textContent = reg.registrado_por_matricula;
        row.insertCell().textContent = new Date(
          reg.registrado_em
        ).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

        const actionsCell = row.insertCell();
        actionsCell.classList.add("actions-cell");

        const editButton = document.createElement("button");
        editButton.classList.add("btn-edit");
        editButton.title = "Editar";
        editButton.innerHTML = '<i class="material-icons">edit</i>';
        editButton.onclick = () => preencherFormParaEdicao(reg);

        const deleteButton = document.createElement("button");
        deleteButton.classList.add("btn-delete");
        deleteButton.title = "Remover";
        deleteButton.innerHTML = '<i class="material-icons">delete</i>';
        deleteButton.onclick = () =>
          removerStatus(
            reg.id,
            reg.nome_funcionario,
            reg.matricula_funcionario
          );

        actionsCell.appendChild(editButton);
        actionsCell.appendChild(deleteButton);
      });
    } catch (error) {
      loadingMessage.style.display = "none";
      noResultsMessage.style.display = "block";
    }
  }

  formNovoStatus.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(formNovoStatus);
    const dados = Object.fromEntries(formData.entries());

    delete dados.selecao_turma_form; // Remover o campo auxiliar de turma do envio

    const id = dados.editStatusId;
    let url = "/api/controle-status";
    let method = "POST";

    if (id) {
      url += `/${id}`;
      method = "PUT";
    }
    delete dados.editStatusId;

    if (!dados.matricula_funcionario) {
      showToast("Por favor, selecione um funcionário.", "error");
      return;
    }
    if (new Date(dados.data_inicio) > new Date(dados.data_fim)) {
      showToast("Data de início não pode ser maior que a data fim.", "error");
      return;
    }

    btnSalvarStatus.disabled = true;
    btnSalvarStatus.innerHTML = `<i class="material-icons spin">sync</i> ${
      id ? "Atualizando..." : "Salvando..."
    }`;
    try {
      const result = await fetchAPI(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
      showToast(result.message, "success");
      formNovoStatus.reset();
      resetFormState();
      carregarStatus();
    } catch (error) {
    } finally {
      btnSalvarStatus.disabled = false;
      btnSalvarStatus.innerHTML = "Salvar Status";
    }
  });

  function resetFormState() {
    editStatusIdInput.value = "";
    btnSalvarStatus.innerHTML = "Salvar Status";
    btnCancelarEdicao.style.display = "none";

    selectSelecaoTurmaForm.value = "";
    // selectSelecaoTurmaForm.disabled = (userData && userData.cargo === "Encarregado" && !( privilegedRoles.includes(userData.cargo) || (userData.turma_encarregado && userData.turma_encarregado.toString() === "2193")));

    selectFuncionario.innerHTML =
      '<option value="">Selecione uma turma</option>';
    selectFuncionario.disabled = true;
    selectFuncionario.value = "";

    selectTipoStatus.value = "";
    document.getElementById("observacao").value = "";
    document.getElementById("dataInicio").value = "";
    document.getElementById("dataFim").value = "";

    // Se for encarregado não privilegiado, repopular sua turma e funcionários
    const privilegedRolesCheck = [
      "ADMIN",
      "Gerente",
      "Inspetor",
      "Engenheiro",
      "Técnico",
    ]; // Recheck
    if (
      userData &&
      userData.cargo === "Encarregado" &&
      !(
        privilegedRolesCheck.includes(userData.cargo) ||
        (userData.turma_encarregado &&
          userData.turma_encarregado.toString() === "2193")
      )
    ) {
      if (userData.turma_encarregado) {
        selectSelecaoTurmaForm.value = userData.turma_encarregado;
        populateFuncionariosPorTurma(userData.turma_encarregado);
        // selectSelecaoTurmaForm.disabled = true;
      }
    } else {
      // selectSelecaoTurmaForm.disabled = false;
    }
  }

  async function preencherFormParaEdicao(status) {
    formNovoStatus.scrollIntoView({ behavior: "smooth", block: "start" });
    editStatusIdInput.value = status.id;

    const funcionarioEditado = todosOsFuncionariosCache.find(
      (f) => f.matricula === status.matricula_funcionario
    );
    const turmaDoFuncionarioEditado = funcionarioEditado
      ? funcionarioEditado.turma_encarregado
      : null;

    if (turmaDoFuncionarioEditado) {
      selectSelecaoTurmaForm.value = turmaDoFuncionarioEditado;
      await populateFuncionariosPorTurma(turmaDoFuncionarioEditado); // Espera popular
      selectFuncionario.value = status.matricula_funcionario;
    } else {
      // Se o funcionário não tem turma_encarregado (ou não está no cache), tenta popular todos
      // ou uma mensagem de erro. Por agora, limpamos.
      selectSelecaoTurmaForm.value = "";
      selectFuncionario.innerHTML =
        '<option value="">Funcionário não encontrado ou sem turma</option>';
      selectFuncionario.disabled = true;
    }

    document.getElementById("dataInicio").value =
      status.data_inicio.split("T")[0];
    document.getElementById("dataFim").value = status.data_fim.split("T")[0];
    selectTipoStatus.value = status.tipo_status;
    document.getElementById("observacao").value = status.observacao || "";

    btnSalvarStatus.innerHTML = "Atualizar Status";
    btnCancelarEdicao.style.display = "inline-flex"; // Ajustado para flex
  }

  btnCancelarEdicao.addEventListener("click", () => {
    formNovoStatus.reset(); // Limpa campos input
    resetFormState(); // Reseta selects e estado do formulário
  });

  async function removerStatus(id, nome, matricula) {
    const displayName = nome || `funcionário matrícula ${matricula}`;
    if (
      !confirm(`Tem certeza que deseja remover o status para ${displayName}?`)
    ) {
      return;
    }
    try {
      const result = await fetchAPI(`/api/controle-status/${id}`, {
        method: "DELETE",
      });
      showToast(result.message, "success");
      carregarStatus();
    } catch (error) {}
  }

  formFiltros.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(formFiltros);
    const filtros = Object.fromEntries(formData.entries());
    carregarStatus(filtros);
  });

  btnLimparFiltros.addEventListener("click", () => {
    formFiltros.reset();
    carregarStatus();
  });

  async function init() {
    await fetchInitialData(); // Carrega user, todas as turmas/funcionários, e tipos de status
    carregarStatus(); // Carrega a tabela de status
  }

  init();
});
