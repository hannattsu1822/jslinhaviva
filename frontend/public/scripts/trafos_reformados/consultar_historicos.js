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
      tbody.innerHTML = safeHtml`<tr><td colspan="8" class="text-center text-danger py-4">Erro ao buscar dados: ${error.message}</td></tr>`;
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

  const wrapper = document.createElement("div");
  wrapper.className = "d-flex align-items-center gap-2 flex-wrap";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "btn btn-outline-secondary btn-sm";
  prevBtn.textContent = "Prev";
  prevBtn.disabled = currentPage <= 1;
  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) buscarChecklistsAvaliados(currentPage - 1);
  });

  const pageLabel = document.createElement("span");
  pageLabel.className = "small text-muted";
  pageLabel.textContent = "Página";

  const pageSelect = document.createElement("select");
  pageSelect.className = "form-select form-select-sm";
  pageSelect.style.width = "90px";
  for (let i = 1; i <= totalPages; i += 1) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = String(i);
    option.selected = i === currentPage;
    pageSelect.appendChild(option);
  }
  pageSelect.addEventListener("change", () => {
    const selectedPage = parseInt(pageSelect.value, 10);
    if (!Number.isNaN(selectedPage) && selectedPage !== currentPage) {
      buscarChecklistsAvaliados(selectedPage);
    }
  });

  const totalLabel = document.createElement("span");
  totalLabel.className = "small text-muted";
  totalLabel.textContent = `de ${totalPages}`;

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "btn btn-outline-secondary btn-sm";
  nextBtn.textContent = "Next";
  nextBtn.disabled = currentPage >= totalPages;
  nextBtn.addEventListener("click", () => {
    if (currentPage < totalPages) buscarChecklistsAvaliados(currentPage + 1);
  });

  wrapper.appendChild(prevBtn);
  wrapper.appendChild(pageLabel);
  wrapper.appendChild(pageSelect);
  wrapper.appendChild(totalLabel);
  wrapper.appendChild(nextBtn);
  container.appendChild(wrapper);
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
    const historicoButtonHtml = `<button class="btn btn-sm btn-outline-info" data-action="navigate" data-href="/transformadores/historico/${trafo.numero_serie}" title="Ver todos os históricos para este Nº de Série"><i class="fas fa-history"></i> (${trafo.total_ciclos})</button>`;

    const actionButtonsHtml = `
        <button class="btn btn-sm btn-info" data-action="visualizarChecklist" data-id="${trafo.id}" title="Visualizar Detalhes">
            <i class="fas fa-eye"></i>
        </button>
        <button class="btn btn-sm btn-secondary" data-action="gerarPDFChecklist" data-id="${trafo.id}" title="Gerar PDF do Checklist">
            <i class="fas fa-file-pdf"></i>
        </button>
        <button class="btn btn-sm btn-warning" data-action="reverterParaPendente" data-id="${trafo.id}" title="Reverter para Pendente">
            <i class="fas fa-undo"></i>
        </button>
    `;

    const tr = document.createElement("tr");
    tr.innerHTML = safeHtml`
      <td data-label="ID do Registro">${trafo.id}</td>
      <td data-label="Nº de Série">${trafo.numero_serie}</td>
      <td data-label="Fabricante">${trafo.fabricante || "-"}</td>
      <td data-label="Potência">${trafo.pot || "-"}</td>
      <td data-label="Status"><span class="badge ${statusClass}">${statusText}</span></td>
      <td data-label="Data Avaliação">${dataAvaliacao}</td>
      <td data-label="Histórico" class="text-center">${rawHtml(historicoButtonHtml)}</td>
      <td data-label="Ações" class="text-center">
        <div class="btn-group">
            ${rawHtml(actionButtonsHtml)}
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

window.visualizarChecklist = async function visualizarChecklist(registroId) {
  const container = document.getElementById("checklistDetailsContainer");
  if (!container || !checklistModalInstance) return;
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
    const checklistData = response.data;

    let anexoHtml = "";
    if (checklistData.anexos && checklistData.anexos.length > 0) {
      const imageLinks = checklistData.anexos
        .map((anexo) => {
          const imagePath = `/${anexo.caminho_arquivo}`;
          return `
            <a href="${imagePath}" target="_blank" title="Ver imagem: ${
            anexo.nome_original
          }">
              <img src="${imagePath}" alt="${
            anexo.nome_original
          }" class="img-thumbnail" style="width: 100px; height: 100px; object-fit: cover;">
            </a>
          `;
        })
        .join("");

      anexoHtml = `
        <hr>
        <h6>Anexos Fotográficos</h6>
        <div class="d-flex flex-wrap gap-2 mt-2">
          ${imageLinks}
        </div>
      `;
    }

    container.innerHTML = safeHtml`
            <p><strong>ID do Teste:</strong> ${checklistData.id}</p>
            <p><strong>Data do Teste:</strong> ${new Date(
              checklistData.data_teste
            ).toLocaleString("pt-BR")}</p>
            <p><strong>Técnico:</strong> ${
              checklistData.nome_tecnico ||
              checklistData.tecnico_responsavel_teste
            }</p>
            <hr>
            <h6>Bobinas Primárias</h6>
            <p><strong>Primária I/II/III:</strong> ${
              checklistData.bobina_primaria_i || "N/A"
            } / ${checklistData.bobina_primaria_ii || "N/A"} / ${
      checklistData.bobina_primaria_iii || "N/A"
    }</p>
            <h6>Bobinas Secundárias</h6>
            <p><strong>Secundária I/II/III:</strong> ${
              checklistData.bobina_secundaria_i || "N/A"
            } / ${checklistData.bobina_secundaria_ii || "N/A"} / ${
      checklistData.bobina_secundaria_iii || "N/A"
    }</p>
            <h6>Valores TTR</h6>
            <p><strong>Valor I/II/III:</strong> ${
              checklistData.valor_bobina_i || "N/A"
            } / ${checklistData.valor_bobina_ii || "N/A"} / ${
      checklistData.valor_bobina_iii || "N/A"
    }</p>
            <hr>
            <p><strong>Estado Físico Geral:</strong> ${
              checklistData.estado_fisico || "N/A"
            }</p>
            <p><strong>Observações do Checklist:</strong> ${
              checklistData.observacoes_checklist || "Nenhuma."
            }</p>
            <p><strong>Observações Gerais / Motivo da Reprovação:</strong> ${
              checklistData.resultado_avaliacao || "Nenhuma."
            }</p>
            ${rawHtml(anexoHtml)}
        `;
  } catch (error) {
    container.innerHTML = safeHtml`<div class="alert alert-danger">${error.message}</div>`;
  }
};

window.gerarPDFChecklist = async function gerarPDFChecklist(registroId, button) {
  const btn =
    button ||
    document.querySelector(
      `button[data-action="gerarPDFChecklist"][data-id="${registroId}"]`
    );
  if (!btn) return;
  const originalIcon = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';

  try {
    const response = await fazerRequisicao(
      `/api/checklist_por_registro/${registroId}`
    );

    if (!response.success || !response.data) {
      throw new Error("Não foi possível obter os dados para gerar o PDF.");
    }

    const combinedData = response.data;

    const payload = {
      checklist: combinedData,
      transformador: {
        id: combinedData.trafos_reformados_id,
        numero_serie: combinedData.numero_serie,
        fabricante: combinedData.fabricante,
        pot: combinedData.pot,
        resultado_avaliacao: combinedData.resultado_avaliacao,
      },
    };

    const pdfResponse = await fetch("/api/gerar_pdf_checklist_especifico", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (!pdfResponse.ok) {
      const errorData = await pdfResponse.json();
      throw new Error(errorData.message || "Erro ao gerar PDF.");
    }

    const blob = await pdfResponse.blob();
    const urlBlob = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = urlBlob;
    a.download = `Checklist_Trafo_${combinedData.numero_serie}_ID${combinedData.id}.pdf`;
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
};

window.reverterParaPendente = async function reverterParaPendente(registroId) {
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
};

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
