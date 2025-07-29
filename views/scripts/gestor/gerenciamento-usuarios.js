document.addEventListener("DOMContentLoaded", () => {
  const userTableBody = document.getElementById("user-table-body");
  const loadingMessage = document.getElementById("loading-message");
  const addUserBtn = document.getElementById("add-user-btn");
  const paginationContainer = document.getElementById("pagination-container");

  const modal = document.getElementById("user-modal");
  const modalTitle = document.getElementById("modal-title");
  const closeModalBtn = document.getElementById("close-modal-btn");
  const cancelBtn = document.getElementById("cancel-btn");
  const saveBtn = document.getElementById("save-btn");

  const userForm = document.getElementById("user-form");
  const userIdInput = document.getElementById("user-id");
  const nomeInput = document.getElementById("nome");
  const matriculaInput = document.getElementById("matricula");
  const cargoInput = document.getElementById("cargo");
  const nivelInput = document.getElementById("nivel");
  const senhaInput = document.getElementById("senha");
  const confirmarSenhaInput = document.getElementById("confirmar-senha");

  const filtroTermo = document.getElementById("filtro-termo");
  const filtroCargo = document.getElementById("filtro-cargo");
  const filtroNivel = document.getElementById("filtro-nivel");
  const clearFiltersBtn = document.getElementById("clear-filters-btn");

  const confirmationModal = document.getElementById("confirmation-modal");
  const confirmationTitle = document.getElementById("confirmation-title");
  const confirmationMessage = document.getElementById("confirmation-message");
  const confirmationCancelBtn = document.getElementById(
    "confirmation-cancel-btn"
  );
  const confirmationConfirmBtn = document.getElementById(
    "confirmation-confirm-btn"
  );
  const toastContainer = document.getElementById("toast-container");

  let editingUserId = null;
  let currentPage = 1;
  let confirmCallback = null;

  const api = {
    getUsers: (params = "") =>
      fetch(`/api/gerenciamento/usuarios?${params}`).then((res) => res.json()),
    getUserById: (id) =>
      fetch(`/api/gerenciamento/usuarios/${id}`).then((res) => res.json()),
    createUser: (data) =>
      fetch("/api/gerenciamento/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    updateUser: (id, data) =>
      fetch(`/api/gerenciamento/usuarios/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    toggleUserStatus: (id, nivelAtual) =>
      fetch(`/api/gerenciamento/usuarios/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nivelAtual }),
      }),
    deleteUser: (id) =>
      fetch(`/api/gerenciamento/usuarios/${id}`, {
        method: "DELETE",
      }),
  };

  const showToast = (message, type = "success") => {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const icon = type === "success" ? "check_circle" : "error";
    toast.innerHTML = `<span class="material-symbols-outlined toast-icon">${icon}</span> <p>${message}</p>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
      toast.classList.remove("show");
      toast.addEventListener("transitionend", () => toast.remove());
    }, 4000);
  };

  const showConfirmation = (title, message, onConfirm) => {
    confirmationTitle.textContent = title;
    confirmationMessage.textContent = message;
    confirmCallback = onConfirm;
    confirmationModal.classList.remove("hidden");
  };

  const hideConfirmation = () => {
    confirmationModal.classList.add("hidden");
    confirmCallback = null;
  };

  confirmationConfirmBtn.addEventListener("click", () => {
    if (typeof confirmCallback === "function") {
      confirmCallback();
    }
    hideConfirmation();
  });
  confirmationCancelBtn.addEventListener("click", hideConfirmation);

  const openModal = (mode = "add", user = null) => {
    userForm.reset();
    if (mode === "edit" && user) {
      editingUserId = user.id;
      modalTitle.textContent = "Editar Usuário";
      userIdInput.value = user.id;
      nomeInput.value = user.nome;
      matriculaInput.value = user.matricula;
      cargoInput.value = user.cargo;
      nivelInput.value = user.nivel;
    } else {
      editingUserId = null;
      modalTitle.textContent = "Adicionar Novo Usuário";
    }
    modal.classList.remove("hidden");
  };

  const closeModal = () => {
    modal.classList.add("hidden");
  };

  const renderTable = (users) => {
    userTableBody.innerHTML = "";
    if (users.length === 0) {
      loadingMessage.textContent =
        "Nenhum usuário encontrado com os filtros aplicados.";
      loadingMessage.style.display = "block";
      return;
    }
    loadingMessage.style.display = "none";

    users.forEach((user) => {
      const tr = document.createElement("tr");
      if (user.nivel === 0) {
        tr.classList.add("desativado");
      }

      const isAtivo = user.nivel > 0;
      const toggleIcon = isAtivo ? "toggle_off" : "toggle_on";
      const toggleTitle = isAtivo ? "Desativar" : "Ativar";
      const toggleClass = isAtivo ? "" : "ativar";

      tr.innerHTML = `
                <td>${user.nome}</td>
                <td>${user.matricula}</td>
                <td>${user.cargo}</td>
                <td>${user.nivel}</td>
                <td class="actions-column">
                    <button class="action-btn toggle-status ${toggleClass}" data-user-id="${user.id}" data-user-nivel="${user.nivel}" title="${toggleTitle}"><span class="material-symbols-outlined">${toggleIcon}</span></button>
                    <button class="action-btn edit" data-user-id="${user.id}" title="Editar"><span class="material-symbols-outlined">edit</span></button>
                    <button class="action-btn delete" data-user-id="${user.id}" data-user-name="${user.nome}" title="Excluir"><span class="material-symbols-outlined">delete</span></button>
                </td>
            `;
      userTableBody.appendChild(tr);
    });
  };

  const renderPagination = (totalPages, currentPage) => {
    paginationContainer.innerHTML = "";
    if (totalPages <= 1) return;

    const createButton = (text, page, isDisabled = false, isActive = false) => {
      const button = document.createElement("button");
      button.innerHTML = text;
      button.className = "pagination-btn";
      if (isDisabled) button.disabled = true;
      if (isActive) button.classList.add("active");
      button.addEventListener("click", () => {
        if (!isDisabled) {
          loadUsers(page);
        }
      });
      return button;
    };

    paginationContainer.appendChild(
      createButton("Anterior", currentPage - 1, currentPage === 1)
    );

    for (let i = 1; i <= totalPages; i++) {
      paginationContainer.appendChild(
        createButton(i, i, false, i === currentPage)
      );
    }

    paginationContainer.appendChild(
      createButton("Próximo", currentPage + 1, currentPage === totalPages)
    );
  };

  const loadUsers = async (page = 1) => {
    currentPage = page;
    loadingMessage.textContent = "Carregando usuários...";
    loadingMessage.style.display = "block";
    userTableBody.innerHTML = "";
    paginationContainer.innerHTML = "";

    const params = new URLSearchParams({
      pagina: currentPage,
      termo: filtroTermo.value,
      cargo: filtroCargo.value,
      nivel: filtroNivel.value,
    }).toString();

    try {
      const data = await api.getUsers(params);
      renderTable(data.users);
      renderPagination(data.totalPages, data.currentPage);
    } catch (error) {
      loadingMessage.textContent = "Erro ao carregar usuários.";
      console.error(error);
    }
  };

  const handleSave = async () => {
    if (senhaInput.value !== confirmarSenhaInput.value) {
      showToast("As senhas não coincidem.", "error");
      return;
    }

    const userData = {
      nome: nomeInput.value,
      matricula: matriculaInput.value,
      cargo: cargoInput.value,
      nivel: nivelInput.value,
    };

    if (senhaInput.value) {
      userData.senha = senhaInput.value;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Salvando...";

    try {
      let response;
      if (editingUserId) {
        response = await api.updateUser(editingUserId, userData);
      } else {
        if (!userData.senha) {
          showToast(
            "A senha é obrigatória para criar um novo usuário.",
            "error"
          );
          saveBtn.disabled = false;
          saveBtn.textContent = "Salvar";
          return;
        }
        response = await api.createUser(userData);
      }

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message);
      }

      showToast(result.message, "success");
      closeModal();
      loadUsers();
    } catch (error) {
      showToast(`Erro ao salvar: ${error.message}`, "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Salvar";
    }
  };

  addUserBtn.addEventListener("click", () => openModal("add"));
  closeModalBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  saveBtn.addEventListener("click", handleSave);

  filtroTermo.addEventListener("input", () => loadUsers(1));
  filtroCargo.addEventListener("input", () => loadUsers(1));
  filtroNivel.addEventListener("change", () => loadUsers(1));

  clearFiltersBtn.addEventListener("click", () => {
    filtroTermo.value = "";
    filtroCargo.value = "";
    filtroNivel.value = "";
    loadUsers(1);
  });

  userTableBody.addEventListener("click", async (e) => {
    const target = e.target.closest(".action-btn");
    if (!target) return;

    const userId = target.dataset.userId;

    if (target.classList.contains("edit")) {
      try {
        const userToEdit = await api.getUserById(userId);
        if (userToEdit) {
          openModal("edit", userToEdit);
        }
      } catch (error) {
        showToast("Não foi possível carregar os dados do usuário.", "error");
      }
    }

    if (target.classList.contains("toggle-status")) {
      const nivelAtual = target.dataset.userNivel;
      const acao = nivelAtual > 0 ? "desativar" : "ativar";
      showConfirmation(
        `Confirmar ${acao}`,
        `Tem certeza que deseja ${acao} este usuário?`,
        async () => {
          try {
            const response = await api.toggleUserStatus(userId, nivelAtual);
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            showToast(result.message, "success");
            loadUsers(currentPage);
          } catch (error) {
            showToast(`Erro ao ${acao} usuário: ${error.message}`, "error");
          }
        }
      );
    }

    if (target.classList.contains("delete")) {
      const userName = target.dataset.userName;
      showConfirmation(
        "Confirmar Exclusão",
        `Tem certeza que deseja EXCLUIR PERMANENTEMENTE o usuário "${userName}"? Esta ação não pode ser desfeita.`,
        async () => {
          try {
            const response = await api.deleteUser(userId);
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            showToast(result.message, "success");
            loadUsers(1);
          } catch (error) {
            showToast(`Erro ao excluir: ${error.message}`, "error");
          }
        }
      );
    }
  });

  loadUsers();
});
