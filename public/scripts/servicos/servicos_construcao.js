// public/scripts/servicos/servicos_construcao.js

let allServices = [];
let filteredServices = [];

// Função utilitária para evitar chamadas excessivas à API durante a digitação
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

// Formata a data para o padrão brasileiro
function formatData(dateString) {
  if (!dateString) {
    return "—";
  }
  const data = new Date(dateString);
  return data.toLocaleDateString("pt-BR", {
    timeZone: "UTC", // Garante que a data não mude por causa do fuso horário
  });
}

// Gera o HTML para a coluna de Status/Motivo
function getStatusHtml(service) {
  switch (service.status) {
    case "concluido":
      return '<span class="status-concluido">Concluído</span>';
    case "nao_concluido":
      const motivo = service.motivo_nao_conclusao || "Motivo não especificado.";
      return `<span class="status-nao-concluido">Não Concluído</span>
              <small class="motivo-nao-concluido" title="${motivo}">${motivo}</small>`;
    case "ativo":
    case "em_progresso":
    default:
      return '<span class="status-andamento">Em Andamento</span>';
  }
}

// Renderiza a tabela com os dados filtrados
function renderTable() {
  const tbody = document.getElementById("tabela-servicos-construcao");
  if (!tbody) return;

  if (filteredServices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4">Nenhum serviço encontrado com os filtros aplicados.</td></tr>`;
    return;
  }

  const rowsHtml = filteredServices
    .map((service) => {
      const statusHtml = getStatusHtml(service);
      const dataFinalizacao = formatData(service.data_conclusao);

      return `
      <tr>
        <td>${service.id}</td>
        <td>${service.processo || "N/A"}</td>
        <td>${service.nomes_responsaveis || "Não atribuída"}</td>
        <td>${service.alimentador || "N/A"}</td>
        <td>${statusHtml}</td>
        <td>${dataFinalizacao}</td>
        <td class="text-center">
          <button 
            class="btn btn-sm btn-outline-info me-1" 
            onclick="navigateTo('/detalhes_servico?id=${service.id}')" 
            title="Ver Detalhes">
            <i class="fas fa-eye"></i>
          </button>
          <button 
            class="btn btn-sm btn-outline-secondary" 
            onclick="window.open('/api/servicos/${
              service.id
            }/consolidar-pdfs', '_blank')" 
            title="Gerar Relatório PDF">
            <i class="fas fa-file-pdf"></i>
          </button>
        </td>
      </tr>
    `;
    })
    .join("");

  tbody.innerHTML = rowsHtml;
}

// Aplica os filtros e chama a renderização da tabela
function applyFilters() {
  const processoFiltro = document
    .getElementById("filtro-processo")
    .value.toLowerCase();
  const statusFiltro = document.getElementById("filtro-status").value;
  const dataFiltro = document.getElementById("filtro-data").value;

  filteredServices = allServices.filter((service) => {
    const processoMatch =
      !processoFiltro ||
      service.processo.toLowerCase().includes(processoFiltro) ||
      String(service.id).includes(processoFiltro);

    let statusMatch = true;
    if (statusFiltro) {
      if (statusFiltro === "andamento") {
        statusMatch =
          service.status === "ativo" || service.status === "em_progresso";
      } else {
        statusMatch = service.status === statusFiltro;
      }
    }

    const dataMatch =
      !dataFiltro ||
      (service.data_conclusao && service.data_conclusao.startsWith(dataFiltro));

    return processoMatch && statusMatch && dataMatch;
  });

  renderTable();
}

// Busca os dados dos serviços da API
async function fetchConstructionServices() {
  const tbody = document.getElementById("tabela-servicos-construcao");
  tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Carregando...</span></div> Carregando serviços...</td></tr>`;

  try {
    const response = await fetch("/api/servicos/origem/Construcao");
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message || `Erro na requisição: ${response.status}`
      );
    }
    allServices = await response.json();
    applyFilters();
  } catch (error) {
    console.error("Erro ao buscar serviços de construção:", error);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-danger">Falha ao carregar os serviços. Por favor, tente atualizar a página.</td></tr>`;
  }
}

// Função de navegação padrão
window.navigateTo = async function (pageNameOrUrl) {
  let urlToNavigate = pageNameOrUrl.startsWith("/")
    ? pageNameOrUrl
    : `/${pageNameOrUrl}`;
  try {
    const response = await fetch(urlToNavigate);
    if (response.ok) {
      window.location.href = urlToNavigate;
    } else if (response.status === 403) {
      const modal = new bootstrap.Modal(
        document.getElementById("access-denied-modal")
      );
      modal.show();
    } else {
      const modal = new bootstrap.Modal(
        document.getElementById("development-modal")
      );
      modal.show();
    }
  } catch (error) {
    const modal = new bootstrap.Modal(
      document.getElementById("development-modal")
    );
    modal.show();
  }
};

// Ponto de entrada do script
document.addEventListener("DOMContentLoaded", () => {
  const filtroProcesso = document.getElementById("filtro-processo");
  const filtroStatus = document.getElementById("filtro-status");
  const filtroData = document.getElementById("filtro-data");
  const btnAtualizar = document.getElementById("btn-atualizar");

  const debouncedFilter = debounce(applyFilters, 300);

  filtroProcesso.addEventListener("input", debouncedFilter);
  filtroStatus.addEventListener("change", applyFilters);
  filtroData.addEventListener("change", applyFilters);
  btnAtualizar.addEventListener("click", fetchConstructionServices);

  fetchConstructionServices();
});
