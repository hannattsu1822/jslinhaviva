const PAGE_LIMIT = 10;

document.addEventListener("DOMContentLoaded", async () => {
  const pathParts = window.location.pathname.split("/");
  const numeroSerie = decodeURIComponent(pathParts[pathParts.length - 1]);

  if (!numeroSerie) {
    document.body.innerHTML =
      "<h1>Erro: Número de série do transformador não encontrado na URL.</h1>";
    return;
  }

  const historyListEl = document.getElementById("checklistHistoryList");
  const unifiedTimelineEl = document.getElementById("unifiedHistoryTimeline");
  const trafoNumeroSerieEl = document.getElementById("trafoNumeroSerie");
  const btnGerarPDFLista = document.getElementById("btnGerarPDFLista");
  const state = {
    numeroSerie,
    checklistPage: 1,
    unifiedPage: 1,
    currentChecklists: [],
  };

  trafoNumeroSerieEl.textContent = numeroSerie;
  historyListEl.innerHTML = '<div class="list-group-item">Carregando...</div>';
  if (unifiedTimelineEl) {
    unifiedTimelineEl.innerHTML = '<div class="list-group-item">Carregando...</div>';
  }

  document
    .getElementById("btnUnifiedPrev")
    .addEventListener("click", () => carregarHistoricoUnificado(state, -1));
  document
    .getElementById("btnUnifiedNext")
    .addEventListener("click", () => carregarHistoricoUnificado(state, 1));
  document
    .getElementById("btnChecklistPrev")
    .addEventListener("click", () => carregarHistoricoChecklist(state, -1));
  document
    .getElementById("btnChecklistNext")
    .addEventListener("click", () => carregarHistoricoChecklist(state, 1));
  btnGerarPDFLista.addEventListener("click", async () => {
    try {
      const todosChecklists = await carregarTodosChecklists(numeroSerie);
      gerarPDFLista(todosChecklists, { numero_serie: numeroSerie });
    } catch (error) {
      alert("Erro ao preparar PDF da lista: " + error.message);
    }
  });

  try {
    await Promise.all([
      carregarHistoricoUnificado(state, 0),
      carregarHistoricoChecklist(state, 0),
    ]);
  } catch (error) {
    historyListEl.innerHTML = safeHtml`<div class="list-group-item text-danger">Erro ao carregar: ${error.message}</div>`;
    if (unifiedTimelineEl) {
      unifiedTimelineEl.innerHTML = safeHtml`<div class="list-group-item text-danger">Erro ao carregar histórico unificado: ${error.message}</div>`;
    }
  }
});

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

async function carregarHistoricoChecklist(state, pageDelta = 0) {
  const nextPage = Math.max(1, state.checklistPage + pageDelta);
  const historyResponse = await fazerRequisicao(
    `/api/historico_por_serie/${encodeURIComponent(
      state.numeroSerie
    )}?page=${nextPage}&limit=${PAGE_LIMIT}`
  );
  if (!historyResponse?.success) {
    throw new Error(historyResponse?.message || "Falha ao carregar histórico.");
  }

  state.checklistPage = nextPage;
  state.currentChecklists = Array.isArray(historyResponse.data)
    ? historyResponse.data
    : [];
  renderHistoryList(state.currentChecklists);
  atualizarPaginacaoChecklist(historyResponse.pagination);
}

async function carregarTodosChecklists(numeroSerie) {
  const todos = [];
  let page = 1;
  let hasNext = true;

  while (hasNext && page <= 200) {
    const response = await fazerRequisicao(
      `/api/historico_por_serie/${encodeURIComponent(
        numeroSerie
      )}?page=${page}&limit=100`
    );
    if (!response?.success) {
      throw new Error(response?.message || "Falha ao carregar checklists.");
    }
    todos.push(...(Array.isArray(response.data) ? response.data : []));
    hasNext = Boolean(response.pagination?.has_next);
    page += 1;
  }

  return todos;
}

async function carregarHistoricoUnificado(state, pageDelta = 0) {
  const nextPage = Math.max(1, state.unifiedPage + pageDelta);
  const unifiedResponse = await fazerRequisicao(
    `/api/transformadores/historico-unificado/${encodeURIComponent(
      state.numeroSerie
    )}?page=${nextPage}&limit=${PAGE_LIMIT}`
  );
  if (!unifiedResponse?.success) {
    throw new Error(
      unifiedResponse?.message || "Falha ao carregar histórico unificado."
    );
  }

  state.unifiedPage = nextPage;
  renderUnifiedTimeline(unifiedResponse.data);
  atualizarPaginacaoUnificada(unifiedResponse.data?.pagination);
}

function atualizarPaginacaoChecklist(pagination = {}) {
  const infoEl = document.getElementById("checklistPaginationInfo");
  const prevBtn = document.getElementById("btnChecklistPrev");
  const nextBtn = document.getElementById("btnChecklistNext");
  const page = Number(pagination.page || 1);
  const totalPages = Number(pagination.total_pages || 1);
  const totalItems = Number(pagination.total_items || 0);
  infoEl.textContent = `Página ${page} de ${totalPages} • ${totalItems} item(ns)`;
  prevBtn.disabled = !pagination.has_prev;
  nextBtn.disabled = !pagination.has_next;
}

function atualizarPaginacaoUnificada(pagination = {}) {
  const infoEl = document.getElementById("unifiedPaginationInfo");
  const prevBtn = document.getElementById("btnUnifiedPrev");
  const nextBtn = document.getElementById("btnUnifiedNext");
  const page = Number(pagination.page || 1);
  const totalPages = Number(pagination.total_pages || 1);
  const totalItems = Number(pagination.total_items || 0);
  infoEl.textContent = `Página ${page} de ${totalPages} • ${totalItems} evento(s)`;
  prevBtn.disabled = !pagination.has_prev;
  nextBtn.disabled = !pagination.has_next;
}

