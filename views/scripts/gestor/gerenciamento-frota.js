document.addEventListener("DOMContentLoaded", () => {
  const veiculoTableBody = document.getElementById("veiculo-table-body");
  const loadingMessage = document.getElementById("loading-message");
  const addVeiculoBtn = document.getElementById("add-veiculo-btn");
  const paginationContainer = document.getElementById("pagination-container");

  const modal = document.getElementById("veiculo-modal");
  const modalTitle = document.getElementById("modal-title");
  const closeModalBtn = document.getElementById("close-modal-btn");
  const cancelBtn = document.getElementById("cancel-btn");
  const saveBtn = document.getElementById("save-btn");

  const veiculoForm = document.getElementById("veiculo-form");
  const veiculoIdInput = document.getElementById("veiculo-id");
  const placaInput = document.getElementById("placa");
  const modeloInput = document.getElementById("modelo");
  const tipoInput = document.getElementById("tipo");
  const anoInput = document.getElementById("ano");
  const statusInput = document.getElementById("status");

  const filtroTermo = document.getElementById("filtro-termo");
  const filtroStatus = document.getElementById("filtro-status");
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

  let editingVeiculoId = null;
  let currentPage = 1;
  let confirmCallback = null;

  const api = {
    getVeiculos: (params = "") =>
      fetch(`/api/gestao-frota/veiculos?${params}`).then((res) => res.json()),
    getVeiculoById: (id) =>
      fetch(`/api/gestao-frota/veiculos/${id}`).then((res) => res.json()),
    createVeiculo: (data) =>
      fetch("/api/gestao-frota/veiculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    updateVeiculo: (id, data) =>
      fetch(`/api/gestao-frota/veiculos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    deleteVeiculo: (id) =>
      fetch(`/api/gestao-frota/veiculos/${id}`, {
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

  const openModal = (mode = "add", veiculo = null) => {
    veiculoForm.reset();
    if (mode === "edit" && veiculo) {
      editingVeiculoId = veiculo.id;
      modalTitle.textContent = "Editar Veículo";
      veiculoIdInput.value = veiculo.id;
      placaInput.value = veiculo.placa;
      modeloInput.value = veiculo.modelo;
      tipoInput.value = veiculo.tipo;
      anoInput.value = veiculo.ano;
      statusInput.value = veiculo.status;
    } else {
      editingVeiculoId = null;
      modalTitle.textContent = "Adicionar Novo Veículo";
    }
    modal.classList.remove("hidden");
  };

  const closeModal = () => {
    modal.classList.add("hidden");
  };

  const renderTable = (veiculos) => {
    veiculoTableBody.innerHTML = "";
    if (veiculos.length === 0) {
      loadingMessage.textContent = "Nenhum veículo encontrado.";
      loadingMessage.style.display = "block";
      return;
    }
    loadingMessage.style.display = "none";

    veiculos.forEach((veiculo) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${veiculo.modelo}</td>
        <td>${veiculo.placa}</td>
        <td>${veiculo.tipo || ""}</td>
        <td>${veiculo.ano || ""}</td>
        <td>${veiculo.status}</td>
        <td class="actions-column">
            <button class="action-btn edit" data-id="${
              veiculo.id
            }" title="Editar"><span class="material-symbols-outlined">edit</span></button>
            <button class="action-btn delete" data-id="${
              veiculo.id
            }" data-placa="${
        veiculo.placa
      }" title="Excluir"><span class="material-symbols-outlined">delete</span></button>
        </td>
      `;
      veiculoTableBody.appendChild(tr);
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
          loadVeiculos(page);
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

  const loadVeiculos = async (page = 1) => {
    currentPage = page;
    loadingMessage.textContent = "Carregando veículos...";
    loadingMessage.style.display = "block";
    veiculoTableBody.innerHTML = "";
    paginationContainer.innerHTML = "";

    const params = new URLSearchParams({
      pagina: currentPage,
      termo: filtroTermo.value,
      status: filtroStatus.value,
    }).toString();

    try {
      const data = await api.getVeiculos(params);
      renderTable(data.veiculos);
      renderPagination(data.totalPages, data.currentPage);
    } catch (error) {
      loadingMessage.textContent = "Erro ao carregar veículos.";
    }
  };

  const handleSave = async () => {
    const veiculoData = {
      placa: placaInput.value,
      modelo: modeloInput.value,
      tipo: tipoInput.value,
      ano: anoInput.value,
      status: statusInput.value,
    };

    saveBtn.disabled = true;
    saveBtn.textContent = "Salvando...";

    try {
      let response;
      if (editingVeiculoId) {
        response = await api.updateVeiculo(editingVeiculoId, veiculoData);
      } else {
        response = await api.createVeiculo(veiculoData);
      }

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message);
      }

      showToast(result.message, "success");
      closeModal();
      loadVeiculos(editingVeiculoId ? currentPage : 1);
    } catch (error) {
      showToast(`Erro ao salvar: ${error.message}`, "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Salvar";
    }
  };

  addVeiculoBtn.addEventListener("click", () => openModal("add"));
  closeModalBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  saveBtn.addEventListener("click", handleSave);

  filtroTermo.addEventListener("input", () => loadVeiculos(1));
  filtroStatus.addEventListener("change", () => loadVeiculos(1));

  clearFiltersBtn.addEventListener("click", () => {
    filtroTermo.value = "";
    filtroStatus.value = "";
    loadVeiculos(1);
  });

  veiculoTableBody.addEventListener("click", async (e) => {
    const target = e.target.closest(".action-btn");
    if (!target) return;

    const veiculoId = target.dataset.id;

    if (target.classList.contains("edit")) {
      try {
        const veiculoToEdit = await api.getVeiculoById(veiculoId);
        openModal("edit", veiculoToEdit);
      } catch (error) {
        showToast("Não foi possível carregar os dados do veículo.", "error");
      }
    }

    if (target.classList.contains("delete")) {
      const veiculoPlaca = target.dataset.placa;
      showConfirmation(
        "Confirmar Exclusão",
        `Tem certeza que deseja EXCLUIR o veículo de placa "${veiculoPlaca}"? Esta ação não pode ser desfeita.`,
        async () => {
          try {
            const response = await api.deleteVeiculo(veiculoId);
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            showToast(result.message, "success");
            loadVeiculos(1);
          } catch (error) {
            showToast(`Erro ao excluir: ${error.message}`, "error");
          }
        }
      );
    }
  });

  loadVeiculos();
});
