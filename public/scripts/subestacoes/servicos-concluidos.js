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
  const btnAdicionarAnexoPosterior = document.getElementById(
    "btnAdicionarAnexoPosterior"
  );
  const arquivosAnexoPosterior = document.getElementById(
    "arquivosAnexoPosterior"
  );
  const previewAnexosPosterior = document.getElementById(
    "previewAnexosPosterior"
  );
  const templateAnexoPreviewPosterior = document.getElementById(
    "templateAnexoPreviewPosterior"
  );

  const paginationContainer = document.getElementById("paginationContainer");
  let currentPage = 1;
  const a_cada = 10;

  let acaoConfirmadaCallback = null;
  let anexosPosteriorTemporarios = [];

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

  async function carregarServicos(page = 1) {
    if (!corpoTabelaServicosElem || !nenhumServicoMsgElem) return;

    currentPage = page;
    corpoTabelaServicosElem.innerHTML =
      '<tr><td colspan="9"><div class="feedback-message">Carregando histórico...</div></td></tr>';
    nenhumServicoMsgElem.classList.add("d-none");

    const params = Object.fromEntries(
      new FormData(formFiltrosServicos).entries()
    );
    if (!params.status) {
      params.status = "CONCLUIDO";
    }

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
          '<tr><td colspan="9"><div class="feedback-message error">Erro ao carregar o histórico.</div></td></tr>';
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
      const statusTxt = (serv.status || "DESCONHECIDO").replace(/_/g, " ");
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
          <td>${serv.id || "-"}</td>
          <td>${serv.processo || "-"}</td>
          <td>${serv.subestacao_sigla || "-"}</td>
          <td title="${serv.motivo || ""}">${motivoDisplay}</td>
          <td>${serv.tipo_ordem || "-"}</td>
          <td class="text-center">${dataConclusaoFormatada}</td>
          <td>${serv.responsavel_nome || "-"}</td>
          <td class="text-center"><span class="status-badge status-${statusCls}">${statusTxt}</span></td>
          <td class="actions-column text-center">
              <button class="btn text-info btn-ver-detalhes" data-id="${
                serv.id
              }" title="Ver Relatório Final"><span class="material-symbols-outlined">visibility</span></button>
              <button class="btn text-warning btn-reabrir-servico" data-id="${
                serv.id
              }" data-processo="${
        serv.processo
      }" title="Reabrir Serviço"><span class="material-symbols-outlined">history</span></button>
              <button class="btn text-primary btn-anexar" data-id="${
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
    if (!modalConfirmacaoEl) return;

    modalConfirmacaoTitulo.innerHTML = `<span class="material-symbols-outlined text-warning">history</span> Reabrir Serviço`;
    modalConfirmacaoMensagem.textContent = `Tem certeza que deseja reabrir o serviço de processo Nº ${processo}? Ele voltará para a lista de serviços ativos com o status "EM ANDAMENTO".`;
    btnConfirmarAcao.className = "btn btn-warning";
    btnConfirmarAcao.textContent = "Sim, Reabrir";

    acaoConfirmadaCallback = async () => {
      try {
        await fetchData(`/api/servicos-subestacoes/${servicoId}/reabrir`, {
          method: "PUT",
        });
        alert("Serviço reaberto com sucesso!");
        ocultarModal(modalConfirmacaoEl);
        carregarServicos(currentPage);
      } catch (error) {
        alert(`Falha ao reabrir serviço: ${error.message}`);
      }
    };

    mostrarModal(modalConfirmacaoEl);
  }

  function renderAnexosPosterior() {
    if (!previewAnexosPosterior || !templateAnexoPreviewPosterior) return;
    previewAnexosPosterior.innerHTML = "";
    anexosPosteriorTemporarios.forEach((file, index) => {
      const clone = templateAnexoPreviewPosterior.content.cloneNode(true);
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
        anexosPosteriorTemporarios.splice(index, 1);
        renderAnexosPosterior();
      });

      previewAnexosPosterior.appendChild(clone);
    });
  }

  function abrirModalAnexar(servicoId, processo) {
    if (!modalAnexarPosteriorEl) return;
    formAnexarPosterior.reset();
    anexosPosteriorTemporarios = [];
    renderAnexosPosterior();
    servicoIdAnexoPosteriorInput.value = servicoId;
    processoServicoAnexoPosteriorSpan.textContent = processo;
    mostrarModal(modalAnexarPosteriorEl);
  }

  if (btnAdicionarAnexoPosterior) {
    btnAdicionarAnexoPosterior.addEventListener("click", () => {
      arquivosAnexoPosterior.click();
    });
  }

  if (arquivosAnexoPosterior) {
    arquivosAnexoPosterior.addEventListener("change", (event) => {
      anexosPosteriorTemporarios.push(...Array.from(event.target.files));
      renderAnexosPosterior();
      event.target.value = "";
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
      filtroStatusSelect.value = "CONCLUIDO";
      carregarServicos(1);
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

      if (anexosPosteriorTemporarios.length === 0) {
        alert("Por favor, selecione pelo menos um arquivo para anexar.");
        return;
      }

      const formData = new FormData();
      const descricao = document.getElementById(
        "descricaoAnexoPosterior"
      ).value;
      if (descricao) {
        formData.append("descricao_anexo", descricao);
      }
      anexosPosteriorTemporarios.forEach((file) => {
        formData.append("anexosServico", file, file.name);
      });

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
        ocultarModal(modalAnexarPosteriorEl);
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
