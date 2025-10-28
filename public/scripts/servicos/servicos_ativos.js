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
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

function usarDataAtual() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const localDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}`;
  const localTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  document.getElementById("dataConclusao").value = localDate;
  document.getElementById("horaConclusao").value = localTime;
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
    document.getElementById(
      "tabela-servicos"
    ).innerHTML = `<tr><td colspan="10" class="text-center py-4">Falha ao carregar serviços. Tente atualizar.</td></tr>`;
  }
}

function atualizarTabela() {
  const tbody = document.getElementById("tabela-servicos");
  tbody.innerHTML = "";

  const filtroTermo = document
    .getElementById("filtroProcesso")
    .value.toLowerCase();
  const filtroSubestacao = document.getElementById("filtroSubestacao").value;
  const filtroEncarregado = document.getElementById("filtroEncarregado").value;
  const filtroData = document.getElementById("filtroData").value;
  const ordenarPor = document.getElementById("ordenarPor").value;

  let servicosFiltrados = servicosData.filter((servico) => {
    const termoMatch =
      !filtroTermo ||
      String(servico.id).includes(filtroTermo) ||
      (servico.processo &&
        String(servico.processo).toLowerCase().includes(filtroTermo));
    const subestacaoMatch =
      !filtroSubestacao || servico.subestacao === filtroSubestacao;
    const encarregadoMatch =
      !filtroEncarregado ||
      (servico.nomes_responsaveis &&
        servico.nomes_responsaveis
          .toLowerCase()
          .includes(filtroEncarregado.toLowerCase()));
    const dataMatch =
      !filtroData ||
      (servico.data_prevista_execucao &&
        servico.data_prevista_execucao.startsWith(filtroData));
    return termoMatch && subestacaoMatch && encarregadoMatch && dataMatch;
  });

  // Aplica a lógica de ordenação
  servicosFiltrados.sort((a, b) => {
    switch (ordenarPor) {
      case "id_asc":
        return a.id - b.id;
      case "id_desc":
        return b.id - a.id;
      case "data_asc":
        return (
          new Date(a.data_prevista_execucao) -
          new Date(b.data_prevista_execucao)
        );
      case "data_desc":
      default:
        return (
          new Date(b.data_prevista_execucao) -
          new Date(a.data_prevista_execucao)
        );
    }
  });

  if (servicosFiltrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4">Nenhum serviço ativo encontrado.</td></tr>`;
    return;
  }

  servicosFiltrados.forEach((servico) => {
    const tr = document.createElement("tr");
    tr.className =
      servico.tipo_processo === "Emergencial"
        ? "emergency-row"
        : "glass-table-row";
    tr.dataset.id = servico.id;

    let equipeHtml = '<span class="badge bg-warning text-dark">Pendente</span>';
    if (servico.total_responsaveis > 0) {
      const nomes = servico.nomes_responsaveis || "Equipe não informada";
      if (servico.status === "em_progresso") {
        equipeHtml = `<span class="badge bg-info text-dark" data-bs-toggle="tooltip" title="${nomes}">Em Progresso (${
          servico.concluidos_responsaveis || 0
        }/${servico.total_responsaveis})</span>`;
      } else {
        equipeHtml = `<span data-bs-toggle="tooltip" title="${nomes}">${nomes.substring(
          0,
          30
        )}${nomes.length > 30 ? "..." : ""}</span>`;
      }
    }

    let aprButtonHtml = `<button class="btn btn-sm glass-btn btn-outline-primary w-100" onclick="abrirModalUploadAPR(${servico.id})" title="Anexar APR"><span class="material-symbols-outlined">attach_file</span> Anexar</button>`;
    if (servico.caminho_apr_anexo) {
      aprButtonHtml = `
        <div class="d-flex flex-column align-items-center">
            <a href="${
              servico.caminho_apr_anexo
            }?download=true" target="_blank" class="btn btn-sm glass-btn btn-success mb-1 w-100" title="Ver/Baixar APR: ${
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
      <td>${formatarData(servico.data_prevista_execucao)}</td>
      <td>${equipeHtml}</td>
      <td>${
        servico.desligamento === "SIM"
          ? '<span class="badge bg-danger">Sim</span>'
          : '<span class="badge bg-success">Não</span>'
      }</td>
      <td class="text-center table-actions apr-actions">${aprButtonHtml}</td>
      <td>${servico.ordem_obra || "N/A"}</td>
      <td class="text-center table-actions">
        <div class="btn-group" role="group">
          <button class="btn btn-sm glass-btn me-1" onclick="window.navigateTo('/detalhes_servico?id=${
            servico.id
          }')" title="Visualizar Detalhes"><span class="material-symbols-outlined">visibility</span></button>
          <button class="btn btn-sm glass-btn btn-primary me-1" onclick="atribuirEquipe(${
            servico.id
          })" title="Atribuir Equipe"><span class="material-symbols-outlined">manage_accounts</span></button>
          <button class="btn btn-sm glass-btn btn-success me-1" onclick="abrirModalFinalizacao(${
            servico.id
          })" title="Finalizar Minha Parte"><span class="material-symbols-outlined">task_alt</span></button>
          <button class="btn btn-sm glass-btn btn-danger" onclick="confirmarExclusao(${
            servico.id
          })" title="Excluir Serviço"><span class="material-symbols-outlined">delete</span></button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });

  if (bootstrap.Tooltip) {
    new bootstrap.Tooltip(document.body, {
      selector: '[data-bs-toggle="tooltip"]',
    });
  }
}

window.abrirModalUploadAPR = (id) => {
  currentServicoId = id;
  document.getElementById("aprServicoId").value = id;
  document.getElementById("aprFile").value = "";
  document.getElementById("aprUploadProgress").style.display = "none";
  if (aprUploadModalInstance) aprUploadModalInstance.show();
};

async function submeterArquivoAPR() {
  const form = document.getElementById("formUploadAPR");
  const formData = new FormData(form);
  const servicoId = formData.get("servicoId");
  const btn = document.getElementById("btnConfirmarUploadAPR");
  btn.disabled = true;
  try {
    const res = await fetch(`/api/servicos/${servicoId}/upload-apr`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    showToast("APR enviada com sucesso!", "success");
    aprUploadModalInstance.hide();
    carregarServicosAtivos();
  } catch (error) {
    showToast("Erro ao enviar APR: " + error.message, "danger");
  } finally {
    btn.disabled = false;
  }
}

window.atribuirEquipe = async (id) => {
  currentServicoId = id;
  const modalBody = document.getElementById("modalResponsavelBody");
  modalBody.innerHTML =
    '<div class="text-center"><div class="spinner-border"></div></div>';
  modalResponsavelInstance.show();
  try {
    const [encarregadosRes, servicoRes] = await Promise.all([
      fetch("/api/encarregados"),
      fetch(`/api/servicos/${id}`),
    ]);
    if (!encarregadosRes.ok || !servicoRes.ok)
      throw new Error("Falha ao carregar dados.");
    const encarregados = await encarregadosRes.json();
    const { data: servico } = await servicoRes.json();
    const equipeAtual = servico.responsaveis.map(
      (r) => r.responsavel_matricula
    );
    modalBody.innerHTML = "";
    encarregados.forEach((enc) => {
      modalBody.innerHTML += `
        <label class="list-group-item">
          <input class="form-check-input me-1" type="checkbox" value="${
            enc.matricula
          }" ${equipeAtual.includes(enc.matricula) ? "checked" : ""}>
          ${enc.nome} (${enc.matricula})
        </label>`;
    });
    document.getElementById("filtroResponsaveis").oninput = (e) => {
      const termo = e.target.value.toLowerCase();
      modalBody.querySelectorAll(".list-group-item").forEach((item) => {
        item.style.display = item.textContent.toLowerCase().includes(termo)
          ? ""
          : "none";
      });
    };
  } catch (error) {
    modalBody.innerHTML = `<p class="text-danger">${error.message}</p>`;
  }
};

window.confirmarResponsavel = async () => {
  const responsaveis = Array.from(
    document.querySelectorAll(
      '#modalResponsavelBody input[type="checkbox"]:checked'
    )
  ).map((cb) => cb.value);
  try {
    const res = await fetch(`/api/servicos/${currentServicoId}/responsavel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responsaveis }),
    });
    if (!res.ok) throw new Error((await res.json()).message);
    showToast("Equipe atribuída com sucesso", "success");
    modalResponsavelInstance.hide();
    carregarServicosAtivos();
  } catch (error) {
    showToast("Erro ao atribuir equipe: " + error.message, "danger");
  }
};

