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
    processo: null,
    subestacao: null,
    alimentador: null,
    data: null,
    status: null,
  },
  ordenarPor: null,
};

function inicializarElementos() {
  elementos.toastEl = document.getElementById("liveToast");
  if (elementos.toastEl)
    elementos.toastInstance = new bootstrap.Toast(elementos.toastEl);
  elementos.tabela = document.getElementById("tabela-servicos");
  elementos.paginacao = document.getElementById("paginacao");
  elementos.contador = document.getElementById("contador-servicos");
  elementos.filtros.processo = document.getElementById("filtroProcesso");
  elementos.filtros.subestacao = document.getElementById("filtroSubestacao");
  elementos.filtros.alimentador = document.getElementById("filtroAlimentador");
  elementos.filtros.data = document.getElementById("filtroData");
  elementos.filtros.status = document.getElementById("filtroStatus");
  elementos.ordenarPor = document.getElementById("ordenarPor");

  if (bootstrap.Modal) {
    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);
    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
    const aprUploadModalEl = document.getElementById("aprUploadModal");
    if (aprUploadModalEl)
      aprUploadModalInstance = new bootstrap.Modal(aprUploadModalEl);
  }
}

function configurarEventListeners() {
  Object.values(elementos.filtros).forEach((el) => {
    if (el)
      el.addEventListener("input", debounce(aplicarFiltrosEAtualizar, 300));
  });
  if (elementos.ordenarPor) {
    elementos.ordenarPor.addEventListener("change", aplicarFiltrosEAtualizar);
  }
  const btnConfirmarUploadAPR = document.getElementById(
    "btnConfirmarUploadAPR"
  );
  if (btnConfirmarUploadAPR)
    btnConfirmarUploadAPR.addEventListener("click", submeterArquivoAPR);
}

function aplicarFiltrosEAtualizar() {
  currentPage = 1;
  atualizarTabela();
}

function mostrarNotificacao(mensagem, tipo = "success") {
  if (!elementos.toastInstance) return;
  const toastBody = elementos.toastEl.querySelector(".toast-body");
  toastBody.textContent = mensagem;
  elementos.toastEl.className = `toast align-items-center text-bg-${tipo} border-0`;
  elementos.toastInstance.show();
}

async function carregarServicosConcluidos() {
  try {
    mostrarNotificacao("Carregando serviços...", "info");
    const response = await fetch("/api/servicos?status=concluido");
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    servicosData = await response.json();
    currentPage = 1;
    atualizarTabela();
    mostrarNotificacao("Serviços carregados!", "success");
  } catch (error) {
    mostrarNotificacao("Erro ao carregar serviços: " + error.message, "danger");
  }
}

function obterServicosFiltrados() {
  const filtroTermo = elementos.filtros.processo?.value.toLowerCase() || "";
  const filtroSubestacao =
    elementos.filtros.subestacao?.value.toLowerCase() || "";
  const filtroAlimentador =
    elementos.filtros.alimentador?.value.toLowerCase() || "";
  const filtroData = elementos.filtros.data?.value || "";
  const filtroStatus = elementos.filtros.status?.value || "";

  return servicosData.filter((servico) => {
    // *** ALTERAÇÃO AQUI ***
    // Converte a data de conclusão para o formato YYYY-MM-DD no fuso horário local do navegador
    let dataConclusaoLocal = "";
    if (servico.data_conclusao) {
      const data = new Date(servico.data_conclusao);
      const ano = data.getFullYear();
      const mes = String(data.getMonth() + 1).padStart(2, "0");
      const dia = String(data.getDate()).padStart(2, "0");
      dataConclusaoLocal = `${ano}-${mes}-${dia}`;
    }
    // *** FIM DA ALTERAÇÃO ***

    const termoMatch =
      !filtroTermo ||
      String(servico.id).includes(filtroTermo) ||
      (servico.processo &&
        String(servico.processo).toLowerCase().includes(filtroTermo));

    return (
      termoMatch &&
      (servico.subestacao || "").toLowerCase().includes(filtroSubestacao) &&
      (servico.alimentador || "").toLowerCase().includes(filtroAlimentador) &&
      (!filtroData || dataConclusaoLocal === filtroData) && // Usa a data local para comparar
      (!filtroStatus || servico.status === filtroStatus)
    );
  });
}

