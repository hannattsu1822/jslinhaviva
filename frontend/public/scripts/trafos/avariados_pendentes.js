let currentPage = 1;
const itemsPerPage = 15;

async function fazerRequisicao(url, options = {}) {
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
  if (response.status === 204) return null;
  return response.json();
}

function formatarDataCurta(valor) {
  if (!valor) return "-";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function renderizarInfoPaginacao(pagination) {
  const { currentPage, itemsPerPage, totalItems } = pagination;
  const paginationInfoEl = document.getElementById("paginationInfo");
  if (!paginationInfoEl) return;

  if (totalItems === 0) {
    paginationInfoEl.textContent = "Nenhum item encontrado";
    return;
  }
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(startItem + itemsPerPage - 1, totalItems);
  paginationInfoEl.textContent = `Mostrando ${startItem}-${endItem} de ${totalItems} itens`;
}

function renderizarControlesPaginacao(pagination) {
  const { currentPage, totalPages } = pagination;
  const container = document.getElementById("paginationControlsContainer");
  if (!container) return;
  container.innerHTML = "";
  if (!totalPages || totalPages <= 1) return;

  const ul = document.createElement("ul");
  ul.className = "pagination pagination-sm mb-0";

  const prevLi = document.createElement("li");
  prevLi.className = `page-item ${currentPage === 1 ? "disabled" : ""}`;
  prevLi.innerHTML = `<a class="page-link" href="#" aria-label="Anterior">«</a>`;
  prevLi.addEventListener("click", (e) => {
    e.preventDefault();
    if (currentPage > 1) carregarPendentes(currentPage - 1);
  });
  ul.appendChild(prevLi);

  for (let page = 1; page <= totalPages; page += 1) {
    const li = document.createElement("li");
    li.className = `page-item ${page === currentPage ? "active" : ""}`;
    li.innerHTML = `<a class="page-link" href="#">${page}</a>`;
    li.addEventListener("click", (e) => {
      e.preventDefault();
      if (page !== currentPage) carregarPendentes(page);
    });
    ul.appendChild(li);
  }

  const nextLi = document.createElement("li");
  nextLi.className = `page-item ${currentPage === totalPages ? "disabled" : ""}`;
  nextLi.innerHTML = `<a class="page-link" href="#" aria-label="Próxima">»</a>`;
  nextLi.addEventListener("click", (e) => {
    e.preventDefault();
    if (currentPage < totalPages) carregarPendentes(currentPage + 1);
  });
  ul.appendChild(nextLi);

  container.appendChild(ul);
}

function preencherTabela(items) {
  const tbody = document.querySelector("#tabelaResultados tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!items || !items.length) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="text-center py-4">Nenhum transformador avariado pendente encontrado.</td></tr>';
    return;
  }

  items.forEach((item) => {
    const localRegional = [item.local_retirada, item.regional]
      .filter(Boolean)
      .join(" / ");
    const tr = document.createElement("tr");
    tr.innerHTML = safeHtml`
      <td>${item.numero_serie || "-"}</td>
      <td>${item.marca || "-"}</td>
      <td>${item.potencia || "-"}</td>
      <td>${localRegional || "-"}</td>
      <td>${formatarDataCurta(item.data_processamento_remessa)}</td>
      <td><span class="badge bg-warning text-dark">Pendente</span></td>
      <td class="text-center">
        <a class="btn btn-sm btn-primary" href="/formulario_transformadores?numero_serie=${encodeURIComponent(item.numero_serie || "")}" title="Avaliar">
          <i class="fas fa-clipboard-check"></i>
        </a>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function carregarPendentes(page = 1) {
  currentPage = parseInt(page, 10) || 1;
  const tbody = document.querySelector("#tabelaResultados tbody");
  const paginationInfoEl = document.getElementById("paginationInfo");
  const numeroSerie = document.getElementById("filterNumeroSerie")?.value || "";

  if (tbody) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Carregando...</td></tr>';
  }
  if (paginationInfoEl) paginationInfoEl.textContent = "Carregando...";

  try {
    const params = new URLSearchParams();
    params.append("page", currentPage);
    params.append("limit", itemsPerPage);
    if (numeroSerie.trim()) params.append("numero_serie", numeroSerie.trim());

    const response = await fazerRequisicao(
      `/api/transformadores_avariados_pendentes?${params.toString()}`
    );
    if (!response?.success) {
      throw new Error(response?.message || "Falha ao carregar pendentes.");
    }
    preencherTabela(response.data || []);
    renderizarInfoPaginacao(response.pagination || {});
    renderizarControlesPaginacao(response.pagination || {});
  } catch (error) {
    if (tbody) {
      tbody.innerHTML = safeHtml`<tr><td colspan="7" class="text-center text-danger py-4">Erro ao carregar dados: ${error.message}</td></tr>`;
    }
    if (paginationInfoEl) paginationInfoEl.textContent = "Falha ao carregar";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const filtroForm = document.getElementById("filtroForm");
  if (filtroForm) {
    filtroForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      currentPage = 1;
      await carregarPendentes(1);
    });
  }
  await carregarPendentes(1);
});