window.confirmarExclusao = (id) => {
  currentServicoId = id;
  confirmModalInstance.show();
};
async function excluirServico() {
  try {
    const res = await fetch(`/api/servicos/${currentServicoId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    showToast("Serviço excluído com sucesso!", "success");
    confirmModalInstance.hide();
    carregarServicosAtivos();
  } catch (error) {
    showToast("Erro ao excluir serviço: " + error.message, "danger");
  }
}

function controlarCamposFinalizacao() {
  const status = document.getElementById("statusFinalServico").value;
  const obsInput = document.getElementById("observacoesFinalizacao");
  obsInput.placeholder =
    status === "concluido"
      ? "Observações da conclusão (opcional)"
      : "Motivo da não conclusão (obrigatório)";
  obsInput.required = status !== "concluido";
}

window.abrirModalFinalizacao = (id) => {
  currentServicoId = id;
  document.getElementById("formConcluirServico").reset();
  controlarCamposFinalizacao();
  usarDataAtual();
  document.getElementById("previewContainer").innerHTML = "";
  concluirModalInstance.show();
};

async function submeterFinalizacaoServico() {
  const btn = document.getElementById("btnSalvarFinalizacao");
  btn.disabled = true;
  try {
    const payload = {
      status_final: document.getElementById("statusFinalServico").value,
      dataConclusao: document.getElementById("dataConclusao").value,
      horaConclusao: document.getElementById("horaConclusao").value,
      observacoes: document.getElementById("observacoesFinalizacao").value,
      motivo_nao_conclusao:
        document.getElementById("statusFinalServico").value === "nao_concluido"
          ? document.getElementById("observacoesFinalizacao").value
          : "",
    };
    const res = await fetch(`/api/servicos/${currentServicoId}/concluir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json()).message);
    showToast((await res.json()).message, "info");
    const files = document.getElementById("fotosConclusao").files;
    if (files.length > 0) {
      for (const file of files) {
        const formData = new FormData();
        formData.append("foto_conclusao", file);
        formData.append("status_final", payload.status_final);
        await fetch(`/api/servicos/${currentServicoId}/upload-foto-conclusao`, {
          method: "POST",
          body: formData,
        });
      }
    }
    showToast("Finalização salva com sucesso!", "success");
    setTimeout(() => {
      concluirModalInstance.hide();
      carregarServicosAtivos();
    }, 1500);
  } catch (error) {
    showToast(error.message, "danger");
  } finally {
    btn.disabled = false;
  }
}

