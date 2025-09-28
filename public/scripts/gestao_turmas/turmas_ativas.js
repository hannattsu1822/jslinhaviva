let turmasData = [];
let accessDeniedModalInstance;
let developmentModalInstance;
let user = null;

function showAlert(type, message, duration = 5000) {
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

function loadTurmas() {
  fetch("/api/turmas", {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Erro na requisição ao carregar turmas");
      }
      return response.json();
    })
    .then((data) => {
      turmasData = data;
      populateTurmaFilter();
      populateTable(data);
      const filterAlert = document.getElementById("filterAlert");
      if (filterAlert) filterAlert.style.display = "none";
    })
    .catch((error) => {
      console.error("Erro ao carregar turmas:", error);
      showAlert(
        "danger",
        "Erro ao carregar dados das turmas. Tente novamente."
      );
      const filterAlert = document.getElementById("filterAlert");
      if (filterAlert) {
        filterAlert.textContent =
          "Erro ao carregar dados. Tente atualizar a página.";
        filterAlert.style.display = "block";
      }
    });
}

function populateTurmaFilter() {
  const turmaFilter = document.getElementById("turmaFilter");
  if (!turmaFilter) return;

  while (turmaFilter.options.length > 1) {
    turmaFilter.remove(1);
  }

  const turmasUnicas = [
    ...new Set(turmasData.map((item) => item.turma_encarregado)),
  ]
    .filter(Boolean)
    .sort();

  turmasUnicas.forEach((turma) => {
    const option = document.createElement("option");
    option.value = turma;
    option.textContent = turma;
    turmaFilter.appendChild(option);
  });
}

window.applyFilters = function () {
  const turmaFilterVal = document.getElementById("turmaFilter").value;
  const cargoFilterVal = document.getElementById("cargoFilter").value;

  let dadosFiltrados = turmasData;

  if (turmaFilterVal) {
    dadosFiltrados = dadosFiltrados.filter(
      (membro) => membro.turma_encarregado === turmaFilterVal
    );
  }
  if (cargoFilterVal) {
    dadosFiltrados = dadosFiltrados.filter(
      (membro) => membro.cargo === cargoFilterVal
    );
  }

  populateTable(dadosFiltrados);
  const filterAlert = document.getElementById("filterAlert");
  if (filterAlert) {
    filterAlert.style.display =
      dadosFiltrados.length === 0 && (turmaFilterVal || cargoFilterVal)
        ? "block"
        : "none";
    if (dadosFiltrados.length === 0 && (turmaFilterVal || cargoFilterVal)) {
      filterAlert.textContent =
        "Nenhum membro encontrado com os filtros selecionados.";
    }
  }
};

function populateTable(data) {
  const tableBody = document.getElementById("turmasTableBody");
  if (!tableBody) return;
  tableBody.innerHTML = "";

  if (data.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="6" class="text-center py-4">Nenhum membro encontrado.</td>`;
    tableBody.appendChild(row);
    return;
  }

  data.forEach((membro) => {
    const row = document.createElement("tr");
    row.innerHTML = `
            <td>${membro.id || ""}</td>
            <td>${membro.matricula || ""}</td>
            <td>${membro.nome || ""}</td>
            <td>${membro.cargo || ""}</td>
            <td>${membro.turma_encarregado || "Não atribuído"}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-primary me-1" onclick="window.editMember(${
                  membro.id
                })" title="Editar/Mover Turma">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="window.confirmDelete(${
                  membro.id
                })" title="Remover Membro">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>`;
    tableBody.appendChild(row);
  });
}

window.addMember = function () {
  const form = document.getElementById("addMemberForm");
  if (!form) return;
  const formData = new FormData(form);
  const dados = Object.fromEntries(formData);

  if (!dados.matricula || !dados.nome || !dados.cargo) {
    showAlert(
      "danger",
      "Matrícula, Nome e Cargo são obrigatórios para adicionar membro."
    );
    return;
  }

  const saveBtn = form.querySelector('button[type="submit"]');
  const originalBtnHTML = saveBtn ? saveBtn.innerHTML : "Salvar";
  if (saveBtn) {
    saveBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...';
    saveBtn.disabled = true;
  }

  fetch("/api/turmas/adicionar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify(dados),
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((err) => {
          throw new Error(err.message || "Erro ao adicionar membro");
        });
      }
      return response.json();
    })
    .then((data) => {
      showAlert("success", data.message || "Membro adicionado com sucesso!");
      form.reset();
      const modalEl = document.getElementById("addMemberModal");
      if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
      loadTurmas();
    })
    .catch((error) => {
      console.error("Erro ao adicionar membro:", error);
      showAlert("danger", error.message || "Erro ao adicionar membro");
    })
    .finally(() => {
      if (saveBtn) {
        saveBtn.innerHTML = originalBtnHTML;
        saveBtn.disabled = false;
      }
    });
};

