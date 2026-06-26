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
        '<i class="fa-solid fa-spinner fa-spin me-2"></i> Processando...';
      clearMessage();

      try {
        const formData = new FormData(form);
        const response = await fetch("/api/upload_transformadores", {
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
    messageArea.style.opacity = "0";
    messageArea.style.height = "0";
    messageArea.style.padding = "0 1.5rem";
    messageArea.style.marginTop = "0";
  }
}

function showSuccess(result) {
  const messageArea = document.getElementById("messageArea");
  if (!messageArea) return;

  const data = result.data || {};
  const successDetails = `
        <div class="result-summary">
          <div class="d-flex justify-content-between mb-2">
            <span>Total de linhas processadas:</span>
            <strong>${data.total_rows ?? "N/A"}</strong>
          </div>
          <div class="d-flex justify-content-between mb-2">
            <span>Novos transformadores cadastrados:</span>
            <strong class="text-success">${data.new_trafos_imported ?? 0}</strong>
          </div>
          <div class="d-flex justify-content-between mb-2">
            <span>Transformadores atualizados:</span>
            <strong>${data.trafos_updated ?? 0}</strong>
          </div>
          <div class="d-flex justify-content-between mb-2">
            <span>Checklists importados:</span>
            <strong>${data.checklists_imported ?? 0}</strong>
          </div>
          <div class="d-flex justify-content-between mb-2">
            <span>Linhas com falha:</span>
            <strong class="text-danger">${data.failed_rows ?? 0}</strong>
          </div>
        </div>`;

  messageArea.innerHTML = safeHtml`
        <div class="message-icon">
          <i class="fa-solid fa-circle-check"></i>
        </div>
        <div class="message-content">
          <h4>${result.message || "Importação Concluída!"}</h4>
          ${successDetails}
          <div class="action-buttons mt-4">
            <button type="button" class="btn btn-outline-secondary btn-sm" data-action="reload">
              <i class="fa-solid fa-rotate-right me-2"></i>Nova Importação
            </button>
            <button type="button" class="btn btn-primary btn-sm" data-action="navigate" data-href="/transformadores">
              <i class="fa-solid fa-bolt me-2"></i>Voltar ao Hub
            </button>
          </div>
        </div>`;
  messageArea.className = "message-area success";
  setTimeout(() => {
    messageArea.style.opacity = "1";
    messageArea.style.height = messageArea.scrollHeight + "px";
    messageArea.style.padding = "1.5rem";
    messageArea.style.marginTop = "2rem";
  }, 10);
}

function showError(message) {
  const messageArea = document.getElementById("messageArea");
  if (!messageArea) return;

  messageArea.innerHTML = safeHtml`
        <div class="message-icon">
          <i class="fa-solid fa-circle-exclamation"></i>
        </div>
        <div class="message-content">
          <h4>Erro na Importação</h4>
          <p>${message || "Ocorreu um erro desconhecido."}</p>
          <button type="button" class="btn btn-outline-danger mt-3 btn-sm" data-action="reload">
            <i class="fa-solid fa-rotate-right me-2"></i>Tentar Novamente
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
