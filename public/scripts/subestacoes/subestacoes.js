document.addEventListener("DOMContentLoaded", () => {
  const selectSubestacao = document.getElementById("selectSubestacao");
  const btnNovaSubestacao = document.getElementById("btnNovaSubestacao");
  const subestacaoDetalhesSection = document.getElementById(
    "subestacaoDetalhesSection"
  );
  const nomeSubestacaoDetalhes = document.getElementById(
    "nomeSubestacaoDetalhes"
  );
  const siglaSubestacaoDetalhes = document.getElementById(
    "siglaSubestacaoDetalhes"
  );
  const anoOpSubestacaoDetalhes = document.getElementById(
    "anoOpSubestacaoDetalhes"
  );
  const btnEditarSubestacao = document.getElementById("btnEditarSubestacao");
  const btnExcluirSubestacao = document.getElementById("btnExcluirSubestacao");

  const catalogoEquipamentosSection = document.getElementById(
    "catalogoEquipamentosSection"
  );
  const btnNovoItemCatalogo = document.getElementById("btnNovoItemCatalogo");
  const corpoTabelaCatalogo = document.getElementById("corpoTabelaCatalogo");
  const nenhumItemCatalogo = document.getElementById("nenhumItemCatalogo");

  const modalSubestacao = document.getElementById("modalSubestacao");
  const modalSubestacaoTitulo = document.getElementById(
    "modalSubestacaoTitulo"
  );
  const formSubestacao = document.getElementById("formSubestacao");
  const subestacaoIdModal = document.getElementById("subestacaoIdModal");
  const subestacaoSiglaModal = document.getElementById("subestacaoSiglaModal");
  const subestacaoNomeModal = document.getElementById("subestacaoNomeModal");
  const subestacaoAnoOpModal = document.getElementById("subestacaoAnoOpModal");

  const modalCatalogoItem = document.getElementById("modalCatalogoItem");
  const modalCatalogoItemTitulo = document.getElementById(
    "modalCatalogoItemTitulo"
  );
  const formCatalogoItem = document.getElementById("formCatalogoItem");
  const catalogoItemIdModal = document.getElementById("catalogoItemIdModal");
  const catalogoCodigoModal = document.getElementById("catalogoCodigoModal");
  const catalogoNomeModal = document.getElementById("catalogoNomeModal");
  const catalogoCategoriaModal = document.getElementById(
    "catalogoCategoriaModal"
  );
  const catalogoDescricaoModal = document.getElementById(
    "catalogoDescricaoModal"
  );

  const modalConfirmacao = document.getElementById("modalConfirmacao");
  const mensagemConfirmacao = document.getElementById("mensagemConfirmacao");
  const btnConfirmarExclusao = document.getElementById("btnConfirmarExclusao");
  const btnCancelarExclusao = document.getElementById("btnCancelarExclusao");

  const closeModalButtons = document.querySelectorAll(".close-modal");

  let subestacoesCache = [];
  let subestacaoSelecionadaId = null;
  let operacaoConfirmacao = null;
  let idItemParaExcluir = null;
  let tipoItemParaExcluir = "";

  async function fetchData(url, options = {}) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: `Erro HTTP: ${response.status}` }));
        throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
      }
      if (response.status === 204) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error("Erro na requisição:", error);
      alert(`Erro: ${error.message}`);
      throw error;
    }
  }

  function mostrarModal(modalElement) {
    if (modalElement) modalElement.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function ocultarModal(modalElement) {
    if (modalElement) modalElement.classList.add("hidden");
    document.body.style.overflow = "";
  }

  async function carregarSubestacoes() {
    try {
      selectSubestacao.disabled = true;
      selectSubestacao.innerHTML = '<option value="">Carregando...</option>';
      const data = await fetchData("/subestacoes");
      subestacoesCache = data;
      popularSelectSubestacoes(data);
      selectSubestacao.disabled = false;
      if (data && data.length > 0) {
        const primeiroId = data[0].Id;
        selectSubestacao.value = primeiroId;
        await carregarDetalhesSubestacao(primeiroId);
      } else {
        selectSubestacao.innerHTML =
          '<option value="">Nenhuma subestação encontrada</option>';
        ocultarDetalhesSubestacao();
      }
    } catch (error) {
      selectSubestacao.innerHTML = '<option value="">Erro ao carregar</option>';
      ocultarDetalhesSubestacao();
    }
  }

  function popularSelectSubestacoes(subestacoes) {
    selectSubestacao.innerHTML =
      '<option value="">Selecione uma Subestação</option>';
    if (subestacoes && subestacoes.length > 0) {
      subestacoes.forEach((sub) => {
        const option = document.createElement("option");
        option.value = sub.Id;
        option.textContent = `${sub.sigla} - ${sub.nome}`;
        selectSubestacao.appendChild(option);
      });
    } else {
      selectSubestacao.innerHTML =
        '<option value="">Nenhuma subestação</option>';
    }
  }

  function ocultarDetalhesSubestacao() {
    subestacaoDetalhesSection.classList.add("hidden");
    subestacaoSelecionadaId = null;
  }

  async function carregarDetalhesSubestacao(idSubestacao) {
    if (!idSubestacao) {
      ocultarDetalhesSubestacao();
      return;
    }
    subestacaoSelecionadaId = idSubestacao;
    try {
      const subestacao =
        subestacoesCache.find((s) => s.Id == idSubestacao) ||
        (await fetchData(`/subestacoes/${idSubestacao}`));
      if (subestacao) {
        exibirDetalhesSubestacao(subestacao);
      } else {
        ocultarDetalhesSubestacao();
      }
    } catch (error) {
      ocultarDetalhesSubestacao();
    }
  }

  function exibirDetalhesSubestacao(subestacao) {
    nomeSubestacaoDetalhes.textContent = subestacao.nome;
    siglaSubestacaoDetalhes.textContent = subestacao.sigla;
    anoOpSubestacaoDetalhes.textContent =
      subestacao.Ano_Inicio_Op || "Não informado";
    subestacaoDetalhesSection.classList.remove("hidden");
  }

  async function carregarCatalogoEquipamentos() {
    corpoTabelaCatalogo.innerHTML =
      '<tr><td colspan="5" style="text-align:center;">Carregando catálogo...</td></tr>';
    nenhumItemCatalogo.classList.add("hidden");
    try {
      const catalogo = await fetchData("/api/catalogo/equipamentos");
      popularTabelaCatalogo(catalogo);
    } catch (error) {
      corpoTabelaCatalogo.innerHTML =
        '<tr><td colspan="5" style="text-align:center; color:red;">Erro ao carregar catálogo.</td></tr>';
    }
  }

  function popularTabelaCatalogo(catalogo) {
    corpoTabelaCatalogo.innerHTML = "";
    if (!catalogo || catalogo.length === 0) {
      nenhumItemCatalogo.classList.remove("hidden");
      return;
    }
    nenhumItemCatalogo.classList.add("hidden");

    catalogo.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
          <td>${item.codigo}</td>
          <td>${item.nome}</td>
          <td>${item.categoria || "-"}</td>
          <td>${item.descricao || "-"}</td>
          <td class="actions-column">
              <button class="btn btn-icon btn-editar-catalogo" data-id="${
                item.id
              }" title="Editar Item">
                  <span class="material-icons-outlined edit-icon">edit</span>
              </button>
              <button class="btn btn-icon btn-excluir-catalogo" data-id="${
                item.id
              }" data-nome="${item.nome}" title="Excluir Item">
                  <span class="material-icons-outlined delete-icon">delete</span>
              </button>
          </td>
      `;
      tr.querySelector(".btn-editar-catalogo").addEventListener("click", () =>
        abrirModalCatalogoParaEdicao(item)
      );
      tr.querySelector(".btn-excluir-catalogo").addEventListener("click", (e) =>
        confirmarExclusaoItemCatalogo(
          e.currentTarget.dataset.id,
          e.currentTarget.dataset.nome
        )
      );
      corpoTabelaCatalogo.appendChild(tr);
    });
  }

  closeModalButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const modalId = button.getAttribute("data-modal-id");
      ocultarModal(document.getElementById(modalId));
    });
  });

  window.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal")) {
      ocultarModal(event.target);
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      ocultarModal(modalConfirmacao);
      ocultarModal(modalCatalogoItem);
      ocultarModal(modalSubestacao);
    }
  });

  function abrirModalSubestacaoParaCriacao() {
    formSubestacao.reset();
    subestacaoIdModal.value = "";
    modalSubestacaoTitulo.innerHTML =
      '<span class="material-icons-outlined">domain</span> Nova Subestação';
    mostrarModal(modalSubestacao);
    subestacaoSiglaModal.focus();
  }

  function abrirModalSubestacaoParaEdicao(subestacao) {
    formSubestacao.reset();
    subestacaoIdModal.value = subestacao.Id;
    subestacaoSiglaModal.value = subestacao.sigla;
    subestacaoNomeModal.value = subestacao.nome;
    subestacaoAnoOpModal.value = subestacao.Ano_Inicio_Op || "";
    modalSubestacaoTitulo.innerHTML =
      '<span class="material-icons-outlined">domain</span> Editar Subestação';
    mostrarModal(modalSubestacao);
    subestacaoSiglaModal.focus();
  }

  formSubestacao.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = subestacaoIdModal.value;
    const subestacaoData = {
      sigla: subestacaoSiglaModal.value.trim(),
      nome: subestacaoNomeModal.value.trim(),
      Ano_Inicio_Op: subestacaoAnoOpModal.value
        ? parseInt(subestacaoAnoOpModal.value)
        : null,
    };

    if (!subestacaoData.sigla || !subestacaoData.nome) {
      alert("Sigla e Nome são obrigatórios.");
      return;
    }

    const url = id ? `/subestacoes/${id}` : "/subestacoes";
    const method = id ? "PUT" : "POST";
    const submitButton = formSubestacao.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      const resultado = await fetchData(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subestacaoData),
      });
      alert(`Subestação ${id ? "atualizada" : "criada"} com sucesso!`);
      ocultarModal(modalSubestacao);
      const idParaSelecionar = id ? id : resultado.id;
      await carregarSubestacoes();
      if (idParaSelecionar) {
        selectSubestacao.value = idParaSelecionar;
        await carregarDetalhesSubestacao(idParaSelecionar);
      }
    } finally {
      submitButton.disabled = false;
    }
  });

  function abrirModalCatalogoParaCriacao() {
    formCatalogoItem.reset();
    catalogoItemIdModal.value = "";
    modalCatalogoItemTitulo.innerHTML =
      '<span class="material-icons-outlined">category</span> Novo Item de Catálogo';
    mostrarModal(modalCatalogoItem);
    catalogoCodigoModal.focus();
  }

  function abrirModalCatalogoParaEdicao(item) {
    formCatalogoItem.reset();
    catalogoItemIdModal.value = item.id;
    catalogoCodigoModal.value = item.codigo;
    catalogoNomeModal.value = item.nome;
    catalogoCategoriaModal.value = item.categoria || "";
    catalogoDescricaoModal.value = item.descricao || "";
    modalCatalogoItemTitulo.innerHTML =
      '<span class="material-icons-outlined">category</span> Editar Item de Catálogo';
    mostrarModal(modalCatalogoItem);
    catalogoCodigoModal.focus();
  }

  formCatalogoItem.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = catalogoItemIdModal.value;
    const itemData = {
      codigo: catalogoCodigoModal.value.trim(),
      nome: catalogoNomeModal.value.trim(),
      categoria: catalogoCategoriaModal.value.trim(),
      descricao: catalogoDescricaoModal.value.trim(),
    };

    if (!itemData.codigo || !itemData.nome) {
      alert("Código e Nome são obrigatórios.");
      return;
    }

    const url = id
      ? `/api/catalogo/equipamentos/${id}`
      : "/api/catalogo/equipamentos";
    const method = id ? "PUT" : "POST";
    const submitButton = formCatalogoItem.querySelector(
      'button[type="submit"]'
    );
    submitButton.disabled = true;

    try {
      await fetchData(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemData),
      });
      alert(`Item de catálogo ${id ? "atualizado" : "criado"} com sucesso!`);
      ocultarModal(modalCatalogoItem);
      await carregarCatalogoEquipamentos();
    } finally {
      submitButton.disabled = false;
    }
  });

  function confirmarExclusao(tipo, id, nomeItem) {
    mensagemConfirmacao.textContent = `Você tem certeza que deseja excluir ${tipo}: "${nomeItem}"? Esta ação não pode ser desfeita.`;
    idItemParaExcluir = id;
    tipoItemParaExcluir = tipo;
    mostrarModal(modalConfirmacao);
  }

  function confirmarExclusaoItemCatalogo(id, nome) {
    confirmarExclusao("o item de catálogo", id, nome);
  }

  btnConfirmarExclusao.addEventListener("click", async () => {
    if (idItemParaExcluir === null) return;

    btnConfirmarExclusao.disabled = true;
    let url, successCallback;

    if (tipoItemParaExcluir === "a subestação") {
      url = `/subestacoes/${idItemParaExcluir}`;
      successCallback = async () => {
        ocultarDetalhesSubestacao();
        await carregarSubestacoes();
        if (subestacoesCache.length > 0) {
          selectSubestacao.value = subestacoesCache[0].Id;
          await carregarDetalhesSubestacao(subestacoesCache[0].Id);
        }
      };
    } else {
      url = `/api/catalogo/equipamentos/${idItemParaExcluir}`;
      successCallback = carregarCatalogoEquipamentos;
    }

    try {
      await fetchData(url, { method: "DELETE" });
      alert("Item excluído com sucesso!");
      await successCallback();
    } finally {
      btnConfirmarExclusao.disabled = false;
      ocultarModal(modalConfirmacao);
      idItemParaExcluir = null;
      tipoItemParaExcluir = "";
    }
  });

  btnCancelarExclusao.addEventListener("click", () =>
    ocultarModal(modalConfirmacao)
  );

  selectSubestacao.addEventListener("change", (event) => {
    carregarDetalhesSubestacao(event.target.value);
  });

  btnNovaSubestacao.addEventListener("click", abrirModalSubestacaoParaCriacao);

  btnEditarSubestacao.addEventListener("click", () => {
    if (subestacaoSelecionadaId) {
      const subestacao = subestacoesCache.find(
        (s) => s.Id == subestacaoSelecionadaId
      );
      if (subestacao) abrirModalSubestacaoParaEdicao(subestacao);
    }
  });

  btnExcluirSubestacao.addEventListener("click", () => {
    if (subestacaoSelecionadaId) {
      const subestacao = subestacoesCache.find(
        (s) => s.Id == subestacaoSelecionadaId
      );
      if (subestacao)
        confirmarExclusao(
          "a subestação",
          subestacao.Id,
          `${subestacao.sigla} - ${subestacao.nome}`
        );
    }
  });

  btnNovoItemCatalogo.addEventListener("click", abrirModalCatalogoParaCriacao);

  async function init() {
    await carregarSubestacoes();
    await carregarCatalogoEquipamentos();
  }

  init();
});
