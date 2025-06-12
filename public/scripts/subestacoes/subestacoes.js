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
  const btnCancelarExclusao = document.getElementById("btnCancelarExclusao");

  const closeModalButtons = document.querySelectorAll(".close-modal");

  let subestacoesCache = [];
  let subestacaoSelecionadaId = null;
  let operacaoConfirmacao = null;
  let idItemParaExcluir = null;

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
      if (selectSubestacao) {
        selectSubestacao.disabled = true;
        selectSubestacao.innerHTML = '<option value="">Carregando...</option>';
      }
      const data = await fetchData("/subestacoes");
      subestacoesCache = data;
      if (selectSubestacao) {
        popularSelectSubestacoes(data);
        selectSubestacao.disabled = false;
        if (data && data.length > 0) {
          const primeiroId = data[0].Id;
          selectSubestacao.value = primeiroId;
          await carregarDetalhesESubestacao(primeiroId);
        } else {
          selectSubestacao.innerHTML =
            '<option value="">Nenhuma subestação encontrada</option>';
          ocultarDetalhesEEquipamentos();
        }
      } else if (data && data.length > 0) {
        // Se o select não existir mas houver dados, carregar a primeira
        await carregarDetalhesESubestacao(data[0].Id);
      } else {
        ocultarDetalhesEEquipamentos();
      }
    } catch (error) {
      if (selectSubestacao)
        selectSubestacao.innerHTML =
          '<option value="">Erro ao carregar</option>';
      ocultarDetalhesEEquipamentos();
    }
  }

  function popularSelectSubestacoes(subestacoes) {
    if (!selectSubestacao) return;
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

  function ocultarDetalhesEEquipamentos() {
    if (subestacaoDetalhesSection)
      subestacaoDetalhesSection.classList.add("hidden");
    if (equipamentosSection) equipamentosSection.classList.add("hidden");
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
        if (equipamentosSection) {
          // Carregar equipamentos somente se a seção existir
          await carregarEquipamentos(idSubestacao);
        }
      } else {
        ocultarDetalhesEEquipamentos();
      }
    } catch (error) {
      ocultarDetalhesEEquipamentos();
    }
  }

  function exibirDetalhesSubestacao(subestacao) {
    if (!subestacaoDetalhesSection) return;
    if (nomeSubestacaoDetalhes)
      nomeSubestacaoDetalhes.textContent = subestacao.nome;
    if (siglaSubestacaoDetalhes)
      siglaSubestacaoDetalhes.textContent = subestacao.sigla;
    if (anoOpSubestacaoDetalhes)
      anoOpSubestacaoDetalhes.textContent =
        subestacao.Ano_Inicio_Op || "Não informado";
    subestacaoDetalhesSection.classList.remove("hidden");
  }

  async function carregarEquipamentos(idSubestacao) {
    if (
      !equipamentosSection ||
      !corpoTabelaEquipamentos ||
      !nenhumEquipamentoMsg
    )
      return;
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
    if (!corpoTabelaEquipamentos || !nenhumEquipamentoMsg) return;
    corpoTabelaEquipamentos.innerHTML = "";
    if (!equipamentos || equipamentos.length === 0) {
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
                    }" data-tag="${eq.tag}" title="Excluir Equipamento">
                        <span class="material-icons-outlined delete-icon">delete</span>
                    </button>
                </td>
            `;
      const btnEditar = tr.querySelector(".btn-editar-equipamento");
      if (btnEditar)
        btnEditar.addEventListener("click", () =>
          abrirModalEquipamentoParaEdicao(eq)
        );

      const btnExcluir = tr.querySelector(".btn-excluir-equipamento");
      if (btnExcluir)
        btnExcluir.addEventListener("click", (e) =>
          confirmarExclusaoEquipamento(
            e.currentTarget.dataset.id,
            e.currentTarget.dataset.tag
          )
        );

      corpoTabelaEquipamentos.appendChild(tr);
    });
  }

  closeModalButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const modalId = button.getAttribute("data-modal-id");
      const modalElement = document.getElementById(modalId);
      if (modalElement) {
        ocultarModal(modalElement);
      }
    });
  });

  window.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal")) {
      ocultarModal(event.target);
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (modalConfirmacao && !modalConfirmacao.classList.contains("hidden")) {
        ocultarModal(modalConfirmacao);
      } else if (
        modalEquipamento &&
        !modalEquipamento.classList.contains("hidden")
      ) {
        ocultarModal(modalEquipamento);
      } else if (
        modalSubestacao &&
        !modalSubestacao.classList.contains("hidden")
      ) {
        ocultarModal(modalSubestacao);
      }
    }
  });

  function abrirModalSubestacaoParaCriacao() {
    if (
      !formSubestacao ||
      !subestacaoIdModal ||
      !modalSubestacaoTitulo ||
      !modalSubestacao
    )
      return;
    formSubestacao.reset();
    subestacaoIdModal.value = "";
    modalSubestacaoTitulo.innerHTML =
      '<span class="material-icons-outlined">domain</span> Nova Subestação';
    mostrarModal(modalSubestacao);
    if (subestacaoSiglaModal) subestacaoSiglaModal.focus();
  }

  function abrirModalSubestacaoParaEdicao(subestacao) {
    if (
      !formSubestacao ||
      !subestacaoIdModal ||
      !subestacaoSiglaModal ||
      !subestacaoNomeModal ||
      !subestacaoAnoOpModal ||
      !modalSubestacaoTitulo ||
      !modalSubestacao
    )
      return;
    formSubestacao.reset();
    subestacaoIdModal.value = subestacao.Id;
    subestacaoSiglaModal.value = subestacao.sigla;
    subestacaoNomeModal.value = subestacao.nome;
    subestacaoAnoOpModal.value = subestacao.Ano_Inicio_Op || "";
    modalSubestacaoTitulo.innerHTML =
      '<span class="material-icons-outlined">domain</span> Editar Subestação';
    mostrarModal(modalSubestacao);
    if (subestacaoSiglaModal) subestacaoSiglaModal.focus();
  }

  if (formSubestacao) {
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

      const submitButton = formSubestacao.querySelector(
        'button[type="submit"]'
      );
      const originalButtonHtml = submitButton.innerHTML;
      submitButton.disabled = true;
      submitButton.innerHTML =
        '<span class="material-icons-outlined spin" style="animation: spin 1s linear infinite;">sync</span> Salvando...';

      let styleElement = document.getElementById(
        "spin-animation-style-subestacao"
      );
      if (!styleElement) {
        styleElement = document.createElement("style");
        styleElement.id = "spin-animation-style-subestacao";
        styleElement.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
        document.head.appendChild(styleElement);
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
        if (idParaSelecionar && selectSubestacao) {
          selectSubestacao.value = idParaSelecionar;
          await carregarDetalhesESubestacao(idParaSelecionar);
        } else if (!id && subestacoesCache.length > 0 && selectSubestacao) {
          selectSubestacao.value = subestacoesCache[0].Id;
          await carregarDetalhesESubestacao(subestacoesCache[0].Id);
        }
      } catch (error) {
      } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonHtml;
      }
    });
  }

  function abrirModalEquipamentoParaCriacao() {
    if (
      !formEquipamento ||
      !equipamentoIdModal ||
      !equipamentoSubestacaoIdModal ||
      !modalEquipamentoTitulo ||
      !equipamentoStatusModal ||
      !modalEquipamento
    )
      return;
    formEquipamento.reset();
    equipamentoIdModal.value = "";
    equipamentoSubestacaoIdModal.value = subestacaoSelecionadaId;
    modalEquipamentoTitulo.innerHTML =
      '<span class="material-icons-outlined">build_circle</span> Novo Equipamento';
    equipamentoStatusModal.value = "ATIVO";
    mostrarModal(modalEquipamento);
    if (equipamentoTagModal) equipamentoTagModal.focus();
  }

  function abrirModalEquipamentoParaEdicao(equipamento) {
    if (
      !formEquipamento ||
      !equipamentoIdModal ||
      !equipamentoSubestacaoIdModal ||
      !equipamentoTagModal ||
      !equipamentoDescricaoModal ||
      !equipamentoModeloModal ||
      !equipamentoSerialModal ||
      !equipamentoTensaoModal ||
      !equipamentoStatusModal ||
      !equipamentoDataInstModal ||
      !modalEquipamentoTitulo ||
      !modalEquipamento
    )
      return;

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
    if (equipamentoTagModal) equipamentoTagModal.focus();
  }

  if (formEquipamento) {
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

      const submitButton = formEquipamento.querySelector(
        'button[type="submit"]'
      );
      const originalButtonHtml = submitButton.innerHTML;
      submitButton.disabled = true;
      submitButton.innerHTML =
        '<span class="material-icons-outlined spin" style="animation: spin 1s linear infinite;">sync</span> Salvando...';

      let styleElement = document.getElementById("spin-animation-style-equip");
      if (!styleElement) {
        styleElement = document.createElement("style");
        styleElement.id = "spin-animation-style-equip";
        styleElement.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
        document.head.appendChild(styleElement);
      }

      try {
        await fetchData(url, {
          method: method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(equipamentoData),
        });
        alert(`Equipamento ${idEq ? "atualizado" : "criado"} com sucesso!`);
        ocultarModal(modalEquipamento);
        if (equipamentosSection) {
          await carregarEquipamentos(idSub);
        }
      } catch (error) {
      } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonHtml;
      }
    });
  }

  function confirmarExclusao(tipo, id, nomeItem, callbackConfirmacao) {
    if (!mensagemConfirmacao || !modalConfirmacao || !btnConfirmarExclusao)
      return;
    mensagemConfirmacao.textContent = `Você tem certeza que deseja excluir ${tipo}: "${nomeItem}"? Esta ação pode não ser desfeita.`;
    idItemParaExcluir = id;
    operacaoConfirmacao = callbackConfirmacao;
    mostrarModal(modalConfirmacao);
  }

  function confirmarExclusaoEquipamento(idEq, tagEq) {
    confirmarExclusao("o equipamento", idEq, tagEq, excluirEquipamento);
  }

  if (btnConfirmarExclusao) {
    btnConfirmarExclusao.addEventListener("click", async () => {
      if (
        typeof operacaoConfirmacao === "function" &&
        idItemParaExcluir !== null
      ) {
        const originalButtonHtml = btnConfirmarExclusao.innerHTML;
        btnConfirmarExclusao.disabled = true;
        btnConfirmarExclusao.innerHTML =
          '<span class="material-icons-outlined spin" style="animation: spin 1s linear infinite;">sync</span> Excluindo...';

        let styleElement = document.getElementById(
          "spin-animation-style-confirm"
        );
        if (!styleElement) {
          styleElement = document.createElement("style");
          styleElement.id = "spin-animation-style-confirm";
          styleElement.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
          document.head.appendChild(styleElement);
        }

        try {
          await operacaoConfirmacao(idItemParaExcluir);
          alert("Item excluído com sucesso!");
        } catch (error) {
        } finally {
          btnConfirmarExclusao.disabled = false;
          btnConfirmarExclusao.innerHTML = originalButtonHtml;
          ocultarModal(modalConfirmacao);
          operacaoConfirmacao = null;
          idItemParaExcluir = null;
        }
      }
    });
  }

  if (btnCancelarExclusao) {
    btnCancelarExclusao.addEventListener("click", () =>
      ocultarModal(modalConfirmacao)
    );
  }

  async function excluirSubestacao(idSub) {
    await fetchData(`/subestacoes/${idSub}`, { method: "DELETE" });
    ocultarDetalhesEEquipamentos();
    await carregarSubestacoes(); // Recarrega a lista e seleciona o primeiro, se houver
    if (subestacoesCache.length > 0 && selectSubestacao) {
      selectSubestacao.value = subestacoesCache[0].Id;
      await carregarDetalhesESubestacao(subestacoesCache[0].Id);
    } else if (subestacoesCache.length === 0) {
      ocultarDetalhesEEquipamentos(); // Garante que nada seja exibido se a lista estiver vazia
      if (selectSubestacao)
        selectSubestacao.innerHTML =
          '<option value="">Nenhuma subestação encontrada</option>';
    }
  }

  async function excluirEquipamento(idEq) {
    if (!subestacaoSelecionadaId || !equipamentosSection) return;
    await fetchData(
      `/subestacoes/${subestacaoSelecionadaId}/equipamentos/${idEq}`,
      { method: "DELETE" }
    );
    await carregarEquipamentos(subestacaoSelecionadaId);
  }

  if (selectSubestacao) {
    selectSubestacao.addEventListener("change", (event) => {
      const idSelecionado = event.target.value;
      carregarDetalhesESubestacao(idSelecionado);
    });
  }

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
