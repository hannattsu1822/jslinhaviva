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
  if (!toastLiveEl) {
    return;
  }
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
  toastLiveEl.className = "toast align-items-center";
  if (type === "success") {
    toastLiveEl.classList.add("text-bg-success", "border-0");
  } else if (type === "danger") {
    toastLiveEl.classList.add("text-bg-danger", "border-0");
  } else if (type === "warning") {
    toastLiveEl.classList.add("text-bg-warning", "border-0");
  } else if (type === "info") {
    toastLiveEl.classList.add("text-bg-info", "border-0");
  } else {
    toastLiveEl.classList.add("text-bg-secondary", "border-0");
  }
  if (liveToastInstance) {
    liveToastInstance.show();
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
          option.textContent = enc.nome;
          selectEncarregado.appendChild(option);
        });
      }
    }
  } catch (error) {
    console.error("Erro ao carregar dados iniciais:", error);
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
    if (!Array.isArray(servicosData)) {
      console.error("Formato de dados de serviços inválido:", servicosData);
      throw new Error(
        "Formato de dados de serviços inválido recebido do servidor."
      );
    }
    servicosData.sort(
      (a, b) =>
        new Date(b.data_prevista_execucao) - new Date(a.data_prevista_execucao)
    );
    atualizarTabela();
  } catch (error) {
    console.error("Erro ao carregar serviços ativos:", error);
    showToast("Erro ao carregar serviços ativos: " + error.message, "danger");
    const tbody = document.getElementById("tabela-servicos");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4">Falha ao carregar serviços. Tente atualizar.</td></tr>`;
    }
  }
}

