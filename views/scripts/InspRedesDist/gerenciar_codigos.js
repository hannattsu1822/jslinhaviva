document.addEventListener("DOMContentLoaded", function () {
  const modalTipoEl = document.getElementById("modal-tipo");
  const modalTipo = new bootstrap.Modal(modalTipoEl);
  const formTipo = document.getElementById("form-tipo");
  const modalTipoTitle = document.getElementById("modal-tipo-title");
  const tableTiposBody = document.querySelector("#table-tipos tbody");

  const modalTagEl = document.getElementById("modal-tag");
  const modalTag = new bootstrap.Modal(modalTagEl);
  const formTag = document.getElementById("form-tag");
  const modalTagTitle = document.getElementById("modal-tag-title");
  const tableTagsBody = document.querySelector("#table-tags tbody");
  const selectTipoEmTag = document.getElementById("id_ponto_defeito");

  function showToast(message, type = "success", delay = 5000) {
    const toastContainer = document.querySelector(".toast-container");
    const toastId = `toast-${Date.now()}`;
    const toastTypeClass = type === "error" ? "toast-error" : "toast-success";
    const toastHeaderTitle = type === "error" ? "Erro" : "Sucesso";

    const toastHTML = `
      <div id="${toastId}" class="toast ${toastTypeClass}" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="${delay}">
        <div class="toast-header">
          <strong class="me-auto">${toastHeaderTitle}</strong>
          <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
          ${message}
        </div>
      </div>
    `;
    toastContainer.insertAdjacentHTML("beforeend", toastHTML);

    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    toast.show();

    toastElement.addEventListener("hidden.bs.toast", () => {
      toastElement.remove();
    });
  }

  function renderizarTabelaTipos(tipos) {
    tableTiposBody.innerHTML = "";
    if (!tipos || tipos.length === 0) {
      tableTiposBody.innerHTML =
        '<tr><td colspan="2" class="text-center text-muted">Nenhum tipo encontrado.</td></tr>';
      return;
    }
    tipos.forEach((tipo) => {
      const tr = `
        <tr data-tipo-id="${tipo.id}" data-tipo-nome="${tipo.ponto_defeito}">
          <td>${tipo.ponto_defeito}</td>
          <td class="text-end">
            <button class="btn btn-outline-primary btn-icon btn-editar-tipo" title="Editar">
              <span class="material-icons">edit</span>
            </button>
            <button class="btn btn-outline-danger btn-icon btn-deletar-tipo" title="Excluir">
              <span class="material-icons">delete</span>
            </button>
          </td>
        </tr>
      `;
      tableTiposBody.insertAdjacentHTML("beforeend", tr);
    });
  }

  function renderizarTabelaTags(tags) {
    tableTagsBody.innerHTML = "";
    if (!tags || tags.length === 0) {
      tableTagsBody.innerHTML =
        '<tr><td colspan="4" class="text-center text-muted">Nenhuma tag encontrada.</td></tr>';
      return;
    }
    tags.forEach((tag) => {
      const tr = `
        <tr data-tag-id="${tag.id}" data-tag-code="${tag.tag_code}" data-tag-tipo-id="${tag.id_ponto_defeito}" data-tag-descricao="${tag.descricao}">
          <td><strong>${tag.tag_code}</strong></td>
          <td>${tag.ponto_defeito}</td>
          <td>${tag.descricao}</td>
          <td class="text-end">
            <button class="btn btn-outline-primary btn-icon btn-editar-tag" title="Editar">
              <span class="material-icons">edit</span>
            </button>
            <button class="btn btn-outline-danger btn-icon btn-deletar-tag" title="Excluir">
              <span class="material-icons">delete</span>
            </button>
          </td>
        </tr>
      `;
      tableTagsBody.insertAdjacentHTML("beforeend", tr);
    });
  }

  function popularSelectTipos(tipos) {
    selectTipoEmTag.innerHTML =
      '<option value="" selected disabled>Selecione...</option>';
    tipos.forEach((tipo) => {
      const option = new Option(tipo.ponto_defeito, tipo.id);
      selectTipoEmTag.add(option);
    });
  }

  async function inicializarPagina() {
    try {
      const [tiposResponse, tagsResponse] = await Promise.all([
        fetch("/inspecoes/api/codigos/tipos"),
        fetch("/inspecoes/api/codigos/tags"),
      ]);

      if (!tiposResponse.ok)
        throw new Error("Falha ao carregar os tipos de defeito.");
      if (!tagsResponse.ok)
        throw new Error("Falha ao carregar as tags de código.");

      const tipos = await tiposResponse.json();
      const tags = await tagsResponse.json();

      renderizarTabelaTipos(tipos);
      renderizarTabelaTags(tags);
      popularSelectTipos(tipos);
    } catch (error) {
      console.error(error);
      showToast(error.message, "error");
    }
  }

  function abrirModalTipoParaCriar() {
    formTipo.reset();
    document.getElementById("tipo-id").value = "";
    modalTipoTitle.textContent = "Adicionar Novo Tipo";
    modalTipo.show();
  }

  function abrirModalTipoParaEditar(row) {
    formTipo.reset();
    document.getElementById("tipo-id").value = row.dataset.tipoId;
    document.getElementById("ponto_defeito").value = row.dataset.tipoNome;
    modalTipoTitle.textContent = "Editar Tipo";
    modalTipo.show();
  }

  async function handleSalvarTipo(event) {
    event.preventDefault();
    const formData = new FormData(formTipo);
    const data = Object.fromEntries(formData.entries());
    const tipoId = data.id;

    const url = tipoId
      ? `/inspecoes/api/codigos/tipos/${tipoId}`
      : "/inspecoes/api/codigos/tipos";
    const method = tipoId ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      showToast("Tipo salvo com sucesso!");
      location.reload();
    } catch (error) {
      showToast(`Erro ao salvar tipo: ${error.message}`, "error");
    }
  }

  async function handleDeletarTipo(row) {
    const tipoId = row.dataset.tipoId;
    const tipoNome = row.dataset.tipoNome;
    if (!confirm(`Tem certeza que deseja excluir o tipo "${tipoNome}"?`))
      return;

    try {
      const response = await fetch(`/inspecoes/api/codigos/tipos/${tipoId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Erro desconhecido ao excluir.");
      }

      showToast("Tipo excluído com sucesso!");
      location.reload();
    } catch (error) {
      showToast(`Erro ao excluir tipo: ${error.message}`, "error");
    }
  }

  function abrirModalTagParaCriar() {
    formTag.reset();
    document.getElementById("tag-id").value = "";
    modalTagTitle.textContent = "Adicionar Nova Tag";
    modalTag.show();
  }

  function abrirModalTagParaEditar(row) {
    formTag.reset();
    document.getElementById("tag-id").value = row.dataset.tagId;
    document.getElementById("tag_code").value = row.dataset.tagCode;
    document.getElementById("id_ponto_defeito").value = row.dataset.tagTipoId;
    document.getElementById("descricao").value = row.dataset.tagDescricao;
    modalTagTitle.textContent = "Editar Tag";
    modalTag.show();
  }

  async function handleSalvarTag(event) {
    event.preventDefault();
    const formData = new FormData(formTag);
    const data = Object.fromEntries(formData.entries());
    const tagId = data.id;

    const url = tagId
      ? `/inspecoes/api/codigos/tags/${tagId}`
      : "/inspecoes/api/codigos/tags";
    const method = tagId ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      showToast("Tag salva com sucesso!");
      location.reload();
    } catch (error) {
      showToast(`Erro ao salvar tag: ${error.message}`, "error");
    }
  }

  async function handleDeletarTag(row) {
    const tagId = row.dataset.tagId;
    const tagCode = row.dataset.tagCode;
    if (!confirm(`Tem certeza que deseja excluir a tag "${tagCode}"?`)) return;

    try {
      const response = await fetch(`/inspecoes/api/codigos/tags/${tagId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      showToast("Tag excluída com sucesso!");
      location.reload();
    } catch (error) {
      showToast(`Erro ao excluir tag: ${error.message}`, "error");
    }
  }

  document
    .getElementById("btn-adicionar-tipo")
    .addEventListener("click", abrirModalTipoParaCriar);
  formTipo.addEventListener("submit", handleSalvarTipo);

  document
    .getElementById("btn-adicionar-tag")
    .addEventListener("click", abrirModalTagParaCriar);
  formTag.addEventListener("submit", handleSalvarTag);

  document.body.addEventListener("click", function (event) {
    const target = event.target.closest("button");
    if (!target) return;

    const row = target.closest("tr");
    if (!row) return;

    if (target.classList.contains("btn-editar-tipo")) {
      abrirModalTipoParaEditar(row);
    } else if (target.classList.contains("btn-deletar-tipo")) {
      handleDeletarTipo(row);
    } else if (target.classList.contains("btn-editar-tag")) {
      abrirModalTagParaEditar(row);
    } else if (target.classList.contains("btn-deletar-tag")) {
      handleDeletarTag(row);
    }
  });

  inicializarPagina();
});
