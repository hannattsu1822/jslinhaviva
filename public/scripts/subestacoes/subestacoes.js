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

  const equipamentosSection = document.getElementById("equipamentosSection");
  const btnNovoEquipamento = document.getElementById("btnNovoEquipamento");
  const corpoTabelaEquipamentos = document.getElementById(
    "corpoTabelaEquipamentos"
  );
  const nenhumEquipamentoMsg = document.getElementById("nenhumEquipamento");

  const modalSubestacao = document.getElementById("modalSubestacao");
  const modalSubestacaoTitulo = document.getElementById(
    "modalSubestacaoTitulo"
  );
  const formSubestacao = document.getElementById("formSubestacao");
  const subestacaoIdModal = document.getElementById("subestacaoIdModal");
  const subestacaoSiglaModal = document.getElementById("subestacaoSiglaModal");
  const subestacaoNomeModal = document.getElementById("subestacaoNomeModal");
  const subestacaoAnoOpModal = document.getElementById("subestacaoAnoOpModal");

  const modalEquipamento = document.getElementById("modalEquipamento");
  const modalEquipamentoTitulo = document.getElementById(
    "modalEquipamentoTitulo"
  );
  const formEquipamento = document.getElementById("formEquipamento");
  const equipamentoIdModal = document.getElementById("equipamentoIdModal");
  const equipamentoSubestacaoIdModal = document.getElementById(
    "equipamentoSubestacaoIdModal"
  );
  const equipamentoTagModal = document.getElementById("equipamentoTagModal");
  const equipamentoDescricaoModal = document.getElementById(
    "equipamentoDescricaoModal"
  );
  const equipamentoModeloModal = document.getElementById(
    "equipamentoModeloModal"
  );
  const equipamentoSerialModal = document.getElementById(
    "equipamentoSerialModal"
  );
  const equipamentoTensaoModal = document.getElementById(
    "equipamentoTensaoModal"
  );
  const equipamentoStatusModal = document.getElementById(
    "equipamentoStatusModal"
  );
  const equipamentoDataInstModal = document.getElementById(
    "equipamentoDataInstModal"
  );

  const modalConfirmacao = document.getElementById("modalConfirmacao");
  const mensagemConfirmacao = document.getElementById("mensagemConfirmacao");
  const btnConfirmarExclusao = document.getElementById("btnConfirmarExclusao");

  const closeModalButtons = document.querySelectorAll(".close-modal");

  let subestacoesCache = [];
  let subestacaoSelecionadaId = null;
  let operacaoConfirmacao = null;

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
    modalElement.classList.remove("hidden");
  }

  function ocultarModal(modalElement) {
    modalElement.classList.add("hidden");
  }

  async function carregarSubestacoes() {
    try {
      selectSubestacao.disabled = true;
      selectSubestacao.innerHTML = '<option value="">Carregando...</option>';
      const data = await fetchData("/subestacoes");
      subestacoesCache = data;
      popularSelectSubestacoes(data);
      selectSubestacao.disabled = false;
      if (data.length > 0) {
        const primeiroId = data[0].Id;
        selectSubestacao.value = primeiroId;
        await carregarDetalhesESubestacao(primeiroId);
      } else {
        selectSubestacao.innerHTML =
          '<option value="">Nenhuma subestação encontrada</option>';
        ocultarDetalhesEEquipamentos();
      }
    } catch (error) {
      selectSubestacao.innerHTML = '<option value="">Erro ao carregar</option>';
      ocultarDetalhesEEquipamentos();
    }
  }

  function popularSelectSubestacoes(subestacoes) {
    selectSubestacao.innerHTML =
      '<option value="">Selecione uma Subestação</option>';
    subestacoes.forEach((sub) => {
      const option = document.createElement("option");
      option.value = sub.Id;
      option.textContent = `${sub.sigla} - ${sub.nome}`;
      selectSubestacao.appendChild(option);
    });
  }

  function ocultarDetalhesEEquipamentos() {
    subestacaoDetalhesSection.classList.add("hidden");
    equipamentosSection.classList.add("hidden");
    subestacaoSelecionadaId = null;
  }

  async function carregarDetalhesESubestacao(idSubestacao) {
    if (!idSubestacao) {
      ocultarDetalhesEEquipamentos();
      return;
    }
    subestacaoSelecionadaId = idSubestacao;
    try {
      const subestacao =
        subestacoesCache.find((s) => s.Id == idSubestacao) ||
        (await fetchData(`/subestacoes/${idSubestacao}`));
      if (subestacao) {
        exibirDetalhesSubestacao(subestacao);
        await carregarEquipamentos(idSubestacao);
      } else {
        ocultarDetalhesEEquipamentos();
      }
    } catch (error) {
      ocultarDetalhesEEquipamentos();
    }
  }

  function exibirDetalhesSubestacao(subestacao) {
    nomeSubestacaoDetalhes.textContent = subestacao.nome;
    siglaSubestacaoDetalhes.textContent = subestacao.sigla;
    anoOpSubestacaoDetalhes.textContent =
      subestacao.Ano_Inicio_Op || "Não informado";
    subestacaoDetalhesSection.classList.remove("hidden");
  }

  async function carregarEquipamentos(idSubestacao) {
    equipamentosSection.classList.remove("hidden");
    corpoTabelaEquipamentos.innerHTML =
      '<tr><td colspan="8" style="text-align:center;">Carregando equipamentos...</td></tr>';
    nenhumEquipamentoMsg.classList.add("hidden");
    try {
      const equipamentos = await fetchData(
        `/subestacoes/${idSubestacao}/equipamentos`
      );
      popularTabelaEquipamentos(equipamentos);
    } catch (error) {
      corpoTabelaEquipamentos.innerHTML =
        '<tr><td colspan="8" style="text-align:center; color:red;">Erro ao carregar equipamentos.</td></tr>';
    }
  }

  function popularTabelaEquipamentos(equipamentos) {
    corpoTabelaEquipamentos.innerHTML = "";
    if (equipamentos.length === 0) {
      nenhumEquipamentoMsg.classList.remove("hidden");
      return;
    }
    nenhumEquipamentoMsg.classList.add("hidden");

    equipamentos.forEach((eq) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td>${eq.tag}</td>
                <td>${eq.description || "-"}</td>
                <td>${eq.model || "-"}</td>
                <td>${eq.serial_number || "-"}</td>
                <td>${eq.voltage_range || "-"}</td>
                <td>${eq.status || "-"}</td>
                <td>${
                  eq.date_inst
                    ? new Date(eq.date_inst + "T00:00:00").toLocaleDateString(
                        "pt-BR",
                        { timeZone: "UTC" }
                      )
                    : "-"
                }</td>
                <td class="actions-column">
                    <button class="btn btn-icon btn-editar-equipamento" data-id="${
                      eq.id
                    }" title="Editar Equipamento">
                        <span class="material-icons-outlined edit-icon">edit</span>
                    </button>
                    <button class="btn btn-icon btn-excluir-equipamento" data-id="${
                      eq.id
                    }" title="Excluir Equipamento">
                        <span class="material-icons-outlined delete-icon">delete</span>
                    </button>
                </td>
            `;
      tr.querySelector(".btn-editar-equipamento").addEventListener(
        "click",
        () => abrirModalEquipamentoParaEdicao(eq)
      );
      tr.querySelector(".btn-excluir-equipamento").addEventListener(
        "click",
        () => confirmarExclusaoEquipamento(eq.id, eq.tag)
      );
      corpoTabelaEquipamentos.appendChild(tr);
    });
  }

  closeModalButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const modalId = button.getAttribute("data-modal-id");
      if (document.getElementById(modalId)) {
        ocultarModal(document.getElementById(modalId));
      }
    });
  });

  window.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal")) {
      ocultarModal(event.target);
    }
  });

  function abrirModalSubestacaoParaCriacao() {
    formSubestacao.reset();
    subestacaoIdModal.value = "";
    modalSubestacaoTitulo.innerHTML =
      '<span class="material-icons-outlined">domain</span> Nova Subestação';
    mostrarModal(modalSubestacao);
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

    let url = "/subestacoes";
    let method = "POST";
    if (id) {
      url = `/subestacoes/${id}`;
      method = "PUT";
    }

    try {
      const resultado = await fetchData(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subestacaoData),
      });
      alert(`Subestação ${id ? "atualizada" : "criada"} com sucesso!`);
      ocultarModal(modalSubestacao);

      const idParaSelecionar = id ? id : resultado ? resultado.id : null;
      await carregarSubestacoes();
      if (idParaSelecionar) {
        selectSubestacao.value = idParaSelecionar;
        await carregarDetalhesESubestacao(idParaSelecionar);
      } else if (!id && subestacoesCache.length > 0) {
        selectSubestacao.value = subestacoesCache[0].Id;
        await carregarDetalhesESubestacao(subestacoesCache[0].Id);
      }
    } catch (error) {}
  });

  function abrirModalEquipamentoParaCriacao() {
    formEquipamento.reset();
    equipamentoIdModal.value = "";
    equipamentoSubestacaoIdModal.value = subestacaoSelecionadaId;
    modalEquipamentoTitulo.innerHTML =
      '<span class="material-icons-outlined">build_circle</span> Novo Equipamento';
    equipamentoStatusModal.value = "ATIVO";
    mostrarModal(modalEquipamento);
  }

  function abrirModalEquipamentoParaEdicao(equipamento) {
    formEquipamento.reset();
    equipamentoIdModal.value = equipamento.id;
    equipamentoSubestacaoIdModal.value = equipamento.subest_id;
    equipamentoTagModal.value = equipamento.tag;
    equipamentoDescricaoModal.value = equipamento.description || "";
    equipamentoModeloModal.value = equipamento.model || "";
    equipamentoSerialModal.value = equipamento.serial_number || "";
    equipamentoTensaoModal.value = equipamento.voltage_range || "";
    equipamentoStatusModal.value = equipamento.status || "ATIVO";
    equipamentoDataInstModal.value = equipamento.date_inst
      ? equipamento.date_inst.split("T")[0]
      : "";
    modalEquipamentoTitulo.innerHTML =
      '<span class="material-icons-outlined">build_circle</span> Editar Equipamento';
    mostrarModal(modalEquipamento);
  }

  formEquipamento.addEventListener("submit", async (event) => {
    event.preventDefault();
    const idEq = equipamentoIdModal.value;
    const idSub = equipamentoSubestacaoIdModal.value;

    const equipamentoData = {
      tag: equipamentoTagModal.value.trim(),
      description: equipamentoDescricaoModal.value.trim(),
      model: equipamentoModeloModal.value.trim(),
      serial_number: equipamentoSerialModal.value.trim(),
      voltage_range: equipamentoTensaoModal.value.trim(),
      status: equipamentoStatusModal.value,
      date_inst: equipamentoDataInstModal.value || null,
    };

    if (!equipamentoData.tag) {
      alert("TAG do equipamento é obrigatória.");
      return;
    }

    const url = idEq
      ? `/subestacoes/${idSub}/equipamentos/${idEq}`
      : `/subestacoes/${idSub}/equipamentos`;
    const method = idEq ? "PUT" : "POST";

    try {
      await fetchData(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(equipamentoData),
      });
      alert(`Equipamento ${idEq ? "atualizado" : "criado"} com sucesso!`);
      ocultarModal(modalEquipamento);
      await carregarEquipamentos(idSub);
    } catch (error) {}
  });

  function confirmarExclusao(tipo, id, nomeItem, callbackConfirmacao) {
    mensagemConfirmacao.textContent = `Você tem certeza que deseja excluir ${tipo}: "${nomeItem}"? Esta ação não pode ser desfeita.`;
    operacaoConfirmacao = () => callbackConfirmacao(id);
    btnConfirmarExclusao.dataset.itemId = id;
    mostrarModal(modalConfirmacao);
  }

  function confirmarExclusaoEquipamento(idEq, tagEq) {
    confirmarExclusao("o equipamento", idEq, tagEq, excluirEquipamento);
  }

  btnConfirmarExclusao.addEventListener("click", async () => {
    if (typeof operacaoConfirmacao === "function") {
      const itemId = btnConfirmarExclusao.dataset.itemId;
      try {
        await operacaoConfirmacao(itemId);
        alert("Item excluído com sucesso!");
      } catch (error) {
      } finally {
        ocultarModal(modalConfirmacao);
        operacaoConfirmacao = null;
        delete btnConfirmarExclusao.dataset.itemId;
      }
    }
  });

  async function excluirSubestacao(idSub) {
    await fetchData(`/subestacoes/${idSub}`, { method: "DELETE" });
    ocultarDetalhesEEquipamentos();
    await carregarSubestacoes();
    if (subestacoesCache.length > 0) {
      selectSubestacao.value = subestacoesCache[0].Id;
      carregarDetalhesESubestacao(subestacoesCache[0].Id);
    }
  }

  async function excluirEquipamento(idEq) {
    await fetchData(
      `/subestacoes/${subestacaoSelecionadaId}/equipamentos/${idEq}`,
      { method: "DELETE" }
    );
    await carregarEquipamentos(subestacaoSelecionadaId);
  }

  selectSubestacao.addEventListener("change", (event) => {
    const idSelecionado = event.target.value;
    carregarDetalhesESubestacao(idSelecionado);
  });

  if (btnNovaSubestacao) {
    btnNovaSubestacao.addEventListener(
      "click",
      abrirModalSubestacaoParaCriacao
    );
  }

  if (btnEditarSubestacao) {
    btnEditarSubestacao.addEventListener("click", () => {
      if (subestacaoSelecionadaId) {
        const subestacao = subestacoesCache.find(
          (s) => s.Id == subestacaoSelecionadaId
        );
        if (subestacao) abrirModalSubestacaoParaEdicao(subestacao);
      }
    });
  }

  if (btnExcluirSubestacao) {
    btnExcluirSubestacao.addEventListener("click", () => {
      if (subestacaoSelecionadaId) {
        const subestacao = subestacoesCache.find(
          (s) => s.Id == subestacaoSelecionadaId
        );
        if (subestacao)
          confirmarExclusao(
            "a subestação",
            subestacao.Id,
            `${subestacao.sigla} - ${subestacao.nome}`,
            excluirSubestacao
          );
      }
    });
  }

  if (btnNovoEquipamento) {
    btnNovoEquipamento.addEventListener("click", () => {
      if (subestacaoSelecionadaId) {
        abrirModalEquipamentoParaCriacao();
      } else {
        alert("Selecione uma subestação primeiro.");
      }
    });
  }

  carregarSubestacoes();
});
