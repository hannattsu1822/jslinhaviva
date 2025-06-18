// public/scripts/trafos/upload_transformadores.js

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileInput");
  const browseBtn = document.querySelector(".browse-btn");
  const fileNameDisplay = document.getElementById("fileName");
  const dropArea = document.getElementById("dropArea");
  const submitBtn = document.getElementById("submitBtn");
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

        if (!response.ok || !result.success) {
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

function formatarDataSimples(dataISO) {
  if (!dataISO) return "N/A";
  // Verifica se a data já está no formato DD/MM/YYYY (caso venha assim do backend, improvável com toISOString)
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataISO)) {
    return dataISO;
  }
  // Assume formato YYYY-MM-DD ou similar que o Date.parse entenda
  const dateObj = new Date(dataISO + "T00:00:00Z"); // Adiciona T00:00:00Z para tratar como UTC e evitar problemas de fuso
  if (isNaN(dateObj.getTime())) return "Data Inválida";

  const dia = String(dateObj.getUTCDate()).padStart(2, "0");
  const mes = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const ano = dateObj.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

function showSuccess(result) {
  const messageArea = document.getElementById("messageArea");
  if (!messageArea) return;

  messageArea.className = "message-area success";
  const resultData = result.data || {};
  const totalChecklists =
    resultData.checklists_imported !== undefined
      ? resultData.checklists_imported
      : 0;
  const newTrafos =
    resultData.new_trafos_imported !== undefined
      ? resultData.new_trafos_imported
      : 0;
  const checklistsForExisting = totalChecklists - newTrafos;

  let summaryDetails = `
        <div class="result-summary">
          <div class="d-flex justify-content-between mb-2">
            <span>Total de linhas na planilha:</span>
            <strong>${
              resultData.total_rows !== undefined
                ? resultData.total_rows
                : "N/A"
            }</strong>
          </div>
          <div class="d-flex justify-content-between mb-2">
            <span>Novos transformadores cadastrados:</span>
            <strong class="text-success">${newTrafos}</strong>
          </div>
          <div class="d-flex justify-content-between mb-2">
            <span>Checklists importados com sucesso:</span>
            <strong class="text-success">${totalChecklists}</strong>
          </div>`;
  if (checklistsForExisting > 0) {
    summaryDetails += `
            <div class="d-flex justify-content-between mb-2">
              <span>  &#hookrightarrow; Sendo para transformadores já existentes:</span>
              <strong class="text-info">${checklistsForExisting}</strong>
            </div>`;
  }
  summaryDetails += `</div>`;

  let warningsSection = "";
  if (resultData.warnings_planilha && resultData.warnings_planilha.length > 0) {
    warningsSection = `
        <div class="mt-3 alert alert-warning p-2" style="font-size: 0.9rem;">
            <h6 class="alert-heading" style="font-size: 1rem;"><i class="fas fa-exclamation-triangle me-2"></i>Avisos da Planilha:</h6>
            <ul class="mb-0">
                ${resultData.warnings_planilha
                  .map((warn) => `<li>${warn}</li>`)
                  .join("")}
            </ul>
        </div>`;
  }

  let detailsList = "";
  if (resultData.details && resultData.details.length > 0) {
    resultData.details.forEach((det) => {
      let itemClass = "list-group-item-light";
      let icon = "";
      let infoText = "";

      if (det.status === "success") {
        itemClass = "list-group-item-success";
        icon = `<i class="fas fa-check-circle text-success me-1"></i>`;
      } else if (det.status === "error") {
        itemClass = "list-group-item-danger";
        icon = `<i class="fas fa-times-circle text-danger me-1"></i>`;
      }

      if (det.infoAdicional) {
        if (det.infoAdicional.teveChecklistAnterior) {
          infoText += `<small class="d-block text-muted" style="margin-left: 20px;"><em>↳ Este transformador já possuía checklists anteriores.</em></small>`;
        }
        if (det.infoAdicional.ultimaReformaConhecida) {
          const urc = det.infoAdicional.ultimaReformaConhecida;
          infoText += `<small class="d-block text-muted" style="margin-left: 20px;"><em>↳ Última reforma conhecida em: ${formatarDataSimples(
            urc.data_reformado
          )} (do checklist de ${formatarDataSimples(
            urc.data_checklist_reforma
          )}).</em></small>`;
        }
      }

      detailsList += `
            <li class="list-group-item ${itemClass} p-2" style="font-size: 0.9rem; border-radius: .25rem; margin-bottom: .25rem;">
                ${icon}
                <strong>Linha ${det.linha} (Série: ${
        det.numero_serie || "N/A"
      }):</strong> ${det.message}
                ${infoText}
            </li>`;
    });
  }

  let detailsSection = "";
  if (detailsList) {
    detailsSection = `<div class="mt-3"><h6>Detalhes por Linha Processada:</h6><ul class="list-group">${detailsList}</ul></div>`;
  }

  messageArea.innerHTML = `
        <div class="message-icon">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="message-content">
          <h4>${result.message || "Importação Concluída!"}</h4>
          ${summaryDetails}
          ${warningsSection}
          ${detailsSection}
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
