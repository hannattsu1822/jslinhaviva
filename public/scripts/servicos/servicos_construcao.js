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

function formatData(dateString) {
  if (!dateString) {
    return "—";
  }
  const data = new Date(dateString);
  return data.toLocaleDateString("pt-BR", {
    timeZone: "UTC",
  });
}

function getStatusHtml(service) {
  switch (service.status) {
    case "concluido":
      return '<span class="status-concluido">Concluído</span>';
    case "nao_concluido":
      const motivo = service.motivo_nao_conclusao || "Motivo não especificado.";
      return `<span class="status-nao-concluido">Não Concluído</span><span class="motivo-nao-concluido">${motivo}</span>`;
    case "ativo":
    case "em_progresso":
    default:
      return '<span class="status-andamento">Em Andamento</span>';
  }
}

function aplicarOrdenacao() {
  const selectOrdenacao = document.getElementById("ordenar-por");
  
  if (!selectOrdenacao) {
    console.error("[ERRO] Elemento 'ordenar-por' não encontrado! Atualize o arquivo HTML.");
    return;
  }

  const ordenacao = selectOrdenacao.value;
  console.log(`[JS] Ordenando por: ${ordenacao}`);

  filteredServices.sort((a, b) => {
    switch (ordenacao) {
      case "id_asc":
        return a.id - b.id;
      case "id_desc":
        return b.id - a.id;
      case "data_asc":
        // Sem data vai para o final
        if (!a.data_conclusao && !b.data_conclusao) return 0;
        if (!a.data_conclusao) return 1;
        if (!b.data_conclusao) return -1;
        return new Date(a.data_conclusao) - new Date(b.data_conclusao);
      case "data_desc":
        // Sem data vai para o final
        if (!a.data_conclusao && !b.data_conclusao) return 0;
        if (!a.data_conclusao) return 1;
        if (!b.data_conclusao) return -1;
        return new Date(b.data_conclusao) - new Date(a.data_conclusao);
      default:
        return b.id - a.id;
    }
  });
}

