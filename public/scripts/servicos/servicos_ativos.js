// public/scripts/servicos/servicos_ativos.js

let servicosData = [];
let currentServicoId = null;
let confirmModalInstance;
let concluirModalInstance;
let liveToastInstance; // Declarada globalmente no script
let modalResponsavelInstance;
let accessDeniedModalInstance;
let developmentModalInstance;
let user = null;

// Função para mostrar notificação (Toast)
function showToast(message, type = "success") {
  const toastLiveEl = document.getElementById("liveToast"); // Obtém o elemento toda vez ou garante que liveToastInstance está pronta
  if (!toastLiveEl) {
    console.error("Elemento #liveToast não encontrado no DOM.");
    return;
  }

  // Inicializa a instância do Toast se ainda não foi e o elemento existe
  if (
    !liveToastInstance &&
    typeof bootstrap !== "undefined" &&
    bootstrap.Toast
  ) {
    liveToastInstance = new bootstrap.Toast(toastLiveEl);
  }

  const toastBody = toastLiveEl.querySelector(".toast-body");
  if (toastBody) {
    toastBody.textContent = message;
  }

  // Reset classes e define a cor do background
  toastLiveEl.className = "toast align-items-center"; // Bootstrap 5.2+ para centralizar
  if (type === "success") {
    toastLiveEl.classList.add("text-bg-success", "border-0");
  } else if (type === "danger") {
    toastLiveEl.classList.add("text-bg-danger", "border-0");
  } else if (type === "warning") {
    toastLiveEl.classList.add("text-bg-warning", "border-0");
  } else {
    toastLiveEl.classList.add("text-bg-secondary", "border-0"); // Um fallback
  }

  if (liveToastInstance) {
    liveToastInstance.show();
  } else {
    console.error(
      "Instância do Toast não pôde ser criada/encontrada para #liveToast."
    );
  }
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
  const dataConclusaoInput = document.getElementById("dataConclusao");
  const horaConclusaoInput = document.getElementById("horaConclusao");
  if (dataConclusaoInput) dataConclusaoInput.value = localDate;
  if (horaConclusaoInput) horaConclusaoInput.value = localTime;
}

async function carregarDadosIniciais() {
  try {
    await carregarServicosAtivos();
    const responseSubestacoes = await fetch("/api/subestacoes");
    if (responseSubestacoes.ok) {
      const subestacoes = await responseSubestacoes.json();
      const selectSubestacao = document.getElementById("filtroSubestacao");
      if (selectSubestacao) {
        subestacoes.forEach((sub) => {
          const option = document.createElement("option");
          option.value = sub.nome;
          option.textContent = sub.nome;
          selectSubestacao.appendChild(option);
        });
      }
    }
    const responseEncarregados = await fetch("/api/encarregados");
    if (responseEncarregados.ok) {
      const encarregados = await responseEncarregados.json();
      const selectEncarregado = document.getElementById("filtroEncarregado");
      if (selectEncarregado) {
        encarregados.forEach((enc) => {
          const option = document.createElement("option");
          option.value = enc.matricula;
          option.textContent = `${enc.matricula} - ${enc.nome}`;
          selectEncarregado.appendChild(option);
        });
      }
    }
  } catch (error) {
    console.error("Erro ao carregar dados iniciais:", error);
    showToast("Erro ao carregar dados iniciais", "danger");
  }
}

async function carregarServicosAtivos() {
  try {
    const response = await fetch("/api/servicos?status=ativo");
    if (!response.ok) {
      throw new Error("Erro ao carregar serviços");
    }
    servicosData = await response.json();
    if (!Array.isArray(servicosData)) {
      throw new Error("Formato de dados inválido");
    }
    servicosData.sort(
      (a, b) =>
        new Date(b.data_prevista_execucao) - new Date(a.data_prevista_execucao)
    );
    atualizarTabela();
  } catch (error) {
    console.error("Erro ao carregar serviços:", error);
    showToast("Erro ao carregar serviços: " + error.message, "danger");
  }
}

