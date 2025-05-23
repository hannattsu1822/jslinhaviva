let accessDeniedModalInstance;
let developmentModalInstance;
let currentDiarias = [];
let diariaFetchController = null;
let listenersInitialized = false;
let user = null;
let currentUserIsPrivileged = false;

function showAlert(message, type = "success", duration = 3000) {
  const toastLiveEl = document.getElementById("liveToast");
  if (!toastLiveEl) {
    alert(`${type.toUpperCase()}: ${message}`);
    return;
  }
  let toastInstance = bootstrap.Toast.getOrCreateInstance(toastLiveEl);
  const toastBody = toastLiveEl.querySelector(".toast-body");

  if (toastBody) toastBody.textContent = message;

  toastLiveEl.className = "toast align-items-center";
  if (type === "success")
    toastLiveEl.classList.add("text-bg-success", "border-0");
  else if (type === "danger")
    toastLiveEl.classList.add("text-bg-danger", "border-0");
  else if (type === "warning")
    toastLiveEl.classList.add("text-bg-warning", "border-0");
  else toastLiveEl.classList.add("text-bg-info", "border-0");

  toastInstance.show();
  if (duration > 0 && type !== "danger") {
    setTimeout(() => {
      if (toastInstance) toastInstance.hide();
    }, duration);
  }
}

function initializePageListeners() {
  const turmaSelectEl = document.getElementById("turmaSelect");
  if (turmaSelectEl)
    turmaSelectEl.addEventListener("change", handleTurmaChange);

  const addDiariaFormEl = document.getElementById("addDiariaForm");
  if (addDiariaFormEl)
    addDiariaFormEl.addEventListener("submit", handleFormSubmit);

  const filtroFormEl = document.getElementById("filtroForm");
  if (filtroFormEl) {
    filtroFormEl.addEventListener("submit", function (e) {
      e.preventDefault();
      loadDiarias();
    });
  }

  const addDiariaBtn = document.getElementById("addDiariaBtn");
  if (addDiariaBtn) addDiariaBtn.addEventListener("click", openAddModal);

  const exportPdfBtn = document.getElementById("exportPdfBtn");
  if (exportPdfBtn) exportPdfBtn.addEventListener("click", exportToPDF);
}

function handleTurmaChange() {
  const turma = this.value;
  const funcionariosContainer = document.getElementById(
    "funcionariosCheckboxContainer"
  );

  if (funcionariosContainer) {
    funcionariosContainer.innerHTML =
      '<small class="text-muted">Carregando funcionários...</small>';
    if (turma) {
      loadFuncionariosPorTurma(turma, funcionariosContainer);
    } else {
      funcionariosContainer.innerHTML =
        '<small class="text-muted">Selecione uma turma para listar os funcionários.</small>';
    }
  }
}

