let confirmModalInstance;
let accessDeniedModalInstance;
let developmentModalInstance;
let user = null;

const P = () => window.ServicosPermissions || {};

async function resolverUsuario() {
  try {
    const response = await fetch("/api/me", { credentials: "same-origin" });
    if (response.ok) {
      user = await response.json();
      localStorage.setItem("user", JSON.stringify(user));
      return user;
    }
  } catch {
    /* ignora falha de rede */
  }

  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch {
    user = null;
  }
  return user;
}

function podeEditarServico() {
  return P().podeEditarServico?.(user) ?? false;
}

function podeExcluirServico() {
  return P().podeExcluirServico?.(user) ?? false;
}

function podeGerenciarEquipe() {
  return P().podeGerenciarEquipe?.(user) ?? false;
}

function aplicarPermissoesInterface() {
  const btnEditar = document.getElementById("btn-editar");
  const btnExcluir = document.getElementById("btn-excluir");

  if (btnEditar) {
    btnEditar.style.display = podeEditarServico() ? "" : "none";
  }
  if (btnExcluir) {
    btnExcluir.style.display = podeExcluirServico() ? "" : "none";
  }
}

function tratarValor(valor) {
  return valor || "Não informado";
}

function formatarDataParaExibicao(dataString, includeTime = true) {
  if (!dataString) return "Não informado";
  try {
    const data = new Date(dataString);
    if (isNaN(data.getTime())) return "Data inválida";
    const options = { day: "2-digit", month: "2-digit", year: "numeric" };
    if (includeTime) {
      options.hour = "2-digit";
      options.minute = "2-digit";
    }
    return data.toLocaleString("pt-BR", options).replace(",", "");
  } catch (e) {
    return dataString;
  }
}

function formatarHora(horaString) {
  if (!horaString) return "Não informado";
  try {
    const partes = horaString.split(":");
    if (partes.length >= 2) return `${partes[0]}:${partes[1]}`;
    return horaString;
  } catch (e) {
    return horaString;
  }
}