window.editMember = function (id) {
  const membro = turmasData.find((m) => m.id === id);
  if (!membro) return;

  const modalEl = document.getElementById("editMemberModal");
  if (!modalEl) return;
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  document.getElementById("editMemberId").value = id;
  document.getElementById("editMemberName").textContent = membro.nome;
  document.getElementById("editCurrentTurma").textContent =
    membro.turma_encarregado || "Não atribuído";

  const turmaSelect = document.getElementById("editNewTurma");
  turmaSelect.innerHTML = '<option value="">Selecione uma nova turma</option>';

  const turmasUnicas = [
    ...new Set(turmasData.map((item) => item.turma_encarregado)),
  ]
    .filter(Boolean)
    .sort();
  turmasUnicas.forEach((turma) => {
    if (turma !== membro.turma_encarregado) {
      const option = document.createElement("option");
      option.value = turma;
      option.textContent = turma;
      turmaSelect.appendChild(option);
    }
  });
  const optionNaoAtribuido = document.createElement("option");
  optionNaoAtribuido.value = "NAO_ATRIBUIDO";
  optionNaoAtribuido.textContent = "Remover da Turma (Não Atribuído)";
  turmaSelect.appendChild(optionNaoAtribuido);

  modal.show();
};

window.saveEdit = function () {
  const id = document.getElementById("editMemberId").value;
  let newTurma = document.getElementById("editNewTurma").value;

  if (!id || !newTurma) {
    showAlert("warning", "Selecione uma nova turma para o membro.");
    return;
  }
  if (newTurma === "NAO_ATRIBUIDO") {
    newTurma = null;
  }

  const saveBtn = document.querySelector(
    '#editMemberModal button[onclick="window.saveEdit()"]'
  );
  const originalBtnHTML = saveBtn ? saveBtn.innerHTML : "Salvar Alterações";
  if (saveBtn) {
    saveBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...';
    saveBtn.disabled = true;
  }

  fetch(`/api/turmas/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify({ turma_encarregado: newTurma }),
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((err) => {
          throw new Error(err.message || "Erro ao atualizar turma do membro");
        });
      }
      return response.json();
    })
    .then((data) => {
      showAlert(
        "success",
        data.message || "Turma do membro atualizada com sucesso!"
      );
      const modalEl = document.getElementById("editMemberModal");
      if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
      loadTurmas();
    })
    .catch((error) => {
      console.error("Erro ao atualizar turma:", error);
      showAlert("danger", error.message || "Erro ao atualizar turma do membro");
    })
    .finally(() => {
      if (saveBtn) {
        saveBtn.innerHTML = originalBtnHTML;
        saveBtn.disabled = false;
      }
    });
};

window.confirmDelete = function (id) {
  const modalEl = document.getElementById("confirmModal");
  if (!modalEl) return;
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  const membro = turmasData.find((m) => m.id === id);
  const nomeMembro = membro ? membro.nome : `ID ${id}`;

  const modalTitle = modalEl.querySelector("#confirmModalTitle");
  const modalBody = modalEl.querySelector("#confirmModalBody");
  const confirmBtn = modalEl.querySelector("#confirmModalButton");

  if (modalTitle) modalTitle.textContent = "Confirmar Remoção de Membro";
  if (modalBody)
    modalBody.innerHTML = `<p>Tem certeza que deseja remover <strong>${nomeMembro}</strong> da turma?</p> <p class="text-muted small">Esta ação apenas desvincula o membro da turma, não exclui o usuário.</p>`;

  if (confirmBtn) {
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.addEventListener("click", function () {
      deleteMember(id);
    });
  }

  modal.show();
};

async function deleteMember(id) {
  const confirmBtn = document.getElementById("confirmModalButton");
  const originalBtnHTML = confirmBtn ? confirmBtn.innerHTML : "Confirmar";
  if (confirmBtn) {
    confirmBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Removendo...';
    confirmBtn.disabled = true;
  }

  try {
    const response = await fetch(`/api/turmas/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Erro ao remover membro da turma");
    }
    const data = await response.json();
    showAlert(
      "success",
      data.message || "Membro removido da turma com sucesso!"
    );
    const modalEl = document.getElementById("confirmModal");
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
    loadTurmas();
  } catch (error) {
    console.error("Erro ao remover membro:", error);
    showAlert("danger", error.message || "Erro ao remover membro da turma");
  } finally {
    if (confirmBtn) {
      confirmBtn.innerHTML = originalBtnHTML;
      confirmBtn.disabled = false;
    }
  }
}

window.openAddModal = function () {
  const modalEl = document.getElementById("addMemberModal");
  if (!modalEl) return;
  const form = document.getElementById("addMemberForm");
  if (form) form.reset();
  const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
  bsModal.show();
};

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

document.addEventListener("DOMContentLoaded", function () {
  user = JSON.parse(localStorage.getItem("user"));

  if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);

    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
  }

  loadTurmas();

  const turmaFilterEl = document.getElementById("turmaFilter");
  if (turmaFilterEl) turmaFilterEl.addEventListener("change", applyFilters);

  const cargoFilterEl = document.getElementById("cargoFilter");
  if (cargoFilterEl) cargoFilterEl.addEventListener("change", applyFilters);

  const addMemberFormEl = document.getElementById("addMemberForm");
  if (addMemberFormEl) {
    addMemberFormEl.addEventListener("submit", function (event) {
      event.preventDefault();
      window.addMember();
    });
  }

  const filterAlertEl = document.getElementById("filterAlert");
  if (filterAlertEl && turmasData.length === 0) {
    filterAlertEl.textContent =
      "Carregando membros ou nenhum membro encontrado. Use os filtros ou adicione membros.";
    filterAlertEl.style.display = "block";
  } else if (filterAlertEl) {
    filterAlertEl.style.display = "none";
  }
});
