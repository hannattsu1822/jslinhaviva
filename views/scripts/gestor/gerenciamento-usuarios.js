document.addEventListener("DOMContentLoaded", () => {
  const userTableBody = document.getElementById("user-table-body");
  const loadingMessage = document.getElementById("loading-message");
  const addUserBtn = document.getElementById("add-user-btn");
  const paginationContainer = document.getElementById("pagination-container");

  const userModalEl = document.getElementById("user-modal");
  const userModal = userModalEl ? new bootstrap.Modal(userModalEl) : null;

  const confirmationModalEl = document.getElementById("confirmation-modal");
  const confirmationModal = confirmationModalEl
    ? new bootstrap.Modal(confirmationModalEl)
    : null;

  const modalTitle = document.getElementById("modal-title");
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

  const confirmationTitle = document.getElementById("confirmation-title");
  const confirmationMessage = document.getElementById("confirmation-message");
  const confirmationConfirmBtn = document.getElementById(
    "confirmation-confirm-btn"
  );

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
      fetch(`/api/gerenciamento/usuarios/${id}`, { method: "DELETE" }),
  };

  const showConfirmation = (title, message, onConfirm) => {
    confirmationTitle.textContent = title;
    confirmationMessage.textContent = message;
    confirmCallback = onConfirm;
    if (confirmationModal) confirmationModal.show();
  };

  confirmationConfirmBtn.addEventListener("click", () => {
    if (typeof confirmCallback === "function") {
      confirmCallback();
    }
    if (confirmationModal) confirmationModal.hide();
  });

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
    if (userModal) userModal.show();
  };

  const renderTable = (users) => {
    userTableBody.innerHTML = "";
    if (users.length === 0) {
      const colCount =
        userTableBody.previousElementSibling.querySelectorAll("th").length;
      userTableBody.innerHTML = `<tr><td colspan="${colCount}" class="text-center p-5"><i class="fa-solid fa-user-slash fa-2x text-muted mb-2"></i><p>Nenhum usuário encontrado.</p></td></tr>`;
      return;
    }

    users.forEach((user) => {
      const tr = document.createElement("tr");
      if (user.nivel === 0) {
        tr.classList.add("table-secondary", "text-muted");
      }

      const isAtivo = user.nivel > 0;
      const toggleIcon = isAtivo
        ? "fa-solid fa-toggle-off"
        : "fa-solid fa-toggle-on";
      const toggleTitle = isAtivo ? "Desativar" : "Ativar";
      const toggleClass = isAtivo ? "text-secondary" : "text-success";

      tr.innerHTML = `
        <td>${user.nome}</td>
        <td>${user.matricula}</td>
        <td>${user.cargo}</td>
        <td><span class="badge ${
          isAtivo ? "bg-primary" : "bg-secondary"
        }">Nível ${user.nivel}</span></td>
        <td class="text-end">
            <button class="btn btn-sm btn-outline-secondary toggle-status" data-user-id="${
              user.id
            }" data-user-nivel="${
        user.nivel
      }" title="${toggleTitle}"><i class="${toggleIcon} ${toggleClass}"></i></button>
            <button class="btn btn-sm btn-outline-primary edit" data-user-id="${
              user.id
            }" title="Editar"><i class="fa-solid fa-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger delete" data-user-id="${
              user.id
            }" data-user-name="${
        user.nome
      }" title="Excluir"><i class="fa-solid fa-trash-can"></i></button>
        </td>
      `;
      userTableBody.appendChild(tr);
    });
  };

  const renderPagination = (totalPages, currentPage) => {
    paginationContainer.innerHTML = "";
    if (totalPages <= 1) return;

    const createPageItem = (
      page,
      text,
      isDisabled = false,
      isActive = false
    ) => {
      const li = document.createElement("li");
      li.className = `page-item ${isDisabled ? "disabled" : ""} ${
        isActive ? "active" : ""
      }`;
      const a = document.createElement("a");
      a.className = "page-link";
      a.href = "#";
      a.innerHTML = text;
      a.addEventListener("click", (e) => {
        e.preventDefault();
        if (!isDisabled) loadUsers(page);
      });
      li.appendChild(a);
      return li;
    };

    const ul = document.createElement("ul");
    ul.className = "pagination justify-content-center";

    ul.appendChild(
      createPageItem(currentPage - 1, "&laquo;", currentPage === 1)
    );
    for (let i = 1; i <= totalPages; i++) {
      ul.appendChild(createPageItem(i, i, false, i === currentPage));
    }
    ul.appendChild(
      createPageItem(currentPage + 1, "&raquo;", currentPage === totalPages)
    );

    paginationContainer.appendChild(ul);
  };

  const loadUsers = async (page = 1) => {
    currentPage = page;
    userTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-5"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></td></tr>`;
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
      userTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-danger">Erro ao carregar usuários.</td></tr>`;
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

    const originalButtonHTML = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...`;

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
          saveBtn.innerHTML = originalButtonHTML;
          return;
        }
        response = await api.createUser(userData);
      }

      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      showToast(result.message, "success");
      if (userModal) userModal.hide();
      loadUsers();
    } catch (error) {
      showToast(`Erro ao salvar: ${error.message}`, "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalButtonHTML;
    }
  };

  addUserBtn.addEventListener("click", () => openModal("add"));
  saveBtn.addEventListener("click", handleSave);

  [filtroTermo, filtroCargo].forEach((el) =>
    el.addEventListener("input", () => loadUsers(1))
  );
  filtroNivel.addEventListener("change", () => loadUsers(1));

  clearFiltersBtn.addEventListener("click", () => {
    filtroTermo.value = "";
    filtroCargo.value = "";
    filtroNivel.value = "";
    loadUsers(1);
  });

  userTableBody.addEventListener("click", async (e) => {
    const target = e.target.closest(".btn");
    if (!target) return;

    const userId = target.dataset.userId;

    if (target.classList.contains("edit")) {
      try {
        const userToEdit = await api.getUserById(userId);
        if (userToEdit) openModal("edit", userToEdit);
      } catch (error) {
        showToast("Não foi possível carregar os dados do usuário.", "error");
      }
    }

    if (target.classList.contains("toggle-status")) {
      const nivelAtual = target.dataset.userNivel;
      const acao = nivelAtual > 0 ? "desativar" : "ativar";
      showConfirmation(
        `Confirmar ${acao.charAt(0).toUpperCase() + acao.slice(1)}`,
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
