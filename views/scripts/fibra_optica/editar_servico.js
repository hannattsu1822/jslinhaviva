document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-editar-servico");
  if (!form) return;

  const submitButton = form.querySelector('button[type="submit"]');
  const servicoId = form.dataset.servicoId;

  const fileInput = document.getElementById("file-input");
  const fileListWrapper = document.getElementById("file-list-wrapper");
  const fileListContainer = document.getElementById("file-list");
  const fileDropZone = document.querySelector(".file-drop-zone");
  let storedFiles = [];

  const anexosExistentesContainer = document.getElementById(
    "anexos-existentes-container"
  );
  const anexosARemoverInput = document.getElementById("anexos_a_remover_input");

  if (fileDropZone && fileInput) {
    fileDropZone.addEventListener("click", () => fileInput.click());
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
    if (storedFiles.length === 0) {
      fileListWrapper.style.display = "none";
      return;
    }
    fileListWrapper.style.display = "block";
    storedFiles.forEach((file, index) => {
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
  };

  if (fileInput) {
    fileInput.addEventListener("change", (event) => {
      storedFiles.push(...Array.from(event.target.files));
      updateFileList();
      event.target.value = "";
    });
  }

  if (fileListContainer) {
    fileListContainer.addEventListener("click", (event) => {
      const removeButton = event.target.closest(".btn-close");
      if (removeButton) {
        const indexToRemove = parseInt(removeButton.dataset.index, 10);
        storedFiles.splice(indexToRemove, 1);
        updateFileList();
      }
    });
  }

  if (anexosExistentesContainer) {
    anexosExistentesContainer.addEventListener("click", (event) => {
      const removeButton = event.target.closest(".btn-remover-anexo");
      if (removeButton) {
        console.log("Botão de remover anexo existente clicado.");
        const listItem = removeButton.closest("li[data-anexo-id]");
        if (!listItem) {
          console.error(
            "Não foi possível encontrar o item da lista (li) pai do botão."
          );
          return;
        }

        const anexoId = listItem.dataset.anexoId;
        console.log(`Anexo ID para remover: ${anexoId}`);

        const currentIds = anexosARemoverInput.value.split(",").filter(Boolean);
        if (!currentIds.includes(anexoId)) {
          currentIds.push(anexoId);
          anexosARemoverInput.value = currentIds.join(",");
          console.log(
            `Campo 'anexos_a_remover' atualizado para: "${anexosARemoverInput.value}"`
          );
        }

        listItem.style.display = "none";
      }
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    console.log(
      "Formulário enviado. Valor do campo de remoção:",
      anexosARemoverInput.value
    );

    const originalButtonHTML = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...`;

    const formData = new FormData(form);

    storedFiles.forEach((file) => {
      formData.append("anexos", file);
    });

    try {
      const response = await fetch(`/fibra/servico/${servicoId}/editar`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        if (typeof showToast === "function") {
          showToast(result.message, "success");
        } else {
          alert(result.message);
        }
        setTimeout(() => {
          window.location.href = `/fibra/servico/${servicoId}`;
        }, 1500);
      } else {
        throw new Error(result.message || "Ocorreu um erro desconhecido.");
      }
    } catch (error) {
      if (typeof showToast === "function") {
        showToast(error.message, "error");
      } else {
        alert(error.message);
      }
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonHTML;
    }
  });
});