function renderHistoryList(checklists) {
  const historyListEl = document.getElementById("checklistHistoryList");
  const btnGerarPDFLista = document.getElementById("btnGerarPDFLista");
  historyListEl.innerHTML = "";

  if (checklists.length === 0) {
    historyListEl.innerHTML =
      '<div class="list-group-item text-center p-4">Nenhuma avaliação encontrada para este transformador.</div>';
    btnGerarPDFLista.disabled = true;
    return;
  }
  btnGerarPDFLista.disabled = false;

  checklists.forEach((checklist) => {
    const item = document.createElement("div");
    item.className = "list-group-item";

    const statusClass =
      checklist.conclusao_checklist === "APROVADO" ? "bg-success" : "bg-danger";

    item.innerHTML = safeHtml`
            <div class="d-flex w-100 justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">Avaliação do Registro ID: ${
                      checklist.trafos_reformados_id
                    } - <span class="badge ${statusClass}">${
      checklist.conclusao_checklist
    }</span></h6>
                    <small>Data: ${new Date(
                      checklist.data_teste
                    ).toLocaleString("pt-BR")}</small><br>
                    <small>Técnico: ${checklist.nome_tecnico || "N/A"}</small>
                </div>
                <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-outline-secondary btn-pdf-item" data-checklist-id="${
                      checklist.id
                    }" title="Gerar PDF do Checklist">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                </div>
            </div>
        `;

    item.querySelector(".btn-pdf-item").addEventListener("click", (e) => {
      e.stopPropagation();
      gerarPDFChecklistEspecifico(checklist);
    });

    historyListEl.appendChild(item);
  });
}

function renderUnifiedTimeline(data) {
  const unifiedTimelineEl = document.getElementById("unifiedHistoryTimeline");
  if (!unifiedTimelineEl) return;

  const eventos = Array.isArray(data?.eventos) ? data.eventos : [];
  unifiedTimelineEl.innerHTML = "";

  if (!eventos.length) {
    unifiedTimelineEl.innerHTML =
      '<div class="list-group-item text-center p-4">Nenhum evento encontrado para esta série.</div>';
    return;
  }

  eventos.forEach((evento) => {
    const item = document.createElement("div");
    item.className = "list-group-item";

    const dataEvento = evento.data_evento
      ? new Date(evento.data_evento).toLocaleString("pt-BR")
      : "Data não informada";
    const tipo = formatEventType(evento.tipo);
    const detalhes = formatEventDetails(evento.detalhes || {});

    item.innerHTML = safeHtml`
      <div class="d-flex w-100 justify-content-between align-items-start gap-2">
        <div>
          <h6 class="mb-1">${evento.titulo || "Evento"}</h6>
          <small class="text-muted">${tipo} • ${dataEvento}</small>
          <div class="mt-2">${rawHtml(detalhes)}</div>
        </div>
      </div>
    `;
    unifiedTimelineEl.appendChild(item);
  });
}

function formatEventType(tipo) {
  const map = {
    cadastro_transformador: "Cadastro",
    movimentacao_almoxarifado: "Movimentação",
    remessa_almoxarifado: "Remessa",
    ciclo_reformado: "Ciclo Reformado",
    avaliacao_reformado: "Avaliação Reformado",
    checklist_transformador: "Checklist Transformador",
  };
  return map[tipo] || tipo || "Evento";
}

function formatEventDetails(details) {
  const entries = Object.entries(details).filter(
    ([, value]) => value !== null && value !== undefined && String(value).trim() !== ""
  );
  if (!entries.length) return "<small class=\"text-muted\">Sem detalhes.</small>";

  return `<ul class="mb-0 ps-3">${entries
    .slice(0, 8)
    .map(
      ([key, value]) =>
        `<li><small><strong>${escapeLabel(key)}:</strong> ${escapeValue(value)}</small></li>`
    )
    .join("")}</ul>`;
}

function escapeLabel(value) {
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function escapeValue(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function gerarPDFChecklistEspecifico(checklistData) {
  const btn = document.querySelector(
    `.btn-pdf-item[data-checklist-id="${checklistData.id}"]`
  );
  const originalIcon = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';

  try {
    const payload = {
      checklist: checklistData,
      transformador: {
        id: checklistData.trafos_reformados_id,
        numero_serie: checklistData.numero_serie,
        fabricante: checklistData.fabricante,
        pot: checklistData.pot,
        resultado_avaliacao: checklistData.resultado_avaliacao,
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
      const errorData = await response.json();
      throw new Error(errorData.message || "Erro ao gerar PDF.");
    }

    const blob = await response.blob();
    const urlBlob = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = urlBlob;
    a.download = `Checklist_Trafo_${checklistData.numero_serie}_ID${checklistData.id}.pdf`;
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

async function gerarPDFLista(checklists, trafoInfo) {
  const btn = document.getElementById("btnGerarPDFLista");
  const originalBtnHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Gerando...';

  try {
    const payload = {
      checklists: checklists,
      transformador: trafoInfo,
    };

    const response = await fetch("/api/gerar_pdf_lista_historico", {
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
      throw new Error(errorData.message || "Erro ao gerar PDF da lista.");
    }

    const blob = await response.blob();
    const urlBlob = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = urlBlob;
    a.download = `Historico_Completo_Trafo_${trafoInfo.numero_serie}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(urlBlob);
  } catch (error) {
    alert("Erro ao gerar PDF: " + error.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-file-pdf me-2"></i>Gerar PDF da Lista';
  }
}
