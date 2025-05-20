/**
 * Script principal da página de Serviços Concluídos
 * Contém toda a lógica de carregamento, filtragem e exibição dos serviços
 */

// Objeto para armazenar elementos do DOM
const elementos = {
  toast: null,
  tabela: null,
  paginacao: null,
  contador: null,
  filtros: {
    processo: null,
    subestacao: null,
    alimentador: null,
    data: null,
  },
};

// Variáveis de estado
let servicosData = [];
let currentPage = 1;
const itemsPerPage = 10;

// Inicialização - Executa quando o DOM estiver carregado
document.addEventListener("DOMContentLoaded", function () {
  inicializarElementos();
  configurarEventListeners();
  carregarServicosConcluidos();
});

/**
 * Inicializa todos os elementos do DOM
 */
function inicializarElementos() {
  try {
    // Elementos principais
    elementos.toast = new bootstrap.Toast(document.getElementById("liveToast"));
    elementos.tabela = document.getElementById("tabela-servicos");
    elementos.paginacao = document.getElementById("paginacao");
    elementos.contador = document.getElementById("contador-servicos");

    // Elementos de filtro
    elementos.filtros.processo = document.getElementById("filtroProcesso");
    elementos.filtros.subestacao = document.getElementById("filtroSubestacao");
    elementos.filtros.alimentador =
      document.getElementById("filtroAlimentador");
    elementos.filtros.data = document.getElementById("filtroData");

    if (!elementos.tabela)
      throw new Error("Elemento tabela-servicos não encontrado");
    if (!elementos.contador)
      throw new Error("Elemento contador-servicos não encontrado");
  } catch (error) {
    console.error("Erro na inicialização dos elementos:", error);
    mostrarNotificacao(
      "Erro ao inicializar a página. Recarregue e tente novamente.",
      "danger"
    );
  }
}

/**
 * Configura os event listeners para os filtros
 */
function configurarEventListeners() {
  try {
    if (elementos.filtros.processo) {
      elementos.filtros.processo.addEventListener(
        "input",
        debounce(aplicarFiltrosEAtualizar, 300)
      );
    }
    if (elementos.filtros.subestacao) {
      elementos.filtros.subestacao.addEventListener(
        "input",
        debounce(aplicarFiltrosEAtualizar, 300)
      );
    }
    if (elementos.filtros.alimentador) {
      elementos.filtros.alimentador.addEventListener(
        "input",
        debounce(aplicarFiltrosEAtualizar, 300)
      );
    }
    if (elementos.filtros.data) {
      elementos.filtros.data.addEventListener(
        "change",
        aplicarFiltrosEAtualizar
      );
    }
  } catch (error) {
    console.error("Erro ao configurar event listeners:", error);
  }
}

/**
 * Função wrapper para aplicar filtros e resetar a página para 1 antes de atualizar a tabela.
 */
function aplicarFiltrosEAtualizar() {
  currentPage = 1; // Reseta para a primeira página ao aplicar filtros
  atualizarTabela();
}

/**
 * Debounce para melhorar performance dos filtros
 * @param {Function} func - Função a ser executada
 * @param {number} wait - Tempo de espera em ms
 */
