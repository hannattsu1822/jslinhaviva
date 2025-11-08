document.addEventListener("DOMContentLoaded", async () => {
  const pathParts = window.location.pathname.split("/");
  const numeroSerie = decodeURIComponent(pathParts[pathParts.length - 1]);

  if (!numeroSerie) {
    document.body.innerHTML =
      "<h1>Erro: Número de série do transformador não encontrado na URL.</h1>";
    return;
  }

  const historyListEl = document.getElementById("checklistHistoryList");
  const trafoNumeroSerieEl = document.getElementById("trafoNumeroSerie");

  trafoNumeroSerieEl.textContent = numeroSerie;
  historyListEl.innerHTML = '<div class="list-group-item">Carregando...</div>';

  try {
    const historyResponse = await fazerRequisicao(
      `/api/historico_por_serie/${numeroSerie}`
    );

    if (!historyResponse.success) {
      throw new Error(historyResponse.message);
    }

    const checklists = historyResponse.data;
    renderHistoryList(checklists);

    const btnGerarPDFLista = document.getElementById("btnGerarPDFLista");
    btnGerarPDFLista.addEventListener("click", () =>
      gerarPDFLista(checklists, { numero_serie: numeroSerie })
    );
  } catch (error) {
    historyListEl.innerHTML = `<div class="list-group-item text-danger">Erro ao carregar: ${error.message}</div>`;
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

function renderHistoryList(checklists) {
  const historyListEl = document.getElementById("checklistHistoryList");
  historyListEl.innerHTML = "";

  if (checklists.length === 0) {
    historyListEl.innerHTML =
      '<div class="list-group-item text-center p-4">Nenhuma avaliação encontrada para este transformador.</div>';
    document.getElementById("btnGerarPDFLista").disabled = true;
    return;
  }

  checklists.forEach((checklist) => {
    const item = document.createElement("div");
    item.className = "list-group-item";

    const statusClass =
      checklist.conclusao_checklist === "APROVADO" ? "bg-success" : "bg-danger";

    item.innerHTML = `
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
