let avaliacaoModalInstance;
let accessDeniedModalInstance;
let developmentModalInstance;
let verChecklistModalInstance;
let user = null;

let currentPage = 1;
const itemsPerPage = 15;

async function fazerRequisicao(url, options = {}) {
  try {
    const defaultOptions = {
      credentials: "include",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        ...options.headers,
      },
    };
    const finalOptions = { ...defaultOptions, ...options };

    const response = await fetch(url, finalOptions);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: `Erro na requisição: ${response.statusText} (Status: ${response.status})`,
      }));
      throw new Error(
        errorData.message ||
          `Erro na requisição: ${response.statusText} (Status: ${response.status})`
      );
    }
    if (response.status === 204) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(
      `Erro na requisição para ${url} com opções ${JSON.stringify(options)}:`,
      error
    );
    throw error;
  }
}

async function carregarFabricantes() {
  try {
    const data = await fazerRequisicao("/api/fabricantes_trafos_reformados");
    const select = document.getElementById("filterFabricante");
    if (!select) return;
    select.innerHTML = '<option value="">Todos</option>';
    if (Array.isArray(data)) {
      data.forEach((fabricante) => {
        const option = document.createElement("option");
        option.value = fabricante;
        option.textContent = fabricante;
        select.appendChild(option);
      });
    } else {
      console.warn("Resposta de fabricantes não é um array:", data);
    }
  } catch (error) {
    alert("Erro ao carregar fabricantes: " + error.message);
  }
}

async function carregarPotencias() {
  try {
    const data = await fazerRequisicao("/api/potencias_trafos_reformados");
    const select = document.getElementById("filterPotencia");
    if (!select) return;
    select.innerHTML = '<option value="">Todas</option>';
    if (Array.isArray(data)) {
      data.forEach((potencia) => {
        const option = document.createElement("option");
        option.value = potencia;
        option.textContent = potencia;
        select.appendChild(option);
      });
    } else {
      console.warn("Resposta de potências não é um array:", data);
    }
  } catch (error) {
    alert("Erro ao carregar potências: " + error.message);
  }
}

async function carregarTecnicos() {
  try {
    const data = await fazerRequisicao(
      "/api/tecnicos_responsaveis_trafos_reformados"
    );
    const select = document.getElementById("filterTecnico");
    if (!select) return;
    select.innerHTML = '<option value="">Todos</option>';
    if (Array.isArray(data)) {
      data.forEach((tecnico) => {
        const option = document.createElement("option");
        option.value = tecnico.matricula;
        option.textContent = `${tecnico.nome} (${tecnico.matricula})`;
        select.appendChild(option);
      });
    } else {
      console.warn("Resposta de técnicos não é um array:", data);
    }
  } catch (error) {
    alert("Erro ao carregar técnicos: " + error.message);
  }
}

