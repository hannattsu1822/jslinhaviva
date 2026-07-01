document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileInput");
  const browseBtn = document.querySelector(".browse-btn");
  const fileNameDisplay = document.getElementById("fileName");
  const dropArea = document.getElementById("dropArea");
  const submitBtn = document.getElementById("submitBtn");
  const previewBtn = document.getElementById("previewBtn");
  const form = document.getElementById("uploadForm");

  if (browseBtn && fileInput) {
    browseBtn.addEventListener("click", () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (fileNameDisplay) {
        fileNameDisplay.textContent = file ? file.name : "Nenhum arquivo selecionado";
      }
      if (dropArea) dropArea.classList.toggle("has-file", !!file);
      clearMessage();
    });
  }

  if (dropArea && fileInput) {
    ["dragenter", "dragover"].forEach((eventName) => {
      dropArea.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropArea.classList.add("dragging");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropArea.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropArea.classList.remove("dragging");
      });
    });

    dropArea.addEventListener("drop", (event) => {
      event.preventDefault();
      const file = event.dataTransfer.files && event.dataTransfer.files[0];
      if (!file) return;
      fileInput.files = event.dataTransfer.files;
      if (fileNameDisplay) fileNameDisplay.textContent = file.name;
      dropArea.classList.add("has-file");
      clearMessage();
    });
  }

  async function enviarImportacao({ dryRun }) {
    if (!fileInput || !fileInput.files.length) {
      showError("Por favor, selecione um arquivo para enviar.");
      return;
    }

    const originalSubmitBtnHTML = submitBtn ? submitBtn.innerHTML : "";
    const originalPreviewBtnHTML = previewBtn ? previewBtn.innerHTML : "";

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin me-2"></i> Processando...';
    }
    if (previewBtn) {
      previewBtn.disabled = true;
      previewBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin me-2"></i> Simulando...';
    }
    clearMessage();

    try {
      const url = dryRun
        ? "/api/upload_transformadores?dryRun=true"
        : "/api/upload_transformadores";
      const response = await fetch(url, {
        method: "POST",
        body: new FormData(form),
        credentials: "same-origin",
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result) {
        throw new Error(
          (result && result.message) || "Erro ao processar a planilha."
        );
      }

      showSuccess(result);
      if (!dryRun) {
        form.reset();
        if (fileNameDisplay) fileNameDisplay.textContent = "Nenhum arquivo selecionado";
        if (dropArea) dropArea.classList.remove("has-file");
      }
    } catch (error) {
      showError(error.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalSubmitBtnHTML;
      }
      if (previewBtn) {
        previewBtn.disabled = false;
        previewBtn.innerHTML = originalPreviewBtnHTML;
      }
    }
  }

  if (form && submitBtn) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await enviarImportacao({ dryRun: false });
    });
  }

  if (previewBtn) {
    previewBtn.addEventListener("click", async () => {
      await enviarImportacao({ dryRun: true });
    });
  }
});

function clearMessage() {
  const messageArea = document.getElementById("messageArea");
  if (!messageArea) return;
  messageArea.innerHTML = "";
  messageArea.className = "message-area";
  messageArea.style.opacity = "0";
  messageArea.style.height = "0";
  messageArea.style.padding = "0 1.5rem";
  messageArea.style.marginTop = "0";
}

function showSuccess(result) {
  const messageArea = document.getElementById("messageArea");
  if (!messageArea) return;

  const data = result.data || {};
  const details = Array.isArray(data.details) ? data.details : [];
  const errors = details.filter((item) => item.status === "error");
  const warnings = details.filter((item) => item.status === "warning");

  messageArea.innerHTML = `
    <div class="message-icon">
      <i class="fas fa-check-circle"></i>
    </div>
    <div class="message-content">
      <h4>${escapeText(result.message || "Importação concluída.")}</h4>
      ${data.dry_run ? '<div class="alert alert-info py-2 mb-3">Simulação concluída. Nenhuma alteração foi gravada no banco.</div>' : ""}
      ${renderSummary(data)}
      ${renderDetails("Detalhes das falhas", errors, "text-danger")}
      ${renderDetails("Avisos", warnings, "text-warning")}
    </div>`;
  messageArea.className =
    Number(data.failed_rows || 0) > 0 ? "message-area error" : "message-area success";
  showMessageArea(messageArea);
}

function renderSummary(data) {
  return `
    <div class="result-summary">
      <div class="d-flex justify-content-between mb-2">
        <span>Total de linhas processadas:</span>
        <strong>${escapeText(data.total_rows ?? "N/A")}</strong>
      </div>
      <div class="d-flex justify-content-between mb-2">
        <span>Novos transformadores cadastrados:</span>
        <strong class="text-success">${escapeText(data.new_trafos_imported ?? 0)}</strong>
      </div>
      <div class="d-flex justify-content-between mb-2">
        <span>Transformadores atualizados:</span>
        <strong>${escapeText(data.trafos_updated ?? 0)}</strong>
      </div>
      <div class="d-flex justify-content-between mb-2">
        <span>Checklists importados:</span>
        <strong>${escapeText(data.checklists_imported ?? 0)}</strong>
      </div>
      <div class="d-flex justify-content-between mb-2">
        <span>Linhas com falha:</span>
        <strong class="text-danger">${escapeText(data.failed_rows ?? 0)}</strong>
      </div>
    </div>`;
}

function renderDetails(title, items, colorClass) {
  if (!items.length) return "";
  return `
    <div class="detail-section mt-3">
      <div class="d-flex align-items-center mb-2">
        <i class="fas fa-circle-info ${colorClass} me-2"></i>
        <h5 class="m-0">${escapeText(title)}</h5>
      </div>
      <ul class="list-unstyled mb-0" style="font-size: 0.85rem;">
        ${items
          .map(
            (item) =>
              `<li>Linha ${escapeText(item.linha)}: ${escapeText(item.message || item.erro || "Sem detalhe")} (Série: ${escapeText(item.numero_serie || "N/A")})</li>`
          )
          .join("")}
      </ul>
    </div>`;
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
      <p>${escapeText(message || "Ocorreu um erro desconhecido.")}</p>
    </div>`;
  messageArea.className = "message-area error";
  showMessageArea(messageArea);
}

function showMessageArea(messageArea) {
  setTimeout(() => {
    messageArea.style.opacity = "1";
    messageArea.style.height = messageArea.scrollHeight + "px";
    messageArea.style.padding = "1.5rem";
    messageArea.style.marginTop = "2rem";
  }, 10);
}

function escapeText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
