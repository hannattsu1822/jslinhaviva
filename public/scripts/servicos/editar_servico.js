// public/scripts/servicos/editar_servico.js
document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const servicoId = urlParams.get("id");

  const servicoIdInput = document.getElementById("servicoId");
  if (servicoIdInput) servicoIdInput.value = servicoId;

  if (!servicoId) {
    alert("ID do serviço não especificado");
    window.location.href = "/servicos_ativos";
    return;
  }

  await carregarDadosServico(servicoId);
  await carregarResponsaveis(); // Carregar a lista de responsáveis

  const desligamentoSelect = document.getElementById("desligamento");
  if (desligamentoSelect) {
    desligamentoSelect.addEventListener("change", function () {
      const mostrarHorarios = this.value === "SIM";
      const horariosContainer = document.getElementById("horariosContainer");
      const horaInicioInput = document.getElementById("horaInicio");
      const horaFimInput = document.getElementById("horaFim");

      if (horariosContainer)
        horariosContainer.style.display = mostrarHorarios ? "flex" : "none";

      if (mostrarHorarios) {
        if (horaInicioInput) horaInicioInput.setAttribute("required", "");
        if (horaFimInput) horaFimInput.setAttribute("required", "");
      } else {
        if (horaInicioInput) horaInicioInput.removeAttribute("required");
        if (horaFimInput) horaFimInput.removeAttribute("required");
      }
    });
    desligamentoSelect.dispatchEvent(new Event("change"));
  }

  const novosAnexosInput = document.getElementById("novosAnexos");
  if (novosAnexosInput) {
    novosAnexosInput.addEventListener("change", function () {
      const previewContainer = document.getElementById("previewNovosAnexos");
      if (!previewContainer) return;
      previewContainer.innerHTML = "";

      Array.from(this.files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = function (e) {
          const previewItem = document.createElement("div");
          previewItem.className = "preview-item";

          if (file.type.startsWith("image/")) {
            previewItem.innerHTML = `
                            <img src="${e.target.result}" class="img-thumbnail" style="max-width: 100px; max-height: 100px; object-fit: cover;">
                            <div class="small text-truncate mt-1" style="max-width: 100px;">${file.name}</div>
                        `;
          } else {
            previewItem.innerHTML = `
                            <div class="text-center">
                                <i class="fas ${getFileIcon(
                                  file.name
                                )} fa-2x mb-1"></i>
                                <div class="small text-truncate" style="max-width: 100px;">${
                                  file.name
                                }</div>
                            </div>
                        `;
          }
          previewContainer.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
      });
    });
  }

  const mapsInput = document.getElementById("maps");
  if (mapsInput) {
    mapsInput.addEventListener("blur", function () {
      validarMapsCampo(this);
    });
  }

  const editarServicoForm = document.getElementById("editarServicoForm");
  if (editarServicoForm) {
    editarServicoForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      await salvarAlteracoes(servicoId);
    });
  }

  const cancelButton = document.querySelector(
    ".form-header .btn-outline-secondary"
  );
  if (cancelButton) {
    cancelButton.href = `/detalhes_servico?id=${servicoId}`;
  }
});

