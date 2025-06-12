// public/scripts/servicos/registro_servicos.js

// Função para configurar o formulário como emergencial ou normal
// Tornando global para ser acessível pelo onclick no HTML
window.setEmergencial = function (isEmergencial) {
  const modalElement = document.getElementById("tipoServicoModal");
  if (modalElement) {
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) {
      modal.hide();
    }
  }

  const processoInput = document.getElementById("processo");
  const processoLabel = document.getElementById("processoLabel");
  const tipoProcessoInput = document.getElementById("tipo_processo");
  const formContainer = document.getElementById("formContainer");

  if (processoInput && processoLabel && tipoProcessoInput) {
    if (isEmergencial) {
      processoInput.value = "EMERGENCIAL";
      processoInput.readOnly = true;
      tipoProcessoInput.value = "Emergencial";
      processoLabel.innerHTML =
        'Tipo de Serviço <span class="badge bg-danger">Emergencial</span>';
    } else {
      processoInput.value = "";
      processoInput.placeholder = "Digite o número do processo";
      processoLabel.textContent = "Número do Processo *";
      processoInput.readOnly = false;
      tipoProcessoInput.value = "Normal";
    }
  }
  if (formContainer) {
    formContainer.style.display = "block";
  }
};

// Função para mostrar/ocultar campos de horário
// Tornando global para ser acessível pelo onchange no HTML
window.toggleHorariosDesligamento = function () {
  const desligamentoSelect = document.getElementById("desligamento");
  const horaInicioGroup = document.getElementById("horaInicioGroup");
  const horaFimGroup = document.getElementById("horaFimGroup");
  const horaInicioInput = document.getElementById("hora_inicio");
  const horaFimInput = document.getElementById("hora_fim");

  if (
    !desligamentoSelect ||
    !horaInicioGroup ||
    !horaFimGroup ||
    !horaInicioInput ||
    !horaFimInput
  )
    return;

  if (desligamentoSelect.value === "SIM") {
    horaInicioGroup.style.display = "block";
    horaFimGroup.style.display = "block";
    horaInicioInput.required = true;
    horaFimInput.required = true;
  } else {
    horaInicioGroup.style.display = "none";
    horaFimGroup.style.display = "none";
    horaInicioInput.required = false;
    horaFimInput.required = false;
    horaInicioInput.value = "";
    horaFimInput.value = "";
  }
};

document.addEventListener("DOMContentLoaded", function () {
  const tipoServicoModalEl = document.getElementById("tipoServicoModal");
  if (
    tipoServicoModalEl &&
    typeof bootstrap !== "undefined" &&
    bootstrap.Modal
  ) {
    const modal = new bootstrap.Modal(tipoServicoModalEl);
    if (modal) {
      // Verifica se o modal foi instanciado corretamente
      modal.show();
    }
  }

  const desligamentoSelect = document.getElementById("desligamento");
  if (desligamentoSelect) {
    desligamentoSelect.addEventListener("change", toggleHorariosDesligamento);
  }
  toggleHorariosDesligamento();

  const uploadArea = document.getElementById("uploadArea");
  const fileInputAnexos = document.getElementById("anexos");
  const arquivosSelecionadosDiv = document.getElementById(
    "arquivos-selecionados"
  );

  if (uploadArea && fileInputAnexos) {
    uploadArea.addEventListener("click", () => fileInputAnexos.click());

    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.classList.add("dragover");
    });
    uploadArea.addEventListener("dragleave", () => {
      uploadArea.classList.remove("dragover");
    });
    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");
      if (e.dataTransfer.files.length > 0) {
        fileInputAnexos.files = e.dataTransfer.files;
        mostrarArquivosSelecionadosInterna();
      }
    });
    fileInputAnexos.addEventListener(
      "change",
      mostrarArquivosSelecionadosInterna
    );
  }

  function mostrarArquivosSelecionadosInterna() {
    if (!fileInputAnexos || !arquivosSelecionadosDiv) return;
    arquivosSelecionadosDiv.innerHTML = "";

    if (fileInputAnexos.files.length > 0) {
      const lista = document.createElement("ul");
      lista.className = "list-group mt-2";

      Array.from(fileInputAnexos.files).forEach((file, index) => {
        const item = document.createElement("li");
        item.className =
          "list-group-item list-group-item-sm d-flex justify-content-between align-items-center";

        const fileInfo = document.createElement("span");
        const iconClass = file.type.includes("image")
          ? "fa-file-image"
          : file.type.includes("pdf")
          ? "fa-file-pdf"
          : "fa-file";
        fileInfo.innerHTML = `
                    <i class="fas ${iconClass} me-2"></i>
                    ${file.name} <small>(${(file.size / (1024 * 1024)).toFixed(
          2
        )} MB)</small>
                `;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn btn-sm btn-outline-danger p-1";
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.onclick = (e) => {
          e.preventDefault();
          const newFiles = Array.from(fileInputAnexos.files);
          newFiles.splice(index, 1);
          const dataTransfer = new DataTransfer();
          newFiles.forEach((f) => dataTransfer.items.add(f));
          fileInputAnexos.files = dataTransfer.files;
          mostrarArquivosSelecionadosInterna();
        };

        item.appendChild(fileInfo);
        item.appendChild(removeBtn);
        lista.appendChild(item);
      });
      arquivosSelecionadosDiv.appendChild(lista);
    }
  }

  const formServico = document.getElementById("formServico");
  if (formServico) {
    formServico.addEventListener("submit", async (e) => {
      e.preventDefault();

      const btnSubmit = e.target.querySelector('button[type="submit"]');
      const originalBtnHTML = btnSubmit.innerHTML;
      btnSubmit.disabled = true;
      btnSubmit.innerHTML =
        '<i class="fas fa-spinner fa-spin me-2"></i>Salvando...';

      try {
        const formData = new FormData(e.target);

        const tipoProcessoInput = document.getElementById("tipo_processo");
        if (tipoProcessoInput && !formData.has("tipo_processo")) {
          formData.append("tipo_processo", tipoProcessoInput.value);
        }
        if (!formData.has("responsavel_matricula")) {
          formData.append("responsavel_matricula", "pendente");
        }

        const desligamentoValue = document.getElementById("desligamento").value;
        if (desligamentoValue === "NÃO") {
          formData.delete("hora_inicio");
          formData.delete("hora_fim");
        } else {
          if (!formData.get("hora_inicio") || !formData.get("hora_fim")) {
            throw new Error(
              "Horário de início e término são obrigatórios para desligamentos."
            );
          }
        }

        if (fileInputAnexos.files.length > 0) {
          Array.from(fileInputAnexos.files).forEach((file) => {
            if (file.size > 10 * 1024 * 1024) {
              // 10MB
              throw new Error(`O arquivo ${file.name} excede o limite de 10MB`);
            }
          });
        }

        const response = await fetch("/api/servicos", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: "Erro desconhecido do servidor." }));
          throw new Error(errorData.message || "Erro ao registrar serviço.");
        }

        alert("Serviço registrado com sucesso!");
        e.target.reset();

        if (arquivosSelecionadosDiv) arquivosSelecionadosDiv.innerHTML = "";

        toggleHorariosDesligamento();

        setTimeout(() => {
          window.location.href = "/gestao-servicos";
        }, 1000);
      } catch (error) {
        console.error("Erro ao submeter formulário de serviço:", error);
        alert(`Erro: ${error.message}`);
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnHTML;
      }
    });
  }
});