function debounce(func, wait) {
  let timeout;
  return function () {
    const context = this,
      args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

/**
 * Carrega os serviços concluídos da API
 */
async function carregarServicosConcluidos() {
  try {
    mostrarNotificacao("Carregando serviços concluídos...", "info");

    const response = await fetch("/api/servicos?status=concluido");

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Formato de dados inválido - esperado array");
    }

    servicosData = data;
    currentPage = 1; // Resetar para a primeira página ao carregar novos dados
    atualizarTabela(); // Isso também chamará atualizarPaginacao

    mostrarNotificacao("Serviços carregados com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao carregar serviços:", error);
    mostrarNotificacao(
      "Erro ao carregar serviços concluídos: " + error.message,
      "danger"
    );
  }
}

/**
 * Mostra uma notificação toast
 * @param {string} mensagem - Mensagem a ser exibida
 * @param {string} tipo - Tipo de notificação (success, danger, info, warning)
 */
function mostrarNotificacao(mensagem, tipo = "success") {
  try {
    if (!elementos.toast) return;

    const toastBody = document.querySelector("#liveToast .toast-body"); // Mais específico
    const toastElement = document.getElementById("liveToast");
    const toastHeader = document.querySelector("#liveToast .toast-header");

    if (toastBody && toastElement && toastHeader) {
      toastBody.textContent = mensagem;

      toastElement.className = "toast"; // Reset classes
      toastHeader.className = "toast-header"; // Reset classes do header

      toastElement.classList.add("bg-" + tipo);
      if (tipo === "success" || tipo === "danger" || tipo === "info") {
        toastElement.classList.add("text-white");
        toastHeader.classList.add("text-white"); // Garante que o texto do header seja branco
        // Adiciona um leve escurecimento no header para fundos coloridos
        toastHeader.style.backgroundColor = "rgba(0,0,0,0.1)";
      } else {
        // para warning ou outros
        toastElement.classList.remove("text-white");
        toastHeader.classList.remove("text-white");
        toastHeader.style.backgroundColor = ""; // Reseta o background do header
      }

      elementos.toast.show();
    }
  } catch (error) {
    console.error("Erro ao mostrar notificação:", error);
  }
}

/**
 * Helper function para obter os dados filtrados (evita duplicação)
 */
function obterServicosFiltrados() {
  const filtroProcesso = elementos.filtros.processo?.value.toLowerCase() || "";
  const filtroSubestacao =
    elementos.filtros.subestacao?.value.toLowerCase() || "";
  const filtroAlimentador =
    elementos.filtros.alimentador?.value.toLowerCase() || "";
  const filtroData = elementos.filtros.data?.value || "";

  return servicosData.filter((servico) => {
    const processo = servico.processo?.toString().toLowerCase() || ""; // Garante que é string
    const subestacao = servico.subestacao?.toString().toLowerCase() || "";
    const alimentador = servico.alimentador?.toString().toLowerCase() || "";
    const dataConclusao = servico.data_conclusao || "";

    return (
      processo.includes(filtroProcesso) &&
      subestacao.includes(filtroSubestacao) &&
      alimentador.includes(filtroAlimentador) &&
      (filtroData === "" ||
        (dataConclusao && dataConclusao.startsWith(filtroData)))
    );
  });
}

/**
 * Atualiza a tabela com os dados filtrados e paginados
 */
function atualizarTabela() {
  try {
    if (!elementos.tabela || !elementos.contador) return;

    elementos.tabela.innerHTML = "";

    const servicosFiltrados = obterServicosFiltrados();

    elementos.contador.textContent = `${servicosFiltrados.length} ${
      servicosFiltrados.length === 1 ? "serviço" : "serviços"
    }`;

    const totalPages = Math.ceil(servicosFiltrados.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
      currentPage = totalPages;
    } else if (totalPages === 0) {
      currentPage = 1;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const servicosPagina = servicosFiltrados.slice(startIndex, endIndex);

    if (servicosPagina.length === 0) {
      elementos.tabela.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <i class="fas fa-info-circle me-2"></i>Nenhum serviço concluído encontrado com os filtros aplicados.
                    </td>
                </tr>
            `;
    } else {
      servicosPagina.forEach((servico) => {
        const tr = document.createElement("tr");
        // tr.className = 'glass-table-row'; // Se existir essa classe no CSS
        tr.innerHTML = `
                    <td>${servico.id || "N/A"}</td>
                    <td>${servico.processo || "Não informado"}</td>
                    <td>${servico.subestacao || "Não informado"}</td>
                    <td>${servico.alimentador || "Não informado"}</td>
                    <td>${formatarData(servico.data_conclusao)}</td>
                    <td>${servico.responsavel || "Não informado"}</td>
                    <td class="text-center">
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm glass-btn me-1" onclick="window.location.href='/detalhes_servico?id=${
                              servico.id
                            }'" title="Visualizar">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-sm glass-btn btn-warning" onclick="reativarServico(${
                              servico.id
                            })" title="Retornar para Ativos">
                                <i class="fas fa-undo"></i>
                            </button>
                        </div>
                    </td>
                `;
        elementos.tabela.appendChild(tr);
      });
    }

    atualizarPaginacao();
  } catch (error) {
    console.error("Erro ao atualizar tabela:", error);
    mostrarNotificacao("Erro ao atualizar tabela de serviços", "danger");
  }
}

/**
 * Atualiza a paginação baseada nos dados filtrados
 */
function atualizarPaginacao() {
  try {
    if (!elementos.paginacao) return;

    elementos.paginacao.innerHTML = "";
    const servicosFiltrados = obterServicosFiltrados();
    const totalPages = Math.ceil(servicosFiltrados.length / itemsPerPage);

    if (totalPages <= 1) {
      return;
    }

    const maxPagesToShow = 5;
    let startPage, endPage;

    if (totalPages <= maxPagesToShow) {
      startPage = 1;
      endPage = totalPages;
    } else {
      const maxPagesBeforeCurrent = Math.floor(maxPagesToShow / 2);
      const maxPagesAfterCurrent = Math.ceil(maxPagesToShow / 2) - 1;
      if (currentPage <= maxPagesBeforeCurrent) {
        startPage = 1;
        endPage = maxPagesToShow;
      } else if (currentPage + maxPagesAfterCurrent >= totalPages) {
        startPage = totalPages - maxPagesToShow + 1;
        endPage = totalPages;
      } else {
        startPage = currentPage - maxPagesBeforeCurrent;
        endPage = currentPage + maxPagesAfterCurrent;
      }
    }

    const liPrev = document.createElement("li");
    liPrev.className = `page-item ${currentPage === 1 ? "disabled" : ""}`;
    liPrev.innerHTML = `<a class="page-link glass-btn" href="#" onclick="event.preventDefault(); mudarPagina(${
      currentPage - 1
    })">Anterior</a>`;
    elementos.paginacao.appendChild(liPrev);

    if (startPage > 1) {
      const liFirst = document.createElement("li");
      liFirst.className = "page-item";
      liFirst.innerHTML = `<a class="page-link glass-btn" href="#" onclick="event.preventDefault(); mudarPagina(1)">1</a>`;
      elementos.paginacao.appendChild(liFirst);
      if (startPage > 2) {
        const liEllipsisStart = document.createElement("li");
        liEllipsisStart.className = "page-item disabled";
        liEllipsisStart.innerHTML = `<span class="page-link glass-btn">...</span>`;
        elementos.paginacao.appendChild(liEllipsisStart);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      const li = document.createElement("li");
      li.className = `page-item ${i === currentPage ? "active" : ""}`;
      li.innerHTML = `<a class="page-link glass-btn" href="#" onclick="event.preventDefault(); mudarPagina(${i})">${i}</a>`;
      elementos.paginacao.appendChild(li);
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        const liEllipsisEnd = document.createElement("li");
        liEllipsisEnd.className = "page-item disabled";
        liEllipsisEnd.innerHTML = `<span class="page-link glass-btn">...</span>`;
        elementos.paginacao.appendChild(liEllipsisEnd);
      }
      const liLast = document.createElement("li");
      liLast.className = "page-item";
      liLast.innerHTML = `<a class="page-link glass-btn" href="#" onclick="event.preventDefault(); mudarPagina(${totalPages})">${totalPages}</a>`;
      elementos.paginacao.appendChild(liLast);
    }

    const liNext = document.createElement("li");
    liNext.className = `page-item ${
      currentPage === totalPages ? "disabled" : ""
    }`;
    liNext.innerHTML = `<a class="page-link glass-btn" href="#" onclick="event.preventDefault(); mudarPagina(${
      currentPage + 1
    })">Próximo</a>`;
    elementos.paginacao.appendChild(liNext);
  } catch (error) {
    console.error("Erro ao atualizar paginação:", error);
  }
}