async function carregarResponsaveis() {
  const selectResponsavel = document.getElementById("servico-responsavel");
  if (!selectResponsavel) return;

  try {
    const response = await fetch("/api/encarregados");
    if (!response.ok) {
      throw new Error("Falha ao carregar responsáveis");
    }
    const responsaveis = await response.json();

    // Guardar o valor atual antes de limpar as opções
    const valorAtual = selectResponsavel.value;
    selectResponsavel.innerHTML =
      '<option value="">Selecione um responsável...</option>'; // Limpa e adiciona a opção padrão

    responsaveis.forEach((resp) => {
      const option = document.createElement("option");
      option.value = resp.matricula;
      option.textContent = `${resp.nome} (${resp.matricula})`;
      selectResponsavel.appendChild(option);
    });

    // Restaurar o valor se ele ainda existir na nova lista ou se for 'pendente'
    if (valorAtual) {
      if (
        Array.from(selectResponsavel.options).some(
          (opt) => opt.value === valorAtual
        )
      ) {
        selectResponsavel.value = valorAtual;
      } else if (valorAtual === "pendente") {
        // Se era pendente e não há mais opção "pendente" explícita, manter como vazio/selecione
        selectResponsavel.value = "";
      }
    }
  } catch (error) {
    console.error("Erro ao carregar responsáveis:", error);
    selectResponsavel.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

function validarMaps(url) {
  if (!url || url.trim() === "") return true;
  const patterns = [
    /^(https?:\/\/)?(www\.)?google\.[a-z\.]{2,6}\/maps\/.+/i,
    /^(https?:\/\/)?maps\.google\.[a-z\.]{2,6}\/.+/i,
    /^(https?:\/\/)?goo\.gl\/maps\/.+/i,
    /^(https?:\/\/)?maps\.app\.goo\.gl\/.+/i,
  ];
  return patterns.some((pattern) => pattern.test(url));
}

function validarMapsCampo(input) {
  const url = input.value.trim();
  const feedbackEl =
    input.parentElement.querySelector(".invalid-feedback") ||
    input.nextElementSibling;

  if (url && !validarMaps(url)) {
    input.classList.add("is-invalid");
    if (feedbackEl && feedbackEl.classList.contains("invalid-feedback"))
      feedbackEl.style.display = "block";
    return false;
  } else {
    input.classList.remove("is-invalid");
    if (feedbackEl && feedbackEl.classList.contains("invalid-feedback"))
      feedbackEl.style.display = "none";
    return true;
  }
}

async function carregarDadosServico(servicoId) {
  try {
    const response = await fetch(`/api/servicos/${servicoId}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro raw do servidor:", errorText);
      let errorMsg = "Erro ao carregar dados do serviço";
      try {
        const errorData = JSON.parse(errorText);
        errorMsg = errorData.message || errorMsg;
      } catch (e) {
        errorMsg = `Erro ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMsg);
    }

    const result = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.message || "Dados do serviço não encontrados.");
    }
    const data = result.data;

    document.getElementById("subestacao").value = data.subestacao || "";
    document.getElementById("alimentador").value = data.alimentador || "";
    document.getElementById("chaveMontante").value = data.chave_montante || "";
    document.getElementById("desligamento").value = data.desligamento || "NAO";
    document.getElementById("maps").value = data.maps || "";

    // <<< LINHA ADICIONADA PARA PREENCHER ORDEM DE OBRA >>>
    document.getElementById("ordem_obra").value = data.ordem_obra || "";

    // Carregar e definir responsável
    const selectResponsavel = document.getElementById("servico-responsavel");
    if (selectResponsavel) {
      // Espera carregarResponsaveis ter populado o select
      await carregarResponsaveis(); // Garante que as opções estejam lá
      if (data.responsavel_matricula) {
        selectResponsavel.value = data.responsavel_matricula;
      } else {
        selectResponsavel.value = "pendente"; // Ou "" se 'pendente' não for uma opção válida explícita
      }
    }

    const desligamentoSelect = document.getElementById("desligamento");
    if (data.desligamento === "SIM") {
      const horariosContainer = document.getElementById("horariosContainer");
      if (horariosContainer) horariosContainer.style.display = "flex";
      document.getElementById("horaInicio").value = data.hora_inicio
        ? data.hora_inicio.substring(0, 5)
        : "";
      document.getElementById("horaFim").value = data.hora_fim
        ? data.hora_fim.substring(0, 5)
        : "";
    }
    if (desligamentoSelect)
      desligamentoSelect.dispatchEvent(new Event("change"));

    preencherAnexosAtuais(data.anexos || []);
  } catch (error) {
    console.error("Erro em carregarDadosServico:", error);
    alert("Erro ao carregar dados do serviço: " + error.message);
  }
}

function preencherAnexosAtuais(anexos) {
  const container = document.getElementById("anexosAtuais");
  const semAnexosMsg = document.getElementById("semAnexos");
  if (!container || !semAnexosMsg) return;
  container.innerHTML = "";

  if (anexos.length === 0) {
    semAnexosMsg.style.display = "block";
    return;
  }

  semAnexosMsg.style.display = "none";
  anexos.forEach((anexo) => {
    const anexoElement = document.createElement("div");
    anexoElement.className = "attachment-item";
    const nomeDoAnexo = anexo.nomeOriginal || "arquivo";
    const caminhoDoAnexo =
      anexo.caminho && anexo.caminho.startsWith("/")
        ? anexo.caminho
        : `/${anexo.caminho || "#"}`;

    anexoElement.innerHTML = `
            <button type="button" class="remove-attachment" data-anexoid="${
              anexo.id
            }" title="Remover este anexo">×</button>
            <div class="text-center">
                <i class="fas ${getFileIcon(nomeDoAnexo)} fa-2x mb-1"></i>
                <div class="small text-truncate" title="${nomeDoAnexo}">${nomeDoAnexo}</div>
                <a href="${caminhoDoAnexo}" target="_blank" class="btn btn-sm btn-link p-0 mt-1 ${
      caminhoDoAnexo === "/#" || caminhoDoAnexo === "#" ? "disabled" : ""
    }">Visualizar</a>
            </div>
        `;
    container.appendChild(anexoElement);

    const removeButton = anexoElement.querySelector(".remove-attachment");
    if (removeButton) {
      removeButton.addEventListener("click", async function (e) {
        e.stopPropagation();
        const anexoIdParaRemover = this.getAttribute("data-anexoid");
        if (
          confirm(
            "Deseja realmente remover este anexo? Esta ação não pode ser desfeita."
          )
        ) {
          const servicoId = document.getElementById("servicoId").value;
          if (servicoId && anexoIdParaRemover) {
            await removerAnexo(servicoId, anexoIdParaRemover);
          } else {
            alert(
              "Não foi possível identificar o serviço ou o anexo para remoção."
            );
          }
        }
      });
    }
  });
}

