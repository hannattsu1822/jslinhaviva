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
let currentSistemaVersao = null;
let modalResponsavelInstance;
let confirmModalInstance;
let finalizarItensModalInstance;
let concluirModalLegadoInstance;
let user = null;

async function carregarDadosIniciais() {
  try {
    const [subestacoesRes, encarregadosRes] = await Promise.all([
      fetch("/api/subestacoes"),
      fetch("/api/encarregados"),
    ]);

    if (subestacoesRes.ok) {
      const subestacoes = await subestacoesRes.json();
      const selectSubestacao = document.getElementById("filtroSubestacao");
      if (selectSubestacao) {
        selectSubestacao.innerHTML =
          '<option value="">Todas as Subestações</option>';
        subestacoes.forEach((sub) => {
          const option = document.createElement("option");
          option.value = sub.nome;
          option.textContent = sub.nome;
          selectSubestacao.appendChild(option);
        });
      }
    }

    if (encarregadosRes.ok) {
      const encarregados = await encarregadosRes.json();
      const selectEncarregado = document.getElementById("filtroEncarregado");
      if (selectEncarregado) {
        selectEncarregado.innerHTML =
          '<option value="">Todos os Responsáveis</option>';
        encarregados.forEach((enc) => {
          const option = document.createElement("option");
          option.value = enc.matricula;
          option.textContent = enc.nome;
          selectEncarregado.appendChild(option);
        });
      }
    }
  } catch (error) {
    console.error("Erro ao carregar dados iniciais:", error);
  }
}

async function carregarServicosAtivos() {
  try {
    const response = await fetch("/api/servicos?status=ativo");
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }
    servicosData = await response.json();
    atualizarTabela();
  } catch (error) {
    console.error("Erro ao carregar serviços ativos:", error);
  }
}

function formatarData(dataString) {
  if (!dataString) return "N/A";
  try {
    return new Date(dataString).toLocaleDateString("pt-BR", {
      timeZone: "UTC",
    });
  } catch (e) {
    return "Data inválida";
  }
}

