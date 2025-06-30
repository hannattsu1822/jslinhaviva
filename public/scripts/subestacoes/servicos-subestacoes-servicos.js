document.addEventListener("DOMContentLoaded", () => {
  const formFiltrosServicos = document.getElementById("formFiltrosServicos");
  const filtroSubestacaoSelect = document.getElementById("filtroSubestacao");
  const btnLimparFiltrosServicos = document.getElementById(
    "btnLimparFiltrosServicos"
  );
  const corpoTabelaServicosElem = document.getElementById(
    "corpoTabelaServicos"
  );
  const nenhumServicoMsgElem = document.getElementById("nenhumServico");
  const btnNovoServico = document.getElementById("btnNovoServico");

  const modalConfirmacaoServicoEl = document.getElementById(
    "modalConfirmacaoServico"
  );
  const modalConfirmacaoServicoTitulo = document.getElementById(
    "modalConfirmacaoServicoTitulo"
  );
  const mensagemConfirmacaoServico = document.getElementById(
    "mensagemConfirmacaoServico"
  );
  const formConfirmacaoConcluirServico = document.getElementById(
    "formConfirmacaoConcluirServico"
  );
  const listaItensParaConcluirContainer = document.getElementById(
    "listaItensParaConcluirContainer"
  );
  const confirmacaoDataConclusaoInput = document.getElementById(
    "confirmacaoDataConclusaoInput"
  );
  const confirmacaoHoraConclusaoInput = document.getElementById(
    "confirmacaoHoraConclusaoInput"
  );
  const confirmacaoObservacoesTextarea = document.getElementById(
    "confirmacaoObservacoesTextarea"
  );
  const confirmacaoAnexosInput = document.getElementById(
    "confirmacaoAnexosInput"
  );
  const btnConfirmarAcaoServico = document.getElementById(
    "btnConfirmarAcaoServico"
  );

  const modalGerenciarItensServicoEl = document.getElementById(
    "modalGerenciarItensServico"
  );
  const servicoIdParaGerenciarItensInput = document.getElementById(
    "servicoIdParaGerenciarItens"
  );
  const processoServicoGerenciarItensSpan = document.getElementById(
    "processoServicoGerenciarItens"
  );
  const listaItensParaGerenciamentoDiv = document.getElementById(
    "listaItensParaGerenciamento"
  );
  const nenhumItemEscopoParaGerenciarMsg = document.getElementById(
    "nenhumItemEscopoParaGerenciarMsg"
  );
  const btnSalvarGerenciamentoItens = document.getElementById(
    "btnSalvarGerenciamentoItens"
  );

  let operacaoConfirmacaoServico = null;
  let idServicoParaAcao = null;
  let encarregadosCache = [];
  let currentUser = null;

  function mostrarModal(modalEl) {
    if (modalEl) modalEl.classList.remove("hidden");
  }

  function ocultarModal(modalEl) {
    if (modalEl) modalEl.classList.add("hidden");
  }

  document
    .querySelectorAll(
      ".modal-overlay .btn-close, .modal-overlay .btn-close-modal"
    )
    .forEach((btn) => {
      btn.addEventListener("click", () =>
        ocultarModal(btn.closest(".modal-overlay"))
      );
    });

  async function fetchCurrentUser() {
    if (currentUser) return currentUser;
    try {
      currentUser = await fetchData("/api/me");
      return currentUser;
    } catch (error) {
      console.error("Erro ao buscar dados do usuário atual.");
      return null;
    }
  }

  async function fetchData(url, options = {}) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: `Erro HTTP: ${response.status}` }));
        throw new Error(
          errorData.message || `Erro HTTP: ${response.status} em ${url}`
        );
      }
      return response.status === 204 ? null : await response.json();
    } catch (error) {
      alert(`Erro ao comunicar com o servidor: ${error.message}`);
      throw error;
    }
  }

  function formatarDataParaInput(dataISO) {
    if (!dataISO) return "";
    return dataISO.split("T")[0];
  }

  function formatarHoraParaInput(horaISO) {
    if (!horaISO) return "";
    if (typeof horaISO === "string" && horaISO.includes(":"))
      return horaISO.substring(0, 5);
    return "";
  }

  function formatarNomes(nomesString) {
    if (!nomesString) return "-";
    return nomesString
      .split(",")
      .map((nome) => {
        const partes = nome.trim().split(" ");
        return partes.length > 1 ? `${partes[0]} ${partes[1]}` : partes[0];
      })
      .join("<br>");
  }

  async function popularFiltroSubestacoes() {
    if (!filtroSubestacaoSelect) return;
    try {
      const subestacoes = (await fetchData("/subestacoes")) || [];
      filtroSubestacaoSelect.innerHTML = '<option value="">Todas</option>';
      subestacoes.forEach((sub) =>
        filtroSubestacaoSelect.add(
          new Option(`${sub.sigla} - ${sub.nome}`, sub.Id)
        )
      );
    } catch (error) {
      if (filtroSubestacaoSelect)
        filtroSubestacaoSelect.innerHTML =
          '<option value="">Erro ao carregar</option>';
    }
  }

  async function popularSelectEncarregados(
    selectElement,
    selecionadoId = null
  ) {
    try {
      if (encarregadosCache.length === 0) {
        encarregadosCache =
          (await fetchData("/usuarios-encarregados-e-inspetores")) || [];
      }
      if (selectElement) {
        selectElement.innerHTML = '<option value="">Nenhum</option>';
        encarregadosCache.forEach((user) => {
          const option = new Option(user.nome, user.id);
          if (String(selecionadoId) === String(user.id)) {
            option.selected = true;
          }
          selectElement.add(option);
        });
      }
    } catch (error) {
      if (selectElement) {
        selectElement.innerHTML = '<option value="">Erro ao carregar</option>';
      }
    }
  }

  async function carregarServicos(params = {}) {
    if (!corpoTabelaServicosElem || !nenhumServicoMsgElem) return;

    corpoTabelaServicosElem.innerHTML =
      '<tr><td colspan="10"><div class="feedback-message">Carregando serviços...</div></td></tr>';
    nenhumServicoMsgElem.classList.add("d-none");
    const queryParams = new URLSearchParams(params);

    const url = `/api/servicos-subestacoes?${queryParams.toString()}`;
    try {
      const servicos = await fetchData(url);
      popularTabelaServicos(servicos);
    } catch (error) {
      if (corpoTabelaServicosElem) {
        corpoTabelaServicosElem.innerHTML =
          '<tr><td colspan="10"><div class="feedback-message text-danger">Erro ao carregar os serviços.</div></td></tr>';
      }
    }
  }

  function popularTabelaServicos(servicos) {
    corpoTabelaServicosElem.innerHTML = "";
    if (!servicos || servicos.length === 0) {
      nenhumServicoMsgElem.classList.remove("d-none");
      return;
    }
    nenhumServicoMsgElem.classList.add("d-none");

    servicos.forEach((serv) => {
      const tr = document.createElement("tr");
      const statusServ = (serv.status || "").toUpperCase();
      const statusCls = (serv.status || "desconhecido").toLowerCase();
      const statusTxt = (serv.status || "DESCONHECIDO").replace(/_/g, " ");
      const dataPrevistaFormatada = serv.data_prevista
        ? new Date(serv.data_prevista + "T00:00:00Z").toLocaleDateString(
            "pt-BR",
            { timeZone: "UTC" }
          )
        : "-";
      const progressoItens =
        serv.total_itens > 0
          ? `${serv.itens_concluidos}/${serv.total_itens}`
          : "N/A";
      const progressoClasse =
        serv.total_itens > 0 && serv.itens_concluidos === serv.total_itens
          ? "text-success fw-bold"
          : "text-muted";
      const prioridade = serv.prioridade || "MEDIA";
      const prioridadeClasse = `prioridade-${prioridade.toLowerCase()}`;

      tr.innerHTML = `
          <td>${serv.id || "-"}</td>
          <td>${serv.processo || "-"}</td>
          <td>${serv.subestacao_sigla || "-"}</td>
          <td><span class="prioridade-badge ${prioridadeClasse}">${prioridade}</span></td>
          <td>${dataPrevistaFormatada}</td>
          <td>${serv.responsavel_nome || "-"}</td>
          <td>${formatarNomes(serv.encarregados_itens_nomes)}</td>
          <td class="text-center ${progressoClasse}">${progressoItens}</td>
          <td class="text-center"><span class="status-badge status-${statusCls}">${statusTxt}</span></td>
          <td class="actions-column">
              <div class="actions-wrapper">
                  <button class="btn text-info btn-ver-detalhes" data-id="${
                    serv.id
                  }" title="Ver Detalhes"><span class="material-symbols-outlined">visibility</span></button>
                  <button class="btn text-primary btn-editar-servico" data-id="${
                    serv.id
                  }" title="Editar Serviço"><span class="material-symbols-outlined">edit</span></button>
                  <button class="btn text-secondary btn-gerenciar-itens" data-id="${
                    serv.id
                  }" data-processo="${
        serv.processo
      }" title="Gerenciar Itens/Encarregados"><span class="material-symbols-outlined">manage_accounts</span></button>
                  <button class="btn text-success btn-concluir-servico" data-id="${
                    serv.id
                  }" data-processo="${
        serv.processo
      }" title="Concluir Serviço / Meus Itens" ${
        statusServ === "CONCLUIDO" || statusServ === "CANCELADO"
          ? "disabled"
          : ""
      }><span class="material-symbols-outlined">check_circle</span></button>
                  <button class="btn text-danger btn-excluir-servico" data-id="${
                    serv.id
                  }" data-processo="${
        serv.processo
      }" title="Excluir Serviço"><span class="material-symbols-outlined">delete</span></button>
              </div>
          </td>`;

      tr.querySelector(".btn-ver-detalhes")?.addEventListener("click", (e) =>
        window.open(
          `/servicos/${e.currentTarget.dataset.id}/detalhes-pagina`,
          "_blank"
        )
      );
      tr.querySelector(".btn-editar-servico")?.addEventListener(
        "click",
        (e) =>
          (window.location.href = `/registrar-servico-subestacao?editarId=${e.currentTarget.dataset.id}`)
      );
      tr.querySelector(".btn-concluir-servico")?.addEventListener(
        "click",
        (e) =>
          abrirModalConfirmacaoConcluirServico(
            e.currentTarget.dataset.id,
            e.currentTarget.dataset.processo
          )
      );
      tr.querySelector(".btn-gerenciar-itens")?.addEventListener("click", (e) =>
        abrirModalGerenciarItens(
          e.currentTarget.dataset.id,
          e.currentTarget.dataset.processo
        )
      );
      tr.querySelector(".btn-excluir-servico")?.addEventListener("click", (e) =>
        confirmarExclusaoServico(
          e.currentTarget.dataset.id,
          e.currentTarget.dataset.processo
        )
      );

      corpoTabelaServicosElem.appendChild(tr);
    });
  }

  if (formFiltrosServicos) {
    formFiltrosServicos.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(formFiltrosServicos);
      const params = Object.fromEntries(formData.entries());
      carregarServicos(params);
    });
  }

  if (btnLimparFiltrosServicos && formFiltrosServicos) {
    btnLimparFiltrosServicos.addEventListener("click", () => {
      formFiltrosServicos.reset();
      carregarServicos();
    });
  }

  if (btnNovoServico) {
    btnNovoServico.addEventListener("click", () => {
      window.location.href = "/registrar-servico-subestacao";
    });
  }

  function confirmarExclusaoServico(servicoId, processo) {
    idServicoParaAcao = servicoId;
    operacaoConfirmacaoServico = async () => {
      try {
        await fetchData(`/api/servicos-subestacoes/${idServicoParaAcao}`, {
          method: "DELETE",
        });
        alert("Serviço excluído com sucesso!");
        ocultarModal(modalConfirmacaoServicoEl);
        carregarServicos(
          Object.fromEntries(new FormData(formFiltrosServicos).entries())
        );
      } catch (error) {
        alert(`Falha ao excluir serviço: ${error.message}`);
      }
    };

    modalConfirmacaoServicoTitulo.innerHTML = `<span class="material-symbols-outlined text-danger">warning</span> Confirmar Exclusão`;
    mensagemConfirmacaoServico.textContent = `Tem certeza que deseja excluir o serviço do processo "${
      processo || servicoId
    }"? Esta ação não pode ser desfeita.`;
    formConfirmacaoConcluirServico.classList.add("hidden");
    btnConfirmarAcaoServico.className = "btn btn-danger";
    btnConfirmarAcaoServico.innerHTML = `<span class="material-symbols-outlined">delete</span> Excluir`;
    mostrarModal(modalConfirmacaoServicoEl);
  }

  async function abrirModalConfirmacaoConcluirServico(
    servicoId,
    processoServico
  ) {
    formConfirmacaoConcluirServico.reset();
    idServicoParaAcao = servicoId;
    const user = await fetchCurrentUser();
    const servico = await fetchData(`/api/servicos-subestacoes/${servicoId}`);
    const cargosConclusaoGeral = [
      "ADMIN",
      "Engenheiro",
      "Gerente",
      "Técnico",
      "ADM",
    ];

    modalConfirmacaoServicoTitulo.innerHTML = `<span class="material-symbols-outlined text-success">check_circle</span> Concluir Serviço`;
    btnConfirmarAcaoServico.className = "btn btn-success";
    btnConfirmarAcaoServico.innerHTML = `<span class="material-symbols-outlined">check</span> Confirmar Conclusão`;

    if (cargosConclusaoGeral.includes(user.cargo)) {
      mensagemConfirmacaoServico.textContent = `Deseja realmente marcar o serviço do processo "${
        processoServico || servicoId
      }" como CONCLUÍDO? Todos os itens pendentes serão fechados automaticamente.`;
      listaItensParaConcluirContainer.innerHTML = "";
      listaItensParaConcluirContainer.classList.add("hidden");
    } else {
      const meusItens = servico.itens_escopo.filter(
        (item) =>
          item.encarregado_item_id === user.id &&
          !item.status_item_escopo.startsWith("CONCLUIDO")
      );
      if (meusItens.length === 0) {
        alert("Você não possui itens pendentes para concluir neste serviço.");
        return;
      }
      mensagemConfirmacaoServico.textContent =
        "Você está prestes a concluir os seguintes itens sob sua responsabilidade:";
      listaItensParaConcluirContainer.innerHTML = `<ul class="item-list">${meusItens
        .map((item) => `<li>${item.descricao_item_servico}</li>`)
        .join("")}</ul>`;
      listaItensParaConcluirContainer.classList.remove("hidden");
    }

    formConfirmacaoConcluirServico.classList.remove("hidden");
    confirmacaoDataConclusaoInput.value = formatarDataParaInput(
      new Date().toISOString()
    );
    confirmacaoHoraConclusaoInput.value = new Date().toLocaleTimeString(
      "pt-BR",
      { hour: "2-digit", minute: "2-digit" }
    );
    operacaoConfirmacaoServico = handleConcluirServico;
    mostrarModal(modalConfirmacaoServicoEl);
  }

  async function handleConcluirServico() {
    if (!idServicoParaAcao || !confirmacaoDataConclusaoInput.value) {
      alert("A data de conclusão é obrigatória.");
      return;
    }
    const formData = new FormData(formConfirmacaoConcluirServico);
    btnConfirmarAcaoServico.disabled = true;
    try {
      await fetchData(
        `/api/servicos-subestacoes/${idServicoParaAcao}/concluir`,
        { method: "PUT", body: formData }
      );
      alert("Ação de conclusão registrada com sucesso!");
      ocultarModal(modalConfirmacaoServicoEl);
      carregarServicos(
        Object.fromEntries(new FormData(formFiltrosServicos).entries())
      );
    } catch (error) {
      alert(`Falha ao registrar conclusão: ${error.message}`);
    } finally {
      btnConfirmarAcaoServico.disabled = false;
    }
  }

  async function abrirModalGerenciarItens(servicoId, processoServico) {
    servicoIdParaGerenciarItensInput.value = servicoId;
    processoServicoGerenciarItensSpan.textContent =
      processoServico || servicoId;
    listaItensParaGerenciamentoDiv.innerHTML =
      '<div class="feedback-message">Carregando...</div>';
    nenhumItemEscopoParaGerenciarMsg.classList.add("d-none");
    mostrarModal(modalGerenciarItensServicoEl);

    try {
      const servicoDetalhes = await fetchData(
        `/api/servicos-subestacoes/${servicoId}`
      );
      await popularSelectEncarregados(null);
      listaItensParaGerenciamentoDiv.innerHTML = "";

      if (servicoDetalhes.itens_escopo.length === 0) {
        nenhumItemEscopoParaGerenciarMsg.classList.remove("d-none");
        return;
      }

      servicoDetalhes.itens_escopo.forEach((item) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "item-management-card";
        itemDiv.dataset.itemEscopoId = item.item_escopo_id;
        const selectEncarregado = document.createElement("select");
        selectEncarregado.className = "form-select";
        popularSelectEncarregados(selectEncarregado, item.encarregado_item_id);
        itemDiv.innerHTML = `<h6>${item.descricao_item_servico}</h6>`;
        itemDiv.appendChild(selectEncarregado);
        listaItensParaGerenciamentoDiv.appendChild(itemDiv);
      });
    } catch (error) {
      listaItensParaGerenciamentoDiv.innerHTML =
        '<div class="feedback-message text-danger">Erro ao carregar os itens.</div>';
    }
  }

  if (btnSalvarGerenciamentoItens) {
    btnSalvarGerenciamentoItens.addEventListener("click", async () => {
      const servicoId = servicoIdParaGerenciarItensInput.value;
      const atualizacoes = Array.from(
        listaItensParaGerenciamentoDiv.querySelectorAll(".item-management-card")
      ).map((itemEl) => ({
        item_escopo_id: parseInt(itemEl.dataset.itemEscopoId),
        novo_encarregado_item_id: itemEl.querySelector("select").value
          ? parseInt(itemEl.querySelector("select").value)
          : null,
      }));

      if (atualizacoes.length === 0) {
        ocultarModal(modalGerenciarItensServicoEl);
        return;
      }

      btnSalvarGerenciamentoItens.disabled = true;
      try {
        await fetchData(
          `/api/servicos/${servicoId}/atualizar-encarregados-itens`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ atualizacoes_encarregados: atualizacoes }),
          }
        );
        alert("Encarregados dos itens atualizados com sucesso!");
        ocultarModal(modalGerenciarItensServicoEl);
        carregarServicos(
          Object.fromEntries(new FormData(formFiltrosServicos).entries())
        );
      } catch (error) {
        alert(`Falha ao atualizar encarregados: ${error.message}`);
      } finally {
        btnSalvarGerenciamentoItens.disabled = false;
      }
    });
  }

  if (btnConfirmarAcaoServico) {
    btnConfirmarAcaoServico.addEventListener("click", () => {
      if (typeof operacaoConfirmacaoServico === "function") {
        operacaoConfirmacaoServico();
      }
    });
  }

  async function init() {
    await fetchCurrentUser();
    await popularFiltroSubestacoes();
    await carregarServicos();
  }

  init();
});
