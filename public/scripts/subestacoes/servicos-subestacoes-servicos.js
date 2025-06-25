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
  const listaNomesAnexosConclusao = document.getElementById(
    "listaNomesAnexosConclusao"
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

  let bsModalConfirmacaoServico = null;
  let bsModalGerenciarItensServico = null;

  if (modalConfirmacaoServicoEl)
    bsModalConfirmacaoServico = new bootstrap.Modal(modalConfirmacaoServicoEl);
  if (modalGerenciarItensServicoEl)
    bsModalGerenciarItensServico = new bootstrap.Modal(
      modalGerenciarItensServicoEl
    );

  let operacaoConfirmacaoServico = null;
  let idServicoParaAcao = null;
  let subestacoesCache = [];
  let encarregadosCache = [];
  let currentUser = null;

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

  function mostrarModal(bsModalInstance) {
    if (bsModalInstance) bsModalInstance.show();
  }
  function ocultarModal(bsModalInstance) {
    if (bsModalInstance) bsModalInstance.hide();
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
        if (partes.length > 1) {
          return `${partes[0]} ${partes[1]}`;
        }
        return partes[0];
      })
      .join("<br>");
  }

  async function popularFiltroSubestacoes() {
    if (!filtroSubestacaoSelect) return;
    try {
      subestacoesCache = (await fetchData("/subestacoes")) || [];
      filtroSubestacaoSelect.innerHTML = '<option value="">Todas</option>';
      subestacoesCache.forEach((sub) =>
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
    const localCorpoTabela = corpoTabelaServicosElem;
    const localNenhumMsg = nenhumServicoMsgElem;

    if (!localCorpoTabela || !localNenhumMsg) return;

    localCorpoTabela.innerHTML =
      '<tr><td colspan="11" class="text-center p-5"><div class="spinner-border spinner-border-sm text-primary" role="status"><span class="visually-hidden">Carregando...</span></div> Carregando serviços...</td></tr>';
    localNenhumMsg.classList.add("d-none");
    const queryParams = new URLSearchParams(params);

    const url = `/api/servicos-subestacoes?${queryParams.toString()}`;
    try {
      const servicos = await fetchData(url);
      popularTabelaServicos(servicos);
    } catch (error) {
      if (localCorpoTabela) {
        localCorpoTabela.innerHTML =
          '<tr><td colspan="11" class="text-center text-danger p-5">Erro ao carregar os serviços. Verifique o console.</td></tr>';
      }
    }
  }

  function popularTabelaServicos(servicos) {
    const localCorpoTabela = corpoTabelaServicosElem;
    const localNenhumMsg = nenhumServicoMsgElem;

    localCorpoTabela.innerHTML = "";
    if (!servicos || servicos.length === 0) {
      localNenhumMsg.classList.remove("d-none");
      return;
    }
    localNenhumMsg.classList.add("d-none");

    servicos.forEach((serv) => {
      const tr = document.createElement("tr");
      const statusServ = (serv.status || "").toUpperCase();
      const statusCls = (serv.status || "desconhecido")
        .toLowerCase()
        .replace(/_/g, "");
      const statusTxt = (serv.status || "DESCONHECIDO").replace("_", " ");
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

      tr.innerHTML = `
          <td data-label="ID">${serv.id || "-"}</td>
          <td data-label="Processo">${serv.processo || "-"}</td>
          <td data-label="Subestação">${
            serv.subestacao_sigla || serv.subestacao_id || "-"
          }</td>
          <td data-label="Motivo" title="${serv.motivo || ""}">${(
        serv.motivo || ""
      ).substring(0, 35)}${(serv.motivo || "").length > 35 ? "..." : ""}</td>
          <td data-label="Data Prevista">${dataPrevistaFormatada}</td>
          <td data-label="Horário">${
            formatarHoraParaInput(serv.horario_inicio) || "-"
          } - ${formatarHoraParaInput(serv.horario_fim) || "-"}</td>
          <td data-label="Responsável">${serv.responsavel_nome || "-"}</td>
          <td data-label="Encarregado(s)">${formatarNomes(
            serv.encarregados_itens_nomes
          )}</td>
          <td data-label="Progresso Itens" class="text-center ${progressoClasse}">${progressoItens}</td>
          <td data-label="Status (Geral)" class="text-center"><span class="status-badge status-${statusCls}">${statusTxt}</span></td>
          <td data-label="Ações" class="actions-column">
              <div class="actions-wrapper">
                  <div class="action-group">
                      <button class="btn btn-icon text-info btn-ver-detalhes" data-id="${
                        serv.id
                      }" title="Ver Detalhes"><span class="material-symbols-outlined">visibility</span></button>
                      <button class="btn btn-icon text-primary btn-editar-servico" data-id="${
                        serv.id
                      }" title="Editar Serviço"><span class="material-symbols-outlined">edit</span></button>
                      <button class="btn btn-icon text-secondary btn-gerenciar-itens" data-id="${
                        serv.id
                      }" data-processo="${
        serv.processo
      }" title="Gerenciar Itens/Encarregados"><span class="material-symbols-outlined">manage_accounts</span></button>
                  </div>
                  <div class="action-group">
                      <button class="btn btn-icon text-success btn-concluir-servico" data-id="${
                        serv.id
                      }" data-processo="${
        serv.processo
      }" title="Concluir Serviço / Meus Itens" ${
        statusServ === "CONCLUIDO" || statusServ === "CANCELADO"
          ? "disabled"
          : ""
      }><span class="material-symbols-outlined">check_circle</span></button>
                      <button class="btn btn-icon text-warning btn-reabrir-servico" data-id="${
                        serv.id
                      }" data-processo="${
        serv.processo
      }" title="Reabrir Serviço" ${
        statusServ !== "CONCLUIDO" && statusServ !== "CANCELADO"
          ? "disabled"
          : ""
      }><span class="material-symbols-outlined">history</span></button>
                      <button class="btn btn-icon text-danger btn-excluir-servico" data-id="${
                        serv.id
                      }" data-processo="${
        serv.processo
      }" title="Excluir Serviço"><span class="material-symbols-outlined">delete</span></button>
                  </div>
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
      tr.querySelector(".btn-reabrir-servico")?.addEventListener("click", (e) =>
        abrirModalConfirmacaoReabrirServico(
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

      localCorpoTabela.appendChild(tr);
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
    if (!bsModalConfirmacaoServico) return;
    const iconElement = modalConfirmacaoServicoTitulo.querySelector(
      ".material-symbols-outlined"
    );
    iconElement.textContent = "warning";
    iconElement.className = "material-symbols-outlined me-2 text-danger";
    const titleTextNode = Array.from(
      modalConfirmacaoServicoTitulo.childNodes
    ).find((node) => node.nodeType === Node.TEXT_NODE);
    if (titleTextNode) titleTextNode.nodeValue = " Confirmar Exclusão";

    mensagemConfirmacaoServico.textContent = `Tem certeza que deseja excluir o serviço do processo "${
      processo || servicoId
    }"? Esta ação não pode ser desfeita.`;
    formConfirmacaoConcluirServico.classList.add("d-none");
    btnConfirmarAcaoServico.className = "btn btn-sm btn-danger";
    btnConfirmarAcaoServico.innerHTML =
      '<span class="material-symbols-outlined">delete</span> Excluir';
    idServicoParaAcao = servicoId;
    operacaoConfirmacaoServico = async () => {
      const submitButton = btnConfirmarAcaoServico;
      const originalButtonHtmlInner = submitButton.innerHTML;
      submitButton.disabled = true;
      submitButton.innerHTML =
        '<span class="spinner-border spinner-border-sm"></span> Excluindo...';
      try {
        await fetchData(`/api/servicos-subestacoes/${idServicoParaAcao}`, {
          method: "DELETE",
        });
        alert("Serviço excluído com sucesso!");
        const currentParams = Object.fromEntries(
          new FormData(formFiltrosServicos).entries()
        );
        carregarServicos(currentParams);
      } catch (error) {
        alert(`Falha ao excluir serviço: ${error.message}`);
      } finally {
        ocultarModal(bsModalConfirmacaoServico);
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonHtmlInner;
        idServicoParaAcao = null;
      }
    };
    mostrarModal(bsModalConfirmacaoServico);
  }

  async function abrirModalConfirmacaoConcluirServico(
    servicoId,
    processoServico
  ) {
    if (!bsModalConfirmacaoServico) return;

    formConfirmacaoConcluirServico.reset();
    listaNomesAnexosConclusao.innerHTML = "";

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

    const iconElement = modalConfirmacaoServicoTitulo.querySelector(
      ".material-symbols-outlined"
    );
    iconElement.textContent = "check_circle";
    iconElement.className = "material-symbols-outlined me-2 text-success";
    btnConfirmarAcaoServico.className = "btn btn-sm btn-success";
    btnConfirmarAcaoServico.innerHTML =
      '<span class="material-symbols-outlined">check_circle</span> Confirmar Conclusão';

    const titleTextNode = Array.from(
      modalConfirmacaoServicoTitulo.childNodes
    ).find((node) => node.nodeType === Node.TEXT_NODE);

    if (cargosConclusaoGeral.includes(user.cargo)) {
      if (titleTextNode) titleTextNode.nodeValue = " Concluir Serviço (Geral)";
      mensagemConfirmacaoServico.textContent = `Deseja realmente marcar o serviço do processo "${
        processoServico || servicoId
      }" como CONCLUÍDO? Todos os itens pendentes serão fechados automaticamente.`;
      listaItensParaConcluirContainer.innerHTML = "";
      listaItensParaConcluirContainer.classList.add("d-none");
    } else {
      if (titleTextNode) titleTextNode.nodeValue = " Concluir Meus Itens";
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
      let itensHtml = '<ul class="list-group list-group-flush mb-3">';
      meusItens.forEach((item) => {
        itensHtml += `<li class="list-group-item small">${item.descricao_item_servico}</li>`;
      });
      itensHtml += "</ul>";
      listaItensParaConcluirContainer.innerHTML = itensHtml;
      listaItensParaConcluirContainer.classList.remove("d-none");
    }

    formConfirmacaoConcluirServico.classList.remove("d-none");
    confirmacaoDataConclusaoInput.value = formatarDataParaInput(
      new Date().toISOString()
    );
    const now = new Date();
    confirmacaoHoraConclusaoInput.value = now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    operacaoConfirmacaoServico = handleConcluirServico;
    mostrarModal(bsModalConfirmacaoServico);
  }

  async function handleConcluirServico() {
    if (!idServicoParaAcao) return;
    if (!confirmacaoDataConclusaoInput.value) {
      alert("A data de conclusão é obrigatória.");
      confirmacaoDataConclusaoInput.focus();
      return;
    }
    const submitButton = btnConfirmarAcaoServico;
    const originalButtonHtml = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML =
      '<span class="spinner-border spinner-border-sm"></span> Confirmando...';

    const formData = new FormData(formConfirmacaoConcluirServico);

    try {
      await fetchData(
        `/api/servicos-subestacoes/${idServicoParaAcao}/concluir`,
        { method: "PUT", body: formData }
      );
      alert("Ação de conclusão registrada com sucesso!");
      ocultarModal(bsModalConfirmacaoServico);
      const currentParams = Object.fromEntries(
        new FormData(formFiltrosServicos).entries()
      );
      carregarServicos(currentParams);
    } catch (error) {
      alert(`Falha ao registrar conclusão: ${error.message}`);
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonHtml;
      idServicoParaAcao = null;
    }
  }

  function abrirModalConfirmacaoReabrirServico(servicoId, processoServico) {
    if (!bsModalConfirmacaoServico) return;
    idServicoParaAcao = servicoId;
    const iconElement = modalConfirmacaoServicoTitulo.querySelector(
      ".material-symbols-outlined"
    );
    iconElement.textContent = "history";
    iconElement.className = "material-symbols-outlined me-2 text-warning";
    const titleTextNode = Array.from(
      modalConfirmacaoServicoTitulo.childNodes
    ).find((node) => node.nodeType === Node.TEXT_NODE);
    if (titleTextNode) titleTextNode.nodeValue = " Confirmar Reabertura";

    mensagemConfirmacaoServico.textContent = `Deseja realmente reabrir o serviço do processo "${
      processoServico || servicoId
    }" (voltará para EM ANDAMENTO)?`;
    formConfirmacaoConcluirServico.classList.add("d-none");
    btnConfirmarAcaoServico.className = "btn btn-sm btn-warning";
    btnConfirmarAcaoServico.innerHTML =
      '<span class="material-symbols-outlined">history</span> Confirmar Reabertura';
    operacaoConfirmacaoServico = handleReabrirServico;
    mostrarModal(bsModalConfirmacaoServico);
  }

  async function handleReabrirServico() {
    if (!idServicoParaAcao) return;
    const submitButton = btnConfirmarAcaoServico;
    const originalButtonHtml = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML =
      '<span class="spinner-border spinner-border-sm"></span> Reabrindo...';
    try {
      const result = await fetchData(
        `/api/servicos-subestacoes/${idServicoParaAcao}/reabrir`,
        { method: "PUT", headers: { "Content-Type": "application/json" } }
      );
      alert(result.message || "Serviço reaberto com sucesso!");
      ocultarModal(bsModalConfirmacaoServico);
      const currentParams = Object.fromEntries(
        new FormData(formFiltrosServicos).entries()
      );
      carregarServicos(currentParams);
    } catch (error) {
      alert(`Falha ao reabrir serviço: ${error.message}`);
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonHtml;
      idServicoParaAcao = null;
    }
  }

  async function abrirModalGerenciarItens(servicoId, processoServico) {
    if (!bsModalGerenciarItensServico) return;

    servicoIdParaGerenciarItensInput.value = servicoId;
    processoServicoGerenciarItensSpan.textContent =
      processoServico || servicoId;
    listaItensParaGerenciamentoDiv.innerHTML =
      '<div class="text-center p-3"><div class="spinner-border text-primary"></div></div>';
    nenhumItemEscopoParaGerenciarMsg.classList.add("d-none");
    mostrarModal(bsModalGerenciarItensServico);

    try {
      const servicoDetalhes = await fetchData(
        `/api/servicos-subestacoes/${servicoId}`
      );
      if (!servicoDetalhes || !servicoDetalhes.itens_escopo) {
        throw new Error("Não foi possível carregar os itens de escopo.");
      }

      await popularSelectEncarregados(null);

      listaItensParaGerenciamentoDiv.innerHTML = "";

      if (servicoDetalhes.itens_escopo.length === 0) {
        nenhumItemEscopoParaGerenciarMsg.classList.remove("d-none");
        return;
      }

      servicoDetalhes.itens_escopo.forEach((item) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "list-group-item mb-2 p-3 border rounded";
        itemDiv.dataset.itemEscopoId = item.item_escopo_id;

        let descItem = item.descricao_item_servico;
        if (item.inspecao_item_id) {
          descItem = `[Origem Insp. #${
            item.origem_inspecao_formulario_num || item.origem_inspecao_id
          } - Item ${item.inspecao_item_num}] ${
            item.inspecao_item_descricao_original || item.descricao_item_servico
          }`;
        }

        const selectEncarregado = document.createElement("select");
        selectEncarregado.className = "form-select form-select-sm";
        popularSelectEncarregados(selectEncarregado, item.encarregado_item_id);

        const statusClasse = item.status_item_escopo.startsWith("CONCLUIDO")
          ? "success"
          : "secondary";
        const statusTexto = item.status_item_escopo.replace(/_/g, " ");

        itemDiv.innerHTML = `
            <div class="d-flex w-100 justify-content-between align-items-start">
                <h6 class="mb-1 small flex-grow-1" title="${descItem}">${descItem.substring(
          0,
          80
        )}${descItem.length > 80 ? "..." : ""}</h6>
                <div class="item-status-display ms-2"><span class="badge bg-${statusClasse}">${statusTexto}</span></div>
            </div>
            <div class="row align-items-center mt-2">
                <div class="col-md-12">
                    <label class="form-label-sm small mb-1 fw-bold">Encarregado do Item:</label>
                    <div class="select-container"></div>
                </div>
            </div>
            ${
              item.defeito_codigo
                ? `<p class="mb-0 mt-1 small text-secondary"><strong>Defeito:</strong> ${
                    item.defeito_codigo
                  } - ${item.defeito_descricao.substring(0, 50)}...</p>`
                : ""
            }
        `;

        itemDiv
          .querySelector(".select-container")
          .appendChild(selectEncarregado);
        listaItensParaGerenciamentoDiv.appendChild(itemDiv);
      });
    } catch (error) {
      listaItensParaGerenciamentoDiv.innerHTML =
        '<div class="alert alert-danger">Erro ao carregar os itens.</div>';
    }
  }

  if (btnSalvarGerenciamentoItens) {
    btnSalvarGerenciamentoItens.addEventListener("click", async () => {
      const servicoId = servicoIdParaGerenciarItensInput.value;
      if (!servicoId) return;

      const atualizacoes = Array.from(
        listaItensParaGerenciamentoDiv.querySelectorAll(".list-group-item")
      ).map((itemEl) => {
        const selectEncarregado = itemEl.querySelector("select");
        return {
          item_escopo_id: parseInt(itemEl.dataset.itemEscopoId),
          novo_encarregado_item_id: selectEncarregado.value
            ? parseInt(selectEncarregado.value)
            : null,
        };
      });

      if (atualizacoes.length === 0) {
        ocultarModal(bsModalGerenciarItensServico);
        return;
      }

      const originalButtonHtml = btnSalvarGerenciamentoItens.innerHTML;
      btnSalvarGerenciamentoItens.disabled = true;
      btnSalvarGerenciamentoItens.innerHTML =
        '<span class="spinner-border spinner-border-sm"></span> Salvando...';

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
        ocultarModal(bsModalGerenciarItensServico);
        carregarServicos(
          Object.fromEntries(new FormData(formFiltrosServicos).entries())
        );
      } catch (error) {
        alert(`Falha ao atualizar encarregados: ${error.message}`);
      } finally {
        btnSalvarGerenciamentoItens.disabled = false;
        btnSalvarGerenciamentoItens.innerHTML = originalButtonHtml;
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
    await popularSelectEncarregados(null);
    await carregarServicos();
  }

  init();
});