async function loadFuncionariosPorTurma(turma, container) {
  if (!turma || !container) return;
  container.innerHTML = '<small class="text-muted">Carregando...</small>';

  try {
    const response = await fetch(
      `/api/funcionarios_por_turma/${encodeURIComponent(turma)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );
    if (!response.ok) throw new Error("Erro ao carregar funcionários da turma");
    const funcionarios = await response.json();
    container.innerHTML = "";

    if (funcionarios.length === 0) {
      container.innerHTML =
        '<small class="text-muted">Nenhum funcionário encontrado nesta turma.</small>';
      return;
    }

    funcionarios.forEach((func) => {
      const div = document.createElement("div");
      div.className = "form-check";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "form-check-input";
      checkbox.value = func.matricula;
      checkbox.id = `func-check-${func.matricula}`;
      checkbox.dataset.nome = func.nome;
      checkbox.dataset.cargo = func.cargo;

      const label = document.createElement("label");
      label.className = "form-check-label";
      label.htmlFor = `func-check-${func.matricula}`;
      label.textContent = `${func.nome} (${func.matricula}) - ${
        func.cargo || "N/A"
      }`;

      div.appendChild(checkbox);
      div.appendChild(label);
      container.appendChild(div);
    });
  } catch (error) {
    console.error("Erro ao carregar funcionários por turma:", error);
    showAlert("Erro ao carregar funcionários: " + error.message, "danger");
    container.innerHTML =
      '<small class="text-danger">Erro ao carregar funcionários.</small>';
  }
}

function handleFormSubmit(e) {
  e.preventDefault();
  addDiaria();
}

function ensureSingleLoad() {
  if (diariaFetchController) diariaFetchController.abort();
  diariaFetchController = new AbortController();
  return diariaFetchController.signal;
}

function loadProcessosNoFiltro() {
  const filtroDatalist = document.getElementById("filtroProcessosOptions");
  if (filtroDatalist) {
    filtroDatalist.innerHTML = "";
  }
}

function loadDiarias() {
  const turmaEl = document.getElementById("filtroTurma");
  const dataInicialEl = document.getElementById("filtroDataInicial");
  const dataFinalEl = document.getElementById("filtroDataFinal");
  const processoEl = document.getElementById("filtroProcesso");
  const matriculaEl = document.getElementById("filtroMatricula");
  const qsCheckbox = document.getElementById("qsCheckbox");
  const qdCheckbox = document.getElementById("qdCheckbox");
  const warningElement = document.getElementById("filterWarning");
  const tableBody = document.getElementById("diariasTableBody");

  if (!tableBody || !warningElement) return;

  let turma = turmaEl ? turmaEl.value : "";
  const dataInicial = dataInicialEl ? dataInicialEl.value : "";
  const dataFinal = dataFinalEl ? dataFinalEl.value : "";
  const processo = processoEl ? processoEl.value : "";
  const matricula = matriculaEl ? matriculaEl.value : "";
  const qs = qsCheckbox ? qsCheckbox.checked : false;
  const qd = qdCheckbox ? qdCheckbox.checked : false;

  if (user && user.cargo === "Encarregado" && !currentUserIsPrivileged) {
    turma = user.matricula;
  }

  if (
    !turma &&
    !dataInicial &&
    !dataFinal &&
    !processo &&
    !matricula &&
    !qs &&
    !qd
  ) {
    warningElement.style.display = "block";
    tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">Selecione pelo menos um filtro para visualizar as diárias</td></tr>`;
    currentDiarias = [];
    return;
  }
  warningElement.style.display = "none";

  const signal = ensureSingleLoad();
  let url = "/api/diarias?";
  const params = [];
  if (turma) params.push(`turma=${encodeURIComponent(turma)}`);
  if (dataInicial) params.push(`dataInicial=${dataInicial}`);
  if (dataFinal) params.push(`dataFinal=${dataFinal}`);
  if (processo) params.push(`processo=${encodeURIComponent(processo)}`);
  if (matricula) params.push(`matricula=${encodeURIComponent(matricula)}`);
  if (qs) params.push(`qs=${qs}`);
  if (qd) params.push(`qd=${qd}`);
  params.push("ordenar=data_asc");
  url += params.join("&");

  tableBody.innerHTML =
    '<tr><td colspan="8" class="text-center py-4"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Carregando...</span></div></td></tr>';

  fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    signal: signal,
  })
    .then((response) => {
      if (!response.ok)
        throw new Error(`Erro na resposta do servidor: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      if (!Array.isArray(data)) throw new Error("Dados inválidos recebidos");
      currentDiarias = data;
      if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">Nenhuma diária encontrada com os filtros aplicados</td></tr>`;
      } else {
        renderDiariasTable(data);
      }
    })
    .catch((error) => {
      if (error.name !== "AbortError") {
        console.error("Erro ao carregar diárias:", error);
        showAlert("Erro ao carregar diárias: " + error.message, "danger");
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Erro ao carregar diárias: ${error.message}</td></tr>`;
      }
    });
}

function renderDiariasTable(diarias) {
  const tableBody = document.getElementById("diariasTableBody");
  if (!tableBody) return;
  tableBody.innerHTML = "";

  diarias.sort((a, b) => {
    const matriculaComp = (a.matricula || "").localeCompare(b.matricula || "");
    if (matriculaComp !== 0) {
      return matriculaComp;
    }
    const dateA = new Date(a.data);
    const dateB = new Date(b.data);
    return dateA - dateB;
  });

  let currentMatricula = null;
  diarias.forEach((diaria) => {
    if (currentMatricula !== diaria.matricula) {
      currentMatricula = diaria.matricula;
      const groupHeaderRow = document.createElement("tr");
      groupHeaderRow.className = "diaria-group-header";
      groupHeaderRow.style.backgroundColor = "var(--light-blue-diarias)";
      groupHeaderRow.style.color = "var(--primary-blue-diarias)";
      groupHeaderRow.style.fontWeight = "bold";
      groupHeaderRow.innerHTML = `
        <td colspan="3">Funcionário: ${diaria.nome || "N/A"} (${
        diaria.matricula || "N/A"
      }) - Cargo: ${diaria.cargo || "N/A"}</td>
        <td colspan="5"></td>
      `;
      tableBody.appendChild(groupHeaderRow);
    }

    const row = document.createElement("tr");
    const dataFormatada =
      diaria.data_formatada ||
      (diaria.data
        ? new Date(diaria.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })
        : "N/A");
    row.innerHTML = `
      <td>${diaria.matricula || "N/A"}</td>
      <td>${diaria.nome || "N/A"}</td>
      <td>${diaria.cargo || "N/A"}</td>
      <td>${dataFormatada}</td>
      <td class="text-center">${
        diaria.qs ? '<i class="fas fa-check text-success"></i>' : ""
      }</td>
      <td class="text-center">${
        diaria.qd ? '<i class="fas fa-check text-success"></i>' : ""
      }</td>
      <td>${diaria.processo || "N/A"}</td>
      <td class="text-end">
        <button onclick="window.confirmDelete(${diaria.id}, '${String(
      diaria.nome || ""
    ).replace(/'/g, "\\'")}')" 
            class="btn btn-sm btn-outline-danger" title="Remover diária">
            <i class="fas fa-trash-alt"></i>
        </button>
      </td>`;
    tableBody.appendChild(row);
  });
}

let isAddingDiariaFlag = false;
async function addDiaria() {
  if (isAddingDiariaFlag) return;
  isAddingDiariaFlag = true;

  const submitButton = document.querySelector(
    '#addDiariaForm button[type="submit"]'
  );
  const submitSpinner = document.getElementById("submitSpinner");
  const submitButtonText = document.getElementById("submitButtonText");

  let originalButtonText = "Salvar";
  if (submitButtonText) originalButtonText = submitButtonText.textContent;

  if (submitSpinner) submitSpinner.classList.remove("d-none");
  if (submitButtonText) submitButtonText.textContent = "Salvando...";
  if (submitButton) submitButton.disabled = true;

  const turma = document.getElementById("turmaSelect")?.value;
  const data = document.getElementById("diariaData")?.value;
  const processo = document.getElementById("processoSelect")?.value;
  const qs = document.getElementById("modalQsCheckbox")?.checked;
  const qd = document.getElementById("modalQdCheckbox")?.checked;

  const selectedFuncionariosMatriculas = [];
  const checkboxes = document.querySelectorAll(
    "#funcionariosCheckboxContainer .form-check-input:checked"
  );

  checkboxes.forEach((checkbox) => {
    selectedFuncionariosMatriculas.push(checkbox.value);
  });

  if (
    !turma ||
    selectedFuncionariosMatriculas.length === 0 ||
    !data ||
    !processo ||
    (!qs && !qd)
  ) {
    showAlert(
      "Preencha todos os campos obrigatórios (Turma, pelo menos um Funcionário, Data, Processo) e marque pelo menos um tipo de diária (QS/QD)!",
      "danger"
    );
    if (submitSpinner) submitSpinner.classList.add("d-none");
    if (submitButtonText) submitButtonText.textContent = originalButtonText;
    if (submitButton) submitButton.disabled = false;
    isAddingDiariaFlag = false;
    return;
  }

  const signal = ensureSingleLoad();
  const requests = [];

  selectedFuncionariosMatriculas.forEach((funcMatricula) => {
    requests.push(
      fetch("/api/diarias", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          data,
          processo,
          matricula: funcMatricula,
          qs,
          qd,
        }),
        signal: signal,
      })
    );
  });

  Promise.all(requests)
    .then((responses) =>
      Promise.all(
        responses.map(async (res) => {
          if (!res.ok) {
            if (res.status === 0)
              throw new Error("Não foi possível conectar ao servidor.");
            const errorData = await res.json().catch(() => ({}));
            return {
              error: true,
              status: res.status,
              message:
                errorData.message || `Erro ${res.status} ao adicionar diária.`,
            };
          }
          return res.json();
        })
      )
    )
    .then((results) => {
      const successCount = results.filter((r) => !r.error && r.message).length;
      const errorCount = results.filter((r) => r.error).length;
      let message = "";
      if (successCount > 0)
        message += `${successCount} diária(s) adicionada(s) com sucesso! `;
      if (errorCount > 0) {
        message += `${errorCount} falha(s) ao adicionar diária(s).`;
        results
          .filter((r) => r.error)
          .forEach((err) =>
            console.error(
              `Falha ao adicionar diária (Status: ${err.status}): ${err.message}`
            )
          );
      }

      showAlert(
        message || "Operação finalizada.",
        successCount > 0 && errorCount === 0
          ? "success"
          : errorCount > 0 && successCount === 0
          ? "danger"
          : "warning"
      );

      if (successCount > 0) {
        const modalEl = document.getElementById("addDiariaModal");
        if (modalEl) {
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
        }
        const addForm = document.getElementById("addDiariaForm");
        if (addForm) addForm.reset();

        const funcionariosContainer = document.getElementById(
          "funcionariosCheckboxContainer"
        );
        if (funcionariosContainer) {
          funcionariosContainer.innerHTML =
            '<small class="text-muted">Selecione uma turma para listar os funcionários.</small>';
        }
        const procOpt = document.getElementById("processosOptions");
        if (procOpt) procOpt.innerHTML = "";
        const qsCheck = document.getElementById("modalQsCheckbox");
        if (qsCheck) qsCheck.checked = false;
        const qdCheck = document.getElementById("modalQdCheckbox");
        if (qdCheck) qdCheck.checked = false;
        const diariaDataInput = document.getElementById("diariaData");
        if (diariaDataInput)
          diariaDataInput.value = new Date().toISOString().split("T")[0];
        loadDiarias();
      }
    })
    .catch((error) => {
      if (error.name !== "AbortError") {
        console.error("Erro ao adicionar diária(s):", error);
        showAlert(error.message || "Erro ao adicionar diária(s)", "danger");
      }
    })
    .finally(() => {
      if (submitSpinner) submitSpinner.classList.add("d-none");
      if (submitButtonText) submitButtonText.textContent = originalButtonText;
      if (submitButton) submitButton.disabled = false;
      isAddingDiariaFlag = false;
    });
}

window.confirmDelete = function (id, nome) {
  const modalEl = document.getElementById("confirmModal");
  if (!modalEl) return;
  const modalTitle = modalEl.querySelector(".modal-title");
  const modalBody = modalEl.querySelector(".modal-body");
  const confirmBtn = modalEl.querySelector("#confirmModalButton");

  if (modalTitle) modalTitle.textContent = "Confirmar Exclusão";
  if (modalBody)
    modalBody.textContent = `Tem certeza que deseja remover a diária de ${nome}?`;

  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
  newConfirmBtn.addEventListener("click", function () {
    deleteDiaria(id);
  });

  const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
  bsModal.show();
};

async function deleteDiaria(id) {
  try {
    const response = await fetch(`/api/diarias/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Erro ao remover diária");
    }
    const data = await response.json();
    showAlert(data.message || "Diária removida com sucesso!", "success");
    loadDiarias();
    const modalEl = document.getElementById("confirmModal");
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
  } catch (error) {
    console.error("Erro ao remover diária:", error);
    showAlert("Erro ao remover diária: " + error.message, "danger");
  }
}