function formatarData(dataString) {
  if (!dataString) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(dataString)
  );
}

window.removerFotoPreview = (index) => {
  const input = document.getElementById("fotosConclusao");
  const dt = new DataTransfer();
  Array.from(input.files).forEach((file, i) => {
    if (i !== index) dt.items.add(file);
  });
  input.files = dt.files;
  input.dispatchEvent(new Event("change"));
};

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
  if (bootstrap) {
    confirmModalInstance = new bootstrap.Modal("#confirmModal");
    concluirModalInstance = new bootstrap.Modal("#concluirModal");
    modalResponsavelInstance = new bootstrap.Modal("#modalResponsavel");
    aprUploadModalInstance = new bootstrap.Modal("#aprUploadModal");
    accessDeniedModalInstance = new bootstrap.Modal("#access-denied-modal");
    developmentModalInstance = new bootstrap.Modal("#development-modal");
  }
  document
    .getElementById("confirmDelete")
    .addEventListener("click", excluirServico);
  document
    .getElementById("btnSalvarFinalizacao")
    .addEventListener("click", submeterFinalizacaoServico);
  document
    .getElementById("btnConfirmarUploadAPR")
    .addEventListener("click", submeterArquivoAPR);
  [
    "filtroProcesso",
    "filtroSubestacao",
    "filtroEncarregado",
    "filtroData",
  ].forEach((id) =>
    document
      .getElementById(id)
      .addEventListener("input", debounce(atualizarTabela, 300))
  );
  document
    .getElementById("ordenarPor")
    .addEventListener("change", atualizarTabela);
  document.getElementById("btnTirarFoto").onclick = () =>
    document.getElementById("fotoCamera").click();
  document.getElementById("btnAdicionarFotos").onclick = () =>
    document.getElementById("fotosConclusao").click();
  document.getElementById("fotoCamera").onchange = (e) => {
    const dt = new DataTransfer();
    Array.from(document.getElementById("fotosConclusao").files).forEach((f) =>
      dt.items.add(f)
    );
    dt.items.add(e.target.files[0]);
    document.getElementById("fotosConclusao").files = dt.files;
    document
      .getElementById("fotosConclusao")
      .dispatchEvent(new Event("change"));
  };
  document.getElementById("fotosConclusao").onchange = (e) => {
    const preview = document.getElementById("previewContainer");
    preview.innerHTML = "";
    Array.from(e.target.files).forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        preview.innerHTML += `
          <div class="col-6 col-md-4 col-lg-3 mb-2">
            <div class="preview-item position-relative" id="preview-item-${i}">
              <img src="${event.target.result}" class="img-fluid rounded">
              <button type="button" class="btn-remove position-absolute top-0 end-0 btn btn-sm btn-danger m-1" onclick="removerFotoPreview(${i})">&times;</button>
            </div>
          </div>`;
      };
      reader.readAsDataURL(file);
    });
  };
  document
    .getElementById("statusFinalServico")
    .addEventListener("change", controlarCamposFinalizacao);
  carregarDadosIniciais();
});
