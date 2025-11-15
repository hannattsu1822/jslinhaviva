document.addEventListener("DOMContentLoaded", function () {
  // --- Elementos do Formulário ---
  const form = document.getElementById("form-criar-servico");
  const submitButton = document.getElementById("btn-submit");
  const selectCriador = document.getElementById("criador_matricula");

  // --- Elementos do Uploader ---
  const uploadArea = document.getElementById("upload-area");
  const fileInput = document.getElementById("anexos_gerais");
  const previewArea = document.getElementById("preview-area");

  if (
    !form ||
    !submitButton ||
    !uploadArea ||
    !fileInput ||
    !previewArea ||
    !selectCriador
  ) {
    console.error(
      "Um ou mais elementos essenciais do formulário não foram encontrados."
    );
    return;
  }

  const fileStore = new DataTransfer();

  // --- Funções de Inicialização ---

  async function inicializarPagina() {
    try {
      // CORREÇÃO: A URL foi atualizada para corresponder à nova estrutura de rotas.
      const response = await fetch("/inspecoes/api/responsaveis");
      if (!response.ok) {
        throw new Error("Falha ao carregar a lista de responsáveis.");
      }
      const responsaveis = await response.json();

      selectCriador.innerHTML =
        '<option value="" selected disabled>Selecione...</option>';
      responsaveis.forEach((user) => {
        const option = new Option(user.nome, user.matricula);
        selectCriador.add(option);
      });
    } catch (error) {
      console.error(error);
      selectCriador.innerHTML = `<option value="" disabled>${error.message}</option>`;
    }
  }

  // --- Funções de Upload Interativo ---

  function handleFiles(files) {
    for (const file of files) {
      if (
        [...fileStore.files].some(
          (f) => f.name === file.name && f.size === file.size
        )
      ) {
        continue;
      }
      fileStore.items.add(file);
      createPreview(file);
    }
    updateFileInput();
  }

  function createPreview(file) {
    const fileId = `file-${Math.random().toString(36).substr(2, 9)}`;
    const previewElement = document.createElement("div");
    previewElement.classList.add("preview-item");
    previewElement.id = fileId;

    let previewContent;
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        previewElement.innerHTML = `
          <img src="${e.target.result}" alt="${
          file.name
        }" class="preview-thumbnail">
          <div class="preview-info">
            <strong>${file.name}</strong>
            <span>(${(file.size / 1024).toFixed(2)} KB)</span>
          </div>
          <button type="button" class="btn-remove-preview" data-file-id="${fileId}" data-file-name="${
          file.name
        }">&times;</button>
        `;
      };
      reader.readAsDataURL(file);
    } else {
      previewElement.innerHTML = `
        <div class="preview-icon"><span class="material-icons">description</span></div>
        <div class="preview-info">
          <strong>${file.name}</strong>
          <span>(${(file.size / 1024).toFixed(2)} KB)</span>
        </div>
        <button type="button" class="btn-remove-preview" data-file-id="${fileId}" data-file-name="${
        file.name
      }">&times;</button>
      `;
    }
    previewArea.appendChild(previewElement);
  }

  function removeFile(fileName) {
    const newFiles = new DataTransfer();
    for (const file of fileStore.files) {
      if (file.name !== fileName) {
        newFiles.items.add(file);
      }
    }
    fileStore.clearData();
    for (const file of newFiles.files) {
      fileStore.items.add(file);
    }
    updateFileInput();
  }

  function updateFileInput() {
    fileInput.files = fileStore.files;
  }

  // --- Event Listeners para Upload ---

  uploadArea.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => handleFiles(fileInput.files));

  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    uploadArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    uploadArea.addEventListener(eventName, () =>
      uploadArea.classList.add("highlight")
    );
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadArea.addEventListener(eventName, () =>
      uploadArea.classList.remove("highlight")
    );
  });

  uploadArea.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));

  previewArea.addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-remove-preview")) {
      const fileId = e.target.dataset.fileId;
      const fileName = e.target.dataset.fileName;
      document.getElementById(fileId).remove();
      removeFile(fileName);
    }
  });

  // --- Lógica de Submissão do Formulário ---

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    submitButton.classList.add("is-loading");
    submitButton.disabled = true;

    const formData = new FormData(form);
    formData.delete(fileInput.name);
    for (const file of fileStore.files) {
      formData.append(fileInput.name, file);
    }

    try {
      // CORREÇÃO: A URL de submissão do formulário também foi atualizada.
      const response = await fetch("/inspecoes/api/servicos", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result.message || "Ocorreu um erro ao criar o serviço."
        );
      }

      alert("Serviço de inspeção criado com sucesso!");
      window.location.href = `/inspecoes/servicos/${result.servicoId}`;
    } catch (error) {
      console.error("Erro ao submeter o formulário:", error);
      alert(`Falha ao criar o serviço: ${error.message}`);
    } finally {
      submitButton.classList.remove("is-loading");
      submitButton.disabled = false;
    }
  });

  // --- Inicialização da Página ---
  inicializarPagina();
});
