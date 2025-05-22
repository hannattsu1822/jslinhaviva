// public/scripts/trafos/upload_transformadores.js

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileInput");
  const browseBtn = document.querySelector(".browse-btn");
  const fileNameDisplay = document.getElementById("fileName"); // Renomeado para evitar conflito com a variável global fileName
  const dropArea = document.getElementById("dropArea");
  const submitBtn = document.getElementById("submitBtn");
  const messageArea = document.getElementById("messageArea");
  const form = document.getElementById("uploadForm");

  if (browseBtn && fileInput) {
    browseBtn.addEventListener("click", () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length) {
        if (fileNameDisplay)
          fileNameDisplay.textContent = e.target.files[0].name;
        if (dropArea) dropArea.classList.add("has-file");
        clearMessage();
      } else {
        if (fileNameDisplay)
          fileNameDisplay.textContent = "Nenhum arquivo selecionado";
        if (dropArea) dropArea.classList.remove("has-file");
      }
    });
  }

  if (dropArea) {
    ["dragenter", "dragover"].forEach((eventName) => {
      dropArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropArea.classList.add("dragging");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropArea.classList.remove("dragging");
      });
    });

    dropArea.addEventListener("drop", (e) => {
      e.preventDefault();
      if (fileInput && e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        if (fileNameDisplay)
          fileNameDisplay.textContent = e.dataTransfer.files[0].name;
        dropArea.classList.add("has-file");
        clearMessage();
      }
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!fileInput.files.length) {
        showError("Por favor, selecione um arquivo para enviar.");
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML =
          '<i class="fas fa-spinner fa-spin me-2"></i> Enviando...';
      }
      clearMessage();

      try {
        const formData = new FormData(form);
        const response = await fetch(form.action, {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Erro ao processar a planilha");
        }
        showSuccess(result);
        form.reset(); // Limpa o formulário
        if (fileNameDisplay)
          fileNameDisplay.textContent = "Nenhum arquivo selecionado";
        if (dropArea) dropArea.classList.remove("has-file");
      } catch (error) {
        showError(error.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML =
            '<i class="fas fa-upload me-2"></i>Enviar Planilha';
        }
      }
    });
  }
});

function clearMessage() {
  const messageArea = document.getElementById("messageArea");
  if (messageArea) {
    messageArea.innerHTML = "";
    messageArea.className = "message-area";
  }
}

function showSuccess(result) {
  const messageArea = document.getElementById("messageArea");
  if (!messageArea) return;

  messageArea.className = "message-area success";

  let successDetails = `
        <div class="result-summary">
          <div class="d-flex justify-content-between mb-2">
            <span>Total de linhas na planilha processado:</span>
            <strong>${
              result.total !== undefined ? result.total : "N/A"
            }</strong>
          </div>
          <div class="d-flex justify-content-between mb-2">
            <span>Novos transformadores cadastrados:</span>
            <strong class="text-success">${
              result.imported !== undefined ? result.imported : "N/A"
            }</strong>
          </div>
        </div>`;

  let existingItemsSection = "";
  if (result.duplicates_in_db && result.duplicates_in_db.length > 0) {
    existingItemsSection = `
          <div class="mt-3">
            <div class="d-flex align-items-center mb-2">
              <i class="fas fa-database text-warning me-2"></i>
              <h5 class="m-0" style="font-size: 1rem;">Transformadores já existentes no sistema (não alterados):</h5>
            </div>
            <div class="d-flex flex-wrap">
              ${result.duplicates_in_db
                .map(
                  (num) =>
                    `<span class="serial-badge bg-warning-light">${num}</span>`
                )
                .join("")}
            </div>
          </div>`;
  }

  let duplicatesSheetSection = "";
  if (result.duplicates_in_sheet && result.duplicates_in_sheet.length > 0) {
    duplicatesSheetSection = `
          <div class="mt-3">
            <div class="d-flex align-items-center mb-2">
              <i class="fas fa-copy text-danger me-2"></i>
              <h5 class="m-0" style="font-size: 1rem;">Números de série duplicados na planilha (ignorados após primeira ocorrência):</h5>
            </div>
            <div class="d-flex flex-wrap">
              ${result.duplicates_in_sheet
                .map(
                  (num) =>
                    `<span class="serial-badge bg-danger-light">${num}</span>`
                )
                .join("")}
            </div>
          </div>`;
  }

  let errorsSection = "";
  if (result.errors && result.errors.length > 0) {
    errorsSection = `
          <div class="mt-3">
            <div class="d-flex align-items-center mb-2">
              <i class="fas fa-exclamation-triangle text-danger me-2"></i>
              <h5 class="m-0" style="font-size: 1rem;">Erros durante a importação (linhas não importadas):</h5>
            </div>
            <ul>
              ${result.errors
                .map(
                  (err) =>
                    `<li>Linha ${err.linha}: ${err.erro} (Série: ${
                      err.numero_serie || "N/A"
                    })</li>`
                )
                .join("")}
            </ul>
          </div>`;
  }

  messageArea.innerHTML = `
        <div class="message-icon">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="message-content">
          <h4>${result.message || "Importação Concluída!"}</h4>
          ${successDetails}
          ${existingItemsSection}
          ${duplicatesSheetSection}
          ${errorsSection}
          <div class="d-flex justify-content-between mt-4">
            <button type="button" class="btn btn-outline-secondary btn-sm" onclick="location.reload()">
              <i class="fas fa-redo me-2"></i>Nova Importação
            </button>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.location.href='/transformadores'">
              <i class="fas fa-list me-2"></i>Ver Lista de Transformadores
            </button>
          </div>
        </div>`;
}

function showError(message) {
  const messageArea = document.getElementById("messageArea");
  if (!messageArea) return;
  messageArea.className = "message-area error";
  messageArea.innerHTML = `
        <div class="message-icon">
          <i class="fas fa-exclamation-circle"></i>
        </div>
        <div class="message-content">
          <h4>Erro no Processamento</h4>
          <p>${message || "Ocorreu um erro desconhecido."}</p>
          <button type="button" class="btn btn-outline-danger mt-3 btn-sm" onclick="location.reload()">
            <i class="fas fa-redo me-2"></i>Tentar Novamente
          </button>
        </div>`;
}
