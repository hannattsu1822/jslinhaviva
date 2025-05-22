// public/scripts/trafos_reformados/trafos_reformados_importar.js

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileInput");
  const browseBtn = document.querySelector(".browse-btn");
  const fileNameDisplay = document.getElementById("fileName");
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
    ["dragenter", "dragover"].forEach((event) => {
      dropArea.addEventListener(event, (e) => {
        e.preventDefault();
        dropArea.classList.add("dragging");
      });
    });

    ["dragleave", "drop"].forEach((event) => {
      dropArea.addEventListener(event, (e) => {
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
        if (dropArea) dropArea.classList.add("has-file");
        clearMessage();
      }
    });
  }

  if (form && submitBtn) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!fileInput || !fileInput.files.length) {
        showError("Por favor, selecione um arquivo para enviar.");
        return;
      }

      const originalSubmitBtnHTML = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin me-2"></i> Processando...';
      clearMessage();

      try {
        const formData = new FormData(form);
        const response = await fetch("/api/importar_trafos_reformados", {
          method: "POST",
          body: formData,
          credentials: "same-origin",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Erro ao processar a planilha");
        }
        showSuccess(result);
        form.reset();
        if (fileNameDisplay)
          fileNameDisplay.textContent = "Nenhum arquivo selecionado";
        if (dropArea) dropArea.classList.remove("has-file");
      } catch (error) {
        showError(error.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalSubmitBtnHTML;
      }
    });
  }
});

function clearMessage() {
  const messageArea = document.getElementById("messageArea");
  if (messageArea) {
    messageArea.innerHTML = "";
    messageArea.className = "message-area";
    messageArea.style.opacity = "0"; // Para transição
    messageArea.style.height = "0";
    messageArea.style.padding = "0 1.5rem";
    messageArea.style.marginTop = "0";
  }
}

function showSuccess(result) {
  const messageArea = document.getElementById("messageArea");
  if (!messageArea) return;

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
          <div class="d-flex justify-content-between mb-2">
            <span>Falhas na importação (linhas não importadas):</span>
            <strong class="text-danger">${
              result.failed !== undefined ? result.failed : "N/A"
            }</strong>
          </div>
        </div>`;

  let existingItemsSection = "";
  if (result.duplicates_in_db && result.duplicates_in_db.length > 0) {
    existingItemsSection = `
          <div class="detail-section">
            <div class="d-flex align-items-center mb-2">
              <i class="fas fa-database text-warning me-2"></i>
              <h5 class="m-0">Transformadores já cadastrados no sistema (não alterados):</h5>
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
          <div class="detail-section">
            <div class="d-flex align-items-center mb-2">
              <i class="fas fa-copy text-danger me-2"></i>
              <h5 class="m-0">Números de série duplicados na planilha (ignorados após primeira ocorrência):</h5>
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

  let errorsDetailSection = "";
  if (result.errors_details && result.errors_details.length > 0) {
    errorsDetailSection = `
            <div class="detail-section">
                <div class="d-flex align-items-center mb-2">
                    <i class="fas fa-exclamation-triangle text-danger me-2"></i>
                    <h5 class="m-0">Detalhes dos erros:</h5>
                </div>
                <ul class="list-unstyled mb-0" style="font-size: 0.85rem;">
                    ${result.errors_details
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
          ${errorsDetailSection}
          <div class="action-buttons mt-4">
            <button type="button" class="btn btn-outline-secondary btn-sm" onclick="location.reload()">
              <i class="fas fa-redo me-2"></i>Nova Importação
            </button>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.location.href='/transformadores_reformados'">
              <i class="fas fa-list me-2"></i>Ver Transformadores Reformados
            </button>
          </div>
        </div>`;
  messageArea.className = "message-area success"; // Aplica classe depois de inserir conteúdo
  setTimeout(() => {
    // Força reflow para a transição de altura funcionar
    messageArea.style.opacity = "1";
    messageArea.style.height = messageArea.scrollHeight + "px";
    messageArea.style.padding = "1.5rem";
    messageArea.style.marginTop = "2rem";
  }, 10);
}

function showError(message) {
  const messageArea = document.getElementById("messageArea");
  if (!messageArea) return;

  messageArea.innerHTML = `
        <div class="message-icon">
          <i class="fas fa-exclamation-circle"></i>
        </div>
        <div class="message-content">
          <h4>Erro na Importação</h4>
          <p>${message || "Ocorreu um erro desconhecido."}</p>
          <button type="button" class="btn btn-outline-danger mt-3 btn-sm" onclick="location.reload()">
            <i class="fas fa-redo me-2"></i>Tentar Novamente
          </button>
        </div>`;
  messageArea.className = "message-area error";
  setTimeout(() => {
    messageArea.style.opacity = "1";
    messageArea.style.height = messageArea.scrollHeight + "px";
    messageArea.style.padding = "1.5rem";
    messageArea.style.marginTop = "2rem";
  }, 10);
}
