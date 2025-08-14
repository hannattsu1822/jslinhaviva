document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.querySelector(".data-table tbody");

  const aprModal = document.getElementById("apr-modal");
  const confirmationModal = document.getElementById("confirmation-modal");

  const aprForm = document.getElementById("apr-form");
  const aprServiceIdSpan = document.getElementById("apr-service-id");
  const aprFileInput = document.getElementById("apr-file-input");
  const aprFileListWrapper = document.getElementById("apr-file-list-wrapper");
  const aprFileListContainer = document.getElementById("apr-file-list");

  const confirmationTitle = document.getElementById("confirmation-title");
  const confirmationMessage = document.getElementById("confirmation-message");
  const confirmActionButton = document.getElementById("btn-confirm-action");

  let currentServiceId = null;
  let confirmActionCallback = null;
  let aprFiles = [];

  const showModal = (modal) => modal.classList.remove("hidden");
  const hideModal = (modal) => modal.classList.add("hidden");

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const updateAprFileList = () => {
    aprFileListContainer.innerHTML = "";
    if (aprFiles.length === 0) {
      aprFileListWrapper.style.display = "none";
      return;
    }
    aprFileListWrapper.style.display = "block";
    aprFiles.forEach((file, index) => {
      const fileItem = document.createElement("div");
      fileItem.className = "file-list-item";
      fileItem.innerHTML = `
                <div class="file-details">
                    <span class="material-symbols-outlined">description</span>
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">(${formatBytes(file.size)})</span>
                </div>
                <button type="button" class="remove-file-btn" data-index="${index}" aria-label="Remover arquivo">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            `;
      aprFileListContainer.appendChild(fileItem);
    });
  };

  const showConfirmation = (title, message, buttonClass, onConfirm) => {
    confirmationTitle.textContent = title;
    confirmationMessage.textContent = message;
    confirmActionButton.className = `btn ${buttonClass}`;
    confirmActionCallback = onConfirm;
    showModal(confirmationModal);
  };

  const handleAprClick = (servicoId) => {
    currentServiceId = servicoId;
    aprServiceIdSpan.textContent = `#${servicoId}`;
    aprFiles = [];
    updateAprFileList();
    showModal(aprModal);
  };

  const handleReabrirClick = (servicoId) => {
    showConfirmation(
      "Reabrir Serviço",
      `Tem certeza que deseja reabrir o serviço #${servicoId}? Ele voltará para a lista de "Serviços em Andamento".`,
      "btn-primary",
      async () => {
        try {
          const response = await fetch("/api/fibra/reabrir-servico", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ servicoId }),
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
      const aprButton = target.closest(".btn-apr");
      const reabrirButton = target.closest(".btn-reabrir");

      if (aprButton || reabrirButton) {
        const row = target.closest("tr");
        const servicoId = row.dataset.servicoId;

        if (aprButton) handleAprClick(servicoId);
        if (reabrirButton) handleReabrirClick(servicoId);
      }
    });
  }

  confirmActionButton.addEventListener("click", () => {
    if (typeof confirmActionCallback === "function") {
      confirmActionCallback();
    }
  });

  aprFileInput.addEventListener("change", (event) => {
    aprFiles.push(...Array.from(event.target.files));
    updateAprFileList();
    event.target.value = "";
  });

  aprFileListContainer.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".remove-file-btn");
    if (removeButton) {
      const indexToRemove = parseInt(removeButton.dataset.index, 10);
      aprFiles.splice(indexToRemove, 1);
      updateAprFileList();
    }
  });

  aprForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (aprFiles.length === 0) {
      showToast("Por favor, selecione ao menos um arquivo.", "error");
      return;
    }

    const formData = new FormData();
    formData.append("servicoId", currentServiceId);
    aprFiles.forEach((file) => formData.append("anexosAPR", file));

    try {
      const response = await fetch("/api/fibra/upload-apr", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      showToast(result.message, "success");
      hideModal(aprModal);
      window.location.reload();
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  aprModal
    .querySelector(".modal-close-btn")
    .addEventListener("click", () => hideModal(aprModal));
  document
    .getElementById("btn-cancel-apr")
    .addEventListener("click", () => hideModal(aprModal));
  document
    .getElementById("btn-cancel-confirmation")
    .addEventListener("click", () => hideModal(confirmationModal));
});
