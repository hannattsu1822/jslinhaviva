document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.querySelector(".data-table tbody");

  const assignModalEl = document.getElementById("assign-modal");
  const assignModal = assignModalEl ? new bootstrap.Modal(assignModalEl) : null;

  const confirmationModalEl = document.getElementById("confirmation-modal");
  const confirmationModal = confirmationModalEl
    ? new bootstrap.Modal(confirmationModalEl)
    : null;

  const completionModalEl = document.getElementById("completion-modal");
  const completionModal = completionModalEl
    ? new bootstrap.Modal(completionModalEl)
    : null;

  const encarregadoSelect = document.getElementById("encarregado-select");
  const assignServiceIdSpan = document.getElementById("assign-service-id");

  const confirmationTitle = document.getElementById("confirmation-title");
  const confirmationMessage = document.getElementById("confirmation-message");
  const confirmActionButton = document.getElementById("btn-confirm-action");

  const completionForm = document.getElementById("completion-form");
  const completionServiceIdSpan = document.getElementById(
    "completion-service-id"
  );
  const completionDateInput = document.getElementById("completion-date");
  const completionTimeInput = document.getElementById("completion-time");
  const mapPointsContainer = document.getElementById("map-points-container");
  const btnAddMapPoint = document.getElementById("btn-add-map-point");
  const completionFileInput = document.getElementById("completion-file-input");
  const completionFileListWrapper = document.getElementById(
    "completion-file-list-wrapper"
  );
  const completionFileListContainer = document.getElementById(
    "completion-file-list"
  );

  let currentServiceId = null;
  let confirmActionCallback = null;
  let completionFiles = [];

  const getFileIcon = (extension) => {
    const ext = extension.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext))
      return "fa-solid fa-file-image";
    switch (ext) {
      case "pdf":
        return "fa-solid fa-file-pdf";
      case "doc":
      case "docx":
        return "fa-solid fa-file-word";
      case "xls":
      case "xlsx":
        return "fa-solid fa-file-excel";
      case "txt":
        return "fa-solid fa-file-lines";
      default:
        return "fa-solid fa-file";
    }
  };

  const fetchEncarregados = async () => {
    try {
      const response = await fetch("/api/fibra/encarregados");
      if (!response.ok) throw new Error("Falha ao buscar encarregados.");

      const encarregados = await response.json();
      encarregadoSelect.innerHTML =
        '<option value="" disabled selected>Selecione um encarregado</option>';
      encarregados.forEach((enc) => {
        const option = document.createElement("option");
        option.value = enc.matricula;
        option.textContent = `${enc.nome} (${enc.cargo})`;
        encarregadoSelect.appendChild(option);
      });
    } catch (error) {
      encarregadoSelect.innerHTML =
        '<option value="">Erro ao carregar</option>';
      showToast(error.message, "error");
    }
  };

  const addMapPointRow = () => {
    const row = document.createElement("div");
    row.className = "map-point-row border rounded p-3 mb-3";
    row.innerHTML = `
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label">Tipo de Ponto</label>
          <select class="form-select map-point-type" required>
            <option value="" disabled selected>Selecione...</option>
            <option value="Reserva">Reserva</option>
            <option value="Poste">Poste</option>
            <option value="Caixa de Emenda">Caixa de Emenda</option>
            <option value="Cliente">Cliente</option>
            <option value="Outro">Outro</option>
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label">TAG do Ponto</label>
          <input type="text" class="form-control map-point-tag" placeholder="Identificação" required>
        </div>
        <div class="col-md-3">
          <label class="form-label">Zona UTM</label>
          <input type="text" class="form-control map-point-utm-zone" placeholder="Ex: 24L" required>
        </div>
        <div class="col-md-3">
          <label class="form-label">Coordenada Leste</label>
          <input type="number" step="any" class="form-control map-point-easting" placeholder="Easting" required>
        </div>
        <div class="col-md-3">
          <label class="form-label">Coordenada Norte</label>
          <input type="number" step="any" class="form-control map-point-northing" placeholder="Northing" required>
        </div>
        <div class="col-md-3">
          <label class="form-label">Elevação (m)</label>
          <input type="number" step="any" class="form-control map-point-altitude" placeholder="Altitude" required>
        </div>
      </div>
      <div class="d-flex justify-content-end mt-2">
        <button type="button" class="btn btn-danger btn-sm btn-remove-point" aria-label="Remover Ponto">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
    mapPointsContainer.appendChild(row);
  };

  const updateCompletionFileList = () => {
    completionFileListContainer.innerHTML = "";
    if (completionFiles.length === 0) {
      completionFileListWrapper.style.display = "none";
      return;
    }
    completionFileListWrapper.style.display = "block";
    completionFiles.forEach((file, index) => {
      const card = document.createElement("div");
      card.className = "file-preview-card";
      const extension = file.name.split(".").pop();
      const fileTypeIcon = getFileIcon(extension);
      let previewHTML = "";
      if (fileTypeIcon === "fa-solid fa-file-image") {
        previewHTML = `<img src="${URL.createObjectURL(
          file
        )}" alt="Pré-visualização de ${file.name}">`;
      } else {
        previewHTML = `<i class="${fileTypeIcon}"></i>`;
      }
      card.innerHTML = `
        <div class="file-preview-thumbnail">${previewHTML}</div>
        <div class="file-preview-info"><span class="file-preview-name">${file.name}</span></div>
        <button type="button" class="remove-file-btn" data-index="${index}" aria-label="Remover arquivo">
            <i class="fa-solid fa-xmark"></i>
        </button>
      `;
      completionFileListContainer.appendChild(card);
    });
  };

  const handleAssignClick = (servicoId) => {
    currentServiceId = servicoId;
    assignServiceIdSpan.textContent = `#${servicoId}`;
    fetchEncarregados();
    if (assignModal) assignModal.show();
  };

  const showConfirmation = (title, message, buttonClass, onConfirm) => {
    confirmationTitle.textContent = title;
    confirmationMessage.textContent = message;
    confirmActionButton.className = `btn ${buttonClass}`;
    confirmActionCallback = onConfirm;
    if (confirmationModal) confirmationModal.show();
  };

  const handleConcluirClick = (servicoId) => {
    currentServiceId = servicoId;
    completionServiceIdSpan.textContent = `#${servicoId}`;
    const now = new Date();
    completionDateInput.value = now.toISOString().split("T")[0];
    completionTimeInput.value = now
      .toTimeString()
      .split(" ")[0]
      .substring(0, 5);
    mapPointsContainer.innerHTML = "";
    completionFiles = [];
    updateCompletionFileList();
    if (completionModal) completionModal.show();
  };

  const handleExcluirClick = (servicoId) => {
    showConfirmation(
      "Excluir Serviço",
      `Atenção! Deseja realmente excluir o serviço #${servicoId} e todos os seus anexos?`,
      "btn-danger",
      async () => {
        try {
          const response = await fetch(`/api/fibra/servico/${servicoId}`, {
            method: "DELETE",
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message);
          showToast(result.message, "success");
          if (confirmationModal) confirmationModal.hide();
          window.location.reload();
        } catch (error) {
          showToast(error.message, "error");
        }
      }
    );
  };

  if (tableBody) {
    tableBody.addEventListener("click", (event) => {
      const target = event.target;
      const assignButton = target.closest(".btn-assign");
      const concluirButton = target.closest(".btn-concluir");
      const excluirButton = target.closest(".btn-excluir");
      if (assignButton || concluirButton || excluirButton) {
        const row = target.closest("tr");
        const servicoId = row.dataset.servicoId;
        if (assignButton) handleAssignClick(servicoId);
        if (concluirButton) handleConcluirClick(servicoId);
        if (excluirButton) handleExcluirClick(servicoId);
      }
    });
  }

  document
    .getElementById("btn-confirm-assign")
    ?.addEventListener("click", async () => {
      const encarregadoMatricula = encarregadoSelect.value;
      if (!encarregadoMatricula) {
        showToast("Por favor, selecione um encarregado.", "error");
        return;
      }
      try {
        const response = await fetch("/api/fibra/atribuir-encarregado", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            servicoId: currentServiceId,
            encarregadoMatricula,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        showToast(result.message, "success");
        if (assignModal) assignModal.hide();
        window.location.reload();
      } catch (error) {
        showToast(error.message, "error");
      }
    });

  confirmActionButton?.addEventListener("click", () => {
    if (typeof confirmActionCallback === "function") {
      confirmActionCallback();
    }
  });

  btnAddMapPoint?.addEventListener("click", addMapPointRow);

  mapPointsContainer?.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".btn-remove-point");
    if (removeButton) removeButton.closest(".map-point-row").remove();
  });

  completionFileInput?.addEventListener("change", (event) => {
    completionFiles.push(...Array.from(event.target.files));
    updateCompletionFileList();
    event.target.value = "";
  });

  completionFileListContainer?.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".remove-file-btn");
    if (removeButton) {
      const indexToRemove = parseInt(removeButton.dataset.index, 10);
      completionFiles.splice(indexToRemove, 1);
      updateCompletionFileList();
    }
  });

  completionForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const pontosMapa = [];
    document
      .querySelectorAll("#completion-modal .map-point-row")
      .forEach((row) => {
        const tipo = row.querySelector(".map-point-type").value;
        const tag = row.querySelector(".map-point-tag").value;
        const utm_zone = row.querySelector(".map-point-utm-zone").value;
        const easting = row.querySelector(".map-point-easting").value;
        const northing = row.querySelector(".map-point-northing").value;
        const altitude = row.querySelector(".map-point-altitude").value;
        if (tipo && tag && utm_zone && easting && northing && altitude) {
          pontosMapa.push({ tipo, tag, utm_zone, easting, northing, altitude });
        }
      });

    const formData = new FormData();
    formData.append("servicoId", currentServiceId);
    formData.append(
      "statusConclusao",
      document.getElementById("completion-status").value
    );
    formData.append("dataConclusao", completionDateInput.value);
    formData.append("horarioConclusao", completionTimeInput.value);
    formData.append("pontosMapa", JSON.stringify(pontosMapa));
    completionFiles.forEach((file) => formData.append("anexosConclusao", file));

    try {
      const response = await fetch("/api/fibra/finalizar-servico", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      showToast(result.message, "success");
      if (completionModal) completionModal.hide();
      window.location.reload();
    } catch (error) {
      showToast(error.message, "error");
    }
  });
});
