let currentPage = 1;
const itemsPerPage = 15;
let checklistModalInstance;
let accessDeniedModalInstance;
let developmentModalInstance;
let user = null;

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
    }
  } catch (error) {
    alert("Erro ao carregar técnicos: " + error.message);
  }
}

async function buscarChecklistsAvaliados(page = 1) {
  currentPage = parseInt(page) || 1;

  const tbody = document.querySelector("#tabelaResultados tbody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Buscando...</td></tr>`;

  const paginationControlsContainer = document.getElementById(
    "paginationControlsContainer"
  );
  if (paginationControlsContainer) paginationControlsContainer.innerHTML = "";

  const paginationInfoEl = document.getElementById("paginationInfo");
  if (paginationInfoEl) paginationInfoEl.textContent = "Carregando...";

  try {
    const idFilter = document.getElementById("filterId")?.value || "";
    const numeroSerieFilter =
      document.getElementById("filterNumeroSerie")?.value || "";
    const status = document.getElementById("filterStatus")?.value || "";
    const potencia = document.getElementById("filterPotencia")?.value || "";
    const tecnico = document.getElementById("filterTecnico")?.value || "";
    const dataAvaliacaoInicial =
      document.getElementById("filterDataAvaliacaoInicial")?.value || "";
    const dataAvaliacaoFinal =
      document.getElementById("filterDataAvaliacaoFinal")?.value || "";

    const params = new URLSearchParams();

    if (idFilter) params.append("id", idFilter);
    if (numeroSerieFilter) params.append("numero_serie", numeroSerieFilter);
    if (status) {
      params.append("status", status);
    } else {
      params.append("status_not_in", "pendente");
    }
    if (potencia) params.append("pot", potencia);
    if (tecnico) params.append("tecnico_responsavel", tecnico);
    if (dataAvaliacaoInicial)
      params.append("data_avaliacao_inicial", dataAvaliacaoInicial);
    if (dataAvaliacaoFinal)
      params.append("data_avaliacao_final", dataAvaliacaoFinal);

    params.append("page", currentPage);
    params.append("limit", itemsPerPage);

    let url = `/api/transformadores_reformados?${params.toString()}`;

    const responseData = await fazerRequisicao(url);

    if (responseData.success) {
      preencherTabela(responseData.data);
      if (responseData.pagination) {
        renderizarInfoPaginacao(responseData.pagination);
        renderizarControlesPaginacao(responseData.pagination);
      }
    } else {
      throw new Error(
        responseData.message || "Erro ao carregar dados dos transformadores"
      );
    }
  } catch (error) {
    if (tbody)
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Erro ao buscar dados: ${error.message}</td></tr>`;
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
  prevA.innerHTML = "«";
  prevA.setAttribute("aria-label", "Anterior");
  prevA.addEventListener("click", (e) => {
    e.preventDefault();
    if (currentPage > 1) {
      buscarChecklistsAvaliados(currentPage - 1);
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
      buscarChecklistsAvaliados(1);
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
          buscarChecklistsAvaliados(pageNum);
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
      buscarChecklistsAvaliados(totalPages);
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
  nextA.innerHTML = "»";
  nextA.setAttribute("aria-label", "Próxima");
  nextA.addEventListener("click", (e) => {
    e.preventDefault();
    if (currentPage < totalPages) {
      buscarChecklistsAvaliados(currentPage + 1);
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
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4">Nenhum checklist encontrado com os filtros aplicados.</td></tr>`;
    return;
  }

  trafos.forEach((trafo) => {
    let statusClass =
      trafo.status_avaliacao === "avaliado"
        ? "bg-success text-white"
        : "bg-danger text-white";
    let statusText =
      trafo.status_avaliacao === "avaliado" ? "Aprovado" : "Reprovado";
    const dataAvaliacao = trafo.data_avaliacao
      ? new Date(trafo.data_avaliacao).toLocaleDateString("pt-BR")
      : "-";
    const historicoButtonHtml = `<button class="btn btn-sm btn-outline-info" onclick="window.location.href='/transformadores/historico/${trafo.numero_serie}'" title="Ver todos os históricos para este Nº de Série"><i class="fas fa-history"></i> (${trafo.total_ciclos})</button>`;

    const actionButtonsHtml = `
        <button class="btn btn-sm btn-info" onclick="visualizarChecklist(${trafo.id})" title="Visualizar Detalhes">
            <i class="fas fa-eye"></i>
        </button>
        <button class="btn btn-sm btn-secondary" onclick="gerarPDFChecklist(${trafo.id})" title="Gerar PDF do Checklist">
            <i class="fas fa-file-pdf"></i>
        </button>
        <button class="btn btn-sm btn-warning" onclick="reverterParaPendente(${trafo.id})" title="Reverter para Pendente">
            <i class="fas fa-undo"></i>
        </button>
    `;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${trafo.id}</td>
      <td>${trafo.numero_serie}</td>
      <td>${trafo.fabricante || "-"}</td>
      <td>${trafo.pot || "-"}</td>
      <td><span class="badge ${statusClass}">${statusText}</span></td>
      <td>${dataAvaliacao}</td>
      <td class="text-center">${historicoButtonHtml}</td>
      <td class="text-center">
        <div class="btn-group">
            ${actionButtonsHtml}
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

async function visualizarChecklist(registroId) {
  const container = document.getElementById("checklistDetailsContainer");
  container.innerHTML =
    '<div class="text-center p-4"><div class="spinner-border" role="status"></div></div>';
  checklistModalInstance.show();

  try {
    const response = await fazerRequisicao(
      `/api/checklist_por_registro/${registroId}`
    );
    if (!response.success || !response.data) {
      throw new Error(response.message || "Checklist não encontrado.");
    }
    const checklist = response.data;

    container.innerHTML = `
            <p><strong>ID do Teste:</strong> ${checklist.id}</p>
            <p><strong>Data do Teste:</strong> ${new Date(
              checklist.data_teste
            ).toLocaleString("pt-BR")}</p>
            <p><strong>Técnico:</strong> ${
              checklist.nome_tecnico || checklist.tecnico_responsavel_teste
            }</p>
            <hr>
            <h6>Bobinas Primárias</h6>
            <p><strong>Primária I/II/III:</strong> ${
              checklist.bobina_primaria_i || "N/A"
            } / ${checklist.bobina_primaria_ii || "N/A"} / ${
      checklist.bobina_primaria_iii || "N/A"
    }</p>
            <h6>Bobinas Secundárias</h6>
            <p><strong>Secundária I/II/III:</strong> ${
              checklist.bobina_secundaria_i || "N/A"
            } / ${checklist.bobina_secundaria_ii || "N/A"} / ${
      checklist.bobina_secundaria_iii || "N/A"
    }</p>
            <h6>Valores TTR</h6>
            <p><strong>Valor I/II/III:</strong> ${
              checklist.valor_bobina_i || "N/A"
            } / ${checklist.valor_bobina_ii || "N/A"} / ${
      checklist.valor_bobina_iii || "N/A"
    }</p>
            <hr>
            <p><strong>Estado Físico Geral:</strong> ${
              checklist.estado_fisico || "N/A"
            }</p>
            <p><strong>Observações do Checklist:</strong> ${
              checklist.observacoes_checklist || "Nenhuma."
            }</p>
        `;
  } catch (error) {
    container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
  }
}

async function gerarPDFChecklist(registroId) {
  const btn = event.currentTarget;
  const originalIcon = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';

  try {
    const checklistResponse = await fazerRequisicao(
      `/api/checklist_por_registro/${registroId}`
    );
    const trafoResponse = await fazerRequisicao(
      `/api/transformadores_reformados/${registroId}`
    );

    if (!checklistResponse.success || !trafoResponse.success) {
      throw new Error("Não foi possível obter os dados para gerar o PDF.");
    }

    const payload = {
      checklist: checklistResponse.data,
      transformador: trafoResponse.data,
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
      const errorData = await response.json();
      throw new Error(errorData.message || "Erro ao gerar PDF.");
    }

    const blob = await response.blob();
    const urlBlob = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = urlBlob;
    a.download = `Checklist_Trafo_${trafoResponse.data.numero_serie}_ID${checklistResponse.data.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(urlBlob);
  } catch (error) {
    alert("Erro ao gerar PDF: " + error.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalIcon;
  }
}

async function reverterParaPendente(registroId) {
  if (
    !confirm(
      `Tem certeza que deseja reverter o registro ID ${registroId} para o status "Pendente"? Ele voltará para a fila de avaliação.`
    )
  ) {
    return;
  }

  try {
    const response = await fazerRequisicao(
      `/api/transformadores/${registroId}/reverter`,
      { method: "PUT" }
    );

    if (!response.success) {
      throw new Error(response.message || "Erro ao reverter o status.");
    }

    alert('Registro revertido para "Pendente" com sucesso!');
    buscarChecklistsAvaliados(currentPage);
  } catch (error) {
    alert("Erro: " + error.message);
  }
}

async function gerarPDFTabela() {
  const btn = document.getElementById("btnGerarPDFTabela");
  const originalBtnHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Gerando...';

  try {
    const idFilter = document.getElementById("filterId")?.value || "";
    const numeroSerieFilter =
      document.getElementById("filterNumeroSerie")?.value || "";
    const status = document.getElementById("filterStatus")?.value || "";
    const potencia = document.getElementById("filterPotencia")?.value || "";
    const tecnico = document.getElementById("filterTecnico")?.value || "";
    const dataAvaliacaoInicial =
      document.getElementById("filterDataAvaliacaoInicial")?.value || "";
    const dataAvaliacaoFinal =
      document.getElementById("filterDataAvaliacaoFinal")?.value || "";

    const params = new URLSearchParams();

    if (idFilter) params.append("id", idFilter);
    if (numeroSerieFilter) params.append("numero_serie", numeroSerieFilter);
    if (status) {
      params.append("status", status);
    } else {
      params.append("status_not_in", "pendente");
    }
    if (potencia) params.append("pot", potencia);
    if (tecnico) params.append("tecnico_responsavel", tecnico);
    if (dataAvaliacaoInicial)
      params.append("data_avaliacao_inicial", dataAvaliacaoInicial);
    if (dataAvaliacaoFinal)
      params.append("data_avaliacao_final", dataAvaliacaoFinal);

    params.append("getAll", "true");

    const responseData = await fazerRequisicao(
      `/api/transformadores_reformados?${params.toString()}`
    );

    if (!responseData.success || responseData.data.length === 0) {
      throw new Error(
        "Não há dados para gerar o relatório com os filtros atuais."
      );
    }

    const filtrosTexto = {
      "ID do Registro": idFilter,
      "Número de Série": numeroSerieFilter,
      Status:
        document.getElementById("filterStatus").options[
          document.getElementById("filterStatus").selectedIndex
        ].text,
      "Potência (kVA)": potencia,
      Técnico:
        document.getElementById("filterTecnico").options[
          document.getElementById("filterTecnico").selectedIndex
        ].text,
      "Data Aval. Inicial": dataAvaliacaoInicial,
      "Data Aval. Final": dataAvaliacaoFinal,
    };

    const pdfResponse = await fetch("/api/gerar_pdf_tabela_historico", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      credentials: "include",
      body: JSON.stringify({ dados: responseData.data, filtros: filtrosTexto }),
    });

    if (!pdfResponse.ok) {
      const errorData = await pdfResponse.json();
      throw new Error(errorData.message || "Erro ao gerar PDF da tabela.");
    }

    const blob = await pdfResponse.blob();
    const urlBlob = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = urlBlob;
    a.download = "Relatorio_Checklists_Avaliados.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(urlBlob);
  } catch (error) {
    alert("Erro ao gerar PDF da tabela: " + error.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalBtnHTML;
  }
}

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
    const response = await fetch(urlToNavigate, { method: "HEAD" });
    if (
      response.ok ||
      response.status === 401 ||
      response.status === 403 ||
      response.redirected
    ) {
      window.location.href = urlToNavigate;
    } else if (response.status === 404) {
      if (developmentModalInstance) {
        developmentModalInstance.show();
      } else {
        alert("Página não encontrada ou em desenvolvimento.");
      }
    } else {
      if (accessDeniedModalInstance) {
        accessDeniedModalInstance.show();
      } else {
        alert("Acesso negado ou erro ao tentar acessar a página.");
      }
    }
  } catch (error) {
    console.error("Erro de rede ou falha na navegação:", error);
    if (developmentModalInstance) {
      developmentModalInstance.show();
    } else {
      alert("Erro de rede ou falha na navegação.");
    }
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  const modalEl = document.getElementById("visualizarChecklistModal");
  if (modalEl) {
    checklistModalInstance = new bootstrap.Modal(modalEl);
  }

  user = JSON.parse(localStorage.getItem("user"));

  if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);

    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
  }

  await carregarPotencias();
  await carregarTecnicos();
  await buscarChecklistsAvaliados(1);

  const filtroFormEl = document.getElementById("filtroFormHistorico");
  if (filtroFormEl) {
    filtroFormEl.addEventListener("submit", (e) => {
      e.preventDefault();
      buscarChecklistsAvaliados(1);
    });
  }

  const btnGerarPDFTabela = document.getElementById("btnGerarPDFTabela");
  if (btnGerarPDFTabela) {
    btnGerarPDFTabela.addEventListener("click", gerarPDFTabela);
  }
});
