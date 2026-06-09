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
let user = null;
let selectedFiles = [];
let todosEncarregados = [];
let responsaveisSelecionados = [];

function showToast(message, type = "success") {
  const toastLiveEl = document.getElementById("liveToast");
  if (!toastLiveEl) return;
  if (!liveToastInstance) liveToastInstance = new bootstrap.Toast(toastLiveEl);
  const toastBody = toastLiveEl.querySelector(".toast-body");
  if (toastBody) toastBody.textContent = message;
  toastLiveEl.className = `toast align-items-center text-bg-${type} border-0`;
  if (liveToastInstance) liveToastInstance.show();
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

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const resUser = await fetch("/api/me");
    if (resUser.ok) user = await resUser.json();
  } catch (e) {
    console.warn("Erro ao carregar usuário:", e.message);
  }
  const confirmModalEl = document.getElementById("confirmModal");
  if (confirmModalEl) confirmModalInstance = new bootstrap.Modal(confirmModalEl);
  const concluirModalEl = document.getElementById("concluirModal");
  if (concluirModalEl) concluirModalInstance = new bootstrap.Modal(concluirModalEl);
  const modalResponsavelEl = document.getElementById("modalResponsavel");
  if (modalResponsavelEl) {
    modalResponsavelInstance = new bootstrap.Modal(modalResponsavelEl);
    modalResponsavelEl.addEventListener("shown.bs.modal", () => {
      const buscaInput = document.getElementById("buscaResponsavel");
      if (buscaInput) {
        buscaInput.oninput = debounce(function () {
          filtrarResponsaveis(this.value);
        }, 300);
      }
    });
  }
  const aprUploadModalEl = document.getElementById("aprUploadModal");
  if (aprUploadModalEl) aprUploadModalInstance = new bootstrap.Modal(aprUploadModalEl);
  const btnSalvar = document.getElementById("btnSalvarFinalizacao");
  if (btnSalvar) btnSalvar.addEventListener("click", salvarFinalizacao);
  const btnTirarFoto = document.getElementById("btnTirarFoto");
  const fotoCamera = document.getElementById("fotoCamera");
  if (btnTirarFoto && fotoCamera) {
    btnTirarFoto.addEventListener("click", () => fotoCamera.click());
    fotoCamera.addEventListener("change", (e) => adicionarArquivos(e.target.files));
  }
  const btnAdicionarFotos = document.getElementById("btnAdicionarFotos");
  const fotosConclusao = document.getElementById("fotosConclusao");
  if (btnAdicionarFotos && fotosConclusao) {
    btnAdicionarFotos.addEventListener("click", () => fotosConclusao.click());
    fotosConclusao.addEventListener("change", (e) => adicionarArquivos(e.target.files));
  }
  const statusFinalServico = document.getElementById("statusFinalServico");
  if (statusFinalServico) {
    statusFinalServico.addEventListener("change", () => {
      const camposSomente = document.getElementById("camposSomenteConcluido");
      if (camposSomente) {
        camposSomente.style.display = statusFinalServico.value === "nao_concluido" ? "none" : "block";
      }
    });
  }
  const confirmDeleteBtn = document.getElementById("confirmDelete");
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async () => {
      if (!currentServicoId) return;
      await deletarServico(currentServicoId);
      if (confirmModalInstance) confirmModalInstance.hide();
    });
  }
  const btnConfirmarUploadAPR = document.getElementById("btnConfirmarUploadAPR");
  if (btnConfirmarUploadAPR) btnConfirmarUploadAPR.addEventListener("click", confirmarUploadAPR);
  const filtroProcesso = document.getElementById("filtroProcesso");
  if (filtroProcesso) filtroProcesso.addEventListener("input", debounce(atualizarTabela, 300));
  ["filtroSubestacao", "filtroEncarregado", "filtroData", "ordenarPor"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", atualizarTabela);
  });
  await carregarDadosIniciais();
});

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
      if (select) subestacoes.forEach(sub => select.add(new Option(sub.nome, sub.nome)));
    }
    if (encarregadosRes.ok) {
      const encarregados = await encarregadosRes.json();
      const select = document.getElementById("filtroEncarregado");
      if (select) encarregados.forEach(enc => select.add(new Option(enc.nome, enc.matricula)));
    }
  } catch (error) {
    showToast("Erro ao carregar dados iniciais: " + error.message, "danger");
  }
}

