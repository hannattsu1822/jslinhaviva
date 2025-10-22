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

  const modalConcluirItemEl = document.getElementById("modalConcluirItem");
  const formConcluirItem = document.getElementById("formConcluirItem");
  const servicoIdParaConclusaoInput = document.getElementById(
    "servicoIdParaConclusao"
  );
  const servicoProcessoParaConclusaoSpan = document.getElementById(
    "servicoProcessoParaConclusao"
  );
  const selectItemParaConcluir = document.getElementById(
    "selectItemParaConcluir"
  );
  const statusConclusaoItemSelect = document.getElementById(
    "statusConclusaoItem"
  );
  const dataConclusaoItemInput = document.getElementById("dataConclusaoItem");
  const horaConclusaoItemInput = document.getElementById("horaConclusaoItem");
  const observacoesConclusaoItemTextarea = document.getElementById(
    "observacoesConclusaoItem"
  );
  const btnAnexarEvidencia = document.getElementById("btnAnexarEvidencia");
  const anexosConclusaoItemInput = document.getElementById(
    "anexosConclusaoItemInput"
  );
  const previewAnexosConclusaoItem = document.getElementById(
    "previewAnexosConclusaoItem"
  );
  const templateAnexoPreviewConclusao = document.getElementById(
    "templateAnexoPreviewConclusao"
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

  const paginationContainer = document.getElementById("paginationContainer");
  let currentPage = 1;
  const a_cada = 10;

  let encarregadosCache = [];
  let currentUser = null;
  let anexosConclusaoTemporarios = [];

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
    if (!dataISO) return new Date().toISOString().split("T")[0];
    return dataISO.split("T")[0];
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

  async function carregarServicos(page = 1) {
    if (!corpoTabelaServicosElem || !nenhumServicoMsgElem) return;

    currentPage = page;
    corpoTabelaServicosElem.innerHTML =
      '<tr><td colspan="10"><div class="feedback-message">Carregando serviços...</div></td></tr>';
    nenhumServicoMsgElem.classList.add("d-none");
    const params = Object.fromEntries(
      new FormData(formFiltrosServicos).entries()
    );
    params.page = currentPage;
    params.limit = a_cada;

    const queryParams = new URLSearchParams(params);

    const url = `/api/servicos-subestacoes?${queryParams.toString()}`;
    try {
      const response = await fetchData(url);
      popularTabelaServicos(response.data);
      renderizarPaginacao(response.total, response.page, response.totalPages);
    } catch (error) {
      if (corpoTabelaServicosElem) {
        corpoTabelaServicosElem.innerHTML =
          '<tr><td colspan="10"><div class="feedback-message text-danger">Erro ao carregar os serviços.</div></td></tr>';
      }
      if (paginationContainer) paginationContainer.innerHTML = "";
    }
  }

  function renderizarPaginacao(totalItems, page, totalPages) {
    if (!paginationContainer) return;
    paginationContainer.innerHTML = "";

    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
      const pageButton = document.createElement("button");
      pageButton.textContent = i;
      pageButton.className = "pagination-button";
      if (i === page) {
        pageButton.classList.add("active");
        pageButton.disabled = true;
      }
      pageButton.addEventListener("click", () => {
        carregarServicos(i);
      });
      paginationContainer.appendChild(pageButton);
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
                  <button class="btn text-info btn-ver-detalhes" title="Ver Detalhes"><span class="material-symbols-outlined">visibility</span></button>
                  <button class="btn text-primary btn-editar-servico" title="Editar Serviço"><span class="material-symbols-outlined">edit</span></button>
                  <button class="btn text-secondary btn-gerenciar-itens" data-id="${
                    serv.id
                  }" data-processo="${
        serv.processo
      }" title="Gerenciar Itens/Encarregados"><span class="material-symbols-outlined">manage_accounts</span></button>
                  <button class="btn text-success btn-concluir-servico" data-id="${
                    serv.id
                  }" data-processo="${
        serv.processo
      }" title="Concluir Item de Serviço" ${
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

      const servicoIdLimpo = parseInt(serv.id, 10);

      tr.querySelector(".btn-ver-detalhes")?.addEventListener("click", () =>
        window.open(`/servicos/${servicoIdLimpo}/detalhes-pagina`, "_blank")
      );
      tr.querySelector(".btn-editar-servico")?.addEventListener(
        "click",
        () =>
          (window.location.href = `/servicos/${servicoIdLimpo}/detalhes-pagina?modo=editar`)
      );

      tr.querySelector(".btn-concluir-servico")?.addEventListener(
        "click",
        (e) =>
          abrirModalConclusao(
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
      carregarServicos(1);
    });
  }

  if (btnLimparFiltrosServicos && formFiltrosServicos) {
    btnLimparFiltrosServicos.addEventListener("click", () => {
      formFiltrosServicos.reset();
      carregarServicos(1);
    });
  }

  if (btnNovoServico) {
    btnNovoServico.addEventListener("click", () => {
      window.location.href = "/registrar-servico-subestacao";
    });
  }

  function confirmarExclusaoServico(servicoId, processo) {
    if (
      confirm(
        `Tem certeza que deseja excluir o serviço do processo "${
          processo || servicoId
        }"? Esta ação não pode ser desfeita.`
      )
    ) {
      handleExcluirServico(servicoId);
    }
  }

  async function handleExcluirServico(servicoId) {
    try {
      await fetchData(`/api/servicos-subestacoes/${servicoId}`, {
        method: "DELETE",
      });
      alert("Serviço excluído com sucesso!");
      carregarServicos(currentPage);
    } catch (error) {
      alert(`Falha ao excluir serviço: ${error.message}`);
    }
  }

  function renderizarPreviewAnexosConclusao() {
    if (!previewAnexosConclusaoItem || !templateAnexoPreviewConclusao) return;
    previewAnexosConclusaoItem.innerHTML = "";
    anexosConclusaoTemporarios.forEach((file, index) => {
      const clone = templateAnexoPreviewConclusao.content.cloneNode(true);
      const anexoItem = clone.querySelector(".anexo-preview-item");
      const imgPreview = anexoItem.querySelector(".anexo-preview-img");
      const iconDefault = anexoItem.querySelector(".file-icon");

      anexoItem.querySelector(".file-name").textContent = file.name;
      anexoItem.querySelector(".file-size").textContent = `${(
        file.size / 1024
      ).toFixed(1)} KB`;

      if (file.type.startsWith("image/")) {
        imgPreview.src = URL.createObjectURL(file);
        imgPreview.classList.remove("hidden");
        iconDefault.classList.add("hidden");
      } else {
        imgPreview.classList.add("hidden");
        iconDefault.classList.remove("hidden");
      }

      anexoItem.querySelector(".btn-remove").addEventListener("click", () => {
        anexosConclusaoTemporarios.splice(index, 1);
        renderizarPreviewAnexosConclusao();
      });

      previewAnexosConclusaoItem.appendChild(clone);
    });
  }

  if (btnAnexarEvidencia) {
    btnAnexarEvidencia.addEventListener("click", () => {
      anexosConclusaoItemInput.click();
    });
  }

  if (anexosConclusaoItemInput) {
    anexosConclusaoItemInput.addEventListener("change", (event) => {
      anexosConclusaoTemporarios.push(...Array.from(event.target.files));
      renderizarPreviewAnexosConclusao();
      event.target.value = "";
    });
  }

  async function abrirModalConclusao(servicoId, processo) {
    formConcluirItem.reset();
    anexosConclusaoTemporarios = [];
    renderizarPreviewAnexosConclusao();
    servicoIdParaConclusaoInput.value = servicoId;
    servicoProcessoParaConclusaoSpan.textContent = processo || servicoId;

    try {
      const [servico, user] = await Promise.all([
        fetchData(`/api/servicos-subestacoes/${servicoId}`),
        fetchCurrentUser(),
      ]);

      if (!user) {
        alert(
          "Não foi possível identificar o usuário. Por favor, recarregue a página."
        );
        return;
      }

      const meusItensPendentes = servico.itens_escopo.filter(
        (item) =>
          item.encarregado_item_id === user.id &&
          !item.status_item_escopo.startsWith("CONCLUIDO")
      );

      if (meusItensPendentes.length === 0) {
        alert("Você não possui itens pendentes para concluir neste serviço.");
        return;
      }

      selectItemParaConcluir.innerHTML =
        '<option value="">Selecione um item...</option>';
      meusItensPendentes.forEach((item) => {
        const displayText = item.tag_equipamento_alvo
          ? `${item.descricao_item_servico} (TAG: ${item.tag_equipamento_alvo})`
          : item.descricao_item_servico;

        selectItemParaConcluir.add(
          new Option(displayText, item.item_escopo_id)
        );
      });

      dataConclusaoItemInput.value = formatarDataParaInput();
      horaConclusaoItemInput.value = new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      mostrarModal(modalConcluirItemEl);
    } catch (error) {
      alert("Erro ao carregar os itens do serviço.");
    }
  }

  async function handleConcluirItemSubmit(event) {
    event.preventDefault();
    const itemEscopoId = selectItemParaConcluir.value;
    const statusItem = statusConclusaoItemSelect.value;
    const data = dataConclusaoItemInput.value;
    const hora = horaConclusaoItemInput.value;

    if (!itemEscopoId) {
      alert("Por favor, selecione um item para concluir.");
      return;
    }
    if (!data) {
      alert("A data de conclusão é obrigatória.");
      return;
    }

    const dataConclusaoFinal = hora ? `${data} ${hora}:00` : `${data} 00:00:00`;

    const formData = new FormData();
    formData.append("status_item", statusItem);
    formData.append("data_conclusao", dataConclusaoFinal);
    formData.append(
      "observacoes_conclusao",
      observacoesConclusaoItemTextarea.value
    );
    anexosConclusaoTemporarios.forEach((file) => {
      formData.append("anexos_conclusao_item", file);
    });

    const btn =
      event.submitter || document.getElementById("btnConfirmarConclusaoItem");
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined spin">sync</span> Salvando...`;

    try {
      await fetchData(
        `/api/servicos-subestacoes/item/${itemEscopoId}/concluir`,
        {
          method: "PUT",
          body: formData,
        }
      );
      alert("Status do item atualizado com sucesso!");
      ocultarModal(modalConcluirItemEl);
      carregarServicos(currentPage);
    } catch (error) {
      alert(`Falha ao registrar conclusão: ${error.message}`);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined">check</span> Concluir Item Selecionado`;
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

        const itemContent = document.createElement("div");
        itemContent.className = "item-content";

        const itemDesc = document.createElement("h6");
        itemDesc.textContent = item.descricao_item_servico;
        itemContent.appendChild(itemDesc);

        const selectEncarregado = document.createElement("select");
        selectEncarregado.className = "form-select";
        popularSelectEncarregados(selectEncarregado, item.encarregado_item_id);
        itemContent.appendChild(selectEncarregado);

        itemDiv.appendChild(itemContent);
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
          `/api/servicos-subestacoes/${servicoId}/atualizar-encarregados-itens`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ atualizacoes_encarregados: atualizacoes }),
          }
        );
        alert("Encarregados dos itens atualizados com sucesso!");
        ocultarModal(modalGerenciarItensServicoEl);
        carregarServicos(currentPage);
      } catch (error) {
        alert(`Falha ao atualizar encarregados: ${error.message}`);
      } finally {
        btnSalvarGerenciamentoItens.disabled = false;
      }
    });
  }

  if (formConcluirItem) {
    formConcluirItem.addEventListener("submit", handleConcluirItemSubmit);
  }

  async function init() {
    await fetchCurrentUser();
    await popularFiltroSubestacoes();
    await carregarServicos(1);
  }

  init();
});