async function carregarTrafos(page = 1) {
  currentPage = parseInt(page) || 1;

  const tbody = document.querySelector("#tabelaResultados tbody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Carregando...</td></tr>`;

  const paginationControlsContainer = document.getElementById(
    "paginationControlsContainer"
  );
  if (paginationControlsContainer) paginationControlsContainer.innerHTML = "";

  const paginationInfoEl = document.getElementById("paginationInfo");
  if (paginationInfoEl) paginationInfoEl.textContent = "Carregando...";

  try {
    const numeroSerieFilter =
      document.getElementById("filterNumeroSerie")?.value || "";
    const status = document.getElementById("filterStatus")?.value || "";
    const fabricante = document.getElementById("filterFabricante")?.value || "";
    const potencia = document.getElementById("filterPotencia")?.value || "";
    const tecnico = document.getElementById("filterTecnico")?.value || "";
    const dataAvaliacaoInicial =
      document.getElementById("filterDataAvaliacaoInicial")?.value || "";
    const dataAvaliacaoFinal =
      document.getElementById("filterDataAvaliacaoFinal")?.value || "";
    const dataImportacaoInicial =
      document.getElementById("filterDataImportacaoInicial")?.value || "";
    const dataImportacaoFinal =
      document.getElementById("filterDataImportacaoFinal")?.value || "";

    const params = new URLSearchParams();
    if (numeroSerieFilter) params.append("numero_serie", numeroSerieFilter);
    if (status) params.append("status", status);
    if (fabricante) params.append("fabricante", fabricante);
    if (potencia) params.append("pot", potencia);
    if (tecnico) params.append("tecnico_responsavel", tecnico);
    if (dataAvaliacaoInicial)
      params.append("data_avaliacao_inicial", dataAvaliacaoInicial);
    if (dataAvaliacaoFinal)
      params.append("data_avaliacao_final", dataAvaliacaoFinal);
    if (dataImportacaoInicial)
      params.append("data_importacao_inicial", dataImportacaoInicial);
    if (dataImportacaoFinal)
      params.append("data_importacao_final", dataImportacaoFinal);

    params.append("page", currentPage);
    params.append("limit", itemsPerPage);

    let url = `/api/transformadores_reformados?${params.toString()}`;

    const responseData = await fazerRequisicao(url);

    if (responseData.success) {
      preencherTabela(responseData.data);
      if (responseData.pagination) {
        renderizarInfoPaginacao(responseData.pagination);
        renderizarControlesPaginacao(responseData.pagination);
      } else {
        if (paginationInfoEl)
          paginationInfoEl.textContent = `Mostrando ${responseData.data.length} itens`;
      }
    } else {
      throw new Error(
        responseData.message || "Erro ao carregar dados dos transformadores"
      );
    }
  } catch (error) {
    if (tbody)
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Erro ao carregar dados: ${error.message}</td></tr>`;
    if (paginationInfoEl)
      paginationInfoEl.textContent = "Falha ao carregar dados";
  }
}

function renderizarInfoPaginacao(pagination) {
  const {
    currentPage,
    itemsPerPage: actualItemsPerPageFromAPI,
    totalItems,
  } = pagination;
  const paginationInfoEl = document.getElementById("paginationInfo");
  if (!paginationInfoEl) return;

  if (totalItems === 0) {
    paginationInfoEl.textContent = "Nenhum item encontrado";
    return;
  }

  const effectiveItemsPerPage = actualItemsPerPageFromAPI || itemsPerPage;
  const startItem = (currentPage - 1) * effectiveItemsPerPage + 1;
  const endItem = Math.min(startItem + effectiveItemsPerPage - 1, totalItems);
  paginationInfoEl.textContent = `Mostrando ${startItem}-${endItem} de ${totalItems} itens`;
}

function renderizarControlesPaginacao(pagination) {
  const { currentPage, totalPages } = pagination;
  const container = document.getElementById("paginationControlsContainer");
  if (!container) return;
  container.innerHTML = "";

  if (!totalPages || totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  const ul = document.createElement("ul");
  ul.className = "pagination pagination-sm mb-0";

  const prevLi = document.createElement("li");
  prevLi.className = `page-item ${currentPage === 1 ? "disabled" : ""}`;
  const prevA = document.createElement("a");
  prevA.className = "page-link";
  prevA.href = "#";
  prevA.innerHTML = "&laquo;";
  prevA.setAttribute("aria-label", "Anterior");
  prevA.addEventListener("click", (e) => {
    e.preventDefault();
    if (currentPage > 1) {
      carregarTrafos(currentPage - 1);
    }
  });
  prevLi.appendChild(prevA);
  ul.appendChild(prevLi);

  const maxPagesToShow = 5;
  let startPage, endPage;

  if (totalPages <= maxPagesToShow) {
    startPage = 1;
    endPage = totalPages;
  } else {
    if (currentPage <= Math.ceil(maxPagesToShow / 2)) {
      startPage = 1;
      endPage = maxPagesToShow;
    } else if (currentPage + Math.floor(maxPagesToShow / 2) >= totalPages) {
      startPage = totalPages - maxPagesToShow + 1;
      endPage = totalPages;
    } else {
      startPage = currentPage - Math.floor(maxPagesToShow / 2);
      endPage = currentPage + Math.floor(maxPagesToShow / 2);
    }
  }

  if (startPage > 1) {
    const firstPageLi = document.createElement("li");
    firstPageLi.className = "page-item";
    const firstPageA = document.createElement("a");
    firstPageA.className = "page-link";
    firstPageA.href = "#";
    firstPageA.textContent = "1";
    firstPageA.addEventListener("click", (e) => {
      e.preventDefault();
      carregarTrafos(1);
    });
    firstPageLi.appendChild(firstPageA);
    ul.appendChild(firstPageLi);
    if (startPage > 2) {
      const ellipsisLi = document.createElement("li");
      ellipsisLi.className = "page-item disabled";
      ellipsisLi.innerHTML = `<span class="page-link">...</span>`;
      ul.appendChild(ellipsisLi);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const li = document.createElement("li");
    li.className = `page-item ${i === currentPage ? "active" : ""}`;
    const a = document.createElement("a");
    a.className = "page-link";
    a.href = "#";
    a.textContent = i;
    if (i !== currentPage) {
      a.addEventListener(
        "click",
        ((pageNum) => (e) => {
          e.preventDefault();
          carregarTrafos(pageNum);
        })(i)
      );
    }
    li.appendChild(a);
    ul.appendChild(li);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsisLi = document.createElement("li");
      ellipsisLi.className = "page-item disabled";
      ellipsisLi.innerHTML = `<span class="page-link">...</span>`;
      ul.appendChild(ellipsisLi);
    }
    const lastPageLi = document.createElement("li");
    lastPageLi.className = "page-item";
    const lastPageA = document.createElement("a");
    lastPageA.className = "page-link";
    lastPageA.href = "#";
    lastPageA.textContent = totalPages;
    lastPageA.addEventListener("click", (e) => {
      e.preventDefault();
      carregarTrafos(totalPages);
    });
    lastPageLi.appendChild(lastPageA);
    ul.appendChild(lastPageLi);
  }

  const nextLi = document.createElement("li");
  nextLi.className = `page-item ${
    currentPage === totalPages ? "disabled" : ""
  }`;
  const nextA = document.createElement("a");
  nextA.className = "page-link";
  nextA.href = "#";
  nextA.innerHTML = "&raquo;";
  nextA.setAttribute("aria-label", "Próxima");
  nextA.addEventListener("click", (e) => {
    e.preventDefault();
    if (currentPage < totalPages) {
      carregarTrafos(currentPage + 1);
    }
  });
  nextLi.appendChild(nextA);
  ul.appendChild(nextLi);

  container.appendChild(ul);
}

function preencherTabela(trafos) {
  const tbody = document.querySelector("#tabelaResultados tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!trafos || trafos.length === 0) {
    const paginationInfoEl = document.getElementById("paginationInfo");
    if (
      paginationInfoEl &&
      paginationInfoEl.textContent === "Nenhum item encontrado"
    ) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4">Nenhum transformador encontrado com os filtros aplicados.</td></tr>`;
    } else {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4">Nenhum dado para exibir ou filtros resultaram em zero itens.</td></tr>`;
    }
    return;
  }

  trafos.forEach((trafo) => {
    let statusClass, statusText;
    switch (trafo.status_avaliacao) {
      case "avaliado":
        statusClass = "bg-success text-white";
        statusText = "Aprovado";
        break;
      case "reprovado":
        statusClass = "bg-danger text-white";
        statusText = "Reprovado";
        break;
      default:
        statusClass = "bg-warning text-dark";
        statusText = "Pendente";
        break;
    }
    const dataAvaliacao = trafo.data_avaliacao
      ? new Date(trafo.data_avaliacao).toLocaleDateString("pt-BR", {
          timeZone: "UTC",
        })
      : "-";
    const dataImportacao = trafo.data_importacao
      ? new Date(trafo.data_importacao).toLocaleDateString("pt-BR", {
          timeZone: "UTC",
        })
      : "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${trafo.id}</td>
      <td>${trafo.numero_serie}</td>
      <td>${trafo.fabricante || "-"}</td>
      <td>${trafo.pot || "-"}</td>
      <td>${dataImportacao}</td>
      <td><span class="badge ${statusClass}">${statusText}</span></td>
      <td>${dataAvaliacao}</td>
      <td class="text-center">
        <div class="d-flex gap-1 justify-content-center">
          <button onclick="window.abrirModalAvaliacao(${trafo.id})" 
                  class="btn btn-sm btn-primary" 
                  title="Avaliar" ${
                    trafo.status_avaliacao !== "pendente" ? "disabled" : ""
                  }>
            <i class="fas fa-clipboard-check"></i>
          </button>
          <button onclick="window.abrirModalVerChecklist(${
            trafo.id
          }, '${trafo.numero_serie.replace(/'/g, "\\'")}')"
                  class="btn btn-sm btn-info" title="Ver Checklist">
            <i class="fas fa-list-check"></i>
          </button>
          <button onclick="window.confirmarExclusao(${
            trafo.id
          }, '${trafo.numero_serie.replace(/'/g, "\\'")}')" 
                  class="btn btn-sm btn-danger" title="Excluir">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

