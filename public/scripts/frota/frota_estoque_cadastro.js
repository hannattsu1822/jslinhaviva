document.addEventListener("DOMContentLoaded", function () {
  const itemEstoqueForm = document.getElementById("itemEstoqueForm");
  const itensEstoqueTableBody = document.getElementById(
    "itensEstoqueTableBody"
  );
  const toastContainer = document.getElementById("toastContainer");

  const toggleFormBtn = document.getElementById("toggleFormBtn");
  const formContainer = document.getElementById("formContainer");
  const closeFormBtn = document.getElementById("closeFormBtn");

  const filterId = document.getElementById("filterId");
  const filterCod = document.getElementById("filterCod");
  const filterNome = document.getElementById("filterNome");

  const codInputForm = document.getElementById("cod");
  const nomeInputForm = document.getElementById("nome");
  const unidInputForm = document.getElementById("unid");

  let searchTimeout = null;

  if (toggleFormBtn) {
    toggleFormBtn.addEventListener("click", () => {
      formContainer.classList.toggle("hidden");
    });
  }
  if (closeFormBtn) {
    closeFormBtn.addEventListener("click", () => {
      formContainer.classList.add("hidden");
    });
  }

  function showToast(title, message, isError = false) {
    const toast = document.createElement("div");
    toast.className = `toast ${isError ? "error" : "success"}`;
    toast.innerHTML = `<div class="toast-title">${title}</div><div>${message}</div>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
      toast.classList.remove("show");
      toast.addEventListener("transitionend", () => toast.remove());
    }, 5000);
  }

  async function loadItensEstoque(queryParams = "") {
    try {
      itensEstoqueTableBody.innerHTML =
        '<tr><td colspan="5" style="text-align: center;">Buscando peças...</td></tr>';
      const response = await fetch(`/api/frota/estoque_crud${queryParams}`);
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Erro ao carregar itens do estoque." }));
        throw new Error(errorData.message);
      }
      const itens = await response.json();
      itensEstoqueTableBody.innerHTML = "";
      if (itens.length === 0) {
        const message =
          queryParams && queryParams !== "?"
            ? "Nenhuma peça encontrada com os critérios fornecidos."
            : "Utilize os filtros para buscar as peças.";
        itensEstoqueTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">${message}</td></tr>`;
        return;
      }
      itens.forEach((item) => {
        const row = document.createElement("tr");
        row.innerHTML = `
                    <td>${item.id}</td>
                    <td>${item.cod || ""}</td>
                    <td>${item.nome || ""}</td>
                    <td>${item.unid || ""}</td>
                    <td class="actions">
                         <button class="btn btn-info view-btn" data-id="${
                           item.id
                         }" data-cod="${item.cod}" data-nome="${
          item.nome
        }" data-unid="${
          item.unid || ""
        }" title="Visualizar/Preencher Formulário">
                            <i class="material-icons">search</i>
                        </button>
                        <button class="btn btn-danger delete-btn" data-id="${
                          item.id
                        }" title="Excluir Peça">
                            <i class="material-icons">delete</i>
                        </button>
                    </td>
                `;
        itensEstoqueTableBody.appendChild(row);
      });
    } catch (error) {
      console.error("Erro ao carregar itens:", error);
      itensEstoqueTableBody.innerHTML =
        '<tr><td colspan="5" style="text-align: center;">Erro ao carregar peças. Tente novamente.</td></tr>';
      showToast(
        "Erro ao Carregar",
        error.message || "Não foi possível carregar a lista de peças.",
        true
      );
    }
  }

  function handleDynamicSearch() {
    clearTimeout(searchTimeout);
    const codValue = filterCod.value.trim();
    const nomeValue = filterNome.value.trim();
    if (codValue.length < 1 && nomeValue.length < 1) {
      itensEstoqueTableBody.innerHTML =
        '<tr><td colspan="5" style="text-align: center;">Utilize os filtros para buscar as peças.</td></tr>';
      return;
    }
    searchTimeout = setTimeout(() => {
      const params = new URLSearchParams();
      if (codValue) params.append("cod", codValue);
      if (nomeValue) params.append("nome", nomeValue);
      loadItensEstoque("?" + params.toString());
    }, 500);
  }

  if (filterCod) filterCod.addEventListener("input", handleDynamicSearch);
  if (filterNome) filterNome.addEventListener("input", handleDynamicSearch);
  if (filterId) {
    filterId.addEventListener("keyup", () => {
      const idValue = filterId.value.toLowerCase();
      const rows = itensEstoqueTableBody.getElementsByTagName("tr");
      for (const row of rows) {
        if (row.cells.length > 0) {
          const idCell = row.cells[0].textContent.toLowerCase();
          row.style.display = idCell.includes(idValue) ? "" : "none";
        }
      }
    });
  }

  if (itemEstoqueForm) {
    itemEstoqueForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const itemData = {
        cod: codInputForm.value.trim(),
        nome: nomeInputForm.value.trim(),
        unid: unidInputForm.value.trim() || null,
      };
      if (!itemData.cod || !itemData.nome) {
        showToast(
          "Erro de Validação",
          "Código e Nome da peça são obrigatórios.",
          true
        );
        return;
      }
      try {
        const response = await fetch("/api/frota/estoque_crud", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemData),
        });
        const result = await response.json();
        if (response.ok) {
          showToast("Sucesso", result.message || "Peça salva com sucesso!");
          itemEstoqueForm.reset();
          formContainer.classList.add("hidden");
          if (filterCod) filterCod.value = itemData.cod;
          handleDynamicSearch();
        } else {
          throw new Error(
            result.message || "Erro desconhecido ao salvar peça."
          );
        }
      } catch (error) {
        console.error("Erro ao salvar peça:", error);
        showToast("Erro ao Salvar", error.message, true);
      }
    });
  }

  function preencherFormularioComItem(cod, nome, unid) {
    if (codInputForm) codInputForm.value = cod;
    if (nomeInputForm) nomeInputForm.value = nome;
    if (unidInputForm) unidInputForm.value = unid;
    if (formContainer.classList.contains("hidden")) {
      formContainer.classList.remove("hidden");
    }
    if (codInputForm) codInputForm.focus();
  }

  if (itensEstoqueTableBody) {
    itensEstoqueTableBody.addEventListener("click", async function (event) {
      const deleteButton = event.target.closest(".delete-btn");
      const viewButton = event.target.closest(".view-btn");
      if (deleteButton) {
        const itemId = deleteButton.dataset.id;
        if (confirm("Tem certeza que deseja excluir esta peça do estoque?")) {
          try {
            const response = await fetch(`/api/frota/estoque_crud/${itemId}`, {
              method: "DELETE",
            });
            const result = await response.json();
            if (response.ok) {
              showToast(
                "Sucesso",
                result.message || "Peça excluída com sucesso!"
              );
              deleteButton.closest("tr").remove();
              if (
                itensEstoqueTableBody.getElementsByTagName("tr").length === 0
              ) {
                itensEstoqueTableBody.innerHTML =
                  '<tr><td colspan="5" style="text-align: center;">Nenhuma peça encontrada.</td></tr>';
              }
            } else {
              throw new Error(
                result.message || "Erro ao excluir peça do estoque."
              );
            }
          } catch (error) {
            console.error("Erro ao excluir peça:", error);
            showToast("Erro ao Excluir", error.message, true);
          }
        }
      } else if (viewButton) {
        preencherFormularioComItem(
          viewButton.dataset.cod,
          viewButton.dataset.nome,
          viewButton.dataset.unid
        );
      }
    });
  }

  itensEstoqueTableBody.innerHTML =
    '<tr><td colspan="5" style="text-align: center;">Utilize os filtros para buscar as peças.</td></tr>';
});
