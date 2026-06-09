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
let selectedFiles = [];

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
  const dataConclusaoEl = document.getElementById("dataConclusao");
  const horaConclusaoEl = document.getElementById("horaConclusao");
  if (dataConclusaoEl) dataConclusaoEl.value = localDate;
  if (horaConclusaoEl) horaConclusaoEl.value = localTime;
}

function ehNivel5Plus() {
  return user && user.nivel >= 5;
}

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  // Carrega usuário da sessão
  try {
    const resUser = await fetch("/api/me");
    if (resUser.ok) {
      user = await resUser.json();
    }
  } catch (e) {
    console.warn("Não foi possível carregar dados do usuário:", e.message);
  }

  // Inicializa modais Bootstrap
  const confirmModalEl = document.getElementById("confirmModal");
  if (confirmModalEl) confirmModalInstance = new bootstrap.Modal(confirmModalEl);

  const concluirModalEl = document.getElementById("concluirModal");
  if (concluirModalEl) concluirModalInstance = new bootstrap.Modal(concluirModalEl);

  const modalResponsavelEl = document.getElementById("modalResponsavel");
  if (modalResponsavelEl) modalResponsavelInstance = new bootstrap.Modal(modalResponsavelEl);

  const aprUploadModalEl = document.getElementById("aprUploadModal");
  if (aprUploadModalEl) aprUploadModalInstance = new bootstrap.Modal(aprUploadModalEl);

  const accessDeniedModalEl = document.getElementById("access-denied-modal");
  if (accessDeniedModalEl) accessDeniedModalInstance = new bootstrap.Modal(accessDeniedModalEl);

  const developmentModalEl = document.getElementById("development-modal");
  if (developmentModalEl) developmentModalInstance = new bootstrap.Modal(developmentModalEl);

  // Evento: salvar finalização
  const btnSalvar = document.getElementById("btnSalvarFinalizacao");
  if (btnSalvar) {
    btnSalvar.addEventListener("click", salvarFinalizacao);
  }

  // Evento: botão tirar foto
  const btnTirarFoto = document.getElementById("btnTirarFoto");
  const fotoCamera = document.getElementById("fotoCamera");
  if (btnTirarFoto && fotoCamera) {
    btnTirarFoto.addEventListener("click", () => fotoCamera.click());
    fotoCamera.addEventListener("change", (e) => adicionarArquivos(e.target.files));
  }

  // Evento: adicionar fotos da galeria
  const btnAdicionarFotos = document.getElementById("btnAdicionarFotos");
  const fotosConclusao = document.getElementById("fotosConclusao");
  if (btnAdicionarFotos && fotosConclusao) {
    btnAdicionarFotos.addEventListener("click", () => fotosConclusao.click());
    fotosConclusao.addEventListener("change", (e) => adicionarArquivos(e.target.files));
  }

  // Evento: mudança no status final (concluido / nao_concluido)
  const statusFinalServico = document.getElementById("statusFinalServico");
  if (statusFinalServico) {
    statusFinalServico.addEventListener("change", () => {
      const camposSomente = document.getElementById("camposSomenteConcluido");
      if (camposSomente) {
        camposSomente.style.display =
          statusFinalServico.value === "nao_concluido" ? "none" : "block";
      }
    });
  }

  // Evento: confirmar exclusão
  const confirmDeleteBtn = document.getElementById("confirmDelete");
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async () => {
      if (!currentServicoId) return;
      await deletarServico(currentServicoId);
      if (confirmModalInstance) confirmModalInstance.hide();
    });
  }

  // Evento: upload APR
  const btnConfirmarUploadAPR = document.getElementById("btnConfirmarUploadAPR");
  if (btnConfirmarUploadAPR) {
    btnConfirmarUploadAPR.addEventListener("click", confirmarUploadAPR);
  }

  // Filtros com debounce
  const filtroProcesso = document.getElementById("filtroProcesso");
  if (filtroProcesso) {
    filtroProcesso.addEventListener("input", debounce(atualizarTabela, 300));
  }

  ["filtroSubestacao", "filtroEncarregado", "filtroData", "ordenarPor"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", atualizarTabela);
  });

  // Carrega dados iniciais
  await carregarDadosIniciais();
});

// ─── DADOS ────────────────────────────────────────────────────────────────────

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
      if (select) {
        subestacoes.forEach((sub) => {
          select.add(new Option(sub.nome, sub.nome));
        });
      }
    }
    if (encarregadosRes.ok) {
      const encarregados = await encarregadosRes.json();
      const select = document.getElementById("filtroEncarregado");
      if (select) {
        encarregados.forEach((enc) => {
          select.add(new Option(enc.nome, enc.matricula));
        });
      }
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
    const tbody = document.getElementById("tabela-servicos");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4">Falha ao carregar serviços. Tente atualizar.</td></tr>`;
    }
  }
}

// ─── TABELA ───────────────────────────────────────────────────────────────────

function atualizarTabela() {
  const tbody = document.getElementById("tabela-servicos");
  if (!tbody) return;
  tbody.innerHTML = "";

  const filtroTermo = (document.getElementById("filtroProcesso")?.value || "").toLowerCase();
  const filtroSubestacao = document.getElementById("filtroSubestacao")?.value || "";
  const filtroEncarregado = document.getElementById("filtroEncarregado")?.value || "";
  const filtroData = document.getElementById("filtroData")?.value || "";
  const ordenarPor = document.getElementById("ordenarPor")?.value || "data_desc";

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

    let aprButtonHtml = `<button class="btn btn-sm glass-btn btn-outline-primary w-100" onclick="abrirModalUploadAPR(${servico.id})" title="Anexar APR"><span class="material-symbols-outlined">attach_file</span> Anexar</b