window.openAddModal = function () {
  const modalElement = document.getElementById("addDiariaModal");
  if (!modalElement) return;

  const addForm = document.getElementById("addDiariaForm");
  if (addForm) addForm.reset();

  const funcionariosContainer = document.getElementById(
    "funcionariosCheckboxContainer"
  );
  const turmaSelect = document.getElementById("turmaSelect");
  const diariaDataInput = document.getElementById("diariaData");

  if (diariaDataInput)
    diariaDataInput.value = new Date().toISOString().split("T")[0];

  if (user && user.cargo === "Encarregado" && !currentUserIsPrivileged) {
    if (turmaSelect) {
      turmaSelect.value = user.matricula;
      turmaSelect.disabled = true;
      if (funcionariosContainer) {
        loadFuncionariosPorTurma(user.matricula, funcionariosContainer);
      }
    }
  } else {
    if (turmaSelect) {
      turmaSelect.disabled = false;
      turmaSelect.value = "";
    }
    if (funcionariosContainer) {
      funcionariosContainer.innerHTML =
        '<small class="text-muted">Selecione uma turma para listar os funcionários.</small>';
    }
  }

  if (
    turmaSelect &&
    turmaSelect.options.length <= 1 &&
    !(user && user.cargo === "Encarregado" && !currentUserIsPrivileged)
  ) {
    loadTurmasDisponiveis();
  } else if (
    turmaSelect &&
    turmaSelect.options.length > 0 &&
    user &&
    user.cargo === "Encarregado" &&
    !currentUserIsPrivileged &&
    turmaSelect.value !== user.matricula.toString()
  ) {
    loadTurmasDisponiveis();
  }

  const procOpt = document.getElementById("processosOptions");
  if (procOpt) procOpt.innerHTML = "";

  const bsModal = bootstrap.Modal.getOrCreateInstance(modalElement);
  bsModal.show();
};