window.confirmarExclusao = function (id, numeroSerie) {
  if (
    confirm(`Tem certeza que deseja excluir o transformador ${numeroSerie}?`)
  ) {
    excluirTransformador(id);
  }
};

async function excluirTransformador(id) {
  try {
    const response = await fetch(`/api/transformadores_reformados/${id}`, {
      method: "DELETE",
      credentials: "include",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Erro ao excluir");

    if (data.success) {
      alert("Transformador excluído com sucesso!");
      carregarTrafos(currentPage);
    } else {
      alert("Erro ao excluir: " + data.message);
    }
  } catch (error) {
    alert("Erro ao excluir transformador: " + error.message);
  }
}

function resetChecklistModal() {
  document.getElementById("checkBobinaPrimariaI").value = "N/A";
  document.getElementById("checkBobinaPrimariaII").value = "N/A";
  document.getElementById("checkBobinaPrimariaIII").value = "N/A";
  document.getElementById("checkBobinaSecundariaI").value = "N/A";
  document.getElementById("checkBobinaSecundariaII").value = "N/A";
  document.getElementById("checkBobinaSecundariaIII").value = "N/A";
  document.getElementById("valorBobinaI").value = "";
  document.getElementById("valorBobinaII").value = "";
  document.getElementById("valorBobinaIII").value = "";
  document.getElementById("checkEstadoFisico").value = "N/A";
  document.getElementById("observacoesChecklist").value = "";
  document.getElementById("statusAvaliacao").value = "";
  document.getElementById("observacoes").value = "";
}

window.abrirModalAvaliacao = async function (id) {
  resetChecklistModal();
  try {
    const response = await fazerRequisicao(
      `/api/transformadores_reformados/${id}`
    );
    if (response.success) {
      const trafo = response.data;
      document.getElementById("trafoId").value = trafo.id;
      document.getElementById("numeroSerieModal").value = trafo.numero_serie;
      document.getElementById("fabricanteModal").value =
        trafo.fabricante || "-";
      document.getElementById("potenciaModal").value = trafo.pot || "-";

      const statusSelect = document.getElementById("statusAvaliacao");
      statusSelect.value =
        trafo.status_avaliacao && trafo.status_avaliacao !== "pendente"
          ? trafo.status_avaliacao
          : "";

      const obsEl = document.getElementById("observacoes");
      if (obsEl) obsEl.value = trafo.resultado_avaliacao || "";

      if (trafo.checklist_teste) {
        document.getElementById("checkBobinaPrimariaI").value =
          trafo.checklist_teste.bobina_primaria_i || "N/A";
        document.getElementById("checkBobinaPrimariaII").value =
          trafo.checklist_teste.bobina_primaria_ii || "N/A";
        document.getElementById("checkBobinaPrimariaIII").value =
          trafo.checklist_teste.bobina_primaria_iii || "N/A";
        document.getElementById("checkBobinaSecundariaI").value =
          trafo.checklist_teste.bobina_secundaria_i || "N/A";
        document.getElementById("checkBobinaSecundariaII").value =
          trafo.checklist_teste.bobina_secundaria_ii || "N/A";
        document.getElementById("checkBobinaSecundariaIII").value =
          trafo.checklist_teste.bobina_secundaria_iii || "N/A";
        document.getElementById("valorBobinaI").value =
          trafo.checklist_teste.valor_bobina_i || "";
        document.getElementById("valorBobinaII").value =
          trafo.checklist_teste.valor_bobina_ii || "";
        document.getElementById("valorBobinaIII").value =
          trafo.checklist_teste.valor_bobina_iii || "";
        document.getElementById("checkEstadoFisico").value =
          trafo.checklist_teste.estado_fisico || "N/A";
        document.getElementById("observacoesChecklist").value =
          trafo.checklist_teste.observacoes_checklist || "";
      }

      if (trafo.status_avaliacao === "pendente") {
        statusSelect.value = "";
      }

      if (avaliacaoModalInstance) avaliacaoModalInstance.show();
    } else {
      throw new Error(
        response.message || "Erro ao carregar dados do transformador"
      );
    }
  } catch (error) {
    alert(
      "Erro ao carregar dados do transformador para avaliação: " + error.message
    );
  }
};

async function salvarAvaliacao() {
  const id = document.getElementById("trafoId").value;
  const status_final_avaliacao =
    document.getElementById("statusAvaliacao").value;
  const observacoes_gerais = document.getElementById("observacoes").value;

  if (!status_final_avaliacao) {
    alert("Selecione o Status Final da Avaliação.");
    return;
  }
  if (status_final_avaliacao === "reprovado" && !observacoes_gerais.trim()) {
    alert(
      'Para o status final "Reprovado", o campo "Observações Gerais / Motivo Final da Reprovação" é obrigatório.'
    );
    return;
  }

  const currentUser = JSON.parse(localStorage.getItem("user"));
  if (!currentUser || !currentUser.matricula) {
    alert(
      "Usuário não autenticado ou matrícula não encontrada. Faça login novamente."
    );
    return;
  }

  const dadosChecklist = {
    bobina_primaria_i: document.getElementById("checkBobinaPrimariaI").value,
    bobina_primaria_ii: document.getElementById("checkBobinaPrimariaII").value,
    bobina_primaria_iii: document.getElementById("checkBobinaPrimariaIII")
      .value,
    bobina_secundaria_i: document.getElementById("checkBobinaSecundariaI")
      .value,
    bobina_secundaria_ii: document.getElementById("checkBobinaSecundariaII")
      .value,
    bobina_secundaria_iii: document.getElementById("checkBobinaSecundariaIII")
      .value,
    valor_bobina_i: document.getElementById("valorBobinaI").value,
    valor_bobina_ii: document.getElementById("valorBobinaII").value,
    valor_bobina_iii: document.getElementById("valorBobinaIII").value,
    estado_fisico: document.getElementById("checkEstadoFisico").value,
    observacoes_checklist: document.getElementById("observacoesChecklist")
      .value,
  };

  const btnSalvarAvaliacao = document.getElementById("btnSalvarAvaliacao");
  const originalBtnHTML = btnSalvarAvaliacao.innerHTML;
  btnSalvarAvaliacao.disabled = true;
  btnSalvarAvaliacao.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...';

  try {
    const payload = {
      matricula_responsavel: currentUser.matricula,
      status_avaliacao: status_final_avaliacao,
      resultado_avaliacao: observacoes_gerais,
      checklist_data: dadosChecklist,
    };

    const response = await fazerRequisicao(
      `/api/transformadores_reformados/${id}/avaliar_completo`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!response || !response.success) {
      throw new Error(
        response
          ? response.message
          : "Erro desconhecido ao salvar avaliação completa."
      );
    }

    alert("Avaliação e checklist salvos com sucesso!");
    if (avaliacaoModalInstance) avaliacaoModalInstance.hide();
    carregarTrafos(currentPage);
  } catch (error) {
    console.error("Erro completo ao salvar avaliação:", error);
    alert("Erro ao salvar avaliação: " + error.message);
  } finally {
    btnSalvarAvaliacao.disabled = false;
    btnSalvarAvaliacao.innerHTML = originalBtnHTML;
  }
}

window.abrirModalVerChecklist = async function (trafoId, numeroSerie) {
  document.getElementById("checklistNumeroSerieModal").textContent =
    numeroSerie;
  document.getElementById("verChecklistTrafoId").value = trafoId;

  const fieldsToClearIds = [
    "checkId",
    "checkDataTeste",
    "checkTecnicoTeste",
    "checkViewBobinaPrimariaI",
    "checkViewBobinaPrimariaII",
    "checkViewBobinaPrimariaIII",
    "checkViewBobinaSecundariaI",
    "checkViewBobinaSecundariaII",
    "checkViewBobinaSecundariaIII",
    "checkViewValorBobinaI",
    "checkViewValorBobinaII",
    "checkViewValorBobinaIII",
    "checkViewEstadoFisico",
    "checkViewObservacoesChecklist",
    "checkViewConclusaoChecklist",
  ];

  fieldsToClearIds.forEach((fieldId) => {
    const el = document.getElementById(fieldId);
    if (el) el.textContent = "Carregando...";
  });
  const btnGerarPDFChecklistEl = document.getElementById(
    "btnGerarPDFChecklist"
  );
  if (btnGerarPDFChecklistEl)
    btnGerarPDFChecklistEl.style.display = "inline-block";

  if (verChecklistModalInstance) verChecklistModalInstance.show();

  try {
    const response = await fazerRequisicao(
      `/api/transformadores_reformados/${trafoId}`
    );
    if (response.success && response.data) {
      const trafoInfo = response.data;
      const checklist = response.data.checklist_teste;

      const currentBtnGerarPDF = document.getElementById(
        "btnGerarPDFChecklist"
      );

      if (checklist) {
        if (currentBtnGerarPDF) {
          const newBtn = currentBtnGerarPDF.cloneNode(true);
          newBtn.innerHTML =
            '<i class="fas fa-file-pdf"></i> Gerar PDF do Checklist';
          newBtn.disabled = false;
          currentBtnGerarPDF.parentNode.replaceChild(
            newBtn,
            currentBtnGerarPDF
          );
          newBtn.addEventListener("click", () =>
            gerarPDFChecklistEspecifico(checklist, trafoInfo)
          );
          newBtn.style.display = "inline-block";
        }

        document.getElementById("checkId").textContent = checklist.id || "N/A";
        document.getElementById("checkDataTeste").textContent =
          checklist.data_teste
            ? new Date(checklist.data_teste).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })
            : "N/A";

        let tecnicoNomeChecklist = checklist.tecnico_responsavel_teste || "N/A";
        if (checklist.tecnico_responsavel_teste) {
          try {
            const userResp = await fazerRequisicao(
              `/api/user_info/${checklist.tecnico_responsavel_teste}`
            );
            if (userResp && userResp.nome) {
              tecnicoNomeChecklist = `${userResp.nome} (${checklist.tecnico_responsavel_teste})`;
            }
          } catch (e) {
            console.error("Erro ao buscar nome do técnico do checklist:", e);
          }
        }
        document.getElementById("checkTecnicoTeste").textContent =
          tecnicoNomeChecklist;

        document.getElementById("checkViewBobinaPrimariaI").textContent =
          checklist.bobina_primaria_i || "N/A";
        document.getElementById("checkViewBobinaPrimariaII").textContent =
          checklist.bobina_primaria_ii || "N/A";
        document.getElementById("checkViewBobinaPrimariaIII").textContent =
          checklist.bobina_primaria_iii || "N/A";
        document.getElementById("checkViewBobinaSecundariaI").textContent =
          checklist.bobina_secundaria_i || "N/A";
        document.getElementById("checkViewBobinaSecundariaII").textContent =
          checklist.bobina_secundaria_ii || "N/A";
        document.getElementById("checkViewBobinaSecundariaIII").textContent =
          checklist.bobina_secundaria_iii || "N/A";
        document.getElementById("checkViewValorBobinaI").textContent =
          checklist.valor_bobina_i || "N/A";
        document.getElementById("checkViewValorBobinaII").textContent =
          checklist.valor_bobina_ii || "N/A";
        document.getElementById("checkViewValorBobinaIII").textContent =
          checklist.valor_bobina_iii || "N/A";
        document.getElementById("checkViewEstadoFisico").textContent =
          checklist.estado_fisico || "N/A";
        document.getElementById("checkViewObservacoesChecklist").textContent =
          checklist.observacoes_checklist || "Nenhuma";
        document.getElementById("checkViewConclusaoChecklist").textContent =
          checklist.conclusao_checklist || "N/A";
      } else {
        fieldsToClearIds.forEach((fieldId) => {
          const el = document.getElementById(fieldId);
          if (el && fieldId !== "checkViewObservacoesChecklist")
            el.textContent = "N/A";
        });
        document.getElementById("checkViewObservacoesChecklist").textContent =
          "Nenhum checklist registrado para este transformador.";
        if (currentBtnGerarPDF) currentBtnGerarPDF.style.display = "none";
      }
    } else {
      throw new Error(
        response.message || "Erro ao carregar dados do checklist."
      );
    }
  } catch (error) {
    console.error("Erro ao abrir modal ver checklist:", error);
    fieldsToClearIds.forEach((fieldId) => {
      const el = document.getElementById(fieldId);
      if (el && fieldId !== "checkViewObservacoesChecklist")
        el.textContent = "Erro";
    });
    document.getElementById(
      "checkViewObservacoesChecklist"
    ).textContent = `Erro ao carregar: ${error.message}`;
    const btnGerarPDF = document.getElementById("btnGerarPDFChecklist");
    if (btnGerarPDF) btnGerarPDF.style.display = "none";
  }
};