function atualizarTabela() {
  const tbody = document.getElementById("tabela-servicos");
  if (!tbody) {
    return;
  }
  tbody.innerHTML = "";
  let dadosParaFiltrar = [...servicosData];

  if (
    user &&
    user.matricula &&
    ![
      "Engenheiro",
      "Técnico",
      "ADMIN",
      "Inspetor",
      "Gerente",
      "Supervisor",
    ].includes(user.cargo)
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
          String(servico.processo).toLowerCase().includes(filtroProcesso)) ||
        String(servico.tipo_processo).toLowerCase() === "emergencial";
      const subestacaoMatch =
        filtroSubestacao === "" || servico.subestacao === filtroSubestacao;
      const encarregadoMatch =
        filtroEncarregado === "" ||
        servico.responsavel_matricula === filtroEncarregado;
      const dataMatch =
        filtroData === "" ||
        (servico.data_prevista_execucao &&
          String(servico.data_prevista_execucao).includes(filtroData));
      return processoMatch && subestacaoMatch && encarregadoMatch && dataMatch;
    })
    .slice(0, 15);

  if (servicosFiltrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4"><span class="material-symbols-outlined me-2" style="vertical-align: bottom;">info</span>Nenhum serviço ativo encontrado.</td></tr>`;
    return;
  }

  servicosFiltrados.forEach((servico) => {
    const tr = document.createElement("tr");
    tr.className =
      String(servico.tipo_processo).toLowerCase() === "emergencial"
        ? "emergency-row"
        : "glass-table-row";
    tr.setAttribute("data-id", servico.id);
    const processoDisplay =
      String(servico.tipo_processo).toLowerCase() === "emergencial"
        ? "EMERGENCIAL"
        : servico.processo;

    let aprButtonHtml = "";
    if (servico.caminho_apr_anexo) {
      aprButtonHtml = `
            <div class="d-flex flex-column align-items-center">
                <a href="${
                  servico.caminho_apr_anexo
                }?download=true" target="_blank" class="btn btn-sm glass-btn btn-success mb-1 w-100" title="Ver/Baixar APR: ${
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

    tr.innerHTML = `
      <td>${servico.id}</td>
      <td>${processoDisplay || "N/A"}</td>
      <td>${servico.subestacao || "N/A"}</td>
      <td>${servico.alimentador || "N/A"}</td>
      <td>${formatarData(servico.data_prevista_execucao)}</td>
      <td>${
        servico.responsavel_matricula === "pendente"
          ? '<span class="badge bg-warning text-dark">Pendente</span>'
          : (servico.responsavel_matricula || "N/A") +
            " - " +
            (servico.responsavel_nome || "Não Atribuído")
      }</td>
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
          <button class="btn btn-sm glass-btn btn-primary me-1" onclick="selecionarResponsavel(${
            servico.id
          })" title="Selecionar Responsável"><span class="material-symbols-outlined">manage_accounts</span></button>
          <button class="btn btn-sm glass-btn btn-success me-1" onclick="abrirModalFinalizacao(${
            servico.id
          })" title="Finalizar Serviço (Concluir/Não Concluir)"><span class="material-symbols-outlined">task_alt</span></button>
          <button class="btn btn-sm glass-btn btn-danger" onclick="confirmarExclusao(${
            servico.id
          })" title="Excluir Serviço"><span class="material-symbols-outlined">delete</span></button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

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
    showToast("Por favor, selecione um arquivo para a APR.", "warning");
    return;
  }
  if (aprFile.size > 10 * 1024 * 1024) {
    showToast("O arquivo excede o limite de 10MB.", "danger");
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
    showToast(result.message || "APR enviada com sucesso!", "success");

    setTimeout(() => {
      if (aprUploadModalInstance) aprUploadModalInstance.hide();
      carregarServicosAtivos();
    }, 1000);
  } catch (error) {
    if (progressInterval) clearInterval(progressInterval);
    if (progressBar) {
      progressBar.textContent = "Falha!";
      progressBar.classList.add("bg-danger");
    }
    showToast("Erro ao enviar APR: " + error.message, "danger");
    if (aprUploadProgress) aprUploadProgress.style.display = "none";
  } finally {
    if (btnConfirmarUploadAPR) {
      btnConfirmarUploadAPR.disabled = false;
      btnConfirmarUploadAPR.innerHTML = "Enviar APR";
    }
  }
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
                          `<option value="${r.matricula}">${r.nome}</option>`
                      )
                      .join("")}
                </select>
            </div>`;
    }
    if (modalResponsavelInstance) modalResponsavelInstance.show();
  } catch (error) {
    console.error("Erro ao carregar responsáveis:", error);
    showToast(
      "Erro ao carregar lista de responsáveis: " + error.message,
      "danger"
    );
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
    btnDelete.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Excluindo...';
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
    if (btnDelete) {
      btnDelete.disabled = false;
      btnDelete.innerHTML = originalText;
    }
  }
}

function controlarCamposFinalizacao() {
  const statusFinalSelect = document.getElementById("statusFinalServico");
  const camposSomenteConcluido = document.getElementById(
    "camposSomenteConcluido"
  );
  const dataConclusaoInput = document.getElementById("dataConclusao");
  const horaConclusaoInput = document.getElementById("horaConclusao");
  const observacoesFinalizacaoInput = document.getElementById(
    "observacoesFinalizacao"
  );

  if (
    !statusFinalSelect ||
    !camposSomenteConcluido ||
    !dataConclusaoInput ||
    !horaConclusaoInput ||
    !observacoesFinalizacaoInput
  )
    return;

  camposSomenteConcluido.style.display = "block";
  dataConclusaoInput.required = true;
  horaConclusaoInput.required = true;

  if (statusFinalSelect.value === "concluido") {
    observacoesFinalizacaoInput.placeholder =
      "Observações da conclusão (opcional)";
    observacoesFinalizacaoInput.required = false;
  } else {
    observacoesFinalizacaoInput.placeholder =
      "Motivo da não conclusão (obrigatório)";
    observacoesFinalizacaoInput.required = true;
  }
}

window.abrirModalFinalizacao = function (id) {
  currentServicoId = id;
  const form = document.getElementById("formConcluirServico");
  if (form) form.reset();

  const statusFinalSelect = document.getElementById("statusFinalServico");
  if (statusFinalSelect) statusFinalSelect.value = "concluido";

  controlarCamposFinalizacao();
  usarDataAtual();

  const previewContainer = document.getElementById("previewContainer");
  if (previewContainer) previewContainer.innerHTML = "";

  if (concluirModalInstance) {
    concluirModalInstance.show();
  }
};

async function submeterFinalizacaoServico() {
  const btnSalvarFinalizacao = document.getElementById("btnSalvarFinalizacao");
  if (!btnSalvarFinalizacao) return;

  const originalBtnText = btnSalvarFinalizacao.innerHTML;
  btnSalvarFinalizacao.disabled = true;
  btnSalvarFinalizacao.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processando...';

  const statusFinal = document.getElementById("statusFinalServico").value;
  const observacoes = document.getElementById("observacoesFinalizacao").value;
  const dataConclusao = document.getElementById("dataConclusao").value;
  const horaConclusao = document.getElementById("horaConclusao").value;
  const fotosInput = document.getElementById("fotosConclusao");
  const files = fotosInput ? Array.from(fotosInput.files) : [];

  try {
    const infoPayload = {
      status_final: statusFinal,
      dataConclusao: dataConclusao,
      horaConclusao: horaConclusao,
      observacoes: observacoes,
    };
    if (statusFinal === "nao_concluido") {
      infoPayload.motivo_nao_conclusao = observacoes;
    }

    const infoResponse = await fetch(
      `/api/servicos/${currentServicoId}/concluir`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(infoPayload),
      }
    );

    const infoResult = await infoResponse.json();
    if (!infoResponse.ok) {
      throw new Error(
        infoResult.message || "Erro ao salvar informações do serviço."
      );
    }
    showToast(infoResult.message, "info");

    if (files.length > 0) {
      showToast(`Iniciando upload de ${files.length} arquivos...`, "info");
      const errosUpload = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const previewItem = document.getElementById(`preview-item-${i}`);
        const statusOverlay = previewItem
          ? previewItem.querySelector(".upload-status-overlay")
          : null;

        if (statusOverlay) {
          statusOverlay.classList.remove("d-none");
          statusOverlay.innerHTML =
            '<div class="spinner-border spinner-border-sm text-light" role="status"></div>';
        }

        const fileFormData = new FormData();
        fileFormData.append("foto_conclusao", file);
        fileFormData.append("status_final", statusFinal);

        try {
          const fileResponse = await fetch(
            `/api/servicos/${currentServicoId}/upload-foto-conclusao`,
            {
              method: "POST",
              body: fileFormData,
            }
          );

          const fileResult = await fileResponse.json();
          if (!fileResponse.ok) {
            throw new Error(
              fileResult.message || `Falha no upload de ${file.name}`
            );
          }

          if (statusOverlay) {
            statusOverlay.innerHTML =
              '<span class="material-symbols-outlined text-success">check_circle</span>';
          }
        } catch (uploadError) {
          errosUpload.push(`${file.name}: ${uploadError.message}`);
          if (statusOverlay) {
            statusOverlay.innerHTML =
              '<span class="material-symbols-outlined text-danger">error</span>';
          }
        }
      }

      if (errosUpload.length > 0) {
        showToast(`Concluído com ${errosUpload.length} erros.`, "warning");
        console.error("Erros de upload:", errosUpload);
      } else {
        showToast("Todos os arquivos foram enviados com sucesso!", "success");
      }
    }

    setTimeout(async () => {
      if (concluirModalInstance) concluirModalInstance.hide();
      await carregarServicosAtivos();
    }, 1500);
  } catch (error) {
    console.error("Erro ao finalizar serviço:", error);
    showToast(error.message, "danger");
  } finally {
    btnSalvarFinalizacao.disabled = false;
    btnSalvarFinalizacao.innerHTML = originalBtnText;
  }
}

function formatarData(dataString) {
  if (!dataString) return "Não informado";
  try {
    const data = new Date(dataString);
    if (isNaN(data.getTime())) return "Data inválida";
    const dia = String(data.getUTCDate()).padStart(2, "0");
    const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
    const ano = data.getUTCFullYear();
    return `${dia}/${mes}/${ano}`;
  } catch (e) {
    console.error("Erro ao formatar data:", dataString, e);
    return "Data inválida";
  }
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

  if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
    const confirmModalEl = document.getElementById("confirmModal");
    if (confirmModalEl)
      confirmModalInstance = new bootstrap.Modal(confirmModalEl);
    const concluirModalEl = document.getElementById("concluirModal");
    if (concluirModalEl)
      concluirModalInstance = new bootstrap.Modal(concluirModalEl);
    const toastLiveEl = document.getElementById("liveToast");
    if (toastLiveEl) liveToastInstance = new bootstrap.Toast(toastLiveEl);
    const modalResponsavelEl = document.getElementById("modalResponsavel");
    if (modalResponsavelEl)
      modalResponsavelInstance = new bootstrap.Modal(modalResponsavelEl);
    const aprUploadModalEl = document.getElementById("aprUploadModal");
    if (aprUploadModalEl)
      aprUploadModalInstance = new bootstrap.Modal(aprUploadModalEl);
    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);
    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
  }

  const confirmDeleteBtn = document.getElementById("confirmDelete");
  if (confirmDeleteBtn)
    confirmDeleteBtn.addEventListener("click", excluirServico);

  const btnSalvarFinalizacao = document.getElementById("btnSalvarFinalizacao");
  if (btnSalvarFinalizacao) {
    btnSalvarFinalizacao.addEventListener("click", submeterFinalizacaoServico);
  }

  const btnConfirmarUploadAPR = document.getElementById(
    "btnConfirmarUploadAPR"
  );
  if (btnConfirmarUploadAPR)
    btnConfirmarUploadAPR.addEventListener("click", submeterArquivoAPR);

  const filtroProcessoInput = document.getElementById("filtroProcesso");
  if (filtroProcessoInput)
    filtroProcessoInput.addEventListener(
      "input",
      debounce(atualizarTabela, 300)
    );
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
  const btnAdicionarFotos = document.getElementById("btnAdicionarFotos");
  const fotosConclusaoInputGlobal = document.getElementById("fotosConclusao");
  const fotoCameraInputGlobal = document.getElementById("fotoCamera");

  if (btnTirarFoto && (fotosConclusaoInputGlobal || fotoCameraInputGlobal)) {
    btnTirarFoto.addEventListener("click", function () {
      if (isMobileDevice() && fotoCameraInputGlobal) {
        fotoCameraInputGlobal.click();
      } else if (fotosConclusaoInputGlobal) {
        fotosConclusaoInputGlobal.click();
      }
    });
  }
  if (btnAdicionarFotos && fotosConclusaoInputGlobal) {
    btnAdicionarFotos.addEventListener("click", function () {
      fotosConclusaoInputGlobal.click();
    });
  }
  if (fotoCameraInputGlobal && fotosConclusaoInputGlobal) {
    fotoCameraInputGlobal.addEventListener("change", function (e) {
      if (this.files.length > 0) {
        const dataTransfer = new DataTransfer();
        Array.from(fotosConclusaoInputGlobal.files).forEach((file) =>
          dataTransfer.items.add(file)
        );
        dataTransfer.items.add(this.files[0]);
        fotosConclusaoInputGlobal.files = dataTransfer.files;
        fotosConclusaoInputGlobal.dispatchEvent(
          new Event("change", { bubbles: true })
        );
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
        this.value = "";
        return;
      }

      Array.from(this.files).forEach((file, index) => {
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = function (event) {
            const col = document.createElement("div");
            col.className = "col-6 col-md-4 col-lg-3 mb-2";
            col.innerHTML = `
                <div class="preview-item position-relative" id="preview-item-${index}">
                    <img src="${event.target.result}" alt="Preview ${
              index + 1
            }" class="img-fluid rounded">
                    <button type="button" class="btn-remove position-absolute top-0 end-0 btn btn-sm btn-danger m-1" onclick="removerFotoPreview(${index})" style="line-height: 1; padding: 0.1rem 0.3rem;">
                        <span class="material-symbols-outlined" style="font-size: 0.8em;">close</span>
                    </button>
                    <div class="upload-status-overlay d-none">
                        <div class="spinner-border spinner-border-sm text-light" role="status"></div>
                    </div>
                </div>`;
            previewContainer.appendChild(col);
          };
          reader.readAsDataURL(file);
        }
      });
    });
  }

  const statusFinalSelect = document.getElementById("statusFinalServico");
  if (statusFinalSelect) {
    statusFinalSelect.addEventListener("change", controlarCamposFinalizacao);
  }

  carregarDadosIniciais();
});