function atualizarTabela() {
  if (!elementos.tabela || !elementos.contador) return;
  elementos.tabela.innerHTML = "";
  let servicosFiltrados = obterServicosFiltrados();
  elementos.contador.textContent = `${servicosFiltrados.length} serviço(s)`;

  const ordenarPorValor = elementos.ordenarPor.value;
  servicosFiltrados.sort((a, b) => {
    switch (ordenarPorValor) {
      case "id_asc":
        return a.id - b.id;
      case "id_desc":
        return b.id - a.id;
      case "data_asc":
        return new Date(a.data_conclusao) - new Date(b.data_conclusao);
      case "data_desc":
      default:
        return new Date(b.data_conclusao) - new Date(a.data_conclusao);
    }
  });

  const totalPages = Math.ceil(servicosFiltrados.length / itemsPerPage);
  currentPage = Math.min(currentPage, totalPages || 1);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const servicosPagina = servicosFiltrados.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  if (servicosPagina.length === 0) {
    elementos.tabela.innerHTML = `<tr><td colspan="10" class="text-center py-4">Nenhum serviço finalizado encontrado.</td></tr>`;
  } else {
    servicosPagina.forEach((servico) => {
      const tr = document.createElement("tr");
      if (servico.status === "nao_concluido")
        tr.classList.add("nao-concluido-row");

      const statusHtml =
        servico.status === "concluido"
          ? '<span class="badge bg-success">Concluído</span>'
          : `<span class="status-nao-concluido">Não Concluído</span><small class="motivo-nao-concluido d-block">${
              servico.motivo_nao_conclusao || ""
            }</small>`;

      let reativarButtonHtml = "";
      if (user && user.nivel >= 4) {
        reativarButtonHtml = `<button class="btn btn-sm glass-btn btn-warning" onclick="reativarServico(${servico.id})" title="Retornar para Ativos"><span class="material-symbols-outlined">undo</span></button>`;
      }

      let aprButtonHtml = `<button class="btn btn-sm glass-btn btn-outline-primary w-100" onclick="abrirModalUploadAPR(${servico.id})" title="Anexar APR"><span class="material-symbols-outlined">attach_file</span> Anexar</button>`;
      if (servico.caminho_apr_anexo) {
        aprButtonHtml = `
          <div class="d-flex flex-column align-items-center">
              <a href="${
                servico.caminho_apr_anexo
              }" target="_blank" class="btn btn-sm glass-btn btn-success mb-1 w-100" title="Ver APR: ${
          servico.nome_original_apr_anexo || ""
        }"><span class="material-symbols-outlined">description</span> Ver</a>
              <button class="btn btn-sm glass-btn btn-warning w-100" onclick="abrirModalUploadAPR(${
                servico.id
              })" title="Substituir APR"><span class="material-symbols-outlined">upload_file</span> Subst.</button>
          </div>`;
      }

      tr.innerHTML = `
        <td>${servico.id}</td>
        <td>${servico.processo || "N/A"}</td>
        <td>${servico.subestacao || "N/A"}</td>
        <td>${servico.alimentador || "N/A"}</td>
        <td>${statusHtml}</td>
        <td>${formatarData(servico.data_conclusao)}</td>
        <td>${servico.nomes_responsaveis || "Não informado"}</td>
        <td class="text-center table-actions apr-actions">${aprButtonHtml}</td>
        <td>${servico.ordem_obra || "N/A"}</td>
        <td class="text-center">
          <div class="btn-group">
            <button class="btn btn-sm glass-btn me-1" onclick="window.navigateTo('/detalhes_servico?id=${
              servico.id
            }')" title="Visualizar"><span class="material-symbols-outlined">visibility</span></button>
            <button class="btn btn-sm glass-btn btn-success me-1" onclick="solicitarRelatorioCompleto(${
              servico.id
            })" title="Gerar Relatório PDF"><span class="material-symbols-outlined">picture_as_pdf</span></button>
            ${reativarButtonHtml}
          </div>
        </td>`;
      elementos.tabela.appendChild(tr);
    });
  }
  atualizarPaginacao();
}

