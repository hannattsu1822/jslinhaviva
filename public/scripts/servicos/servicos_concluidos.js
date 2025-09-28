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

let servicosData = [];
let currentPage = 1;
const itemsPerPage = 10;
let user = null;
let accessDeniedModalInstance;
let developmentModalInstance;
let currentServicoId = null;
let aprUploadModalInstance;

const elementos = {
  toastEl: null,
  toastInstance: null,
  tabela: null,
  paginacao: null,
  contador: null,
  filtros: {
    idProcesso: null,
    subestacao: null,
    alimentador: null,
    data: null,
    status: null,
  },
};

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
    elementos.filtros.idProcesso = document.getElementById("filtroIdProcesso");
    elementos.filtros.subestacao = document.getElementById("filtroSubestacao");
    elementos.filtros.alimentador =
      document.getElementById("filtroAlimentador");
    elementos.filtros.data = document.getElementById("filtroData");
    elementos.filtros.status = document.getElementById("filtroStatus");

    if (!elementos.tabela)
      throw new Error("Elemento tabela-servicos não encontrado");
    if (!elementos.contador)
      throw new Error("Elemento contador-servicos não encontrado");

    if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
      const admEl = document.getElementById("access-denied-modal");
      if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);
      const devmEl = document.getElementById("development-modal");
      if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
      const aprUploadModalEl = document.getElementById("aprUploadModal");
      if (aprUploadModalEl)
        aprUploadModalInstance = new bootstrap.Modal(aprUploadModalEl);
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
    if (elementos.filtros.idProcesso) {
      elementos.filtros.idProcesso.addEventListener(
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
    if (elementos.filtros.status) {
      elementos.filtros.status.addEventListener(
        "change",
        aplicarFiltrosEAtualizar
      );
    }
    const btnConfirmarUploadAPR = document.getElementById(
      "btnConfirmarUploadAPR"
    );
    if (btnConfirmarUploadAPR) {
      btnConfirmarUploadAPR.addEventListener("click", submeterArquivoAPR);
    }
  } catch (error) {
    console.error("Erro ao configurar event listeners:", error);
  }
}

function aplicarFiltrosEAtualizar() {
  currentPage = 1;
  atualizarTabela();
}