function getFileIcon(filename) {
  if (!filename) return "fa-file text-secondary";
  const ext = filename.split(".").pop().toLowerCase();
  const icons = {
    pdf: "fa-file-pdf text-danger",
    jpg: "fa-file-image text-primary",
    jpeg: "fa-file-image text-primary",
    png: "fa-file-image text-primary",
    doc: "fa-file-word text-info",
    docx: "fa-file-word text-info",
    xls: "fa-file-excel text-success",
    xlsx: "fa-file-excel text-success",
  };
  return icons[ext] || "fa-file text-secondary";
}

async function removerAnexo(servicoId, anexoId) {
  const btnSalvar = document.getElementById("btnSalvar");
  let originalSalvarBtnHTML = "";
  if (btnSalvar) {
    originalSalvarBtnHTML = btnSalvar.innerHTML;
    btnSalvar.disabled = true;
    btnSalvar.innerHTML =
      '<i class="fas fa-spinner fa-spin me-1"></i> Removendo anexo...';
  }
  try {
    const response = await fetch(
      `/api/servicos/${servicoId}/anexos/${anexoId}`,
      {
        method: "DELETE",
      }
    );
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || "Erro ao remover anexo do servidor.");
    }
    alert("Anexo removido com sucesso!");
    await carregarDadosServico(servicoId);
  } catch (error) {
    console.error("Erro ao remover anexo:", error);
    alert("Erro ao remover anexo: " + error.message);
  } finally {
    if (btnSalvar) {
      btnSalvar.disabled = false;
      btnSalvar.innerHTML =
        originalSalvarBtnHTML ||
        '<i class="fas fa-save me-1"></i> Salvar Alterações';
    }
  }
}

async function salvarAlteracoes(servicoId) {
  const btnSalvar = document.getElementById("btnSalvar");
  if (!btnSalvar) return;

  const originalSalvarBtnHTML = btnSalvar.innerHTML;
  btnSalvar.disabled = true;
  btnSalvar.innerHTML =
    '<i class="fas fa-spinner fa-spin me-1"></i> Salvando...';

  const mapsInput = document.getElementById("maps");
  if (!validarMapsCampo(mapsInput)) {
    btnSalvar.disabled = false;
    btnSalvar.innerHTML = originalSalvarBtnHTML;
    alert("Por favor, corrija o link do Google Maps antes de salvar.");
    return;
  }

  const formData = new FormData();
  formData.append("subestacao", document.getElementById("subestacao").value);
  formData.append("alimentador", document.getElementById("alimentador").value);
  formData.append(
    "chave_montante",
    document.getElementById("chaveMontante").value
  );
  formData.append(
    "desligamento",
    document.getElementById("desligamento").value
  );
  formData.append("maps", document.getElementById("maps").value.trim());

  // <<< LINHA ADICIONADA PARA ENVIAR ORDEM DE OBRA >>>
  formData.append("ordem_obra", document.getElementById("ordem_obra").value);

  const selectResponsavel = document.getElementById("servico-responsavel");
  if (selectResponsavel && selectResponsavel.value) {
    formData.append("responsavel_matricula", selectResponsavel.value);
  } else {
    // Garante que, se nenhum responsável for selecionado (e o campo estiver presente),
    // seja enviado um valor padrão, como 'pendente', ou deixe de enviar se a API trata isso.
    // Se o campo de responsável não é editável aqui, esta lógica pode ser removida.
    // Mas como o select é populado, é bom tratar o caso de 'nada selecionado'.
    formData.append("responsavel_matricula", "pendente"); // Ou como a API espera um valor default
  }

  if (document.getElementById("desligamento").value === "SIM") {
    const horaInicioVal = document.getElementById("horaInicio").value;
    const horaFimVal = document.getElementById("horaFim").value;
    if (!horaInicioVal || !horaFimVal) {
      alert(
        "Para desligamento SIM, os horários de início e fim são obrigatórios."
      );
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = originalSalvarBtnHTML;
      return;
    }
    formData.append(
      "hora_inicio",
      horaInicioVal.includes(":00") ? horaInicioVal : horaInicioVal + ":00"
    );
    formData.append(
      "hora_fim",
      horaFimVal.includes(":00") ? horaFimVal : horaFimVal + ":00"
    );
  }

  const novosAnexosInput = document.getElementById("novosAnexos");
  if (novosAnexosInput && novosAnexosInput.files.length > 0) {
    for (let i = 0; i < novosAnexosInput.files.length; i++) {
      if (novosAnexosInput.files[i].size > 10 * 1024 * 1024) {
        alert(
          `O arquivo ${novosAnexosInput.files[i].name} excede o limite de 10MB e não será enviado.`
        );
        continue;
      }
      formData.append("anexos", novosAnexosInput.files[i]);
    }
  }

  try {
    const response = await fetch(`/api/servicos/${servicoId}`, {
      method: "PUT",
      body: formData,
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(
        result.message || "Erro ao salvar alterações do serviço."
      );
    }
    alert(result.message || "Alterações salvas com sucesso!");
    window.location.href =
      result.redirect || `/detalhes_servico?id=${servicoId}`;
  } catch (error) {
    console.error("Erro ao salvar alterações:", error);
    alert("Erro ao salvar alterações: " + error.message);
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.innerHTML = originalSalvarBtnHTML;
  }
}