function atualizarTabela() {
  const tbody = document.getElementById("tabela-servicos");
  if (!tbody) return;
  tbody.innerHTML = "";
  let dadosParaFiltrar = [...servicosData];
  if (
    user &&
    user.matricula &&
    !["Engenheiro", "Técnico", "ADMIN", "Inspetor"].includes(user.cargo)
  ) {
    dadosParaFiltrar = dadosParaFiltrar.filter(
      (s) => s.responsavel_matricula === user.matricula
    );
  }
  const filtroProcessoInput = document.getElementById("filtroProcesso");
  const filtroSubestacaoSelect = document.getElementById("filtroSubestacao");
  const filtroEncarregadoSelect = document.getElementById("filtroEncarregado");
  const filtroDataInput = document.getElementById("filtroData");
  const filtroProcesso = filtroProcessoInput
    ? filtroProcessoInput.value.toLowerCase()
    : "";
  const filtroSubestacao = filtroSubestacaoSelect
    ? filtroSubestacaoSelect.value
    : "";
  const filtroEncarregado = filtroEncarregadoSelect
    ? filtroEncarregadoSelect.value
    : "";
  const filtroData = filtroDataInput ? filtroDataInput.value : "";
  const servicosFiltrados = dadosParaFiltrar
    .filter((servico) => {
      const processoMatch =
        filtroProcesso === "" ||
        (servico.processo &&
          servico.processo.toLowerCase().includes(filtroProcesso)) ||
        servico.prioridade === "EMERGENCIAL";
      const subestacaoMatch =
        filtroSubestacao === "" || servico.subestacao === filtroSubestacao;
      const encarregadoMatch =
        filtroEncarregado === "" ||
        servico.responsavel_matricula === filtroEncarregado;
      const dataMatch =
        filtroData === "" ||
        (servico.data_prevista_execucao &&
          servico.data_prevista_execucao.includes(filtroData));
      return processoMatch && subestacaoMatch && encarregadoMatch && dataMatch;
    })
    .slice(0, 15);
  if (servicosFiltrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4"><i class="fas fa-info-circle me-2"></i>Nenhum serviço encontrado com os filtros aplicados.</td></tr>`;
    return;
  }
  servicosFiltrados.forEach((servico) => {
    const tr = document.createElement("tr");
    tr.className =
      servico.prioridade === "EMERGENCIAL"
        ? "emergency-row"
        : "glass-table-row";
    tr.setAttribute("data-id", servico.id);
    const processoDisplay =
      servico.prioridade === "EMERGENCIAL" ? "EMERGENCIAL" : servico.processo;
    tr.innerHTML = `
      <td>${servico.id}</td>
      <td>${processoDisplay}</td>
      <td>${servico.subestacao || "N/A"}</td>
      <td>${servico.alimentador || "N/A"}</td>
      <td>${formatarData(servico.data_prevista_execucao)}</td>
      <td>${
        servico.responsavel_matricula === "pendente"
          ? '<span class="badge bg-warning text-dark">Pendente</span>'
          : (servico.responsavel_matricula || "N/A") +
            " - " +
            (servico.responsavel || servico.responsavel_nome || "Não Atribuído")
      }</td>
      <td>${
        servico.desligamento === "SIM"
          ? '<span class="badge bg-danger">Sim</span>'
          : '<span class="badge bg-success">Não</span>'
      }</td>
      <td class="text-center">
        <div class="btn-group" role="group">
          <button class="btn btn-sm glass-btn me-1" onclick="window.navigateTo('/detalhes_servico?id=${
            servico.id
          }')" title="Visualizar"><i class="fas fa-eye"></i></button>
          <button class="btn btn-sm glass-btn btn-primary me-1" onclick="selecionarResponsavel(${
            servico.id
          })" title="Selecionar Responsável"><i class="fas fa-user-edit"></i></button>
          <button class="btn btn-sm glass-btn btn-success me-1" onclick="concluirServico(${
            servico.id
          })" title="Concluir Serviço"><i class="fas fa-check-circle"></i></button>
          <button class="btn btn-sm glass-btn btn-danger" onclick="confirmarExclusao(${
            servico.id
          })" title="Excluir Serviço"><i class="fas fa-trash"></i></button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

window.selecionarResponsavel = async function (servicoId) {
  currentServicoId = servicoId;
  try {
    const response = await fetch("/api/encarregados", {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Erro ao carregar responsáveis");
    const responsaveis = await response.json();
    const modalBody = document.getElementById("modalResponsavelBody");
    if (modalBody) {
      modalBody.innerHTML = `
            <div class="mb-3">
                <label for="selectResponsavel" class="form-label">Selecione o Responsável:</label>
                <select class="form-select glass-input" id="selectResponsavel">
                    <option value="">Selecione um responsável...</option>
                    <option value="pendente">Pendente</option>
                    ${responsaveis
                      .map(
                        (r) =>
                          `<option value="${r.matricula}">${r.matricula} - ${r.nome}</option>`
                      )
                      .join("")}
                </select>
            </div>`;
    }
    if (modalResponsavelInstance) modalResponsavelInstance.show();
  } catch (error) {
    console.error("Erro ao carregar responsáveis:", error);
    showToast("Erro ao carregar lista de responsáveis", "danger");
  }
};

window.confirmarResponsavel = async function () {
  const select = document.getElementById("selectResponsavel");
  if (!select) return;
  const responsavelMatricula = select.value;
  if (!responsavelMatricula) {
    showToast("Selecione um responsável", "warning");
    return;
  }
  try {
    const response = await fetch(
      `/api/servicos/${currentServicoId}/responsavel`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responsavel_matricula: responsavelMatricula }),
      }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Erro ao atualizar responsável");
    }
    showToast("Responsável atribuído com sucesso", "success");
    if (modalResponsavelInstance) modalResponsavelInstance.hide();
    await carregarServicosAtivos();
  } catch (error) {
    console.error("Erro ao atribuir responsável:", error);
    showToast("Erro ao atribuir responsável: " + error.message, "danger");
  }
};

window.confirmarExclusao = function (id) {
  currentServicoId = id;
  if (confirmModalInstance) confirmModalInstance.show();
};

async function excluirServico() {
  const btnDelete = document.getElementById("confirmDelete");
  if (!btnDelete) return;
  const originalText = btnDelete.innerHTML;
  try {
    btnDelete.disabled = true;
    btnDelete.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Excluindo...';
    const response = await fetch(`/api/servicos/${currentServicoId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Erro ao excluir serviço");
    }
    showToast("Serviço excluído com sucesso!", "success");
    if (confirmModalInstance) confirmModalInstance.hide();
    await carregarServicosAtivos();
  } catch (error) {
    console.error("Erro ao excluir serviço:", error);
    showToast("Erro ao excluir serviço: " + error.message, "danger");
  } finally {
    btnDelete.disabled = false;
    btnDelete.innerHTML = originalText;
  }
}

window.concluirServico = function (id) {
  currentServicoId = id;
  usarDataAtual();
  const obsConclusao = document.getElementById("observacoesConclusao");
  const fotosConclusaoInput = document.getElementById("fotosConclusao");
  const fotoCameraInput = document.getElementById("fotoCamera");
  const previewContainer = document.getElementById("previewContainer");

  if (obsConclusao) obsConclusao.value = "";
  if (fotosConclusaoInput) fotosConclusaoInput.value = "";
  if (fotoCameraInput) fotoCameraInput.value = "";
  if (previewContainer) previewContainer.innerHTML = "";

  if (concluirModalInstance) concluirModalInstance.show();
};

async function finalizarServico() {
  const btnConcluir = document.getElementById("confirmConcluir");
  if (!btnConcluir) return;
  const originalText = btnConcluir.innerHTML;
  try {
    btnConcluir.disabled = true;
    btnConcluir.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Processando...';
    const dataInput = document.getElementById("dataConclusao").value;
    const horaInput = document.getElementById("horaConclusao").value;
    const observacoes = document.getElementById("observacoesConclusao").value;
    const fotosInput = document.getElementById("fotosConclusao");
    const formData = new FormData();

    if (!dataInput || !horaInput)
      throw new Error("Preencha data e hora de conclusão");
    formData.append("dataConclusao", dataInput);
    formData.append("horaConclusao", horaInput);
    formData.append("observacoes", observacoes);

    if (fotosInput && fotosInput.files.length > 0) {
      for (let i = 0; i < fotosInput.files.length; i++) {
        formData.append("fotos_conclusao", fotosInput.files[i]);
      }
    }

    const response = await fetch(`/api/servicos/${currentServicoId}/concluir`, {
      method: "POST",
      body: formData,
    });
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(text || "Resposta inválida do servidor ao concluir");
    }
    const data = await response.json();
    if (!response.ok || !data.success)
      throw new Error(data.message || "Erro ao concluir serviço");

    const formConcluir = document.getElementById("formConcluirServico");
    const previewContainer = document.getElementById("previewContainer");
    if (formConcluir) formConcluir.reset();
    if (previewContainer) previewContainer.innerHTML = "";

    showToast(data.message || "Serviço concluído com sucesso!", "success");
    if (concluirModalInstance) concluirModalInstance.hide();
    await carregarServicosAtivos();
  } catch (error) {
    console.error("Erro ao concluir serviço:", error);
    let errorMessage = error.message;
    if (errorMessage.startsWith("<!DOCTYPE"))
      errorMessage = "Erro interno no servidor ao concluir serviço";
    showToast(errorMessage, "danger");
  } finally {
    btnConcluir.disabled = false;
    btnConcluir.innerHTML = originalText;
  }
}