async function carregarServicosAtivos() {
  try {
    const response = await fetch("/api/servicos?status=ativo");
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    servicosData = await response.json();
    atualizarTabela();
  } catch (error) {
    showToast("Erro ao carregar serviços ativos: " + error.message, "danger");
    const tbody = document.getElementById("tabela-servicos");
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4">Falha ao carregar serviços. Tente atualizar.</td></tr>`;
  }
}

function abrirDetalhes(servicoId) {
  window.location.href = `/detalhes_servico?id=${servicoId}`;
}

function atualizarTabela() {
  const tbody = document.getElementById("tabela-servicos");
  if (!tbody) return;
  tbody.innerHTML = "";
  const filtroTermo = (document.getElementById("filtroProcesso")?.value || "").toLowerCase();
  const filtroSubestacao = document.getElementById("filtroSubestacao")?.value || "";
  const filtroEncarregado = document.getElementById("filtroEncarregado")?.value || "";
  const filtroData = document.getElementById("filtroData")?.value || "";
  const ordenarPor = document.getElementById("ordenarPor")?.value || "data_desc";
  let servicosFiltrados = servicosData.filter(servico => {
    const termoMatch = !filtroTermo || String(servico.id).includes(filtroTermo) || (servico.processo && String(servico.processo).toLowerCase().includes(filtroTermo));
    const subestacaoMatch = !filtroSubestacao || servico.subestacao === filtroSubestacao;
    const encarregadoMatch = !filtroEncarregado || (servico.nomes_responsaveis && servico.nomes_responsaveis.toLowerCase().includes(filtroEncarregado.toLowerCase()));
    const dataMatch = !filtroData || (servico.data_prevista_execucao && servico.data_prevista_execucao.startsWith(filtroData));
    return termoMatch && subestacaoMatch && encarregadoMatch && dataMatch;
  });
  servicosFiltrados.sort((a, b) => {
    switch (ordenarPor) {
      case "id_asc": return a.id - b.id;
      case "id_desc": return b.id - a.id;
      case "data_asc": return new Date(a.data_prevista_execucao) - new Date(b.data_prevista_execucao);
      default: return new Date(b.data_prevista_execucao) - new Date(a.data_prevista_execucao);
    }
  });
  if (servicosFiltrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4">Nenhum serviço ativo encontrado.</td></tr>`;
    return;
  }
  const podeAtribuirEquipe = (user && (user.nivel >= 6 || ['ADMIN','TÉCNICO','ADM','ENGENHEIRO','GERENTE'].includes(user.cargo?.toUpperCase()))) || false;
  servicosFiltrados.forEach(servico => {
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
    const dataPrevista = servico.data_prevista_execucao ? new Date(servico.data_prevista_execucao + "T00:00:00").toLocaleDateString("pt-BR") : "—";
    const botoesEquipe = podeAtribuirEquipe 
      ? `<button class="btn btn-sm btn-outline-secondary w-100 mb-1" onclick="abrirModalResponsavel(${servico.id})"><span class="material-symbols-outlined" style="font-size:16px">group</span> Equipe</button>`
      : '';
    tr.innerHTML = `
      <td>${servico.id}</td>
      <td>${servico.processo || "—"}</td>
      <td>${servico.subestacao || "—"}</td>
      <td>${servico.alimentador || "—"}</td>
      <td>${servico.tipo_processo || "—"}</td>
      <td>${dataPrevista}</td>
      <td>${equipeHtml}</td>
      <td><button class="btn btn-sm glass-btn btn-outline-primary w-100" onclick="abrirModalUploadAPR(${servico.id})"><span class="material-symbols-outlined">attach_file</span> Anexar</button></td>
      <td>
        <button class="btn btn-sm btn-info w-100 mb-1" onclick="abrirDetalhes(${servico.id})"><span class="material-symbols-outlined" style="font-size:16px">visibility</span> Detalhes</button>
        <button class="btn btn-sm btn-success w-100 mb-1" onclick="abrirModalConcluir(${servico.id})"><span class="material-symbols-outlined" style="font-size:16px">check_circle</span> Concluir</button>
        ${botoesEquipe}
        <button class="btn btn-sm btn-outline-danger w-100" onclick="confirmarExclusao(${servico.id})"><span class="material-symbols-outlined" style="font-size:16px">delete</span> Excluir</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el, { trigger: "hover" }));
}

function abrirModalConcluir(servicoId) {
  currentServicoId = servicoId;
  usarDataAtual();
  const statusEl = document.getElementById("statusFinalServico");
  if (statusEl) statusEl.value = "concluido";
  const camposSomente = document.getElementById("camposSomenteConcluido");
  if (camposSomente) camposSomente.style.display = "block";
  selectedFiles = [];
  renderizarPreviewFotos();
  if (concluirModalInstance) concluirModalInstance.show();
}

async function salvarFinalizacao() {
  if (!currentServicoId) return;
  const statusFinal = document.getElementById("statusFinalServico")?.value;
  const dataConclusao = document.getElementById("dataConclusao")?.value;
  const horaConclusao = document.getElementById("horaConclusao")?.value;
  const observacoes = document.getElementById("observacoesFinalizacao")?.value || "";
  if (!statusFinal || !dataConclusao || !horaConclusao) {
    showToast("Preencha data, hora e status final.", "warning");
    return;
  }
  const btnSalvar = document.getElementById("btnSalvarFinalizacao");
  if (btnSalvar) {
    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";
  }
  try {
    if (selectedFiles.length > 0) {
      const formDataFotos = new FormData();
      selectedFiles.forEach(f => formDataFotos.append("foto_conclusao", f));
      await fetch(`/api/servicos/${currentServicoId}/upload-foto-conclusao`, { method: "POST", body: formDataFotos });
    }
    const res = await fetch(`/api/servicos/${currentServicoId}/concluir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status_final: statusFinal,
        data_conclusao: dataConclusao,
        hora_conclusao: horaConclusao,
        observacoes_conclusao: observacoes
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Erro ${res.status}`);
    showToast("Serviço finalizado com sucesso!", "success");
    if (concluirModalInstance) concluirModalInstance.hide();
    await carregarServicosAtivos();
    currentServicoId = null;
  } catch (err) {
    showToast("Erro ao finalizar: " + err.message, "danger");
  } finally {
    if (btnSalvar) {
      btnSalvar.disabled = false;
      btnSalvar.textContent = "Salvar";
    }
  }
}

async function abrirModalResponsavel(servicoId) {
  currentServicoId = servicoId;
  try {
    const [encRes, servRes] = await Promise.all([
      fetch("/api/encarregados"),
      fetch(`/api/servicos/${servicoId}`)
    ]);
    if (encRes.ok) todosEncarregados = await encRes.json();
    if (servRes.ok) {
      const servico = await servRes.json();
      responsaveisSelecionados = (servico.responsaveis || []).map(r => typeof r === "object" ? r.matricula : r);
    }
  } catch (e) {
    todosEncarregados = [];
    responsaveisSelecionados = [];
  }
  renderizarListaEncarregados(todosEncarregados);
  if (modalResponsavelInstance) modalResponsavelInstance.show();
}

function filtrarResponsaveis(termo) {
  const termoLower = (termo || "").toLowerCase();
  const filtrados = todosEncarregados.filter(e => e.nome.toLowerCase().includes(termoLower) || String(e.matricula).includes(termoLower));
  renderizarListaEncarregados(filtrados);
}

function renderizarListaEncarregados(lista) {
  const container = document.getElementById("listaEncarregados");
  if (!container) return;
  container.innerHTML = "";
  if (!lista || lista.length === 0) {
    container.innerHTML = `<p class="text-muted text-center py-3">Nenhum encarregado encontrado.</p>`;
    return;
  }
  lista.forEach(enc => {
    const selecionado = responsaveisSelecionados.includes(enc.matricula);
    const div = document.createElement("div");
    div.className = `d-flex align-items-center justify-content-between p-2 mb-1 rounded ${selecionado ? "bg-success bg-opacity-10 border border-success" : "bg-light border"}`;
    div.innerHTML = `<div><strong>${enc.nome}</strong><br><small class="text-muted">Mat: ${enc.matricula} — ${enc.cargo || ""}</small></div><button class="btn btn-sm ${selecionado ? "btn-danger" : "btn-success"}" onclick="toggleResponsavel('${enc.matricula}')">${selecionado ? "Remover" : "Adicionar"}</button>`;
    container.appendChild(div);
  });
}

function toggleResponsavel(matricula) {
  if (responsaveisSelecionados.includes(matricula)) {
    responsaveisSelecionados = responsaveisSelecionados.filter(m => m !== matricula);
  } else {
    responsaveisSelecionados.push(matricula);
  }
  renderizarListaEncarregados(todosEncarregados);
}

async function salvarResponsaveis() {
  if (!currentServicoId) return;
  try {
    const res = await fetch(`/api/servicos/${currentServicoId}/responsavel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responsaveis: responsaveisSelecionados })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Erro ${res.status}`);
    showToast("Equipe atualizada com sucesso!", "success");
    if (modalResponsavelInstance) modalResponsavelInstance.hide();
    await carregarServicosAtivos();
  } catch (err) {
    showToast("Erro ao salvar equipe: " + err.message, "danger");
  }
}

function confirmarExclusao(servicoId) {
  currentServicoId = servicoId;
  if (confirmModalInstance) confirmModalInstance.show();
}

async function deletarServico(servicoId) {
  try {
    const res = await fetch(`/api/servicos/${servicoId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Erro ${res.status}`);
    showToast("Serviço excluído com sucesso!", "success");
    await carregarServicosAtivos();
    currentServicoId = null;
  } catch (err) {
    showToast("Erro ao excluir: " + err.message, "danger");
  }
}

let aprServicoId = null;
function abrirModalUploadAPR(servicoId) {
  aprServicoId = servicoId;
  const inputAPR = document.getElementById("aprFileInput");
  if (inputAPR) inputAPR.value = "";
  if (aprUploadModalInstance) aprUploadModalInstance.show();
}

async function confirmarUploadAPR() {
  if (!aprServicoId) return;
  const inputAPR = document.getElementById("aprFileInput");
  if (!inputAPR || !inputAPR.files[0]) {
    showToast("Selecione um arquivo APR.", "warning");
    return;
  }
  const formData = new FormData();
  formData.append("apr_file", inputAPR.files[0]);
  try {
    const res = await fetch(`/api/servicos/${aprServicoId}/upload-apr`, { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Erro ${res.status}`);
    showToast("APR anexada com sucesso!", "success");
    if (aprUploadModalInstance) aprUploadModalInstance.hide();
  } catch (err) {
    showToast("Erro ao anexar APR: " + err.message, "danger");
  }
}