async function loadTurmasDisponiveis() {
  try {
    const response = await fetch("/api/turmas", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    if (!response.ok) throw new Error("Erro ao carregar turmas");
    const turmasData = await response.json();
    let turmasUnicas = [
      ...new Set(turmasData.map((t) => t.turma_encarregado)),
    ].filter(Boolean);

    const selectTurmaModal = document.getElementById("turmaSelect");
    const filtroTurmaSelect = document.getElementById("filtroTurma");

    if (user && user.cargo === "Encarregado" && !currentUserIsPrivileged) {
      const encarregadoTurmaIdentificador = user.matricula.toString();

      if (filtroTurmaSelect) {
        filtroTurmaSelect.innerHTML = "";
        const option = document.createElement("option");
        option.value = encarregadoTurmaIdentificador;
        option.textContent = user.nome;
        filtroTurmaSelect.appendChild(option);
        filtroTurmaSelect.value = encarregadoTurmaIdentificador;
        filtroTurmaSelect.disabled = true;
      }

      if (selectTurmaModal) {
        selectTurmaModal.innerHTML = "";
        const option = document.createElement("option");
        option.value = encarregadoTurmaIdentificador;
        option.textContent = user.nome;
        selectTurmaModal.appendChild(option);
        selectTurmaModal.value = encarregadoTurmaIdentificador;
        selectTurmaModal.disabled = true;
        const funcionariosContainer = document.getElementById(
          "funcionariosCheckboxContainer"
        );
        if (funcionariosContainer) {
          loadFuncionariosPorTurma(
            encarregadoTurmaIdentificador,
            funcionariosContainer
          );
        }
      }
    } else {
      if (selectTurmaModal) {
        selectTurmaModal.innerHTML =
          '<option value="">Selecione a Turma...</option>';
        selectTurmaModal.disabled = false;
      }
      if (filtroTurmaSelect) {
        filtroTurmaSelect.innerHTML = '<option value="">Todas</option>';
        filtroTurmaSelect.disabled = false;
      }

      turmasUnicas.forEach((turma) => {
        const option = document.createElement("option");
        option.value = turma;
        option.textContent = turma;
        if (selectTurmaModal)
          selectTurmaModal.appendChild(option.cloneNode(true));
        if (filtroTurmaSelect)
          filtroTurmaSelect.appendChild(option.cloneNode(true));
      });
    }
  } catch (error) {
    console.error("Erro ao carregar turmas:", error);
    showAlert("Erro ao carregar turmas: " + error.message, "danger");
    const selectTurmaModal = document.getElementById("turmaSelect");
    if (selectTurmaModal)
      selectTurmaModal.innerHTML =
        '<option value="">Erro ao carregar turmas</option>';
  }
}

window.navigateTo = async function (pageNameOrUrl) {
  let urlToNavigate = pageNameOrUrl;
  if (!pageNameOrUrl.startsWith("/") && !pageNameOrUrl.startsWith("http")) {
    urlToNavigate = `/${pageNameOrUrl}`;
  }
  if (
    window.location.pathname === urlToNavigate &&
    !urlToNavigate.includes("?")
  )
    return;

  try {
    const response = await fetch(urlToNavigate);
    if (response.ok) {
      window.location.href = urlToNavigate;
    } else if (response.status === 403) {
      if (accessDeniedModalInstance) accessDeniedModalInstance.show();
      else alert("Acesso negado!");
    } else if (response.status === 404) {
      if (developmentModalInstance) developmentModalInstance.show();
      else alert("Página não encontrada ou em desenvolvimento.");
    } else {
      if (developmentModalInstance) developmentModalInstance.show();
      else alert("Erro ao tentar acessar a página.");
    }
  } catch (error) {
    if (developmentModalInstance) developmentModalInstance.show();
    else alert("Erro de rede ou falha na navegação.");
  }
};

document.addEventListener("DOMContentLoaded", async function () {
  user = JSON.parse(localStorage.getItem("user"));
  let userTurmaEncarregado = null;

  if (user && user.matricula) {
    try {
      const response = await fetch(`/api/user-team-details`);
      if (response.ok) {
        const details = await response.json();
        userTurmaEncarregado = details.turma_encarregado
          ? details.turma_encarregado.toString()
          : null;
      } else {
        console.error(
          "Falha ao buscar detalhes da turma do usuário.",
          response.statusText
        );
      }
    } catch (error) {
      console.error("Erro ao buscar detalhes da turma do usuário:", error);
    }
  }

  if (user) {
    const privilegedRoles = [
      "Tecnico",
      "Engenheiro",
      "ADMIN",
      "Admin",
      "Inspetor",
    ];
    if (
      privilegedRoles.includes(user.cargo) ||
      userTurmaEncarregado === "2193"
    ) {
      currentUserIsPrivileged = true;
    }
  }

  if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);

    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
  }

  if (!listenersInitialized) {
    initializePageListeners();
    listenersInitialized = true;
  }

  await loadTurmasDisponiveis();
  loadProcessosNoFiltro();

  const today = new Date().toISOString().split("T")[0];
  const diariaDataInput = document.getElementById("diariaData");
  const filtroDataInicialInput = document.getElementById("filtroDataInicial");
  const filtroDataFinalInput = document.getElementById("filtroDataFinal");

  if (diariaDataInput) diariaDataInput.value = today;
  if (filtroDataInicialInput) filtroDataInicialInput.value = today;
  if (filtroDataFinalInput) filtroDataFinalInput.value = today;

  const diariasTableBodyEl = document.getElementById("diariasTableBody");
  if (diariasTableBodyEl) {
    diariasTableBodyEl.innerHTML = `
        <tr>
            <td colspan="8" class="text-center text-muted py-4">
                Utilize os filtros para visualizar as diárias ou adicione uma nova.
            </td>
        </tr>
    `;
  }

  if (user && user.cargo === "Encarregado" && !currentUserIsPrivileged) {
    const filtroTurmaEl = document.getElementById("filtroTurma");
    if (filtroTurmaEl && filtroTurmaEl.value === user.matricula.toString()) {
      loadDiarias();
    }
  }

  const tooltipTriggerList = Array.from(
    document.querySelectorAll('[data-bs-toggle="tooltip"]')
  );
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
});

