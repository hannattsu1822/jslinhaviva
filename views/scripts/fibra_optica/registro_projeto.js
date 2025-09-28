document.addEventListener("DOMContentLoaded", () => {
  const choiceModalEl = document.getElementById("choice-modal");
  const choiceModal = choiceModalEl
    ? new bootstrap.Modal(choiceModalEl, {
        backdrop: "static",
        keyboard: false,
      })
    : null;

  const formContainer = document.getElementById("form-container");
  const form = document.getElementById("form-registro-servico");

  const btnGerarEmergencial = document.getElementById("btn-gerar-emergencial");
  const btnGerarNormal = document.getElementById("btn-gerar-normal");
  const btnCancelarRegistro = document.getElementById("btn-cancelar-registro");
  const submitButton = document.getElementById("btn-submit-form");

  const serviceTypeDisplay = document.getElementById("service-type-display");
  const processoInput = document.getElementById("processo");
  const processoLabel = document.querySelector('label[for="processo"]');

  const programadoSwitchContainer = document.getElementById(
    "programado-switch-container"
  );
  const programadoSwitch = document.getElementById("servico-programado");
  const horariosContainer = document.getElementById("horarios-container");
  const horarioInicioInput = document.getElementById("horarioInicio");
  const horarioFimInput = document.getElementById("horarioFim");

  const fileDropZone = document.querySelector(".file-drop-zone");
  const fileInput = document.getElementById("file-input");
  const fileListWrapper = document.getElementById("file-list-wrapper");
  const fileListContainer = document.getElementById("file-list");
  const fileSizeInfo = document.getElementById("file-size-info");

  const MAX_TOTAL_SIZE = 50 * 1024 * 1024;
  let currentServiceType = null;
  let storedFiles = [];

  if (choiceModal) {
    choiceModal.show();
  }

  if (fileDropZone && fileInput) {
    fileDropZone.addEventListener("click", () => {
      fileInput.click();
    });

    fileDropZone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        fileInput.click();
      }
    });
  }

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const updateFileList = () => {
    fileListContainer.innerHTML = "";
    let totalSize = 0;

    if (storedFiles.length === 0) {
      fileListWrapper.style.display = "none";
      return;
    }

    fileListWrapper.style.display = "block";

    storedFiles.forEach((file, index) => {
      totalSize += file.size;
      const fileItem = document.createElement("div");
      fileItem.className =
        "list-group-item d-flex justify-content-between align-items-center";
      fileItem.innerHTML = `
        <span>
          <i class="fa-solid fa-file me-2"></i>
          ${file.name}
          <small class="text-muted ms-2">(${formatBytes(file.size)})</small>
        </span>
        <button type="button" class="btn-close" data-index="${index}" aria-label="Remover arquivo"></button>
      `;
      fileListContainer.appendChild(fileItem);
    });

    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    const limitMB = (MAX_TOTAL_SIZE / (1024 * 1024)).toFixed(2);
    fileSizeInfo.innerHTML = `<span>Tamanho total: <strong>${totalSizeMB} MB / ${limitMB} MB</strong></span>`;

    if (totalSize > MAX_TOTAL_SIZE) {
      fileSizeInfo.classList.add("text-danger");
      submitButton.disabled = true;
      showToast(
        `Tamanho total dos arquivos excede o limite de ${limitMB} MB.`,
        "error"
      );
    } else {
      fileSizeInfo.classList.remove("text-danger");
      submitButton.disabled = false;
    }
  };

  fileInput.addEventListener("change", (event) => {
    const newFiles = Array.from(event.target.files);
    storedFiles.push(...newFiles);
    updateFileList();
    event.target.value = "";
  });

  fileListContainer.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".btn-close");
    if (removeButton) {
      const indexToRemove = parseInt(removeButton.dataset.index, 10);
      storedFiles.splice(indexToRemove, 1);
      updateFileList();
    }
  });

  programadoSwitch.addEventListener("change", () => {
    const isProgramado = programadoSwitch.checked;
    horariosContainer.style.display = isProgramado ? "block" : "none";
    horarioInicioInput.required = isProgramado;
    horarioFimInput.required = isProgramado;
  });

  const setupFormForServiceType = (type) => {
    currentServiceType = type;
    const isNormal = type === "normal";

    if (isNormal) {
      serviceTypeDisplay.innerHTML =
        '<span class="badge bg-primary">Normal</span>';
      programadoSwitchContainer.style.display = "block";
    } else {
      serviceTypeDisplay.innerHTML =
        '<span class="badge bg-danger">Emergencial</span>';
      programadoSwitchContainer.style.display = "none";
    }

    programadoSwitch.checked = false;
    horariosContainer.style.display = "none";
    horarioInicioInput.required = false;
    horarioFimInput.required = false;

    processoInput.required = isNormal;
    processoLabel.classList.toggle("required", isNormal);

    if (choiceModal) choiceModal.hide();
    formContainer.classList.remove("hidden");
  };

  const resetToChoice = () => {
    formContainer.classList.add("hidden");
    form.reset();
    storedFiles = [];
    updateFileList();
    if (choiceModal) choiceModal.show();
    currentServiceType = null;
  };

  btnGerarEmergencial.addEventListener("click", () =>
    setupFormForServiceType("emergencial")
  );
  btnGerarNormal.addEventListener("click", () =>
    setupFormForServiceType("normal")
  );
  btnCancelarRegistro.addEventListener("click", resetToChoice);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const originalButtonHTML = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...`;

    const formData = new FormData(form);
    formData.append("tipoGeracao", currentServiceType);
    storedFiles.forEach((file) => {
      formData.append("anexos", file);
    });

    try {
      const response = await fetch("/registro_projeto_fibra", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        showToast(result.message, "success");
        setTimeout(() => {
          window.location.href = "/projetos_fibra_andamento";
        }, 1500);
      } else {
        throw new Error(result.message || "Ocorreu um erro desconhecido.");
      }
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonHTML;
    }
  });
});