/**
 * Muda para uma página específica
 * @param {number} page - Número da página
 */
function mudarPagina(page) {
  try {
    const servicosFiltrados = obterServicosFiltrados(); // Pega os filtrados para calcular totalPages
    const totalPages = Math.ceil(servicosFiltrados.length / itemsPerPage);

    let targetPage = page;
    if (targetPage < 1 && totalPages > 0) targetPage = 1;
    if (targetPage > totalPages && totalPages > 0) targetPage = totalPages;
    if (totalPages === 0) targetPage = 1;

    if (
      currentPage !== targetPage ||
      (targetPage === 1 && servicosFiltrados.length <= itemsPerPage)
    ) {
      if (
        currentPage === targetPage &&
        servicosFiltrados.length > itemsPerPage &&
        totalPages > 1
      ) {
        // Se já está na página e há mais de uma página, não faz nada para evitar recarga desnecessária
        // A menos que seja a única página possível
      } else {
        currentPage = targetPage;
        atualizarTabela();
        // Rolar para o topo da tabela ou um pouco acima
        const tableElement = document.querySelector(".table-responsive");
        if (tableElement) {
          window.scrollTo({
            top: tableElement.offsetTop - 20,
            behavior: "smooth",
          });
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    }
  } catch (error) {
    console.error("Erro ao mudar página:", error);
  }
}

/**
 * Formata uma data para o formato brasileiro
 * @param {string} dataString - Data no formato ISO
 * @returns {string} Data formatada
 */
function formatarData(dataString) {
  try {
    if (!dataString) return "Não informado";

    const data = new Date(dataString);
    if (isNaN(data.getTime())) {
      // Verifica se a data é válida
      // Tenta tratar caso a data já venha num formato pt-BR dd/mm/yyyy hh:mm:ss
      const parts = dataString.split(/[\s/:]+/);
      if (parts.length >= 5) {
        // dd, mm, yyyy, hh, mm
        // new Date(year, monthIndex, day, hours, minutes, seconds)
        const testDate = new Date(
          parts[2],
          parts[1] - 1,
          parts[0],
          parts[3],
          parts[4],
          parts[5] || 0
        );
        if (!isNaN(testDate.getTime())) return dataString; // Se já está formatado, retorna como está
      }
      return "Data inválida";
    }

    return data.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    console.error("Erro ao formatar data:", dataString, error);
    return "Erro ao formatar";
  }
}

/**
 * Reativa um serviço (retorna para ativos)
 * @param {number} id - ID do serviço
 */
async function reativarServico(id) {
  try {
    if (!confirm("Deseja realmente retornar este serviço para ativos?")) {
      return;
    }

    mostrarNotificacao("Reativando serviço...", "info");

    const response = await fetch(`/api/servicos/${id}/reativar`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        `Erro HTTP: ${response.status} - ${
          errorData ? errorData.message : "Erro desconhecido"
        }`
      );
    }

    mostrarNotificacao("Serviço retornado para ativos com sucesso!", "success");
    await carregarServicosConcluidos(); // Recarrega todos os dados
  } catch (error) {
    console.error("Erro ao reativar serviço:", error);
    mostrarNotificacao("Erro ao reativar serviço: " + error.message, "danger");
  }
}

// Exponha funções que são chamadas diretamente do HTML
window.reativarServico = reativarServico;
window.mudarPagina = mudarPagina;