async function gerarPDFChecklistEspecifico(checklistData, trafoInfo) {
  if (!checklistData) {
    alert("Não há dados de checklist para gerar o PDF.");
    return;
  }

  const btn = document.getElementById("btnGerarPDFChecklist");
  const originalBtnHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Gerando...';

  try {
    const payload = {
      checklist: checklistData,
      transformador: {
        id: trafoInfo.id,
        numero_serie: trafoInfo.numero_serie,
        fabricante: trafoInfo.fabricante,
        pot: trafoInfo.pot,
        item: trafoInfo.item,
      },
    };

    const response = await fetch("/api/gerar_pdf_checklist_especifico", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: `Erro HTTP: ${response.status}` }));
      throw new Error(
        errorData.message || "Erro ao gerar PDF do checklist no servidor"
      );
    }

    const blob = await response.blob();
    const urlBlob = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = urlBlob;
    a.download = `Checklist_Trafo_${trafoInfo.numero_serie}_ID${checklistData.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(urlBlob);
  } catch (error) {
    console.error("Erro ao gerar PDF do checklist:", error);
    alert("Erro ao gerar PDF do checklist: " + error.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalBtnHTML;
  }
}

window.gerarPDF = async function () {
  const btn = document.getElementById("btnGerarPDF");
  const spinner = document.getElementById("pdfSpinner");
  if (btn) btn.disabled = true;
  if (spinner) spinner.style.display = "inline-block";

  try {
    const statusSelect = document.getElementById("filterStatus");
    const numeroSerieFiltro =
      document.getElementById("filterNumeroSerie")?.value || "";
    const fabricanteSelect = document.getElementById("filterFabricante");
    const potenciaSelect = document.getElementById("filterPotencia");
    const tecnicoSelect = document.getElementById("filterTecnico");

    const status = statusSelect?.value || "";
    const fabricante = fabricanteSelect?.value || "";
    const potencia = potenciaSelect?.value || "";
    const tecnico = tecnicoSelect?.value || "";
    const dataAvaliacaoInicial =
      document.getElementById("filterDataAvaliacaoInicial")?.value || "";
    const dataAvaliacaoFinal =
      document.getElementById("filterDataAvaliacaoFinal")?.value || "";
    const dataImportacaoInicial =
      document.getElementById("filterDataImportacaoInicial")?.value || "";
    const dataImportacaoFinal =
      document.getElementById("filterDataImportacaoFinal")?.value || "";

    const params = new URLSearchParams();
    if (numeroSerieFiltro) params.append("numero_serie", numeroSerieFiltro);
    if (status) params.append("status", status);
    if (fabricante) params.append("fabricante", fabricante);
    if (potencia) params.append("pot", potencia);
    if (tecnico) params.append("tecnico_responsavel", tecnico);
    if (dataAvaliacaoInicial)
      params.append("data_avaliacao_inicial", dataAvaliacaoInicial);
    if (dataAvaliacaoFinal)
      params.append("data_avaliacao_final", dataAvaliacaoFinal);
    if (dataImportacaoInicial)
      params.append("data_importacao_inicial", dataImportacaoInicial);
    if (dataImportacaoFinal)
      params.append("data_importacao_final", dataImportacaoFinal);

    params.append("getAll", "true");

    const url = `/api/transformadores_reformados?${params.toString()}`;
    const dataResponse = await fazerRequisicao(url);

    if (!dataResponse.success || !dataResponse.data)
      throw new Error(dataResponse.message || "Erro ao obter dados para PDF");

    const filtrosTexto = {
      numero_serie: numeroSerieFiltro,
      status:
        statusSelect.options[statusSelect.selectedIndex]?.textContent ||
        "Todos",
      fabricante:
        fabricanteSelect.options[fabricanteSelect.selectedIndex]?.textContent ||
        "Todos",
      pot:
        potenciaSelect.options[potenciaSelect.selectedIndex]?.textContent ||
        "Todas",
      tecnico_responsavel:
        tecnicoSelect.options[tecnicoSelect.selectedIndex]?.textContent.split(
          " ("
        )[0] || "Todos",
      data_avaliacao_inicial: dataAvaliacaoInicial
        ? new Date(dataAvaliacaoInicial + "T00:00:00Z").toLocaleDateString(
            "pt-BR",
            { timeZone: "UTC" }
          )
        : "",
      data_avaliacao_final: dataAvaliacaoFinal
        ? new Date(dataAvaliacaoFinal + "T00:00:00Z").toLocaleDateString(
            "pt-BR",
            { timeZone: "UTC" }
          )
        : "",
      data_importacao_inicial: dataImportacaoInicial
        ? new Date(dataImportacaoInicial + "T00:00:00Z").toLocaleDateString(
            "pt-BR",
            { timeZone: "UTC" }
          )
        : "",
      data_importacao_final: dataImportacaoFinal
        ? new Date(dataImportacaoFinal + "T00:00:00Z").toLocaleDateString(
            "pt-BR",
            { timeZone: "UTC" }
          )
        : "",
    };

    const pdfResponse = await fetch("/api/gerar_pdf_trafos_reformados", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      credentials: "include",
      body: JSON.stringify({
        dados: dataResponse.data,
        filtros: filtrosTexto,
      }),
    });
    if (!pdfResponse.ok) {
      const errorData = await pdfResponse
        .json()
        .catch(() => ({ message: `Erro HTTP: ${pdfResponse.status}` }));
      throw new Error(errorData.message || "Erro ao gerar PDF no servidor");
    }
    const blob = await pdfResponse.blob();
    const urlBlob = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = urlBlob;
    a.download = "Relatorio_Transformadores_Reformados.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(urlBlob);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert("Erro ao gerar PDF: " + error.message);
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.style.display = "none";
  }
};

window.navigateTo = async function (pageNameOrUrl) {
  let urlToNavigate = pageNameOrUrl;
  if (!pageNameOrUrl.startsWith("/") && !pageNameOrUrl.startsWith("http")) {
    urlToNavigate = `/${pageNameOrUrl}`;
  }
  if (
    window.location.pathname === urlToNavigate &&
    !urlToNavigate.includes("?")
  )
    return;

  try {
    const response = await fetch(urlToNavigate);
    if (response.ok) {
      window.location.href = urlToNavigate;
    } else if (response.status === 403) {
      if (accessDeniedModalInstance) accessDeniedModalInstance.show();
      else alert("Acesso negado!");
    } else if (response.status === 404) {
      if (developmentModalInstance) developmentModalInstance.show();
      else alert("Página não encontrada ou em desenvolvimento.");
    } else {
      if (developmentModalInstance) developmentModalInstance.show();
      else alert("Erro ao tentar acessar a página.");
    }
  } catch (error) {
    if (developmentModalInstance) developmentModalInstance.show();
    else alert("Erro de rede ou falha na navegação.");
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  user = JSON.parse(localStorage.getItem("user"));

  if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
    const avalModalEl = document.getElementById("avaliacaoModal");
    if (avalModalEl) avaliacaoModalInstance = new bootstrap.Modal(avalModalEl);

    const verChecklistModalEl = document.getElementById("verChecklistModal");
    if (verChecklistModalEl)
      verChecklistModalInstance = new bootstrap.Modal(verChecklistModalEl);

    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);

    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
  } else {
    console.warn(
      "Trafos Reformados Filtrar: Bootstrap não carregado, modais podem não funcionar."
    );
  }

  await carregarFabricantes();
  await carregarPotencias();
  await carregarTecnicos();
  await carregarTrafos(1);

  const filtroFormEl = document.getElementById("filtroForm");
  if (filtroFormEl) {
    filtroFormEl.addEventListener("submit", async (e) => {
      e.preventDefault();
      currentPage = 1;
      await carregarTrafos(currentPage);
    });
  }

  const btnSalvarAvaliacaoEl = document.getElementById("btnSalvarAvaliacao");
  if (btnSalvarAvaliacaoEl)
    btnSalvarAvaliacaoEl.addEventListener("click", salvarAvaliacao);

  const btnGerarPDFEl = document.getElementById("btnGerarPDF");
  if (btnGerarPDFEl) {
    btnGerarPDFEl.addEventListener("click", window.gerarPDF);
  }
});

console.log(
  "Trafos Reformados Filtrar: Script específico da página carregado."
);