function mostrarNotificacao(mensagem, tipo = "success", duracao = 3000) {
  try {
    if (!elementos.toastInstance || !elementos.toastEl) {
      alert(mensagem);
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

async function carregarServicosConcluidos() {
  try {
    mostrarNotificacao("Carregando serviços finalizados...", "info", 2000);
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
      "Erro ao carregar serviços finalizados: " + error.message,
      "danger"
    );
  }
}

function obterServicosFiltrados() {
  const filtroIdProcesso =
    elementos.filtros.idProcesso?.value.toLowerCase() || "";
  const filtroSubestacao =
    elementos.filtros.subestacao?.value.toLowerCase() || "";
  const filtroAlimentador =
    elementos.filtros.alimentador?.value.toLowerCase() || "";
  const filtroDataSelecionada = elementos.filtros.data?.value || "";
  const filtroStatus = elementos.filtros.status?.value || "";

  return servicosData.filter((servico) => {
    const id = servico.id?.toString().toLowerCase() || "";
    const processo = servico.processo?.toString().toLowerCase() || "";
    const subestacao = servico.subestacao?.toString().toLowerCase() || "";
    const alimentador = servico.alimentador?.toString().toLowerCase() || "";

    const matchesIdProcesso =
      !filtroIdProcesso ||
      id.includes(filtroIdProcesso) ||
      processo.includes(filtroIdProcesso);
    const matchesStatus = !filtroStatus || servico.status === filtroStatus;

    let matchesData = true;
    if (filtroDataSelecionada) {
      let dateToCompare = null;
      if (servico.data_conclusao) {
        dateToCompare = servico.data_conclusao;
      }

      if (dateToCompare) {
        try {
          let dataObj;
          if (dateToCompare.includes("T")) {
            dataObj = new Date(dateToCompare);
          } else {
            const dataComT = dateToCompare.replace(" ", "T");
            dataObj = new Date(dataComT);
            if (isNaN(dataObj.getTime())) {
              dataObj = new Date(dateToCompare);
            }
          }

          if (!isNaN(dataObj.getTime())) {
            const formatter = new Intl.DateTimeFormat("en-CA", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              timeZone: "America/Sao_Paulo",
            });

            const parts = formatter.formatToParts(dataObj);
            let year, month, day;
            parts.forEach((part) => {
              if (part.type === "year") year = part.value;
              else if (part.type === "month") month = part.value;
              else if (part.type === "day") day = part.value;
            });
            const formattedDate = `${year}-${month}-${day}`;
            matchesData = formattedDate === filtroDataSelecionada;
          } else {
            matchesData = false;
          }
        } catch (e) {
          console.error(
            "Erro ao parsear ou formatar data para filtro:",
            dateToCompare,
            e
          );
          matchesData = false;
        }
      } else {
        matchesData = false;
      }
    }

    return (
      matchesIdProcesso &&
      subestacao.includes(filtroSubestacao) &&
      alimentador.includes(filtroAlimentador) &&
      matchesData &&
      matchesStatus
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
      elementos.tabela.innerHTML = `<tr><td colspan="10" class="text-center py-4"><span class="material-symbols-outlined me-2" style="vertical-align: bottom;">info</span>Nenhum serviço finalizado encontrado.</td></tr>`;
    } else {
      servicosPagina.forEach((servico) => {
        const tr = document.createElement("tr");
        if (servico.status === "nao_concluido") {
          tr.classList.add("nao-concluido-row");
        }

        let aprButtonHtml = "";
        if (servico.caminho_apr_anexo) {
          aprButtonHtml = `
            <div class="d-flex flex-column align-items-center">
                <a href="${
                  servico.caminho_apr_anexo
                }" target="_blank" class="btn btn-sm glass-btn btn-success mb-1 w-100" title="Ver APR: ${
            servico.nome_original_apr_anexo || ""
          }">
                    <span class="material-symbols-outlined">description</span> Ver
                </a>
                <button class="btn btn-sm glass-btn btn-warning w-100" onclick="abrirModalUploadAPR(${
                  servico.id
                })" title="Substituir APR">
                    <span class="material-symbols-outlined">upload_file</span> Subst.
                </button>
            </div>`;
        } else {
          aprButtonHtml = `
            <button class="btn btn-sm glass-btn btn-outline-primary w-100" onclick="abrirModalUploadAPR(${servico.id})" title="Anexar APR">
                <span class="material-symbols-outlined">attach_file</span> Anexar
            </button>`;
        }

        let statusHtml = "";
        if (servico.status === "concluido") {
          statusHtml = '<span class="badge bg-success">Concluído</span>';
        } else if (servico.status === "nao_concluido") {
          const motivo = servico.motivo || "Motivo não especificado.";
          statusHtml = `
            <span class="status-nao-concluido">Não Concluído</span>
            <small class="motivo-nao-concluido" title="${motivo}">${motivo}</small>
          `;
        } else {
          statusHtml = servico.status || "N/A";
        }

        let dataFinalizacaoDisplay = "N/A";
        if (servico.data_conclusao) {
          dataFinalizacaoDisplay = formatarData(servico.data_conclusao);
        }

        let reativarButtonHtml = "";
        if (user && user.nivel >= 5) {
          reativarButtonHtml = `<button class="btn btn-sm glass-btn btn-warning" onclick="reativarServico(${servico.id})" title="Retornar para Ativos"><span class="material-symbols-outlined">undo</span></button>`;
        }

        const detalhesUrl =
          servico.sistema_versao === "legado"
            ? `/detalhes_servico?id=${servico.id}`
            : `/detalhes_ordem_servico?id=${servico.id}`;

        tr.innerHTML = `
          <td>${servico.id || "N/A"}</td>
          <td>${servico.processo || "Não informado"}</td>
          <td>${servico.subestacao || "Não informado"}</td>
          <td>${servico.alimentador || "Não informado"}</td>
          <td>${statusHtml}</td>
          <td>${dataFinalizacaoDisplay}</td>
          <td>${
            (servico.responsavel_matricula
              ? servico.responsavel_matricula + " - "
              : "") +
            (servico.responsavel_nome || servico.responsavel || "Não informado")
          }</td>
          <td class="text-center table-actions apr-actions">${aprButtonHtml}</td>
          <td>${servico.ordem_obra || "N/A"}</td>
          <td class="text-center">
            <div class="btn-group" role="group">
              <a href="${detalhesUrl}" class="btn btn-sm glass-btn me-1" title="Visualizar"><span class="material-symbols-outlined">visibility</span></a>
              <button class="btn btn-sm glass-btn btn-success me-1" onclick="solicitarRelatorioCompleto(${
                servico.id
              })" title="Gerar Relatório Completo (PDF)"><span class="material-symbols-outlined">picture_as_pdf</span></button>
              ${reativarButtonHtml}
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

    let data;
    if (dataString.includes("T")) {
      data = new Date(dataString);
    } else {
      const dataComT = dataString.replace(" ", "T");
      data = new Date(dataComT);
      if (isNaN(data.getTime())) {
        data = new Date(dataString);
      }
    }

    if (isNaN(data.getTime())) {
      const parts = dataString.split(/[\s/:\-T]+/);
      if (parts.length >= 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        let hours = 0,
          minutes = 0,
          seconds = 0;

        if (parts.length >= 5) {
          hours = parseInt(parts[3], 10) || 0;
          minutes = parseInt(parts[4], 10) || 0;
        }
        if (parts.length >= 6) {
          seconds = parseInt(parts[5], 10) || 0;
        }

        const utcDate = new Date(
          Date.UTC(year, month, day, hours, minutes, seconds)
        );
        if (!isNaN(utcDate.getTime())) {
          return utcDate
            .toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Sao_Paulo",
            })
            .replace(",", "");
        }
      }
      console.warn("Data inválida recebida para formatação:", dataString);
      return "Data inválida";
    }

    return data
      .toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
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

window.solicitarRelatorioCompleto = function (servicoId) {
  mostrarNotificacao(
    "Gerando relatório completo... O download começará em breve.",
    "info",
    5000
  );
  window.location.href = `/api/servicos/${servicoId}/relatorio-completo`;
};

window.abrirModalUploadAPR = function (servicoId) {
  currentServicoId = servicoId;
  const aprServicoIdInput = document.getElementById("aprServicoId");
  const aprFileInput = document.getElementById("aprFile");
  const aprUploadProgress = document.getElementById("aprUploadProgress");
  const progressBar = aprUploadProgress
    ? aprUploadProgress.querySelector(".progress-bar")
    : null;

  if (aprServicoIdInput) aprServicoIdInput.value = servicoId;
  if (aprFileInput) aprFileInput.value = "";
  if (aprUploadProgress) aprUploadProgress.style.display = "none";
  if (progressBar) {
    progressBar.style.width = "0%";
    progressBar.textContent = "0%";
    progressBar.classList.remove("bg-success", "bg-danger");
  }

  if (aprUploadModalInstance) {
    aprUploadModalInstance.show();
  }
};

async function submeterArquivoAPR() {
  const aprFile = document.getElementById("aprFile").files[0];
  const servicoId = document.getElementById("aprServicoId").value;
  const aprUploadProgress = document.getElementById("aprUploadProgress");
  const progressBar = aprUploadProgress
    ? aprUploadProgress.querySelector(".progress-bar")
    : null;
  const btnConfirmarUploadAPR = document.getElementById(
    "btnConfirmarUploadAPR"
  );

  if (!aprFile) {
    mostrarNotificacao(
      "Por favor, selecione um arquivo para a APR.",
      "warning"
    );
    return;
  }
  if (aprFile.size > 10 * 1024 * 1024) {
    mostrarNotificacao("O arquivo excede o limite de 10MB.", "danger");
    return;
  }

  const formData = new FormData();
  formData.append("apr_file", aprFile);

  if (btnConfirmarUploadAPR) {
    btnConfirmarUploadAPR.disabled = true;
    btnConfirmarUploadAPR.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Enviando...';
  }
  if (aprUploadProgress) aprUploadProgress.style.display = "flex";
  if (progressBar) {
    progressBar.style.width = "0%";
    progressBar.textContent = "0%";
    progressBar.classList.remove("bg-success", "bg-danger");
  }

  let progressInterval;
  try {
    let progress = 0;
    if (progressBar) {
      progressInterval = setInterval(() => {
        progress += 20;
        progressBar.style.width = Math.min(progress, 100) + "%";
        progressBar.textContent = Math.min(progress, 100) + "%";
        if (progress >= 100) clearInterval(progressInterval);
      }, 150);
    }

    const response = await fetch(`/api/servicos/${servicoId}/upload-apr`, {
      method: "POST",
      body: formData,
    });

    if (progressInterval) clearInterval(progressInterval);

    if (!response.ok) {
      if (progressBar) progressBar.classList.add("bg-danger");
      const errorData = await response
        .json()
        .catch(() => ({ message: "Erro ao enviar APR." }));
      throw new Error(errorData.message);
    }

    if (progressBar) {
      progressBar.style.width = "100%";
      progressBar.textContent = "Concluído!";
      progressBar.classList.add("bg-success");
    }

    const result = await response.json();
    mostrarNotificacao(result.message || "APR enviada com sucesso!", "success");

    setTimeout(() => {
      if (aprUploadModalInstance) aprUploadModalInstance.hide();
      carregarServicosConcluidos();
    }, 1000);
  } catch (error) {
    if (progressInterval) clearInterval(progressInterval);
    if (progressBar) {
      progressBar.textContent = "Falha!";
      progressBar.classList.add("bg-danger");
    }
    mostrarNotificacao("Erro ao enviar APR: " + error.message, "danger");
    if (aprUploadProgress) aprUploadProgress.style.display = "none";
  } finally {
    if (btnConfirmarUploadAPR) {
      btnConfirmarUploadAPR.disabled = false;
      btnConfirmarUploadAPR.innerHTML = "Enviar APR";
    }
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
