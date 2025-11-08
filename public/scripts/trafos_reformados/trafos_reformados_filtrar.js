let avaliacaoModalInstance;
let accessDeniedModalInstance;
let developmentModalInstance;
let user = null;

let currentPage = 1;
const itemsPerPage = 15;
let fileList = [];
const MAX_FILES = 10;
const MAX_TOTAL_SIZE_MB = 3;

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
    }
  } catch (error) {
    alert("Erro ao carregar potências: " + error.message);
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
    const fabricante = document.getElementById("filterFabricante")?.value || "";
    const potencia = document.getElementById("filterPotencia")?.value || "";

    const params = new URLSearchParams();

    params.append("status", "pendente");

    if (numeroSerieFilter) params.append("numero_serie", numeroSerieFilter);
    if (fabricante) params.append("fabricante", fabricante);
    if (potencia) params.append("pot", potencia);

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
  prevA.innerHTML = "«";
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
  nextA.innerHTML = "»";
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
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4">Nenhum transformador pendente encontrado.</td></tr>`;
    return;
  }

  trafos.forEach((trafo) => {
    const statusClass = "bg-warning text-dark";
    const statusText = "Pendente";
    const dataImportacao = trafo.data_importacao
      ? new Date(trafo.data_importacao).toLocaleDateString("pt-BR", {
          timeZone: "UTC",
        })
      : "-";

    let ultimaAvaliacaoHtml = "Nenhuma";
    if (trafo.ultima_avaliacao_anterior) {
      const dataFormatada = new Date(
        trafo.ultima_avaliacao_anterior
      ).toLocaleDateString("pt-BR", { timeZone: "UTC" });
      ultimaAvaliacaoHtml = `<span class="badge bg-warning text-dark">${dataFormatada}</span>`;
    }

    const actionButtonsHtml = `
        <button onclick="window.abrirModalAvaliacao(${trafo.id})" 
                class="btn btn-sm btn-primary" 
                title="Avaliar">
            <i class="fas fa-clipboard-check"></i>
        </button>
        <button onclick="window.confirmarExclusao(${
          trafo.id
        }, '${trafo.numero_serie.replace(/'/g, "\\'")}')" 
                class="btn btn-sm btn-danger" title="Excluir">
            <i class="fas fa-trash-alt"></i>
        </button>
    `;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${trafo.id}</td>
      <td>${trafo.numero_serie}</td>
      <td>${trafo.fabricante || "-"}</td>
      <td>${trafo.pot || "-"}</td>
      <td>${dataImportacao}</td>
      <td><span class="badge ${statusClass}">${statusText}</span></td>
      <td>${ultimaAvaliacaoHtml}</td>
      <td class="text-center">
        <div class="d-flex gap-1 justify-content-center">
          ${actionButtonsHtml}
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

window.confirmarExclusao = function (id, numeroSerie) {
  if (
    confirm(
      `Tem certeza que deseja excluir o registro de avaliação ID ${id} (${numeroSerie})? Esta ação não pode ser desfeita.`
    )
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
      alert("Registro de avaliação excluído com sucesso!");
      carregarTrafos(currentPage);
    } else {
      alert("Erro ao excluir: " + data.message);
    }
  } catch (error) {
    alert("Erro ao excluir registro: " + error.message);
  }
}

async function apagarTodosPendentes() {
  const confirmacao1 = prompt(
    'Esta ação é irreversível e irá apagar TODOS os transformadores com status "Pendente". Para confirmar, digite "APAGAR TUDO" na caixa abaixo.'
  );
  if (confirmacao1 !== "APAGAR TUDO") {
    alert(
      "Ação cancelada. A frase de confirmação não foi digitada corretamente."
    );
    return;
  }

  const confirmacao2 = confirm(
    "Confirmação final: Tem certeza absoluta que deseja apagar todos os registros pendentes?"
  );
  if (!confirmacao2) {
    alert("Ação cancelada.");
    return;
  }

  const btn = document.getElementById("btnApagarPendentes");
  btn.disabled = true;
  btn.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Apagando...';

  try {
    const response = await fazerRequisicao("/api/trafos_pendentes", {
      method: "DELETE",
    });
    if (response.success) {
      alert(
        `${response.deletedCount} registros pendentes foram apagados com sucesso.`
      );
      carregarTrafos(1);
    } else {
      throw new Error(
        response.message || "Erro desconhecido ao apagar registros."
      );
    }
  } catch (error) {
    alert("Erro ao apagar registros pendentes: " + error.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML =
      '<i class="fas fa-trash-alt me-2"></i>Apagar Todos os Pendentes';
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
  fileList = [];
  document.getElementById("anexosInput").value = "";
  renderPreviews();
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
      statusSelect.value = "";

      const obsEl = document.getElementById("observacoes");
      if (obsEl) obsEl.value = "";

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

  const formData = new FormData();
  formData.append("matricula_responsavel", currentUser.matricula);
  formData.append("status_avaliacao", status_final_avaliacao);
  formData.append("resultado_avaliacao", observacoes_gerais);
  formData.append("checklist_data", JSON.stringify(dadosChecklist));

  fileList.forEach((file) => {
    formData.append("anexos_imagem", file);
  });

  const btnSalvarAvaliacao = document.getElementById("btnSalvarAvaliacao");
  const originalBtnHTML = btnSalvarAvaliacao.innerHTML;
  btnSalvarAvaliacao.disabled = true;
  btnSalvarAvaliacao.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...';

  try {
    const response = await fetch(
      `/api/transformadores_reformados/${id}/avaliar_completo`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        credentials: "include",
        body: formData,
      }
    );

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(
        responseData.message || "Erro desconhecido ao salvar avaliação."
      );
    }

    alert("Avaliação salva com sucesso!");
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

function handleFiles(files) {
  const anexosInput = document.getElementById("anexosInput");
  let currentTotalSize = fileList.reduce((acc, file) => acc + file.size, 0);

  for (const file of files) {
    if (fileList.length >= MAX_FILES) {
      alert(`Você pode anexar no máximo ${MAX_FILES} arquivos.`);
      break;
    }
    if (!file.type.startsWith("image/")) {
      alert(`O arquivo "${file.name}" não é uma imagem e será ignorado.`);
      continue;
    }
    if (currentTotalSize + file.size > MAX_TOTAL_SIZE_MB * 1024 * 1024) {
      alert(
        `O arquivo "${file.name}" excede o limite total de ${MAX_TOTAL_SIZE_MB}MB e não pode ser adicionado.`
      );
      continue;
    }
    fileList.push(file);
    currentTotalSize += file.size;
  }
  anexosInput.value = "";
  renderPreviews();
}

function renderPreviews() {
  const previewArea = document.getElementById("previewArea");
  previewArea.innerHTML = "";

  fileList.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const previewItem = document.createElement("div");
      previewItem.className = "preview-item";

      const img = document.createElement("img");
      img.src = e.target.result;
      img.alt = file.name;

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.innerHTML = "&times;";
      removeBtn.type = "button";
      removeBtn.onclick = () => {
        fileList.splice(index, 1);
        renderPreviews();
      };

      previewItem.appendChild(img);
      previewItem.appendChild(removeBtn);
      previewArea.appendChild(previewItem);
    };
    reader.readAsDataURL(file);
  });
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
  user = JSON.parse(localStorage.getItem("user"));

  if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
    const avalModalEl = document.getElementById("avaliacaoModal");
    if (avalModalEl) avaliacaoModalInstance = new bootstrap.Modal(avalModalEl);

    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);

    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
  }

  await carregarFabricantes();
  await carregarPotencias();
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

  const btnApagarPendentesEl = document.getElementById("btnApagarPendentes");
  if (btnApagarPendentesEl) {
    btnApagarPendentesEl.addEventListener("click", apagarTodosPendentes);
  }

  const uploadArea = document.getElementById("uploadArea");
  const anexosInput = document.getElementById("anexosInput");

  if (uploadArea && anexosInput) {
    uploadArea.addEventListener("click", () => anexosInput.click());
    anexosInput.addEventListener("change", () => handleFiles(anexosInput.files));

    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      uploadArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      uploadArea.addEventListener(eventName, () =>
        uploadArea.classList.add("dragging")
      );
    });

    ["dragleave", "drop"].forEach((eventName) => {
      uploadArea.addEventListener(eventName, () =>
        uploadArea.classList.remove("dragging")
      );
    });

    uploadArea.addEventListener("drop", (e) => {
      handleFiles(e.dataTransfer.files);
    });
  }
});
