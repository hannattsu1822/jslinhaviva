let listaCodigos = [];

window.setEmergencial = function (isEmergencial) {
  const modalElement = document.getElementById("tipoServicoModal");
  if (modalElement) {
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) modal.hide();
  }

  const processoInput = document.getElementById("processo");
  const processoLabel = document.getElementById("processoLabel");
  const tipoProcessoInput = document.getElementById("tipo_processo");
  const formContainer = document.getElementById("formContainer");

  if (isEmergencial) {
    processoInput.value = "";
    processoInput.readOnly = true;
    tipoProcessoInput.value = "Emergencial";
    processoLabel.innerHTML =
      'Tipo de Serviço <span class="badge bg-danger">Emergencial</span>';
    processoInput.required = false;
  } else {
    processoInput.value = "";
    processoInput.placeholder = "Digite o número do processo";
    processoLabel.textContent = "Número do Processo *";
    processoInput.readOnly = false;
    tipoProcessoInput.value = "Normal";
    processoInput.required = true;
  }
  formContainer.style.display = "block";
};

window.toggleHorariosDesligamento = function () {
  const desligamentoSelect = document.getElementById("desligamento");
  const horaInicioGroup = document.getElementById("horaInicioGroup");
  const horaFimGroup = document.getElementById("horaFimGroup");
  const horaInicioInput = document.getElementById("hora_inicio");
  const horaFimInput = document.getElementById("hora_fim");

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

function adicionarItem() {
  const container = document.getElementById("itens-servico-container");
  const itemIndex = container.children.length;
  const div = document.createElement("div");
  div.className =
    "item-servico-row row form-row align-items-center border rounded p-2 mb-3";
  div.innerHTML = `
        <div class="col-12 d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0">Item #${itemIndex + 1}</h6>
            <button type="button" class="btn-close btn-remover-item" title="Remover Item"></button>
        </div>
        <div class="col-md-7">
            <div class="form-group">
                <label class="form-label small">Código do Defeito *</label>
                <select class="form-select item-codigo" required>
                    <option value="" disabled selected>Selecione um código...</option>
                    ${listaCodigos
                      .map(
                        (c) =>
                          `<option value="${c.codigo}">${c.codigo} - ${c.descricao} (${c.ponto_defeito})</option>`
                      )
                      .join("")}
                </select>
            </div>
        </div>
        <div class="col-md-5">
            <div class="form-group">
                <label class="form-label small">Observações</label>
                <input type="text" class="form-control form-control-sm item-observacoes" placeholder="Opcional">
            </div>
        </div>
    `;
  container.appendChild(div);
}

document.addEventListener("DOMContentLoaded", async function () {
  const tipoServicoModalEl = document.getElementById("tipoServicoModal");
  if (tipoServicoModalEl) {
    const modal = new bootstrap.Modal(tipoServicoModalEl);
    modal.show();
  }

  try {
    const response = await fetch("/api/codigos-defeito");
    if (!response.ok) {
      throw new Error("Falha ao carregar a lista de códigos de defeito.");
    }
    listaCodigos = await response.json();

    adicionarItem();
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    alert(
      "Não foi possível carregar os dados necessários para o formulário. Tente recarregar a página."
    );
  }

  document
    .getElementById("btnAdicionarItem")
    .addEventListener("click", () => adicionarItem());

  document
    .getElementById("itens-servico-container")
    .addEventListener("click", function (e) {
      if (e.target && e.target.classList.contains("btn-remover-item")) {
        e.target.closest(".item-servico-row").remove();
        document
          .querySelectorAll(".item-servico-row h6")
          .forEach((h6, index) => {
            h6.textContent = `Item #${index + 1}`;
          });
      }
    });

  const form = document.getElementById("formOrdemServico");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btnSubmit = e.target.querySelector('button[type="submit"]');
    const originalBtnHTML = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML =
      '<i class="fas fa-spinner fa-spin me-2"></i>Registrando...';

    try {
      const formData = new FormData(form);

      const itensArray = [];
      const itemRows = document.querySelectorAll(".item-servico-row");
      if (itemRows.length === 0) {
        throw new Error(
          "É necessário adicionar pelo menos um item de serviço."
        );
      }

      let itemValidationError = false;
      itemRows.forEach((row) => {
        const item = {
          codigo: row.querySelector(".item-codigo").value,
          observacoes: row.querySelector(".item-observacoes").value,
        };
        if (!item.codigo) {
          itemValidationError = true;
        }
        itensArray.push(item);
      });

      if (itemValidationError) {
        throw new Error(
          "Todos os itens devem ter um código de defeito selecionado."
        );
      }

      formData.append("itens", JSON.stringify(itensArray));

      const response = await fetch("/api/ordens-servico", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Erro ao registrar a Ordem de Serviço."
        );
      }

      alert("Ordem de Serviço registrada com sucesso!");
      window.location.href = "/gestao-servicos";
    } catch (error) {
      console.error("Erro ao submeter formulário:", error);
      alert(`Erro: ${error.message}`);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalBtnHTML;
    }
  });

  const uploadArea = document.getElementById("uploadArea");
  const fileInputAnexos = document.getElementById("anexos");
  const arquivosSelecionadosDiv = document.getElementById(
    "arquivos-selecionados"
  );

  function mostrarArquivosSelecionados() {
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
        fileInfo.innerHTML = `<i class="fas ${iconClass} me-2"></i> ${
          file.name
        } <small>(${(file.size / (1024 * 1024)).toFixed(2)} MB)</small>`;

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
          mostrarArquivosSelecionados();
        };

        item.appendChild(fileInfo);
        item.appendChild(removeBtn);
        lista.appendChild(item);
      });
      arquivosSelecionadosDiv.appendChild(lista);
    }
  }

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
        mostrarArquivosSelecionados();
      }
    });
    fileInputAnexos.addEventListener("change", mostrarArquivosSelecionados);
  }
});