function atualizarTabela() {
  const tbody = document.getElementById("tabela-servicos");
  if (!tbody) return;
  tbody.innerHTML = "";

  const filtroIdProcesso = document
    .getElementById("filtroIdProcesso")
    .value.toLowerCase();
  const filtroSubestacao = document.getElementById("filtroSubestacao").value;
  const filtroEncarregado = document.getElementById("filtroEncarregado").value;
  const filtroData = document.getElementById("filtroData").value;

  const servicosFiltrados = servicosData.filter((servico) => {
    const id = servico.id?.toString().toLowerCase() || "";
    const processo = servico.processo?.toString().toLowerCase() || "";

    const idProcessoMatch =
      !filtroIdProcesso ||
      id.includes(filtroIdProcesso) ||
      processo.includes(filtroIdProcesso);
    const subestacaoMatch =
      !filtroSubestacao || servico.subestacao === filtroSubestacao;
    const dataMatch =
      !filtroData ||
      (servico.data_prevista_execucao &&
        servico.data_prevista_execucao.startsWith(filtroData));

    let encarregadoMatch = !filtroEncarregado;
    if (filtroEncarregado) {
      if (servico.sistema_versao === "legado") {
        encarregadoMatch = servico.responsavel_matricula === filtroEncarregado;
      } else {
        encarregadoMatch =
          servico.responsavel_matricula &&
          servico.responsavel_matricula
            .toLowerCase()
            .includes(filtroEncarregado.toLowerCase());
      }
    }

    return idProcessoMatch && subestacaoMatch && dataMatch && encarregadoMatch;
  });

  if (servicosFiltrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4">Nenhum serviço ativo encontrado com os filtros aplicados.</td></tr>`;
    return;
  }

  servicosFiltrados.forEach((servico) => {
    const tr = document.createElement("tr");

    const detalhesUrl =
      servico.sistema_versao === "legado"
        ? `/detalhes_servico?id=${servico.id}`
        : `/detalhes_ordem_servico?id=${servico.id}`;

    let responsavelDisplay;
    if (servico.sistema_versao === "legado") {
      responsavelDisplay =
        servico.responsavel_matricula === "pendente"
          ? '<span class="badge bg-warning text-dark">Pendente</span>'
          : `${servico.responsavel_nome || ""} (${
              servico.responsavel_matricula
            })`;
    } else {
      responsavelDisplay = servico.responsavel_matricula.includes("Pendente")
        ? `<span class="badge bg-warning text-dark" style="cursor: help;" title="Um ou mais itens estão pendentes de atribuição">${servico.responsavel_matricula}</span>`
        : servico.responsavel_matricula;
    }

    let progressoHtml = "N/A";
    if (servico.sistema_versao === "moderno") {
      const concluidos = servico.progresso_concluidos;
      const total = servico.progresso_total;
      const percentual = total > 0 ? (concluidos / total) * 100 : 0;
      progressoHtml = `
                <div class="progress" style="height: 20px; font-size: 0.75rem;">
                    <div class="progress-bar" role="progressbar" style="width: ${percentual}%;" aria-valuenow="${percentual}" aria-valuemin="0" aria-valuemax="100">
                        ${concluidos} / ${total}
                    </div>
                </div>
            `;
    }

    const atribuirBtnHtml = `<button class="btn btn-sm glass-btn btn-primary me-1" onclick="abrirModalAtribuicao(${servico.id}, '${servico.sistema_versao}')" title="Atribuir/Reatribuir Responsável"><span class="material-symbols-outlined">manage_accounts</span></button>`;
    const concluirBtnHtml = `<button class="btn btn-sm glass-btn btn-success me-1" onclick="abrirModalFinalizacao(${servico.id}, '${servico.sistema_versao}')" title="Finalizar Tarefas"><span class="material-symbols-outlined">task_alt</span></button>`;

    let excluirBtnHtml = "";
    if (user && user.nivel >= 5) {
      excluirBtnHtml = `<button class="btn btn-sm glass-btn btn-danger" onclick="confirmarExclusao(${servico.id}, '${servico.sistema_versao}')" title="Excluir Serviço"><span class="material-symbols-outlined">delete</span></button>`;
    }

    tr.innerHTML = `
            <td>${servico.id}</td>
            <td>${servico.processo || "N/A"}</td>
            <td>${servico.subestacao || "N/A"}</td>
            <td>${formatarData(servico.data_prevista_execucao)}</td>
            <td>${responsavelDisplay}</td>
            <td>${progressoHtml}</td>
            <td>${
              servico.desligamento === "SIM"
                ? '<span class="badge bg-danger">Sim</span>'
                : '<span class="badge bg-success">Não</span>'
            }</td>
            <td>${servico.ordem_obra || "N/A"}</td>
            <td class="text-center table-actions">
                <div class="btn-group" role="group">
                    <a href="${detalhesUrl}" class="btn btn-sm glass-btn me-1" title="Visualizar Detalhes"><span class="material-symbols-outlined">visibility</span></a>
                    ${atribuirBtnHtml}
                    ${concluirBtnHtml}
                    ${excluirBtnHtml}
                </div>
            </td>`;
    tbody.appendChild(tr);
  });
}

window.abrirModalAtribuicao = async function (servicoId, sistemaVersao) {
  currentServicoId = servicoId;
  currentSistemaVersao = sistemaVersao;
  const modalBody = document.getElementById("modalResponsavelBody");
  modalBody.innerHTML =
    '<div class="text-center p-4"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Carregando...</span></div></div>';
  if (modalResponsavelInstance) modalResponsavelInstance.show();

  try {
    const encarregadosRes = await fetch("/api/encarregados");
    if (!encarregadosRes.ok) throw new Error("Falha ao carregar encarregados.");
    const encarregados = await encarregadosRes.json();
    const encarregadosOptions = encarregados
      .map(
        (e) =>
          `<option value="${e.matricula}">${e.nome} (${e.matricula})</option>`
      )
      .join("");

    if (sistemaVersao === "legado") {
      modalBody.innerHTML = `
                <p class="mb-2">Atribuir responsável para o serviço legado ID: <strong>${servicoId}</strong></p>
                <select class="form-select" id="selectResponsavelLegado">
                    <option value="" disabled selected>Selecione um encarregado...</option>
                    ${encarregadosOptions}
                </select>
            `;
    } else {
      const itensRes = await fetch(`/api/ordens-servico/${servicoId}/itens`);
      if (!itensRes.ok) throw new Error("Falha ao carregar itens da OS.");
      const itens = await itensRes.json();

      let html = `<p class="mb-3">Atribuir/Reatribuir responsáveis para os itens da OS ID: <strong>${servicoId}</strong></p>`;
      itens.forEach((item) => {
        html += `
                    <div class="mb-3 border p-3 rounded bg-light">
                        <label class="form-label fw-bold d-block mb-2">${
                          item.codigo
                        } - ${item.descricao}</label>
                        <select class="form-select item-responsavel-select" data-item-id="${
                          item.item_id
                        }">
                            <option value="pendente">Pendente</option>
                            ${encarregados
                              .map(
                                (e) =>
                                  `<option value="${e.matricula}" ${
                                    item.responsavel_matricula === e.matricula
                                      ? "selected"
                                      : ""
                                  }>${e.nome} (${e.matricula})</option>`
                              )
                              .join("")}
                        </select>
                    </div>
                `;
      });
      modalBody.innerHTML = html;
    }
  } catch (error) {
    modalBody.innerHTML = `<div class="alert alert-danger">Erro ao carregar dados: ${error.message}</div>`;
  }
};