async function carregarDetalhesServico() {
  const urlParams = new URLSearchParams(window.location.search);
  const servicoId = urlParams.get("id");

  const servicoIdHeaderSpan = document.getElementById("servico-id-header");
  if (servicoIdHeaderSpan && servicoId) {
    servicoIdHeaderSpan.textContent = `(ID: ${servicoId})`;
  }

  if (!servicoId) {
    mostrarErroDetalhes("ID do serviço não especificado na URL.");
    return;
  }

  try {
    const response = await fetch(`/api/servicos/${servicoId}`, {
      credentials: "same-origin",
    });

    if (response.status === 403) {
      mostrarErroDetalhes("Você não tem permissão para visualizar este serviço.");
      aplicarPermissoesInterface();
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData
          ? errorData.message
          : `Erro ao carregar detalhes do serviço: ${response.status}`
      );
    }

    const { success, data } = await response.json();
    if (!success || !data) throw new Error("Detalhes do serviço não encontrados.");

    document.getElementById("servico-id").textContent = data.id || "-";
    document.getElementById("servico-processo").textContent = data.processo || "Não informado";
    document.getElementById("servico-subestacao").textContent = data.subestacao || "Não informado";
    document.getElementById("servico-alimentador").textContent = data.alimentador || "Não informado";
    document.getElementById("servico-chave-montante").textContent = data.chave_montante || "Não informado";
    document.getElementById("servico-ordem-obra").textContent = data.ordem_obra || "Não especificada";

    // Renderiza tabela de responsáveis com botão de remoção (se usuário for gestor)
    preencherEquipeResponsavel(data.responsaveis, data.status);

    document.getElementById("servico-data-prevista").textContent =
      formatarDataParaExibicao(data.data_prevista_execucao, false);

    const desligamentoElement = document.getElementById("servico-desligamento");
    const horaInicioContainer = document.getElementById("hora-inicio-container");
    const horaFimContainer = document.getElementById("hora-fim-container");

    if (data.desligamento === "SIM") {
      if (desligamentoElement) desligamentoElement.textContent = "Sim";
      if (horaInicioContainer) horaInicioContainer.style.display = "block";
      if (horaFimContainer) horaFimContainer.style.display = "block";
      document.getElementById("servico-hora-inicio").textContent = formatarHora(data.hora_inicio);
      document.getElementById("servico-hora-fim").textContent = formatarHora(data.hora_fim);
    } else {
      if (desligamentoElement) desligamentoElement.textContent = "Não";
      if (horaInicioContainer) horaInicioContainer.style.display = "none";
      if (horaFimContainer) horaFimContainer.style.display = "none";
    }

    const statusElement = document.getElementById("servico-status");
    if (statusElement) {
      statusElement.className = "status-badge ";
      if (data.status === "ativo") {
        statusElement.textContent = "Ativo";
        statusElement.classList.add("bg-warning", "text-dark");
      } else if (data.status === "em_progresso") {
        statusElement.textContent = "Em Progresso";
        statusElement.classList.add("bg-em-progresso");
      } else if (data.status === "concluido") {
        statusElement.textContent = "Concluído";
        statusElement.classList.add("bg-success", "text-white");
      } else if (data.status === "nao_concluido") {
        statusElement.textContent = "Não Concluído";
        statusElement.classList.add("bg-nao-concluido");
      } else {
        statusElement.textContent = data.status || "Desconhecido";
        statusElement.classList.add("bg-secondary", "text-white");
      }
    }

    const mapsLink = document.getElementById("maps-link");
    if (mapsLink) {
      const p = mapsLink.querySelector("p");
      if (data.maps && data.maps.trim() !== "") {
        mapsLink.href = data.maps;
        if (p) p.textContent = "Clique para abrir no Google Maps";
      } else {
        mapsLink.removeAttribute("href");
        mapsLink.onclick = (e) => e.preventDefault();
        if (p) p.textContent = "Link do mapa não fornecido";
      }
    }

    document.getElementById("servico-descricao").textContent =
      data.descricao_servico || "Nenhuma descrição informada.";
    document.getElementById("servico-observacoes-registro").textContent =
      data.observacoes || "Nenhuma observação informada.";

    const finalizacaoInfoContainer = document.getElementById("finalizacao-info-container");
    if (data.status === "concluido" || data.status === "nao_concluido") {
      finalizacaoInfoContainer.classList.remove("d-none");
      document.getElementById("servico-data-conclusao").textContent =
        formatarDataParaExibicao(data.data_conclusao);
      document.getElementById("servico-observacoes").textContent =
        data.observacoes_conclusao || "Nenhuma observação registrada.";
      const motivoContainer = document.getElementById("motivo-nao-conclusao-container");
      if (data.status === "nao_concluido") {
        motivoContainer.style.display = "block";
        document.getElementById("servico-motivo-nao-conclusao").textContent =
          data.motivo_nao_conclusao || "Motivo não especificado.";
      } else {
        motivoContainer.style.display = "none";
      }
    } else {
      finalizacaoInfoContainer.classList.add("d-none");
    }

    // Exibe botão "Forçar Conclusão" para gestores quando serviço não estiver concluído
    renderizarBotaoForcarConclusao(data.status, servicoId);

    preencherAnexos(data.anexos || []);
    aplicarPermissoesInterface();
  } catch (error) {
    console.error("Erro ao carregar detalhes do serviço:", error);
    mostrarErroDetalhes(error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Preenche tabela de responsáveis — gestores veem botão de remover encarregado
// ─────────────────────────────────────────────────────────────────────────────
function preencherEquipeResponsavel(responsaveis, statusServico) {
  const container = document.getElementById("servico-responsaveis-container");
  if (!container) return;

  if (!responsaveis || responsaveis.length === 0) {
    container.innerHTML = '<p class="text-muted">Nenhuma equipe atribuída a este serviço.</p>';
    return;
  }

  const servicoConcluido = statusServico === "concluido" || statusServico === "nao_concluido";
  const podeRemover = podeGerenciarEquipe() && !servicoConcluido;

  const table = document.createElement("table");
  table.className = "table table-sm table-borderless responsaveis-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Nome</th>
        <th>Matrícula</th>
        <th>Status</th>
        <th>Data Conclusão</th>
        ${podeRemover ? "<th>Ação</th>" : ""}
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");

  responsaveis.forEach((resp) => {
    const tr = document.createElement("tr");
    let statusBadge = "";
    switch (resp.status_individual) {
      case "concluido":
        statusBadge = '<span class="badge bg-success">Concluído</span>';
        break;
      case "nao_concluido":
        statusBadge = '<span class="badge bg-danger">Não Concluído</span>';
        break;
      case "pendente":
        statusBadge = '<span class="badge bg-warning text-dark">Pendente</span>';
        break;
      default:
        statusBadge = `<span class="badge bg-secondary">${resp.status_individual}</span>`;
    }

    const matricula = resp.responsavel_matricula || "N/A";
    const acaoCell = podeRemover
      ? `<td>
           <button class="btn btn-sm btn-outline-danger btn-remover-encarregado"
             data-matricula="${matricula}"
             title="Remover encarregado">
             <i class="fas fa-user-minus"></i>
           </button>
         </td>`
      : "";

    tr.innerHTML = `
      <td>${resp.nome || "N/A"}</td>
      <td>${matricula}</td>
      <td>${statusBadge}</td>
      <td>${formatarDataParaExibicao(resp.data_conclusao_individual)}</td>
      ${acaoCell}
    `;
    tbody.appendChild(tr);
  });

  container.innerHTML = "";
  container.appendChild(table);

  // Vincula eventos dos botões de remoção
  if (podeRemover) {
    container.querySelectorAll(".btn-remover-encarregado").forEach((btn) => {
      btn.addEventListener("click", () => {
        const matriculaRemover = btn.getAttribute("data-matricula");
        confirmarRemocaoEncarregado(matriculaRemover);
      });
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirmação e execução da remoção de um encarregado específico
// ─────────────────────────────────────────────────────────────────────────────
function confirmarRemocaoEncarregado(matriculaRemover) {
  if (!confirm(`Deseja realmente remover o encarregado ${matriculaRemover} deste serviço?`)) return;
  executarRemocaoEncarregado(matriculaRemover);
}

async function executarRemocaoEncarregado(matriculaRemover) {
  const urlParams = new URLSearchParams(window.location.search);
  const servicoId = urlParams.get("id");

  try {
    const response = await fetch(`/api/servicos/${servicoId}/responsavel/${matriculaRemover}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Erro ao remover encarregado.");
    alert("Encarregado removido com sucesso!");
    await carregarDetalhesServico(); // Recarrega a página de detalhes
  } catch (error) {
    alert("Erro ao remover encarregado: " + error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Botão "Forçar Conclusão" — visível apenas para gestores quando serviço ativo
// ─────────────────────────────────────────────────────────────────────────────
function renderizarBotaoForcarConclusao(statusServico, servicoId) {
  // Tenta inserir o botão numa área de ações existente na página
  const areaAcoes = document.getElementById("action-buttons") || document.querySelector(".action-buttons");
  if (!areaAcoes) return;

  // Remove botão anterior se existir (para evitar duplicatas em recargas)
  const btnAnterior = document.getElementById("btn-forcar-conclusao");
  if (btnAnterior) btnAnterior.remove();

  if (!podeGerenciarEquipe()) return;
  if (statusServico === "concluido" || statusServico === "nao_concluido") return;

  const btn = document.createElement("button");
  btn.id = "btn-forcar-conclusao";
  btn.className = "btn btn-warning ms-2";
  btn.innerHTML = '<i class="fas fa-flag-checkered me-1"></i> Forçar Conclusão';
  btn.title = "Força a conclusão do serviço (apenas gestores)";
  btn.addEventListener("click", () => abrirModalForcarConclusao(servicoId));
  areaAcoes.appendChild(btn);
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal inline de "Forçar Conclusão" (criado dinamicamente se não existir no HTML)
// ─────────────────────────────────────────────────────────────────────────────
function abrirModalForcarConclusao(servicoId) {
  // Remove modal anterior se existir
  let modalEl = document.getElementById("modalForcarConclusao");
  if (modalEl) modalEl.remove();

  const hoje = new Date().toISOString().split("T")[0];
  const agora = new Date().toTimeString().slice(0, 5);

  modalEl = document.createElement("div");
  modalEl.id = "modalForcarConclusao";
  modalEl.className = "modal fade";
  modalEl.setAttribute("tabindex", "-1");
  modalEl.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header bg-warning">
          <h5 class="modal-title"><i class="fas fa-flag-checkered me-2"></i>Forçar Conclusão do Serviço</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <p class="text-muted small">Esta ação marca TODOS os encarregados como concluído e finaliza o serviço imediatamente.</p>
          <div class="mb-3">
            <label class="form-label fw-semibold">Data de Conclusão <span class="text-danger">*</span></label>
            <input type="date" id="forcar-data-conclusao" class="form-control" value="${hoje}" required>
          </div>
          <div class="mb-3">
            <label class="form-label fw-semibold">Hora de Conclusão <span class="text-danger">*</span></label>
            <input type="time" id="forcar-hora-conclusao" class="form-control" value="${agora}" required>
          </div>
          <div class="mb-3">
            <label class="form-label fw-semibold">Observações</label>
            <textarea id="forcar-observacoes" class="form-control" rows="3" placeholder="Motivo da conclusão forçada..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
          <button type="button" class="btn btn-warning" id="btn-confirmar-forcar">
            <i class="fas fa-check me-1"></i> Confirmar Conclusão
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);

  const modal = new bootstrap.Modal(modalEl);
  modal.show();

  document.getElementById("btn-confirmar-forcar").addEventListener("click", async () => {
    const dataConclusao = document.getElementById("forcar-data-conclusao").value;
    const horaConclusao = document.getElementById("forcar-hora-conclusao").value;
    const observacoes = document.getElementById("forcar-observacoes").value;

    if (!dataConclusao || !horaConclusao) {
      alert("Preencha a data e hora de conclusão.");
      return;
    }

    try {
      const response = await fetch(`/api/servicos/${servicoId}/forcar-conclusao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ dataConclusao, horaConclusao, observacoes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Erro ao forçar conclusão.");
      modal.hide();
      alert("Serviço finalizado com sucesso!");
      await carregarDetalhesServico();
    } catch (error) {
      alert("Erro: " + error.message);
    }
  });
}

function preencherAnexos(anexos) {
  const anexosContainer = document.getElementById("anexos-container");
  if (!anexosContainer) return;
  anexosContainer.innerHTML = "";

  if (!anexos || anexos.length === 0) {
    anexosContainer.innerHTML = `<div class="col-12"><p class="text-center text-muted py-3">Nenhum anexo encontrado.</p></div>`;
    return;
  }

  anexos.forEach((anexo, index) => {
    const anexoElement = document.createElement("div");
    anexoElement.className = "col-xl-3 col-lg-4 col-md-6 col-sm-6 col-12 mb-3 d-flex align-items-stretch";

    const nomeOriginalDoAnexo = anexo.nomeOriginal || "arquivo";
    const caminhoCorretoAnexo = anexo.caminho || "#";

    let previewHTML = `<i class="fas ${getFileIcon(nomeOriginalDoAnexo)} fa-3x attachment-preview-icon"></i>`;
    if (anexo.tipo === "imagem" || anexo.tipo === "foto_conclusao" || anexo.tipo === "foto_nao_conclusao") {
      previewHTML = `<img src="${caminhoCorretoAnexo}" alt="Preview" class="attachment-preview-img">`;
    }

    anexoElement.innerHTML = `
      <div class="attachment-card card h-100 w-100 attachment-card--galeria"
        role="button"
        tabindex="0"
        data-galeria-index="${index}"
        data-galeria-url="${caminhoCorretoAnexo}"
        data-galeria-nome="${nomeOriginalDoAnexo}"
        title="Ver ${nomeOriginalDoAnexo}">
        <div class="card-body text-center d-flex flex-column justify-content-between align-items-center">
          <div class="attachment-thumbnail mb-2">${previewHTML}</div>
          <div>
            <p class="attachment-name small mb-1" title="${nomeOriginalDoAnexo}">${truncateFilename(nomeOriginalDoAnexo)}</p>
            <p class="attachment-size small text-muted mb-2">${anexo.tamanho || ""}</p>
          </div>
          <div class="btn-group mt-auto">
            <a href="${caminhoCorretoAnexo}?download=true" class="btn btn-sm btn-outline-secondary" title="Baixar" onclick="event.stopPropagation()"><i class="fas fa-download"></i></a>
          </div>
        </div>
      </div>
    `;
    anexosContainer.appendChild(anexoElement);
  });

  if (window.AnexoGaleria) {
    window.AnexoGaleria.bindContainer(anexosContainer, anexos);
  }
}

function truncateFilename(filename, maxLength = 22) {
  if (!filename || filename.length <= maxLength) return filename || "";
  const extIndex = filename.lastIndexOf(".");
  if (extIndex === -1) return filename.substring(0, maxLength - 3) + "...";
  const name = filename.substring(0, extIndex);
  const ext = filename.substring(extIndex);
  if (name.length + ext.length <= maxLength) return filename;
  return name.substring(0, maxLength - ext.length - 3) + "..." + ext;
}

function getFileIcon(filename) {
  if (!filename) return "fa-file";
  const ext = filename.split(".").pop().toLowerCase();
  const icons = {
    pdf: "fa-file-pdf text-danger",
    doc: "fa-file-word text-primary",
    docx: "fa-file-word text-primary",
    xls: "fa-file-excel text-success",
    xlsx: "fa-file-excel text-success",
  };
  return icons[ext] || "fa-file text-secondary";
}

function mostrarErroDetalhes(mensagem) {
  const container = document.getElementById("alerta-container-detalhes");
  if (container) {
    container.innerHTML = `<div class="alert alert-danger" role="alert">${mensagem}</div>`;
  }
}

window.navigateTo = async function (pageNameOrUrl) {
  let urlToNavigate = pageNameOrUrl.startsWith("/") ? pageNameOrUrl : `/${pageNameOrUrl}`;
  try {
    const response = await fetch(urlToNavigate);
    if (response.ok) window.location.href = urlToNavigate;
    else if (response.status === 403)
      accessDeniedModalInstance && accessDeniedModalInstance.show();
    else developmentModalInstance && developmentModalInstance.show();
  } catch (error) {
    developmentModalInstance && developmentModalInstance.show();
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  await resolverUsuario();

  if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
    const confirmModalEl = document.getElementById("confirmModal");
    if (confirmModalEl) confirmModalInstance = new bootstrap.Modal(confirmModalEl);
    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);
    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
  }

  aplicarPermissoesInterface();
  await carregarDetalhesServico();

  const urlParams = new URLSearchParams(window.location.search);
  const servicoId = urlParams.get("id");

  const btnEditar = document.getElementById("btn-editar");
  if (btnEditar && podeEditarServico()) {
    btnEditar.onclick = () => (window.location.href = `/editar_servico?id=${servicoId}`);
  }

  const btnExcluir = document.getElementById("btn-excluir");
  if (btnExcluir && podeExcluirServico()) {
    btnExcluir.onclick = () => confirmModalInstance && confirmModalInstance.show();
  }

  const confirmDeleteBtn = document.getElementById("confirmDelete");
  if (confirmDeleteBtn) {
    confirmDeleteBtn.onclick = async () => {
      if (!podeExcluirServico()) {
        alert("Você não tem permissão para excluir este serviço.");
        confirmModalInstance && confirmModalInstance.hide();
        return;
      }

      try {
        const response = await fetch(`/api/servicos/${servicoId}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
        if (response.ok) {
          alert("Serviço excluído com sucesso!");
          window.location.href = "/servicos_ativos";
        } else {
          const error = await response.json();
          throw new Error(error.message);
        }
      } catch (error) {
        alert("Erro ao excluir serviço: " + error.message);
      } finally {
        confirmModalInstance && confirmModalInstance.hide();
      }
    };
  }
});