function adicionarArquivos(files) {
  const maxFiles = 5;
  const novos = Array.from(files).filter(f => !selectedFiles.find(sf => sf.name === f.name));
  if (selectedFiles.length + novos.length > maxFiles) {
    showToast(`Máximo de ${maxFiles} fotos permitidas.`, "warning");
    return;
  }
  selectedFiles.push(...novos);
  renderizarPreviewFotos();
}

function renderizarPreviewFotos() {
  const container = document.getElementById("previewContainer");
  if (!container) return;
  container.innerHTML = "";
  selectedFiles.forEach((file, index) => {
    const col = document.createElement("div");
    col.className = "col-md-3 col-sm-4 col-6 position-relative preview-item";
    const imgUrl = URL.createObjectURL(file);
    col.innerHTML = `
      <div class="card h-100">
        <img src="${imgUrl}" class="card-img-top" style="height: 150px; object-fit: cover;" alt="Preview">
        <div class="card-body p-2 text-center">
          <small class="text-muted">${file.name.substring(0, 20)}${file.name.length > 20 ? "..." : ""}</small>
          <button type="button" class="btn btn-sm btn-danger mt-1 w-100" onclick="removerFoto(${index})">
            <span class="material-symbols-outlined" style="font-size: 16px;">delete</span> Remover
          </button>
        </div>
      </div>
    `;
    container.appendChild(col);
  });
}

function removerFoto(index) {
  selectedFiles.splice(index, 1);
  renderizarPreviewFotos();
}
