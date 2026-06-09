function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

let servicosData = [];
let currentServicoId = null;
let confirmModalInstance;
let concluirModalInstance;
let liveToastInstance;
let modalResponsavelInstance;
let aprUploadModalInstance;
let accessDeniedModalInstance;
let developmentModalInstance;
let user = null;

function showToast(message, type = "success") {
  const toastLiveEl = document.getElementById("liveToast");
  if (!toastLiveEl) return;
  if (!liveToastInstance) liveToastInstance = new bootstrap.Toast(toastLiveEl);
  const toastBody = toastLiveEl.querySelector(".toast-body");
  if (toastBody) toastBody.textContent = message;
  toastLiveEl.className = `toast align-items-center text-bg-${type} border-0`;
  if (liveToastInstance) liveToastInstance.show();
}

function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function usarDataAtual() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const localDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const localTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  document.getElementById("dataConclusao").value = localDate;
  document.getElementById("horaConclusao").value = localTime;
}

function ehNivel5Plus() {
  return user && user.nivel >= 5;
}

async function carregarDadosIniciais() {
  try {
    await carregarServicosAtivos();
    const [subestacoesRes, encarregadosRes] = await Promise.all([
      fetch("/api/subestacoes"),
      fetch("/api/encarregados"),
    ]);
    if (subestacoesRes.ok) {
      const subestacoes = await subestacoesRes.json();
      const select = document.getElementById("filtroSubestacao");
      subestacoes.forEach((sub) => {
        select.add(new Option(sub.nome, sub.nome));
      });
    }
    if (encarregadosRes.ok) {
      const encarregados = await encarregadosRes.json();
      const select = document.getElementById("filtroEncarregado");
      encarregados.forEach((enc) => {
        select.add(new Option(enc.nome, enc.matricula));
      });
    }
  } catch (error) {
    showToast("Erro ao carregar dados iniciais: " + error.message, "danger");
  }
}

async function carregarServicosAtivos() {
  try {
    const response = await fetch("/api/servicos?status=ativo");
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
    }
    servicosData = await response.json();
    atualizarTabela();
  } catch (error) {
    showToast("Erro ao carregar serviços ativos: " + error.message, "danger");
    document.getElementById("tabela-servicos").innerHTML = `<tr><td colspan="10" class="text-center py-4">Falha ao carregar serviços. Tente atualizar.</td></tr>`;
  }
}

function atualizarTabela() {
  const tbody = document.getElementById("tabela-servicos");
  tbody.innerHTML = "";

  const filtroTermo = document.getElementById("filtroProcesso").value.toLowerCase();
  const filtroSubestacao = document.getElementById("filtroSubestacao").value;
  const filtroEncarregado = document.getElementById("filtroEncarregado").value;
  const filtroData = document.getElementById("filtroData").value;
  const ordenarPor = document.getElementById("ordenarPor").value;

  let servicosFiltrados = servicosData.filter((servico) => {
    const termoMatch =
      !filtroTermo ||
      String(servico.id).includes(filtroTermo) ||
      (servico.processo && String(servico.processo).toLowerCase().includes(filtroTermo));
    const subestacaoMatch = !filtroSubestacao || servico.subestacao === filtroSubestacao;
    const encarregadoMatch =
      !filtroEncarregado ||
      (servico.nomes_responsaveis &&
        servico.nomes_responsaveis.toLowerCase().includes(filtroEncarregado.toLowerCase()));
    const dataMatch =
      !filtroData ||
      (servico.data_prevista_execucao && servico.data_prevista_execucao.startsWith(filtroData));
    return termoMatch && subestacaoMatch && encarregadoMatch && dataMatch;
  });

  servicosFiltrados.sort((a, b) => {
    switch (ordenarPor) {
      case "id_asc":
        return a.id - b.id;
      case "id_desc":
        return b.id - a.id;
      case "data_asc":
        return new Date(a.data_prevista_execucao) - new Date(b.data_prevista_execucao);
      case "data_desc":
      default:
        return new Date(b.data_prevista_execucao) - new Date(a.data_prevista_execucao);
    }
  });

  if (servicosFiltrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4">Nenhum serviço ativo encontrado.</td></tr>`;
    return;
  }

  servicosFiltrados.forEach((servico) => {
    const tr = document.createElement("tr");
    tr.className = servico.tipo_processo === "Emergencial" ? "emergency-row" : "glass-table-row";
    tr.dataset.id = servico.id;

    let equipeHtml = '<span class="badge bg-warning text-dark">Pendente</span>';
    if (servico.total_responsaveis > 0) {
      const nomes = servico.nomes_responsaveis || "Equipe não informada";
      if (servico.status === "em_progresso") {
        equipeHtml = `<span class="badge bg-info text-dark" data-bs-toggle="tooltip" title="${nomes}">Em Progresso (${servico.concluidos_responsaveis || 0}/${servico.total_responsaveis})</span>`;
      } else {
        equipeHtml = `<span data-bs-toggle="tooltip" title="${nomes}">${nomes.substring(0, 30)}${nomes.length > 30 ? "..." : ""}</span>`;
      }
    }

    let aprButtonHtml = `<button class="btn btn-sm glass-btn btn-outline-primary w-100" onclick="abrirModalUploadAPR(${servico.id})" title="Anexar APR"><span class="material-symbols-outlined">attach_file</span> Anexar</button>`;
    if (servico.caminho_apr_anexo) {
      aprButtonHtml = `
        <div class="d-flex flex-column align-items-center">
          <a href="${servico.caminho_apr_anexo}?download=true" target="_blank" class="btn btn-sm glass-btn btn-outline-success w-100 mb-1" title="Baixar APR"><span class="material-symbols-outlined">download</span> APR</a>
          <button class="btn btn-sm glass-btn btn-outline-warning w-100" onclick="abrirModalUploadAPR(${servico.id})" title="Substituir APR"><span class="material-symbols-outlined">sync</span> Trocar</button>
        </div>`;
    }

    tr.innerHTML = `
      <td>${servico.id}</td>
      <td>${servico.processo || "—"}</td>
      <td>${servico.subestacao || "—"}</td>
      <td>${servico.alimentador || "—"}</td>
      <td>${servico.tipo_processo || "—"}</td>
      <td>${servico.data_prevista_execucao ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(servico.data_prevista_execucao)) : "—"}</td>
      <td>${equipeHtml}</td>
      <td>${aprButtonHtml}</td>
      <td>
        <div class="d-flex flex-wrap gap-1 justify-content-center">
          <button class="btn btn-sm glass-btn btn-outline-info" onclick="navigateTo('/pages/servicos/detalhes_servico.html?id=${servico.id}')" title="Ver Detalhes"><span class="material-symbols-outlined">info</span></button>
          <button class="btn btn-sm glass-btn btn-success" onclick="abrirModalFinalizacao(${servico.id})" title="Finalizar Minha Parte"><span class="material-symbols-outlined">task_alt</span></button>
          <button class="btn btn-sm glass-btn btn-danger" onclick="co
