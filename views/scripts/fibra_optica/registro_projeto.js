document.addEventListener("DOMContentLoaded", () => {
  const choiceModal = document.getElementById("choice-modal");
  const formContainer = document.getElementById("form-container");
  const form = document.getElementById("form-registro-servico");

  const btnGerarEmergencial = document.getElementById("btn-gerar-emergencial");
  const btnGerarNormal = document.getElementById("btn-gerar-normal");
  const btnCancelarRegistro = document.getElementById("btn-cancelar-registro");
  const submitButton = document.getElementById("btn-submit-form");

  const serviceTypeDisplay = document.getElementById("service-type-display");
  const processoInput = document.getElementById("processo");
  const processoLabel = processoInput.previousElementSibling;

  const fileDropZone = document.querySelector(".file-drop-zone"); // Seleciona a área clicável
  const fileInput = document.getElementById("file-input");
  const fileListWrapper = document.getElementById("file-list-wrapper");
  const fileListContainer = document.getElementById("file-list");
  const fileSizeInfo = document.getElementById("file-size-info");

  const MAX_TOTAL_SIZE = 50 * 1024 * 1024;
  let currentServiceType = null;
  let storedFiles = [];

  // --- CORREÇÃO 3: Adicionando o event listener para o botão de anexo ---
  if (fileDropZone && fileInput) {
    // Abre o seletor de arquivos ao clicar na área
    fileDropZone.addEventListener("click", () => {
      fileInput.click();
    });

    // Permite o uso do teclado para acessibilidade
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
      fileListContainer.appendChild(fileItem);
    });

    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    const limitMB = (MAX_TOTAL_SIZE / (1024 * 1024)).toFixed(2);
    fileSizeInfo.innerHTML = `<span>Tamanho total: <strong>${totalSizeMB} MB / ${limitMB} MB</strong></span>`;

    if (totalSize > MAX_TOTAL_SIZE) {
      fileSizeInfo.classList.add("limit-exceeded");
      submitButton.disabled = true;
      showToast(
        `Tamanho total dos arquivos excede o limite de ${limitMB} MB.`,
        "error"
      );
    } else {
      fileSizeInfo.classList.remove("limit-exceeded");
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
    const removeButton = event.target.closest(".remove-file-btn");
    if (removeButton) {
      const indexToRemove = parseInt(removeButton.dataset.index, 10);
      storedFiles.splice(indexToRemove, 1);
      updateFileList();
    }
  });

  const setupFormForServiceType = (type) => {
    currentServiceType = type;
    const isNormal = type === "normal";
    serviceTypeDisplay.textContent = isNormal ? "Normal" : "Emergencial";
    processoInput.required = isNormal;

    const requiredSpan = processoLabel.querySelector(".required");
    if (requiredSpan) requiredSpan.remove();

    if (isNormal) {
      const newSpan = document.createElement("span");
      newSpan.className = "required";
      newSpan.textContent = "*";
      processoLabel.appendChild(newSpan);
    }

    choiceModal.classList.add("hidden");
    formContainer.classList.remove("hidden");
  };

  const resetToChoice = () => {
    formContainer.classList.add("hidden");
    form.reset();
    storedFiles = [];
    updateFileList();
    choiceModal.classList.remove("hidden");
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
    submitButton.innerHTML = `<span class="material-symbols-outlined rotating">progress_activity</span> Salvando...`;

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