window.exportToPDF = async function () {
  if (!currentDiarias || currentDiarias.length === 0) {
    showAlert("Não há diárias para exportar com os filtros atuais.", "warning");
    return;
  }

  const exportButton = document.getElementById("exportPdfBtn");
  let originalButtonHTML = "";
  if (exportButton) {
    originalButtonHTML = exportButton.innerHTML;
    exportButton.disabled = true;
    exportButton.innerHTML =
      '<i class="fas fa-spinner fa-spin me-2"></i>Exportando...';
  }

  try {
    const filtroTurmaEl = document.getElementById("filtroTurma");
    const filtroDataInicialEl = document.getElementById("filtroDataInicial");
    const filtroDataFinalEl = document.getElementById("filtroDataFinal");
    const filtroProcessoEl = document.getElementById("filtroProcesso");
    const filtroMatriculaEl = document.getElementById("filtroMatricula");
    const filtroQsCheckbox = document.getElementById("qsCheckbox");
    const filtroQdCheckbox = document.getElementById("qdCheckbox");

    const filtros = {
      turma: filtroTurmaEl ? filtroTurmaEl.value : "Todas",
      dataInicial: filtroDataInicialEl ? filtroDataInicialEl.value : "",
      dataFinal: filtroDataFinalEl ? filtroDataFinalEl.value : "",
      processo: filtroProcessoEl ? filtroProcessoEl.value : "Todos",
      matricula: filtroMatriculaEl ? filtroMatriculaEl.value : "",
      qs: filtroQsCheckbox ? filtroQsCheckbox.checked : false,
      qd: filtroQdCheckbox ? filtroQdCheckbox.checked : false,
    };

    if (!user || !user.matricula || !user.nome) {
      showAlert(
        "Informações do usuário não encontradas. Faça login novamente.",
        "danger"
      );
      if (exportButton) {
        exportButton.disabled = false;
        exportButton.innerHTML = originalButtonHTML;
      }
      return;
    }
    const usuarioLogado = {
      matricula: user.matricula,
      nome: user.nome,
    };

    const diariasAgrupadas = currentDiarias.reduce((acc, diaria) => {
      const matriculaKey = diaria.matricula || "SEM_MATRICULA";
      if (!acc[matriculaKey]) {
        acc[matriculaKey] = {
          nome: diaria.nome || "Nome não disponível",
          cargo: diaria.cargo || "Cargo não disponível",
          diarias: [],
        };
      }
      acc[matriculaKey].diarias.push({
        data: diaria.data,
        data_formatada:
          diaria.data_formatada ||
          new Date(diaria.data).toLocaleDateString("pt-BR", {
            timeZone: "UTC",
          }),
        qs: diaria.qs,
        qd: diaria.qd,
        processo: diaria.processo,
      });
      return acc;
    }, {});

    const response = await fetch("/api/gerar_pdf_diarias", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        diarias: diariasAgrupadas,
        filtros: filtros,
        usuario: usuarioLogado,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Erro ao gerar PDF: ${response.statusText} (${response.status})`
      );
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Relatorio_Diarias.pdf";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    showAlert("PDF de diárias gerado com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao exportar PDF de diárias:", error);
    showAlert(`Erro ao exportar PDF: ${error.message}`, "danger");
  } finally {
    if (exportButton) {
      exportButton.disabled = false;
      exportButton.innerHTML = originalButtonHTML;
    }
  }
};