window.confirmarResponsavel = async function () {
  const btnConfirm = document.querySelector("#modalResponsavel .btn-primary");
  btnConfirm.disabled = true;
  btnConfirm.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...';

  try {
    let response;
    if (currentSistemaVersao === "legado") {
      const matricula = document.getElementById(
        "selectResponsavelLegado"
      ).value;
      if (!matricula) throw new Error("Selecione um responsável.");

      response = await fetch(`/api/servicos/${currentServicoId}/responsavel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responsavel_matricula: matricula }),
      });
    } else {
      const atribuicoes = [];
      document
        .querySelectorAll(".item-responsavel-select")
        .forEach((select) => {
          atribuicoes.push({
            itemId: select.dataset.itemId,
            responsavel_matricula: select.value,
          });
        });

      response = await fetch(
        `/api/ordens-servico/${currentServicoId}/atribuir`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ atribuicoes }),
        }
      );
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Falha ao salvar as atribuições.");
    }

    if (modalResponsavelInstance) modalResponsavelInstance.hide();
    await carregarServicosAtivos();
  } catch (error) {
    alert(`Erro: ${error.message}`);
  } finally {
    btnConfirm.disabled = false;
    btnConfirm.innerHTML = "Confirmar Atribuições";
  }
};

window.abrirModalFinalizacao = async function (servicoId, sistemaVersao) {
  currentServicoId = servicoId;
  currentSistemaVersao = sistemaVersao;

  if (sistemaVersao === "legado") {
    if (concluirModalLegadoInstance) {
      document.getElementById("formConcluirServico").reset();
      concluirModalLegadoInstance.show();
    }
  } else {
    const modalBody = document.getElementById("finalizarItensModalBody");
    modalBody.innerHTML =
      '<div class="text-center p-4"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Carregando...</span></div></div>';
    if (finalizarItensModalInstance) finalizarItensModalInstance.show();

    try {
      const isSuperUser = user && user.nivel >= 5;
      const apiUrl = isSuperUser
        ? `/api/ordens-servico/${servicoId}/todos-itens-pendentes`
        : `/api/ordens-servico/${servicoId}/meus-itens`;

      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error("Falha ao carregar tarefas pendentes.");
      const itens = await response.json();

      if (itens.length === 0) {
        modalBody.innerHTML = `<div class="alert alert-info">Nenhuma tarefa pendente encontrada para esta Ordem de Serviço.</div>`;
        document.getElementById("btnSalvarFinalizacaoItens").style.display =
          "none";
        return;
      }
      document.getElementById("btnSalvarFinalizacaoItens").style.display =
        "inline-block";

      let html = `<p class="mb-3">Selecione o status para cada tarefa pendente na OS ID: <strong>${servicoId}</strong></p>`;
      itens.forEach((item) => {
        let responsavelInfo = "";
        if (isSuperUser) {
          responsavelInfo = `<small class="d-block text-muted mb-2">Responsável: ${
            item.responsavel_nome || item.responsavel_matricula
          }</small>`;
        }

        html += `
            <div class="mb-3 border p-3 rounded bg-light item-finalizacao-row" data-item-id="${item.item_id}">
                <label class="form-label fw-bold d-block mb-1">${item.codigo} - ${item.descricao}</label>
                ${responsavelInfo}
                <div class="d-flex gap-3">
                    <div class="form-check">
                        <input class="form-check-input item-status" type="radio" name="status_${item.item_id}" value="concluido" id="concluido_${item.item_id}" checked>
                        <label class="form-check-label" for="concluido_${item.item_id}">Concluído</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input item-status" type="radio" name="status_${item.item_id}" value="finalizacao_impossibilitada" id="nao_concluido_${item.item_id}">
                        <label class="form-check-label" for="nao_concluido_${item.item_id}">Finalização Impossibilitada</label>
                    </div>
                </div>
                <textarea class="form-control mt-2 item-observacoes" rows="2" placeholder="Observações / Motivo (obrigatório se impossibilitado)"></textarea>
                <div class="mt-2">
                    <label for="anexos_item_${item.item_id}" class="form-label small">Anexos de Conclusão (opcional)</label>
                    <input class="form-control form-control-sm item-anexos" type="file" id="anexos_item_${item.item_id}" multiple>
                </div>
            </div>
        `;
      });
      modalBody.innerHTML = html;
    } catch (error) {
      modalBody.innerHTML = `<div class="alert alert-danger">Erro ao carregar dados: ${error.message}</div>`;
    }
  }
};

async function salvarFinalizacaoItens() {
  const btnConfirm = document.getElementById("btnSalvarFinalizacaoItens");
  btnConfirm.disabled = true;
  btnConfirm.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...';

  try {
    const formData = new FormData();
    const finalizacoes = [];
    const itemRows = document.querySelectorAll(".item-finalizacao-row");

    let validationError = false;
    itemRows.forEach((row) => {
      const itemId = row.dataset.itemId;
      const status = row.querySelector(
        'input[name="status_' + itemId + '"]:checked'
      ).value;
      const observacoes = row.querySelector(".item-observacoes").value;

      if (status === "finalizacao_impossibilitada" && !observacoes.trim()) {
        row.querySelector(".item-observacoes").classList.add("is-invalid");
        validationError = true;
      } else {
        row.querySelector(".item-observacoes").classList.remove("is-invalid");
      }

      finalizacoes.push({ itemId, status, observacoes });

      const anexoInput = row.querySelector(".item-anexos");
      if (anexoInput.files.length > 0) {
        for (const file of anexoInput.files) {
          formData.append(`anexos_item_${itemId}`, file);
        }
      }
    });

    if (validationError) {
      throw new Error(
        "Para itens com 'Finalização Impossibilitada', as observações são obrigatórias."
      );
    }

    formData.append("finalizacoes", JSON.stringify(finalizacoes));

    const response = await fetch(
      `/api/ordens-servico/${currentServicoId}/finalizar-itens`,
      {
        method: "PATCH",
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Falha ao salvar as finalizações.");
    }

    if (finalizarItensModalInstance) finalizarItensModalInstance.hide();
    await carregarServicosAtivos();
  } catch (error) {
    alert(`Erro: ${error.message}`);
  } finally {
    btnConfirm.disabled = false;
    btnConfirm.innerHTML = "Salvar Finalizações";
  }
}

window.confirmarExclusao = function (servicoId, sistemaVersao) {
  currentServicoId = servicoId;
  currentSistemaVersao = sistemaVersao;
  if (confirmModalInstance) {
    confirmModalInstance.show();
  }
};

async function excluirServico() {
  if (!currentServicoId || !currentSistemaVersao) return;

  const apiUrl =
    currentSistemaVersao === "legado"
      ? `/api/servicos/${currentServicoId}`
      : `/api/ordens-servico/${currentServicoId}`;

  try {
    const response = await fetch(apiUrl, { method: "DELETE" });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Erro ao excluir.");
    }
    if (confirmModalInstance) confirmModalInstance.hide();
    await carregarServicosAtivos();
  } catch (error) {
    alert(`Erro ao excluir: ${error.message}`);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  user = JSON.parse(localStorage.getItem("user"));

  const modalResponsavelEl = document.getElementById("modalResponsavel");
  if (modalResponsavelEl) {
    modalResponsavelInstance = new bootstrap.Modal(modalResponsavelEl);
  }
  const confirmModalEl = document.getElementById("confirmModal");
  if (confirmModalEl) {
    confirmModalInstance = new bootstrap.Modal(confirmModalEl);
  }
  const finalizarItensModalEl = document.getElementById("finalizarItensModal");
  if (finalizarItensModalEl) {
    finalizarItensModalInstance = new bootstrap.Modal(finalizarItensModalEl);
  }
  const concluirModalEl = document.getElementById("concluirModal");
  if (concluirModalEl) {
    concluirModalLegadoInstance = new bootstrap.Modal(concluirModalEl);
  }

  document
    .getElementById("confirmDelete")
    .addEventListener("click", excluirServico);

  const btnSalvarFinalizacaoItens = document.getElementById(
    "btnSalvarFinalizacaoItens"
  );
  if (btnSalvarFinalizacaoItens) {
    btnSalvarFinalizacaoItens.addEventListener("click", salvarFinalizacaoItens);
  }

  document
    .getElementById("filtroIdProcesso")
    .addEventListener("input", debounce(atualizarTabela, 300));
  document
    .getElementById("filtroSubestacao")
    .addEventListener("change", atualizarTabela);
  document
    .getElementById("filtroEncarregado")
    .addEventListener("change", atualizarTabela);
  document
    .getElementById("filtroData")
    .addEventListener("change", atualizarTabela);

  carregarDadosIniciais();
  carregarServicosAtivos();
});
