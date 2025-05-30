document.addEventListener("DOMContentLoaded", function () {
  const itemEstoqueForm = document.getElementById("itemEstoqueForm");
  const itensEstoqueTableBody = document.getElementById(
    "itensEstoqueTableBody"
  );
  const toastEl = document.getElementById("liveToast");
  const bsToast = new bootstrap.Toast(toastEl);

  const filterId = document.getElementById("filterId");
  const filterCod = document.getElementById("filterCod");
  const filterNome = document.getElementById("filterNome");

  const codInputForm = document.getElementById("cod");
  const nomeInputForm = document.getElementById("nome");
  const unidInputForm = document.getElementById("unid");

  const formCollapseEl = document.getElementById("formCollapse");
  const formCollapse = formCollapseEl
    ? new bootstrap.Collapse(formCollapseEl, { toggle: false })
    : null;

  let searchTimeout = null;

  function showToast(title, message, isError = false) {
    const toastTitle = document.getElementById("toastTitle");
    const toastBody = document.getElementById("toastBody");
    toastTitle.textContent = title;
    toastBody.textContent = message;
    toastEl.classList.remove("bg-success", "bg-danger", "text-white");
    if (isError) {
      toastEl.classList.add("bg-danger", "text-white");
    } else {
      toastEl.classList.add("bg-success", "text-white");
    }
    bsToast.show();
  }

  async function loadItensEstoque(queryParams = "") {
    try {
      itensEstoqueTableBody.innerHTML =
        '<tr><td colspan="5" class="text-center">Buscando peças...</td></tr>';
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
        if (queryParams && queryParams !== "?") {
          itensEstoqueTableBody.innerHTML =
            '<tr><td colspan="5" class="text-center">Nenhuma peça encontrada com os critérios fornecidos.</td></tr>';
        } else {
          itensEstoqueTableBody.innerHTML =
            '<tr><td colspan="5" class="text-center">Utilize os filtros para buscar as peças.</td></tr>';
        }
        return;
      }

      itens.forEach((item) => {
        const row = document.createElement("tr");
        row.innerHTML = `
              <td>${item.id}</td>
              <td>${item.cod || ""}</td>
              <td>${item.nome || ""}</td>
              <td>${item.unid || ""}</td>
              <td>
                <button class="btn btn-sm btn-info view-btn me-1" data-id="${
                  item.id
                }" data-cod="${item.cod}" data-nome="${item.nome}" data-unid="${
          item.unid || ""
        }" title="Visualizar/Preencher Formulário">
                  <i class="material-icons">search</i>
                </button>
                <button class="btn btn-sm btn-danger delete-btn" data-id="${
                  item.id
                }" title="Excluir Peça">
                  <i class="material-icons">delete</i>
                </button>
              </td>
            `;
        itensEstoqueTableBody.appendChild(row);
      });
    } catch (error) {
      console.error("Erro ao carregar itens do estoque:", error);
      itensEstoqueTableBody.innerHTML =
        '<tr><td colspan="5" class="text-center">Erro ao carregar peças. Tente novamente.</td></tr>';
      showToast(
        "Erro ao Carregar",
        error.message || "Não foi possível carregar a lista de peças.",
        true
      );
    }
  }

  function preencherFormularioComItem(cod, nome, unid) {
    if (codInputForm) codInputForm.value = cod;
    if (nomeInputForm) nomeInputForm.value = nome;
    if (unidInputForm) unidInputForm.value = unid;

    if (formCollapse && !formCollapseEl.classList.contains("show")) {
      formCollapse.show();
    }
    if (codInputForm) codInputForm.focus();
  }

  function handleDynamicSearch() {
    clearTimeout(searchTimeout);
    const codValue = filterCod.value.trim();
    const nomeValue = filterNome.value.trim();

    if (codValue.length < 1 && nomeValue.length < 1) {
      // Limpa a tabela se ambos os filtros estiverem muito curtos ou vazios
      itensEstoqueTableBody.innerHTML =
        '<tr><td colspan="5" class="text-center">Utilize os filtros para buscar as peças (mínimo 1 caractere).</td></tr>';
      return;
    }

    searchTimeout = setTimeout(() => {
      const params = new URLSearchParams();
      if (codValue) {
        params.append("cod", codValue);
      }
      if (nomeValue) {
        params.append("nome", nomeValue);
      }
      loadItensEstoque("?" + params.toString());
    }, 500); // 500ms de delay
  }

  if (filterCod) filterCod.addEventListener("input", handleDynamicSearch);
  if (filterNome) filterNome.addEventListener("input", handleDynamicSearch);

  // Filtro por ID permanece client-side ou pode ser adaptado
  if (filterId) {
    filterId.addEventListener("keyup", () => {
      const idValue = filterId.value.toLowerCase();
      const rows = itensEstoqueTableBody.getElementsByTagName("tr");
      let found = false;
      for (const row of rows) {
        if (row.cells.length > 0 && !row.querySelector('td[colspan="5"]')) {
          const idCell = row.cells[0].textContent.toLowerCase();
          const shouldShow = idCell.includes(idValue);
          row.style.display = shouldShow ? "" : "none";
          if (shouldShow) found = true;
        }
      }
      if (
        !found &&
        idValue !== "" &&
        !itensEstoqueTableBody.querySelector('td[colspan="5"]')
      ) {
        // Poderia adicionar uma mensagem "ID não encontrado nos resultados atuais"
      } else if (
        itensEstoqueTableBody.querySelector('td[colspan="5"]') &&
        idValue === ""
      ) {
        // Se limpou o filtro de ID e a tabela está vazia, mostra a mensagem padrão
        itensEstoqueTableBody.querySelector(
          'td[colspan="5"]'
        ).parentElement.style.display = "";
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
          showToast(
            "Sucesso",
            result.message || "Peça salva no estoque com sucesso!"
          );
          itemEstoqueForm.reset();
          if (formCollapse) formCollapse.hide();
          if (filterCod) filterCod.value = itemData.cod; // Preenche o filtro com o código salvo
          handleDynamicSearch(); // Recarrega a lista, o novo item deve aparecer
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
                result.message || "Peça excluída do estoque com sucesso!"
              );
              deleteButton.closest("tr").remove();
              if (
                itensEstoqueTableBody.getElementsByTagName("tr").length === 0
              ) {
                itensEstoqueTableBody.innerHTML =
                  '<tr><td colspan="5" class="text-center">Nenhuma peça encontrada.</td></tr>';
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
    '<tr><td colspan="5" class="text-center">Utilize os filtros para buscar as peças.</td></tr>';
});
