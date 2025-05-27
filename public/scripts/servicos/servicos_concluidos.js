const elementos = {
  toastEl: null,
  toastInstance: null,
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

let servicosData = [];
let currentPage = 1;
const itemsPerPage = 10;
let user = null;
let accessDeniedModalInstance;
let developmentModalInstance;

function inicializarElementos() {
  try {
    elementos.toastEl = document.getElementById("liveToast");
    if (
      elementos.toastEl &&
      typeof bootstrap !== "undefined" &&
      bootstrap.Toast
    ) {
      elementos.toastInstance = new bootstrap.Toast(elementos.toastEl);
    }
    elementos.tabela = document.getElementById("tabela-servicos");
    elementos.paginacao = document.getElementById("paginacao");
    elementos.contador = document.getElementById("contador-servicos");
    elementos.filtros.processo = document.getElementById("filtroProcesso");
    elementos.filtros.subestacao = document.getElementById("filtroSubestacao");
    elementos.filtros.alimentador =
      document.getElementById("filtroAlimentador");
    elementos.filtros.data = document.getElementById("filtroData");

    if (!elementos.tabela)
      throw new Error("Elemento tabela-servicos não encontrado");
    if (!elementos.contador)
      throw new Error("Elemento contador-servicos não encontrado");

    if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
      const admEl = document.getElementById("access-denied-modal");
      if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);
      const devmEl = document.getElementById("development-modal");
      if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
    }
  } catch (error) {
    console.error("Erro na inicialização dos elementos:", error);
    mostrarNotificacao(
      "Erro ao inicializar a página. Recarregue e tente novamente.",
      "danger"
    );
  }
}

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

function aplicarFiltrosEAtualizar() {
  currentPage = 1;
  atualizarTabela();
}

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

async function carregarServicosConcluidos() {
  try {
    mostrarNotificacao("Carregando serviços concluídos...", "info", 2000);
    const response = await fetch("/api/servicos?status=concluido");
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data))
      throw new Error("Formato de dados inválido - esperado array");
    servicosData = data;
    currentPage = 1;
    atualizarTabela();
    mostrarNotificacao("Serviços carregados com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao carregar serviços:", error);
    mostrarNotificacao(
      "Erro ao carregar serviços concluídos: " + error.message,
      "danger"
    );
  }
}

function mostrarNotificacao(mensagem, tipo = "success", duracao = 3000) {
  try {
    if (!elementos.toastInstance || !elementos.toastEl) {
      return;
    }
    const toastBody = elementos.toastEl.querySelector(".toast-body");
    const toastHeader = elementos.toastEl.querySelector(".toast-header");

    if (toastBody && elementos.toastEl && toastHeader) {
      toastBody.textContent = mensagem;
      elementos.toastEl.className = "toast align-items-center";
      toastHeader.className = "toast-header";
      elementos.toastEl.classList.add("text-bg-" + tipo, "border-0");
      if (tipo === "success" || tipo === "danger" || tipo === "info") {
        toastHeader.classList.add("text-white");
        toastHeader.style.backgroundColor = "rgba(0,0,0,0.1)";
      } else {
        toastHeader.classList.remove("text-white");
        toastHeader.style.backgroundColor = "";
      }
      elementos.toastInstance.show();
      if (tipo !== "danger" && duracao > 0) {
        setTimeout(() => {
          if (elementos.toastInstance) elementos.toastInstance.hide();
        }, duracao);
      }
    }
  } catch (error) {
    console.error("Erro ao mostrar notificação:", error);
  }
}