function aplicarFiltros() {
  const elProcesso = document.getElementById("filtro-processo");
  const elStatus = document.getElementById("filtro-status");
  const elData = document.getElementById("filtro-data");

  const filtroProcesso = elProcesso ? elProcesso.value.toLowerCase() : "";
  const filtroStatus = elStatus ? elStatus.value : "";
  const filtroData = elData ? elData.value : "";

  filteredServices = allServices.filter((service) => {
    const matchProcesso =
      !filtroProcesso ||
      String(service.id).includes(filtroProcesso) ||
      (service.processo && service.processo.toLowerCase().includes(filtroProcesso));

    let matchStatus = true;
    if (filtroStatus) {
      if (filtroStatus === "andamento") {
        matchStatus = service.status === "ativo" || service.status === "em_progresso";
      } else {
        matchStatus = service.status === filtroStatus;
      }
    }

    let matchData = true;
    if (filtroData && service.data_conclusao) {
      const dataFormatada = new Date(service.data_conclusao).toISOString().split("T")[0];
      matchData = dataFormatada === filtroData;
    } else if (filtroData && !service.data_conclusao) {
      matchData = false;
    }

    return matchProcesso && matchStatus && matchData;
  });

  aplicarOrdenacao();
  currentPage = 1;
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById("tabela-servicos-construcao");
  if (!tbody) return;

  if (filteredServices.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-4">
          <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
          <p class="text-muted">Nenhum serviço encontrado com os filtros aplicados.</p>
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
  const servicosPagina = filteredServices.slice(startIndex, endIndex);

  tbody.innerHTML = "";

  servicosPagina.forEach((service) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>#${service.id}</strong></td>
      <td>${service.processo || "—"}</td>
      <td>${service.nomes_responsaveis || "Sem equipe"}</td>
      <td>${service.alimentador || "—"}</td>
      <td>${getStatusHtml(service)}</td>
      <td>${formatData(service.data_conclusao)}</td>
      <td class="text-center">
        <a href="/detalhes_servico?id=${service.id}" class="btn btn-sm btn-outline-primary" title="Ver Detalhes">
          <i class="fas fa-eye"></i>
        </a>
      </td>
    `;
    tbody.appendChild(row);
  });

  atualizarContador();
  atualizarPaginacao();
}

function atualizarContador() {
  const contador = document.getElementById("contador-servicos");
  if (contador) {
    const total = filteredServices.length;
    contador.textContent = `${total} serviço${total !== 1 ? 's' : ''}`;
  }
}

function atualizarPaginacao() {
  const totalPages = Math.ceil(filteredServices.length / itemsPerPage);
  const infoPaginacao = document.getElementById("info-paginacao");
  
  if (infoPaginacao) {
    if (totalPages === 0) {
      infoPaginacao.textContent = "Nenhuma página";
    } else {
      const startItem = (currentPage - 1) * itemsPerPage + 1;
      const endItem = Math.min(currentPage * itemsPerPage, filteredServices.length);
      infoPaginacao.textContent = `Mostrando ${startItem}-${endItem} de ${filteredServices.length} | Página ${currentPage} de ${totalPages}`;
    }
  }

  const btnPrimeira = document.getElementById("btn-primeira-pagina");
  const btnAnterior = document.getElementById("btn-pagina-anterior");
  const btnProxima = document.getElementById("btn-proxima-pagina");
  const btnUltima = document.getElementById("btn-ultima-pagina");

  if (btnPrimeira) btnPrimeira.disabled = currentPage === 1 || totalPages === 0;
  if (btnAnterior) btnAnterior.disabled = currentPage === 1 || totalPages === 0;
  if (btnProxima) btnProxima.disabled = currentPage === totalPages || totalPages === 0;
  if (btnUltima) btnUltima.disabled = currentPage === totalPages || totalPages === 0;
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
  try {
    const tbody = document.getElementById("tabela-servicos-construcao");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Carregando...</span>
            </div>
            <p class="mt-2 text-muted">Carregando serviços...</p>
          </td>
        </tr>
      `;
    }

    const origem = "Construção";
    const origemEncoded = encodeURIComponent(origem);
    const url = `/api/servicos/origem/${origemEncoded}`;
    
    console.log(`[FRONTEND] Buscando serviços: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[FRONTEND] Serviços carregados: ${data.length}`);
    
    allServices = data;
    filteredServices = [...allServices];
    
    aplicarFiltros();
  } catch (error) {
    console.error("[FRONTEND] Erro ao carregar serviços:", error);
    const tbody = document.getElementById("tabela-servicos-construcao");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4 text-danger">
            <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
            <p>Erro ao carregar serviços: ${error.message}</p>
            <button class="btn btn-sm btn-primary" onclick="carregarServicos()">
              <i class="fas fa-redo me-1"></i>Tentar Novamente
            </button>
          </td>
        </tr>
      `;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  carregarServicos();

  const filtroProcesso = document.getElementById("filtro-processo");
  const filtroStatus = document.getElementById("filtro-status");
  const filtroData = document.getElementById("filtro-data");
  const ordenarPor = document.getElementById("ordenar-por");
  const btnAtualizar = document.getElementById("btn-atualizar");
  const btnGerarRelatorio = document.getElementById("btn-gerar-relatorio");

  if (filtroProcesso) {
    filtroProcesso.addEventListener("input", debounce(aplicarFiltros, 300));
  }

  if (filtroStatus) {
    filtroStatus.addEventListener("change", aplicarFiltros);
  }

  if (filtroData) {
    filtroData.addEventListener("change", aplicarFiltros);
  }

  if (ordenarPor) {
    ordenarPor.addEventListener("change", () => {
      console.log("[EVENT] Mudança na ordenação detectada");
      aplicarFiltros();
    });
  }

  if (btnAtualizar) {
    btnAtualizar.addEventListener("click", () => {
      btnAtualizar.disabled = true;
      btnAtualizar.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Atualizando...';
      carregarServicos().finally(() => {
        btnAtualizar.disabled = false;
        btnAtualizar.innerHTML = '<i class="fas fa-sync-alt me-2"></i>Atualizar';
      });
    });
  }

  if (btnGerarRelatorio) {
    btnGerarRelatorio.addEventListener("click", () => {
      // Placeholder para futura implementação de relatório
      // Exemplo: abrir uma nova aba com PDF
      // window.open('/relatorios/construcao', '_blank');
      alert("Botão 'Gerar Relatório' clicado! Implemente a lógica aqui."); 
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

  const user = JSON.parse(localStorage.getItem("user"));
  if (user) {
    const linkConstrucao = document.getElementById("sidebar-construcao-link");
    const cargosPermitidos = ["Construção", "Engenheiro", "ADMIN", "ADM"];
    if (linkConstrucao && cargosPermitidos.includes(user.cargo)) {
      linkConstrucao.style.display = "block";
    }
  }
});

window.navigateTo = function (page) {
  window.location.href = `/${page}`;
};

window.logout = function () {
  localStorage.removeItem("user");
  window.location.href = "/login";
};
