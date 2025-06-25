document.addEventListener("DOMContentLoaded", () => {
  const formFiltrosServicos = document.getElementById("formFiltrosServicos");
  const filtroSubestacaoSelect = document.getElementById("filtroSubestacao");
  const filtroStatusSelect = document.getElementById("filtroStatusServico");
  const btnLimparFiltrosServicos = document.getElementById(
    "btnLimparFiltrosServicos"
  );
  const corpoTabelaServicosElem = document.getElementById(
    "corpoTabelaServicos"
  );
  const nenhumServicoMsgElem = document.getElementById("nenhumServico");

  const modalConfirmacaoEl = document.getElementById("modalConfirmacao");
  const modalConfirmacaoTitulo = document.getElementById(
    "modalConfirmacaoTitulo"
  );
  const modalConfirmacaoMensagem = document.getElementById(
    "modalConfirmacaoMensagem"
  );
  const btnConfirmarAcao = document.getElementById("btnConfirmarAcao");

  const modalAnexarPosteriorEl = document.getElementById(
    "modalAnexarPosterior"
  );
  const formAnexarPosterior = document.getElementById("formAnexarPosterior");
  const servicoIdAnexoPosteriorInput = document.getElementById(
    "servicoIdAnexoPosterior"
  );
  const processoServicoAnexoPosteriorSpan = document.getElementById(
    "processoServicoAnexoPosterior"
  );

  let bsModalConfirmacao = null;
  let bsModalAnexarPosterior = null;
  if (modalConfirmacaoEl)
    bsModalConfirmacao = new bootstrap.Modal(modalConfirmacaoEl);
  if (modalAnexarPosteriorEl)
    bsModalAnexarPosterior = new bootstrap.Modal(modalAnexarPosteriorEl);

  let acaoConfirmadaCallback = null;

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

  async function carregarServicos(params = {}) {
    if (!corpoTabelaServicosElem || !nenhumServicoMsgElem) return;

    corpoTabelaServicosElem.innerHTML =
      '<tr><td colspan="9" class="text-center p-5"><div class="spinner-border spinner-border-sm text-primary" role="status"><span class="visually-hidden">Carregando...</span></div> Carregando histórico...</td></tr>';
    nenhumServicoMsgElem.classList.add("d-none");

    if (!params.status) {
      params.status = "CONCLUIDO";
    }

    const queryParams = new URLSearchParams(params);
    const url = `/api/servicos-subestacoes?${queryParams.toString()}`;

    try {
      const servicos = await fetchData(url);
      popularTabelaServicos(servicos);
    } catch (error) {
      if (corpoTabelaServicosElem) {
        corpoTabelaServicosElem.innerHTML =
          '<tr><td colspan="9" class="text-center text-danger p-5">Erro ao carregar o histórico.</td></tr>';
      }
    }
  }

  function popularTabelaServicos(servicos) {
    if (!corpoTabelaServicosElem || !nenhumServicoMsgElem) return;

    corpoTabelaServicosElem.innerHTML = "";
    if (!servicos || servicos.length === 0) {
      nenhumServicoMsgElem.classList.remove("d-none");
      return;
    }
    nenhumServicoMsgElem.classList.add("d-none");

    servicos.forEach((serv) => {
      const tr = document.createElement("tr");
      const statusCls = (serv.status || "desconhecido")
        .toLowerCase()
        .replace(/_/g, "");
      const statusTxt = (serv.status || "DESCONHECIDO").replace("_", " ");
      const dataConclusaoFormatada = serv.data_conclusao
        ? new Date(serv.data_conclusao + "T00:00:00Z").toLocaleDateString(
            "pt-BR",
            { timeZone: "UTC" }
          )
        : "N/A";

      let motivoDisplay = serv.motivo || "";
      const matchInspecao = motivoDisplay.match(/- Insp. #(\d+)/);
      if (matchInspecao && matchInspecao[1]) {
        motivoDisplay = `Inspeção #${matchInspecao[1]}`;
      } else {
        motivoDisplay =
          motivoDisplay.substring(0, 40) +
          (motivoDisplay.length > 40 ? "..." : "");
      }

      tr.innerHTML = `
          <td data-label="ID">${serv.id || "-"}</td>
          <td data-label="Processo">${serv.processo || "-"}</td>
          <td data-label="Subestação">${serv.subestacao_sigla || "-"}</td>
          <td data-label="Motivo / Origem" title="${
            serv.motivo || ""
          }">${motivoDisplay}</td>
          <td data-label="Tipo Ordem">${serv.tipo_ordem || "-"}</td>
          <td data-label="Data Conclusão" class="text-center">${dataConclusaoFormatada}</td>
          <td data-label="Responsável">${serv.responsavel_nome || "-"}</td>
          <td data-label="Status (Geral)" class="text-center"><span class="status-badge status-${statusCls}">${statusTxt}</span></td>
          <td data-label="Ações" class="actions-column text-center">
              <button class="btn btn-icon text-info btn-ver-detalhes" data-id="${
                serv.id
              }" title="Ver Relatório Final"><span class="material-symbols-outlined">visibility</span></button>
              <button class="btn btn-icon text-warning btn-reabrir-servico" data-id="${
                serv.id
              }" data-processo="${
        serv.processo
      }" title="Reabrir Serviço"><span class="material-symbols-outlined">history</span></button>
              <button class="btn btn-icon text-primary btn-anexar" data-id="${
                serv.id
              }" data-processo="${
        serv.processo
      }" title="Anexar Documento Posterior"><span class="material-symbols-outlined">attach_file_add</span></button>
          </td>`;

      tr.querySelector(".btn-ver-detalhes")?.addEventListener("click", (e) =>
        window.open(
          `/servicos/${e.currentTarget.dataset.id}/detalhes-concluido`,
          "_blank"
        )
      );
      tr.querySelector(".btn-reabrir-servico")?.addEventListener("click", (e) =>
        abrirModalReabrir(
          e.currentTarget.dataset.id,
          e.currentTarget.dataset.processo
        )
      );
      tr.querySelector(".btn-anexar")?.addEventListener("click", (e) =>
        abrirModalAnexar(
          e.currentTarget.dataset.id,
          e.currentTarget.dataset.processo
        )
      );

      corpoTabelaServicosElem.appendChild(tr);
    });
  }

  function abrirModalReabrir(servicoId, processo) {
    if (!bsModalConfirmacao) return;

    modalConfirmacaoTitulo.innerHTML = `<span class="material-symbols-outlined me-2 text-warning">history</span> Reabrir Serviço`;
    modalConfirmacaoMensagem.textContent = `Tem certeza que deseja reabrir o serviço de processo Nº ${processo}? Ele voltará para a lista de serviços ativos com o status "EM ANDAMENTO".`;
    btnConfirmarAcao.className = "btn btn-sm btn-warning";
    btnConfirmarAcao.textContent = "Sim, Reabrir";

    acaoConfirmadaCallback = async () => {
      try {
        await fetchData(`/api/servicos-subestacoes/${servicoId}/reabrir`, {
          method: "PUT",
        });
        alert("Serviço reaberto com sucesso!");
        bsModalConfirmacao.hide();
        carregarServicos(
          Object.fromEntries(new FormData(formFiltrosServicos).entries())
        );
      } catch (error) {
        alert(`Falha ao reabrir serviço: ${error.message}`);
      }
    };

    bsModalConfirmacao.show();
  }

  function abrirModalAnexar(servicoId, processo) {
    if (!bsModalAnexarPosterior) return;
    formAnexarPosterior.reset();
    servicoIdAnexoPosteriorInput.value = servicoId;
    processoServicoAnexoPosteriorSpan.textContent = processo;
    bsModalAnexarPosterior.show();
  }

  if (formFiltrosServicos) {
    formFiltrosServicos.addEventListener("submit", (event) => {
      event.preventDefault();
      const params = Object.fromEntries(
        new FormData(formFiltrosServicos).entries()
      );
      carregarServicos(params);
    });
  }

  if (btnLimparFiltrosServicos && formFiltrosServicos) {
    btnLimparFiltrosServicos.addEventListener("click", () => {
      formFiltrosServicos.reset();
      filtroStatusSelect.value = "CONCLUIDO";
      carregarServicos({ status: "CONCLUIDO" });
    });
  }

  if (btnConfirmarAcao) {
    btnConfirmarAcao.addEventListener("click", () => {
      if (typeof acaoConfirmadaCallback === "function") {
        acaoConfirmadaCallback();
      }
    });
  }

  if (formAnexarPosterior) {
    formAnexarPosterior.addEventListener("submit", async (e) => {
      e.preventDefault();
      const servicoId = servicoIdAnexoPosteriorInput.value;
      const formData = new FormData(formAnexarPosterior);

      if (
        !formData.has("anexosServico") ||
        formData.get("anexosServico").size === 0
      ) {
        alert("Por favor, selecione pelo menos um arquivo para anexar.");
        return;
      }

      const submitButton = formAnexarPosterior.querySelector(
        'button[type="submit"]'
      );
      submitButton.disabled = true;
      submitButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Enviando...`;

      try {
        await fetchData(`/api/servicos/${servicoId}/anexar-posterior`, {
          method: "POST",
          body: formData,
        });
        alert("Anexos enviados com sucesso!");
        bsModalAnexarPosterior.hide();
      } catch (error) {
        alert(`Falha ao enviar anexos: ${error.message}`);
      } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = `<span class="material-symbols-outlined">upload_file</span> Enviar Anexos`;
      }
    });
  }

  async function init() {
    await popularFiltroSubestacoes();
    const initialParams = Object.fromEntries(
      new FormData(formFiltrosServicos).entries()
    );
    await carregarServicos(initialParams);
  }

  init();
});
