let allServices = [];
let filteredServices = [];
let currentPage = 1;
const itemsPerPage = 8;

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function formatDate(dateString) {
  if (!dateString) return "—";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("pt-BR", {
    timeZone: "UTC",
  });
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function getStatusHtml(service) {
  switch (service.status) {
    case "concluido":
      return '<span class="status-concluido">Concluído</span>';

    case "nao_concluido": {
      const motivo = escapeHtml(
        service.motivo_nao_conclusao || "Motivo não especificado."
      );
      return `
        <span class="status-nao-concluido">Não Concluído</span>
        <span class="motivo-nao-concluido">${motivo}</span>
      `;
    }

    case "ativo":
    case "em_progresso":
    default:
      return '<span class="status-andamento">Em Andamento</span>';
  }
}

function getDesligamentoLabel(value) {
  const normalized = normalizeText(value);

  if (!normalized) return "—";
  if (["SIM", "S", "TRUE", "1"].includes(normalized)) return "Sim";
  if (["NAO", "NAO", "NÃO", "N", "FALSE", "0"].includes(normalized))
    return "Não";

  return value || "—";
}

function popularFiltroEquipe() {
  const select = document.getElementById("filtro-equipe");
  if (!select) return;

  const currentValue = select.value;

  const equipes = Array.from(
    new Set(
      allServices
        .map((service) => (service.nomes_responsaveis || "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  select.innerHTML = '<option value="">Todas</option>';

  equipes.forEach((equipe) => {
    const option = document.createElement("option");
    option.value = equipe;
    option.textContent = equipe;
    select.appendChild(option);
  });

  if (equipes.includes(currentValue)) {
    select.value = currentValue;
  }
}

function aplicarOrdenacao() {
  const selectOrdenacao = document.getElementById("ordenar-por");
  if (!selectOrdenacao) return;

  const ordenacao = selectOrdenacao.value;

  filteredServices.sort((a, b) => {
    switch (ordenacao) {
      case "id_asc":
        return Number(a.id) - Number(b.id);

      case "id_desc":
        return Number(b.id) - Number(a.id);

      case "data_asc": {
        if (!a.data_conclusao && !b.data_conclusao) return 0;
        if (!a.data_conclusao) return 1;
        if (!b.data_conclusao) return -1;
        return new Date(a.data_conclusao) - new Date(b.data_conclusao);
      }

      case "data_desc":
      default: {
        if (!a.data_conclusao && !b.data_conclusao) return 0;
        if (!a.data_conclusao) return 1;
        if (!b.data_conclusao) return -1;
        return new Date(b.data_conclusao) - new Date(a.data_conclusao);
      }
    }
  });
}

function aplicarFiltros() {
  const elProcesso = document.getElementById("filtro-processo");
  const elStatus = document.getElementById("filtro-status");
  const elEquipe = document.getElementById("filtro-equipe");
  const elDesligamento = document.getElementById("filtro-desligamento");
  const elDataInicio = document.getElementById("filtro-data-inicio");
  const elDataFim = document.getElementById("filtro-data-fim");

  const filtroProcesso = (elProcesso?.value || "").toLowerCase().trim();
  const filtroStatus = elStatus?.value || "";
  const filtroEquipe = (elEquipe?.value || "").toLowerCase().trim();
  const filtroDesligamento = elDesligamento?.value || "";
  const filtroDataInicio = elDataInicio?.value || "";
  const filtroDataFim = elDataFim?.value || "";

  filteredServices = allServices.filter((service) => {
    const processo = String(service.processo || "").toLowerCase();
    const equipe = String(service.nomes_responsaveis || "").toLowerCase();

    const matchProcesso =
      !filtroProcesso ||
      String(service.id).includes(filtroProcesso) ||
      processo.includes(filtroProcesso);

    let matchStatus = true;
    if (filtroStatus) {
      if (filtroStatus === "andamento") {
        matchStatus =
          service.status === "ativo" || service.status === "em_progresso";
      } else {
        matchStatus = service.status === filtroStatus;
      }
    }

    const matchEquipe = !filtroEquipe || equipe.includes(filtroEquipe);

    let matchDesligamento = true;
    if (filtroDesligamento) {
      matchDesligamento =
        normalizeText(service.desligamento) ===
        normalizeText(filtroDesligamento);
    }

    let matchPeriodo = true;
    if (filtroDataInicio || filtroDataFim) {
      if (!service.data_conclusao) {
        matchPeriodo = false;
      } else {
        const dataISO = new Date(service.data_conclusao)
          .toISOString()
          .split("T")[0];

        if (filtroDataInicio && dataISO < filtroDataInicio) {
          matchPeriodo = false;
        }

        if (filtroDataFim && dataISO > filtroDataFim) {
          matchPeriodo = false;
        }
      }
    }

    return (
      matchProcesso &&
      matchStatus &&
      matchEquipe &&
      matchDesligamento &&
      matchPeriodo
    );
  });

  aplicarOrdenacao();
  currentPage = 1;
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById("tabela-servicos-construcao");
  if (!tbody) return;

  if (!filteredServices.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center py-4">
          <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
          <p class="text-muted mb-0">
            Nenhum serviço encontrado com os filtros aplicados.
          </p>
        </td>
      </tr>
    `;
    atualizarContador();
    atualizarPaginacao();
    return;
  }

  const totalPages = Math.ceil(filteredServices.length / itemsPerPage);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentServices = filteredServices.slice(startIndex, endIndex);

  tbody.innerHTML = "";

  currentServices.forEach((service) => {
    const row = document.createElement("tr");

    row.innerHTML = safeHtml`
      <td><strong>#${service.id}</strong></td>
      <td>${service.processo || "—"}</td>
      <td>${service.nomes_responsaveis || "Sem equipe"}</td>
      <td>${service.alimentador || "—"}</td>
      <td>${getDesligamentoLabel(service.desligamento)}</td>
      <td>${formatDate(service.created_at)}</td>
      <td>${formatDate(service.data_prevista_execucao)}</td>
      <td>${formatDate(service.data_conclusao)}</td>
      <td>${rawHtml(getStatusHtml(service))}</td>
      <td class="text-center">
        <a
          href="detalhes_servico?id=${service.id}"
          class="btn btn-sm btn-outline-primary me-1"
          title="Ver Detalhes"
        >
          <i class="fas fa-eye"></i>
        </a>
        <button
          class="btn btn-sm btn-outline-secondary"
          data-action="open-url" data-url="/api/servicos/${service.id}/consolidar-pdfs"
          title="Gerar Relatório PDF"
        >
          <i class="fas fa-file-pdf"></i>
        </button>
      </td>
    `;

    tbody.appendChild(row);
  });

  atualizarContador();
  atualizarPaginacao();
}

function atualizarContador() {
  const contador = document.getElementById("contador-servicos");
  if (!contador) return;

  const total = filteredServices.length;
  contador.textContent = `${total} serviço${total !== 1 ? "s" : ""}`;
}

function atualizarPaginacao() {
  const totalPages = Math.ceil(filteredServices.length / itemsPerPage);
  const infoPaginacao = document.getElementById("info-paginacao");

  if (infoPaginacao) {
    if (!totalPages) {
      infoPaginacao.textContent = "Nenhuma página";
    } else {
      const startItem = (currentPage - 1) * itemsPerPage + 1;
      const endItem = Math.min(
        currentPage * itemsPerPage,
        filteredServices.length,
      );
      infoPaginacao.textContent = `Mostrando ${startItem}-${endItem} de ${filteredServices.length} | Página ${currentPage} de ${totalPages}`;
    }
  }

  const btnPrimeira = document.getElementById("btn-primeira-pagina");
  const btnAnterior = document.getElementById("btn-pagina-anterior");
  const btnProxima = document.getElementById("btn-proxima-pagina");
  const btnUltima = document.getElementById("btn-ultima-pagina");

  if (btnPrimeira) btnPrimeira.disabled = currentPage === 1 || totalPages === 0;
  if (btnAnterior) btnAnterior.disabled = currentPage === 1 || totalPages === 0;
  if (btnProxima)
    btnProxima.disabled = currentPage === totalPages || totalPages === 0;
  if (btnUltima)
    btnUltima.disabled = currentPage === totalPages || totalPages === 0;
}

function irParaPrimeiraPagina() {
  currentPage = 1;
  renderTable();
}

function irParaPaginaAnterior() {
  if (currentPage > 1) {
    currentPage--;
    renderTable();
  }
}

function irParaProximaPagina() {
  const totalPages = Math.ceil(filteredServices.length / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderTable();
  }
}

function irParaUltimaPagina() {
  const totalPages = Math.ceil(filteredServices.length / itemsPerPage);
  if (totalPages > 0) {
    currentPage = totalPages;
    renderTable();
  }
}

async function carregarServicos() {
  const tbody = document.getElementById("tabela-servicos-construcao");

  try {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Carregando...</span>
            </div>
            <p class="mt-2 text-muted">Carregando serviços...</p>
          </td>
        </tr>
      `;
    }

    const origem = "Construção";
    const response = await fetch(
      `/api/servicos/origem/${encodeURIComponent(origem)}`,
    );

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data = await response.json();

    allServices = Array.isArray(data) ? data : [];
    filteredServices = [...allServices];

    popularFiltroEquipe();
    aplicarFiltros();
  } catch (error) {
    console.error("[FRONTEND] Erro ao carregar serviços:", error);

    if (tbody) {
      tbody.innerHTML = safeHtml`
        <tr>
          <td colspan="10" class="text-center py-4 text-danger">
            <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
            <p>Erro ao carregar serviços: ${error.message}</p>
            <button class="btn btn-sm btn-primary" data-action="carregarServicos">
              <i class="fas fa-redo me-1"></i>Tentar novamente
            </button>
          </td>
        </tr>
      `;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  fetch("/api/me", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((user) => {
      const P = window.ServicosPermissions || {};
      const podeAcompanhar = P.podeAcompanharConstrucao?.(user);
      if (!podeAcompanhar) {
        window.location.replace("/gestao-servicos");
      }
    })
    .catch(() => {});

  carregarServicos();

  const filtroProcesso = document.getElementById("filtro-processo");
  const filtroStatus = document.getElementById("filtro-status");
  const filtroEquipe = document.getElementById("filtro-equipe");
  const filtroDesligamento = document.getElementById("filtro-desligamento");
  const filtroDataInicio = document.getElementById("filtro-data-inicio");
  const filtroDataFim = document.getElementById("filtro-data-fim");
  const ordenarPor = document.getElementById("ordenar-por");
  const btnAtualizar = document.getElementById("btn-atualizar");

  if (filtroProcesso) {
    filtroProcesso.addEventListener("input", debounce(aplicarFiltros, 300));
  }

  if (filtroStatus) {
    filtroStatus.addEventListener("change", aplicarFiltros);
  }

  if (filtroEquipe) {
    filtroEquipe.addEventListener("change", aplicarFiltros);
  }

  if (filtroDesligamento) {
    filtroDesligamento.addEventListener("change", aplicarFiltros);
  }

  if (filtroDataInicio) {
    filtroDataInicio.addEventListener("change", aplicarFiltros);
  }

  if (filtroDataFim) {
    filtroDataFim.addEventListener("change", aplicarFiltros);
  }

  if (ordenarPor) {
    ordenarPor.addEventListener("change", aplicarFiltros);
  }

  if (btnAtualizar) {
    btnAtualizar.addEventListener("click", () => {
      btnAtualizar.disabled = true;
      btnAtualizar.innerHTML =
        '<i class="fas fa-spinner fa-spin me-2"></i>Atualizando...';

      carregarServicos().finally(() => {
        btnAtualizar.disabled = false;
        btnAtualizar.innerHTML =
          '<i class="fas fa-sync-alt me-2"></i>Atualizar';
      });
    });
  }

  const btnPrimeira = document.getElementById("btn-primeira-pagina");
  const btnAnterior = document.getElementById("btn-pagina-anterior");
  const btnProxima = document.getElementById("btn-proxima-pagina");
  const btnUltima = document.getElementById("btn-ultima-pagina");

  if (btnPrimeira) btnPrimeira.addEventListener("click", irParaPrimeiraPagina);
  if (btnAnterior) btnAnterior.addEventListener("click", irParaPaginaAnterior);
  if (btnProxima) btnProxima.addEventListener("click", irParaProximaPagina);
  if (btnUltima) btnUltima.addEventListener("click", irParaUltimaPagina);

  const userRaw = localStorage.getItem("user");
  if (userRaw) {
    try {
      const user = JSON.parse(userRaw);
      const linkConstrucao = document.getElementById("sidebar-construcao-link");
      const P = window.ServicosPermissions || {};

      if (linkConstrucao && P.podeAcompanharConstrucao?.(user)) {
        linkConstrucao.style.display = "block";
      }
    } catch (error) {
      console.warn("Erro ao interpretar usuário do localStorage:", error);
    }
  }
});