function formatarData(dataString) {
  if (!dataString) return "Não informado";
  const data = new Date(dataString);
  if (isNaN(data.getTime())) return "Data inválida"; // Checa se a data é válida
  const dia = String(data.getUTCDate()).padStart(2, "0");
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const ano = data.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

window.removerFotoPreview = function (index) {
  const input = document.getElementById("fotosConclusao");
  if (!input) return;
  const files = Array.from(input.files);
  files.splice(index, 1);
  const dataTransfer = new DataTransfer();
  files.forEach((file) => dataTransfer.items.add(file));
  input.files = dataTransfer.files;
  const event = new Event("change", { bubbles: true });
  input.dispatchEvent(event);
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
      if (developmentModalInstance) developmentModalInstance.show();
      else alert("Erro ao tentar acessar a página.");
    }
  } catch (error) {
    if (developmentModalInstance) developmentModalInstance.show();
    else alert("Erro de rede ou falha na navegação.");
  }
};

document.addEventListener("DOMContentLoaded", function () {
  user = JSON.parse(localStorage.getItem("user"));

  if (typeof bootstrap !== "undefined") {
    const confirmModalEl = document.getElementById("confirmModal");
    if (confirmModalEl)
      confirmModalInstance = new bootstrap.Modal(confirmModalEl);

    const concluirModalEl = document.getElementById("concluirModal");
    if (concluirModalEl)
      concluirModalInstance = new bootstrap.Modal(concluirModalEl);

    const toastLiveEl = document.getElementById("liveToast"); // Mover para cá para garantir que bootstrap está carregado
    if (toastLiveEl) liveToastInstance = new bootstrap.Toast(toastLiveEl);

    const modalResponsavelEl = document.getElementById("modalResponsavel");
    if (modalResponsavelEl)
      modalResponsavelInstance = new bootstrap.Modal(modalResponsavelEl);

    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);

    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
  } else {
    console.error(
      "Bootstrap não está carregado. Modais e Toast não funcionarão."
    );
  }

  const confirmDeleteBtn = document.getElementById("confirmDelete");
  if (confirmDeleteBtn)
    confirmDeleteBtn.addEventListener("click", excluirServico);

  const confirmConcluirBtn = document.getElementById("confirmConcluir");
  if (confirmConcluirBtn)
    confirmConcluirBtn.addEventListener("click", finalizarServico);

  const filtroProcessoInput = document.getElementById("filtroProcesso");
  if (filtroProcessoInput)
    filtroProcessoInput.addEventListener("input", atualizarTabela);

  const filtroSubestacaoSelect = document.getElementById("filtroSubestacao");
  if (filtroSubestacaoSelect)
    filtroSubestacaoSelect.addEventListener("change", atualizarTabela);

  const filtroEncarregadoSelect = document.getElementById("filtroEncarregado");
  if (filtroEncarregadoSelect)
    filtroEncarregadoSelect.addEventListener("change", atualizarTabela);

  const filtroDataInput = document.getElementById("filtroData");
  if (filtroDataInput)
    filtroDataInput.addEventListener("change", atualizarTabela);

  const btnTirarFoto = document.getElementById("btnTirarFoto");
  if (btnTirarFoto) {
    btnTirarFoto.addEventListener("click", function () {
      if (isMobileDevice()) {
        const fotoCameraInput = document.getElementById("fotoCamera");
        if (fotoCameraInput) fotoCameraInput.click();
      } else {
        const fotosConclusaoInput = document.getElementById("fotosConclusao");
        if (fotosConclusaoInput) fotosConclusaoInput.click();
      }
    });
  }

  const btnAdicionarFotos = document.getElementById("btnAdicionarFotos");
  const fotosConclusaoInputGlobal = document.getElementById("fotosConclusao");
  if (btnAdicionarFotos && fotosConclusaoInputGlobal) {
    btnAdicionarFotos.addEventListener("click", function () {
      fotosConclusaoInputGlobal.click();
    });
  }

  const fotoCameraInputGlobal = document.getElementById("fotoCamera");
  if (fotoCameraInputGlobal && fotosConclusaoInputGlobal) {
    fotoCameraInputGlobal.addEventListener("change", function (e) {
      if (this.files.length > 0) {
        const dataTransfer = new DataTransfer();
        for (let i = 0; i < fotosConclusaoInputGlobal.files.length; i++) {
          dataTransfer.items.add(fotosConclusaoInputGlobal.files[i]);
        }
        dataTransfer.items.add(this.files[0]);
        fotosConclusaoInputGlobal.files = dataTransfer.files;
        const event = new Event("change", { bubbles: true });
        fotosConclusaoInputGlobal.dispatchEvent(event);
        this.value = "";
      }
    });
  }

  if (fotosConclusaoInputGlobal) {
    fotosConclusaoInputGlobal.addEventListener("change", function (e) {
      const previewContainer = document.getElementById("previewContainer");
      if (!previewContainer) return;
      previewContainer.innerHTML = "";

      if (this.files.length > 5) {
        showToast("Máximo de 5 fotos permitidas!", "danger");
        this.value = ""; // Limpa a seleção de arquivos
        return;
      }

      Array.from(this.files).forEach((file, index) => {
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = function (event) {
            const col = document.createElement("div");
            col.className = "col-6 col-md-4 col-lg-3 mb-2";
            col.innerHTML = `
                            <div class="preview-item position-relative">
                                <img src="${
                                  event.target.result
                                }" alt="Preview ${
              index + 1
            }" class="img-fluid rounded">
                                <button type="button" class="btn-remove position-absolute top-0 end-0 btn btn-sm btn-danger m-1" onclick="removerFotoPreview(${index})" style="line-height: 1; padding: 0.1rem 0.3rem;">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>`;
            previewContainer.appendChild(col);
          };
          reader.readAsDataURL(file);
        }
      });
    });
  }

  carregarDadosIniciais();
});