function atualizarPaginacao() {
  if (!elementos.paginacao) return;
  elementos.paginacao.innerHTML = "";
  const totalPages = Math.ceil(obterServicosFiltrados().length / itemsPerPage);
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

  const createPageItem = (page, text, disabled = false, active = false) => {
    const li = document.createElement("li");
    li.className = `page-item ${disabled ? "disabled" : ""} ${
      active ? "active" : ""
    }`;
    li.innerHTML = `<a class="page-link glass-btn" href="#" onclick="event.preventDefault(); ${
      !disabled ? `mudarPagina(${page})` : ""
    }">${text}</a>`;
    return li;
  };

  elementos.paginacao.appendChild(
    createPageItem(currentPage - 1, "Anterior", currentPage === 1)
  );

  if (startPage > 1) {
    elementos.paginacao.appendChild(createPageItem(1, "1"));
    if (startPage > 2) {
      const ellipsis = document.createElement("li");
      ellipsis.className = "page-item disabled";
      ellipsis.innerHTML = `<span class="page-link glass-btn">...</span>`;
      elementos.paginacao.appendChild(ellipsis);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    elementos.paginacao.appendChild(
      createPageItem(i, i, false, i === currentPage)
    );
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("li");
      ellipsis.className = "page-item disabled";
      ellipsis.innerHTML = `<span class="page-link glass-btn">...</span>`;
      elementos.paginacao.appendChild(ellipsis);
    }
    elementos.paginacao.appendChild(createPageItem(totalPages, totalPages));
  }

  elementos.paginacao.appendChild(
    createPageItem(currentPage + 1, "Próximo", currentPage === totalPages)
  );
}

window.mudarPagina = (page) => {
  currentPage = page;
  atualizarTabela();
};

function formatarData(dataString) {
  if (!dataString) return "Não informado";
  const data = new Date(dataString);
  if (isNaN(data.getTime())) return "Data inválida";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

window.reativarServico = async (id) => {
  if (!confirm("Deseja realmente retornar este serviço para ativos?")) return;
  try {
    const response = await fetch(`/api/servicos/${id}/reativar`, {
      method: "PATCH",
    });
    if (!response.ok) throw new Error(await response.text());
    mostrarNotificacao("Serviço retornado para ativos!", "success");
    carregarServicosConcluidos();
  } catch (error) {
    mostrarNotificacao("Erro ao reativar serviço: " + error.message, "danger");
  }
};

window.solicitarRelatorioCompleto = (servicoId) => {
  mostrarNotificacao("Gerando relatório...", "info");
  window.open(`/api/servicos/${servicoId}/consolidar-pdfs`, "_blank");
};

window.abrirModalUploadAPR = (id) => {
  currentServicoId = id;
  document.getElementById("aprServicoId").value = id;
  document.getElementById("aprFile").value = "";
  aprUploadModalInstance.show();
};

async function submeterArquivoAPR() {
  const form = document.getElementById("formUploadAPR");
  const formData = new FormData(form);
  const servicoId = formData.get("servicoId");
  const btn = document.getElementById("btnConfirmarUploadAPR");
  btn.disabled = true;
  try {
    const response = await fetch(`/api/servicos/${servicoId}/upload-apr`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error(await response.text());
    mostrarNotificacao("APR enviada com sucesso!", "success");
    aprUploadModalInstance.hide();
    carregarServicosConcluidos();
  } catch (error) {
    mostrarNotificacao("Erro ao enviar APR: " + error.message, "danger");
  } finally {
    btn.disabled = false;
  }
}

window.navigateTo = async (url) => {
  try {
    const res = await fetch(url.startsWith("/") ? url : `/${url}`);
    if (res.ok) window.location.href = url;
    else if (res.status === 403) accessDeniedModalInstance.show();
    else developmentModalInstance.show();
  } catch (e) {
    developmentModalInstance.show();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  user = JSON.parse(localStorage.getItem("user"));
  inicializarElementos();
  configurarEventListeners();
  carregarServicosConcluidos();
});