function obterServicosFiltrados() {
  const filtroProcesso = elementos.filtros.processo?.value.toLowerCase() || "";
  const filtroSubestacao =
    elementos.filtros.subestacao?.value.toLowerCase() || "";
  const filtroAlimentador =
    elementos.filtros.alimentador?.value.toLowerCase() || "";
  const filtroData = elementos.filtros.data?.value || "";

  return servicosData.filter((servico) => {
    const processo = servico.processo?.toString().toLowerCase() || "";
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

function atualizarTabela() {
  try {
    if (!elementos.tabela || !elementos.contador) return;
    elementos.tabela.innerHTML = "";
    const servicosFiltrados = obterServicosFiltrados();
    elementos.contador.textContent = `${servicosFiltrados.length} ${
      servicosFiltrados.length === 1 ? "serviço" : "serviços"
    }`;
    const totalPages = Math.ceil(servicosFiltrados.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    else if (totalPages === 0) currentPage = 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const servicosPagina = servicosFiltrados.slice(startIndex, endIndex);
    if (servicosPagina.length === 0) {
      elementos.tabela.innerHTML = `<tr><td colspan="7" class="text-center py-4"><span class="material-symbols-outlined me-2" style="vertical-align: bottom;">info</span>Nenhum serviço concluído encontrado.</td></tr>`;
    } else {
      servicosPagina.forEach((servico) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${servico.id || "N/A"}</td>
          <td>${servico.processo || "Não informado"}</td>
          <td>${servico.subestacao || "Não informado"}</td>
          <td>${servico.alimentador || "Não informado"}</td>
          <td>${formatarData(servico.data_conclusao)}</td>
          <td>${
            (servico.responsavel_matricula
              ? servico.responsavel_matricula + " - "
              : "") +
            (servico.responsavel_nome || servico.responsavel || "Não informado")
          }</td>
          <td class="text-center">
            <div class="btn-group" role="group">
              <button class="btn btn-sm glass-btn me-1" onclick="window.navigateTo('/detalhes_servico?id=${
                servico.id
              }')" title="Visualizar"><span class="material-symbols-outlined">visibility</span></button>
              <button class="btn btn-sm glass-btn btn-info me-1" onclick="solicitarConsolidacaoPDFs(${
                servico.id
              })" title="Consolidar PDFs Anexos"><span class="material-symbols-outlined">merge_type</span></button>
              <button class="btn btn-sm glass-btn btn-warning" onclick="reativarServico(${
                servico.id
              })" title="Retornar para Ativos"><span class="material-symbols-outlined">undo</span></button>
            </div>
          </td>`;
        elementos.tabela.appendChild(tr);
      });
    }
    atualizarPaginacao();
  } catch (error) {
    console.error("Erro ao atualizar tabela:", error);
    mostrarNotificacao("Erro ao atualizar tabela de serviços", "danger");
  }
}

function atualizarPaginacao() {
  try {
    if (!elementos.paginacao) return;
    elementos.paginacao.innerHTML = "";
    const servicosFiltrados = obterServicosFiltrados();
    const totalPages = Math.ceil(servicosFiltrados.length / itemsPerPage);
    if (totalPages <= 1) return;
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

window.mudarPagina = function (page) {
  try {
    const servicosFiltrados = obterServicosFiltrados();
    const totalPages = Math.ceil(servicosFiltrados.length / itemsPerPage);
    let targetPage = parseInt(page, 10);
    if (isNaN(targetPage)) return;

    if (targetPage < 1 && totalPages > 0) targetPage = 1;
    if (targetPage > totalPages && totalPages > 0) targetPage = totalPages;
    if (totalPages === 0) targetPage = 1;

    if (currentPage !== targetPage || (targetPage === 1 && totalPages > 0)) {
      currentPage = targetPage;
      atualizarTabela();
      const tableElement = document.querySelector(".table-responsive");
      if (tableElement) {
        window.scrollTo({
          top: tableElement.offsetTop - 70,
          behavior: "smooth",
        });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  } catch (error) {
    console.error("Erro ao mudar página:", error);
  }
};

function formatarData(dataString) {
  try {
    if (!dataString) return "Não informado";
    const data = new Date(dataString);
    if (isNaN(data.getTime())) {
      const parts = dataString.split(/[\s/:\-T]+/);
      if (parts.length >= 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        let hours = 0,
          minutes = 0;
        if (parts.length >= 5) {
          hours = parseInt(parts[3], 10);
          minutes = parseInt(parts[4], 10);
        }
        const testDate = new Date(Date.UTC(year, month, day, hours, minutes));
        if (!isNaN(testDate.getTime())) {
          return (
            testDate.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              timeZone: "UTC",
            }) +
            (parts.length >= 5
              ? " " +
                testDate.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "UTC",
                })
              : "")
          );
        }
      }
      return "Data inválida";
    }
    return data
      .toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      })
      .replace(",", "");
  } catch (error) {
    console.error("Erro ao formatar data:", dataString, error);
    return "Erro ao formatar";
  }
}

window.reativarServico = async function (id) {
  try {
    if (!confirm("Deseja realmente retornar este serviço para ativos?")) return;
    mostrarNotificacao("Reativando serviço...", "info");
    const response = await fetch(`/api/servicos/${id}/reativar`, {
      method: "PATCH",
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Erro HTTP: ${response.status} - ${
          errorData.message || "Erro desconhecido"
        }`
      );
    }
    mostrarNotificacao("Serviço retornado para ativos com sucesso!", "success");
    await carregarServicosConcluidos();
  } catch (error) {
    console.error("Erro ao reativar serviço:", error);
    mostrarNotificacao("Erro ao reativar serviço: " + error.message, "danger");
  }
};

window.solicitarConsolidacaoPDFs = function (servicoId) {
  mostrarNotificacao(
    "Processando consolidação de PDFs... Isso pode levar um momento.",
    "info",
    5000
  );
  const downloadUrl = `/api/servicos/${servicoId}/consolidar-pdfs`;

  const link = document.createElement("a");
  link.href = downloadUrl;
  link.setAttribute("download", "");
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

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
    const response = await fetch(urlToNavigate);
    if (response.ok) {
      window.location.href = urlToNavigate;
    } else if (response.status === 403) {
      if (accessDeniedModalInstance) accessDeniedModalInstance.show();
      else alert("Acesso negado!");
    } else if (response.status === 404) {
      if (developmentModalInstance) developmentModalInstance.show();
      else alert("Página não encontrada ou em desenvolvimento.");
    } else {
      const errorText = await response.text();
      console.error("Erro ao navegar:", response.status, errorText);
      if (developmentModalInstance) developmentModalInstance.show();
      else alert("Erro ao tentar acessar a página.");
    }
  } catch (error) {
    console.error("Erro de rede ou falha na navegação:", error);
    if (developmentModalInstance) developmentModalInstance.show();
    else alert("Erro de rede ou falha na navegação.");
  }
};

document.addEventListener("DOMContentLoaded", function () {
  user = JSON.parse(localStorage.getItem("user"));
  inicializarElementos();
  configurarEventListeners();
  carregarServicosConcluidos();
});
