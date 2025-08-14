document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.querySelector(".data-table tbody");

  const assignModal = document.getElementById("assign-modal");
  const confirmationModal = document.getElementById("confirmation-modal");
  const completionModal = document.getElementById("completion-modal");

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

  const showModal = (modal) => modal.classList.remove("hidden");
  const hideModal = (modal) => modal.classList.add("hidden");

  const getFileIcon = (extension) => {
    const ext = extension.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext))
      return "image";
    switch (ext) {
      case "pdf":
        return "picture_as_pdf";
      case "doc":
      case "docx":
        return "description";
      case "xls":
      case "xlsx":
        return "spreadsheet";
      case "txt":
        return "article";
      default:
        return "draft";
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
    row.className = "map-point-row";
    row.innerHTML = `
      <div class="input-row">
        <div class="input-group flex-2">
          <label>Tipo de Ponto</label>
          <select class="map-point-type" required>
            <option value="" disabled selected>Selecione o Tipo</option>
            <option value="Reserva">Reserva</option>
            <option value="Poste">Poste</option>
            <option value="Caixa de Emenda">Caixa de Emenda</option>
            <option value="Cliente">Cliente</option>
            <option value="Outro">Outro</option>
          </select>
        </div>
        <div class="input-group flex-1">
          <label>TAG do Ponto</label>
          <input type="text" class="map-point-tag" placeholder="Identificação" required>
        </div>
      </div>
      <div class="input-row">
        <div class="input-group">
          <label>Latitude</label>
          <input type="number" step="any" class="map-point-x" placeholder="-22.123456" required>
        </div>
        <div class="input-group">
          <label>Longitude</label>
          <input type="number" step="any" class="map-point-y" placeholder="-45.123456" required>
        </div>
        <div class="input-group-buttons">
          <button type="button" class="btn-get-coords" aria-label="Obter Coordenadas GPS">
            <span class="material-symbols-outlined">my_location</span>
          </button>
          <button type="button" class="btn-remove-point" aria-label="Remover Ponto">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
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
      const fileType = getFileIcon(extension);
      let previewHTML = "";
      if (fileType === "image") {
        previewHTML = `<img src="${URL.createObjectURL(
          file
        )}" alt="Pré-visualização de ${file.name}">`;
      } else {
        previewHTML = `<span class="material-symbols-outlined">${fileType}</span>`;
      }
      card.innerHTML = `
        <div class="file-preview-thumbnail">${previewHTML}</div>
        <div class="file-preview-info"><span class="file-preview-name">${file.name}</span></div>
        <button type="button" class="remove-file-btn" data-index="${index}" aria-label="Remover arquivo">
            <span class="material-symbols-outlined">close</span>
        </button>
      `;
      completionFileListContainer.appendChild(card);
    });
  };

  const handleGetCoordinates = (button) => {
    if (!navigator.geolocation) {
      showToast("Geolocalização não é suportada por este navegador.", "error");
      return;
    }
    button.innerHTML = `<span class="material-symbols-outlined rotating">progress_activity</span>`;
    button.disabled = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const row = button.closest(".map-point-row");
        row.querySelector(".map-point-x").value =
          position.coords.latitude.toFixed(8);
        row.querySelector(".map-point-y").value =
          position.coords.longitude.toFixed(8);
        showToast("Coordenadas obtidas com sucesso!", "success");
        button.innerHTML = `<span class="material-symbols-outlined">my_location</span>`;
        button.disabled = false;
      },
      (error) => {
        showToast(`Erro ao obter GPS: ${error.message}`, "error");
        button.innerHTML = `<span class="material-symbols-outlined">my_location</span>`;
        button.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleAssignClick = (servicoId) => {
    currentServiceId = servicoId;
    assignServiceIdSpan.textContent = `#${servicoId}`;
    fetchEncarregados();
    showModal(assignModal);
  };

  const showConfirmation = (title, message, buttonClass, onConfirm) => {
    confirmationTitle.textContent = title;
    confirmationMessage.textContent = message;
    confirmActionButton.className = `btn ${buttonClass}`;
    confirmActionCallback = onConfirm;
    showModal(confirmationModal);
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
    showModal(completionModal);
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
          hideModal(confirmationModal);
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
    .addEventListener("click", async () => {
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
        hideModal(assignModal);
        window.location.reload();
      } catch (error) {
        showToast(error.message, "error");
      }
    });

  confirmActionButton.addEventListener("click", () => {
    if (typeof confirmActionCallback === "function") {
      confirmActionCallback();
    }
  });

  btnAddMapPoint.addEventListener("click", addMapPointRow);

  mapPointsContainer.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".btn-remove-point");
    const getCoordsButton = event.target.closest(".btn-get-coords");
    if (removeButton) removeButton.closest(".map-point-row").remove();
    if (getCoordsButton) handleGetCoordinates(getCoordsButton);
  });

  completionFileInput.addEventListener("change", (event) => {
    completionFiles.push(...Array.from(event.target.files));
    updateCompletionFileList();
    event.target.value = "";
  });

  completionFileListContainer.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".remove-file-btn");
    if (removeButton) {
      const indexToRemove = parseInt(removeButton.dataset.index, 10);
      completionFiles.splice(indexToRemove, 1);
      updateCompletionFileList();
    }
  });

  completionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const pontosMapa = [];
    document
      .querySelectorAll("#completion-modal .map-point-row")
      .forEach((row) => {
        const tipo = row.querySelector(".map-point-type").value;
        const tag = row.querySelector(".map-point-tag").value;
        const x = row.querySelector(".map-point-x").value;
        const y = row.querySelector(".map-point-y").value;
        if (tipo && tag && x && y) pontosMapa.push({ tipo, tag, x, y });
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
      hideModal(completionModal);
      window.location.reload();
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  assignModal
    .querySelector(".modal-close-btn")
    .addEventListener("click", () => hideModal(assignModal));
  document
    .getElementById("btn-cancel-assign")
    .addEventListener("click", () => hideModal(assignModal));
  confirmationModal
    .querySelector(".modal-close-btn")
    ?.addEventListener("click", () => hideModal(confirmationModal));
  document
    .getElementById("btn-cancel-confirmation")
    .addEventListener("click", () => hideModal(confirmationModal));
  completionModal
    .querySelector(".modal-close-btn")
    .addEventListener("click", () => hideModal(completionModal));
  document
    .getElementById("btn-cancel-completion")
    .addEventListener("click", () => hideModal(completionModal));

  const style = document.createElement("style");
  style.innerHTML = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .rotating { animation: spin 1s linear infinite; }`;
  document.head.appendChild(style);
});
