document.addEventListener("DOMContentLoaded", () => {
  const veiculoTableBody = document.getElementById("veiculo-table-body");
  const addVeiculoBtn = document.getElementById("add-veiculo-btn");
  const paginationContainer = document.getElementById("pagination-container");

  const veiculoModalEl = document.getElementById("veiculo-modal");
  const veiculoModal = veiculoModalEl
    ? new bootstrap.Modal(veiculoModalEl)
    : null;

  const confirmationModalEl = document.getElementById("confirmation-modal");
  const confirmationModal = confirmationModalEl
    ? new bootstrap.Modal(confirmationModalEl)
    : null;

  const modalTitle = document.getElementById("modal-title");
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

  const confirmationTitle = document.getElementById("confirmation-title");
  const confirmationMessage = document.getElementById("confirmation-message");
  const confirmationConfirmBtn = document.getElementById(
    "confirmation-confirm-btn"
  );

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
      fetch(`/api/gestao-frota/veiculos/${id}`, { method: "DELETE" }),
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
    if (veiculoModal) veiculoModal.show();
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "ATIVO":
        return '<span class="badge bg-success">Ativo</span>';
      case "EM_MANUTENCAO":
        return '<span class="badge bg-warning text-dark">Em Manutenção</span>';
      case "INATIVO":
        return '<span class="badge bg-secondary">Inativo</span>';
      default:
        return `<span class="badge bg-light text-dark">${status}</span>`;
    }
  };

  const renderTable = (veiculos) => {
    veiculoTableBody.innerHTML = "";
    if (veiculos.length === 0) {
      const colCount =
        veiculoTableBody.previousElementSibling.querySelectorAll("th").length;
      veiculoTableBody.innerHTML = `<tr><td colspan="${colCount}" class="text-center p-5"><i class="fa-solid fa-truck-arrow-right fa-2x text-muted mb-2"></i><p>Nenhum veículo encontrado.</p></td></tr>`;
      return;
    }

    veiculos.forEach((veiculo) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${veiculo.modelo}</td>
        <td>${veiculo.placa}</td>
        <td>${veiculo.tipo || ""}</td>
        <td>${veiculo.ano || ""}</td>
        <td>${getStatusBadge(veiculo.status)}</td>
        <td class="text-end">
            <button class="btn btn-sm btn-outline-primary edit" data-id="${
              veiculo.id
            }" title="Editar"><i class="fa-solid fa-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger delete" data-id="${
              veiculo.id
            }" data-placa="${
        veiculo.placa
      }" title="Excluir"><i class="fa-solid fa-trash-can"></i></button>
        </td>
      `;
      veiculoTableBody.appendChild(tr);
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
        if (!isDisabled) loadVeiculos(page);
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

  const loadVeiculos = async (page = 1) => {
    currentPage = page;
    veiculoTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-5"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></td></tr>`;
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
      veiculoTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-5 text-danger">Erro ao carregar veículos.</td></tr>`;
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

    const originalButtonHTML = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...`;

    try {
      let response;
      if (editingVeiculoId) {
        response = await api.updateVeiculo(editingVeiculoId, veiculoData);
      } else {
        response = await api.createVeiculo(veiculoData);
      }

      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      showToast(result.message, "success");
      if (veiculoModal) veiculoModal.hide();
      loadVeiculos(editingVeiculoId ? currentPage : 1);
    } catch (error) {
      showToast(`Erro ao salvar: ${error.message}`, "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalButtonHTML;
    }
  };

  addVeiculoBtn.addEventListener("click", () => openModal("add"));
  saveBtn.addEventListener("click", handleSave);

  filtroTermo.addEventListener("input", () => loadVeiculos(1));
  filtroStatus.addEventListener("change", () => loadVeiculos(1));

  clearFiltersBtn.addEventListener("click", () => {
    filtroTermo.value = "";
    filtroStatus.value = "";
    loadVeiculos(1);
  });

  veiculoTableBody.addEventListener("click", async (e) => {
    const target = e.target.closest(".btn");
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
