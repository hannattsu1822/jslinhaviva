document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const servicoId = urlParams.get("id");
  const servicoTipo = urlParams.get("tipo");

  if (!servicoId || !servicoTipo) {
    alert("ID ou tipo do serviço não especificado.");
    window.location.href = "/gestao-servicos";
    return;
  }

  document.getElementById("servicoId").value = servicoId;
  document.getElementById("servicoTipo").value = servicoTipo;

  await carregarDadosServico(servicoId, servicoTipo);

  if (servicoTipo === "legado") {
    await carregarResponsaveis();
  } else {
    const responsavelContainer = document.getElementById(
      "responsavelContainer"
    );
    if (responsavelContainer) responsavelContainer.style.display = "none";
  }

  document
    .getElementById("desligamento")
    .addEventListener("change", function () {
      const mostrarHorarios = this.value === "SIM";
      const horariosContainer = document.getElementById("horariosContainer");
      const horaInicioInput = document.getElementById("hora_inicio");
      const horaFimInput = document.getElementById("hora_fim");

      if (horariosContainer)
        horariosContainer.style.display = mostrarHorarios ? "block" : "none";
      if (horaInicioInput) horaInicioInput.required = mostrarHorarios;
      if (horaFimInput) horaFimInput.required = mostrarHorarios;
    });

  document
    .getElementById("novosAnexos")
    .addEventListener("change", function () {
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
                          <i class="fas fa-file fa-2x mb-1"></i>
                          <div class="small text-truncate" style="max-width: 100px;">${file.name}</div>
                      </div>
                  `;
          }
          previewContainer.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
      });
    });

  document
    .getElementById("editarServicoForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();
      await salvarAlteracoes(servicoId, servicoTipo);
    });
});

async function carregarDadosServico(id, tipo) {
  const apiUrl =
    tipo === "legado" ? `/api/servicos/${id}` : `/api/ordens-servico/${id}`;
  const btnVoltar = document.getElementById("btn-voltar-detalhes");

  if (tipo === "legado") {
    btnVoltar.href = `/detalhes_servico?id=${id}`;
  } else {
    btnVoltar.href = `/detalhes_ordem_servico?id=${id}`;
  }

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error("Falha ao carregar dados do serviço.");

    const result = await response.json();
    if (!result.success || !result.data)
      throw new Error(result.message || "Dados não encontrados.");

    const data = result.data;

    document.getElementById("processo").value = data.processo || "";
    document.getElementById("subestacao").value = data.subestacao || "";
    document.getElementById("alimentador").value = data.alimentador || "";
    document.getElementById("chave_montante").value = data.chave_montante || "";
    document.getElementById("desligamento").value = data.desligamento || "NÃO";
    document.getElementById("ordem_obra").value = data.ordem_obra || "";
    document.getElementById("maps").value = data.maps || "";

    document.getElementById("descricao_geral").value =
      data.descricao_geral || data.descricao_servico || "";
    document.getElementById("observacoes_gerais").value =
      data.observacoes_gerais || data.observacoes || "";

    if (tipo === "legado") {
      document.getElementById("responsavel_matricula").value =
        data.responsavel_matricula || "";
    }

    const desligamentoSelect = document.getElementById("desligamento");
    if (data.desligamento === "SIM") {
      document.getElementById("horariosContainer").style.display = "block";
      document.getElementById("hora_inicio").value = data.hora_inicio
        ? data.hora_inicio.substring(0, 5)
        : "";
      document.getElementById("hora_fim").value = data.hora_fim
        ? data.hora_fim.substring(0, 5)
        : "";
    } else {
      document.getElementById("horariosContainer").style.display = "none";
    }
    desligamentoSelect.dispatchEvent(new Event("change"));
  } catch (error) {
    alert("Erro ao carregar dados: " + error.message);
  }
}

async function carregarResponsaveis() {
  const selectResponsavel = document.getElementById("responsavel_matricula");
  try {
    const response = await fetch("/api/encarregados");
    if (!response.ok) throw new Error("Falha ao carregar responsáveis");
    const responsaveis = await response.json();

    const valorAtual = selectResponsavel.value;
    selectResponsavel.innerHTML =
      '<option value="">Selecione um responsável...</option>';
    responsaveis.forEach((resp) => {
      const option = document.createElement("option");
      option.value = resp.matricula;
      option.textContent = `${resp.nome} (${resp.matricula})`;
      selectResponsavel.appendChild(option);
    });
    if (valorAtual) selectResponsavel.value = valorAtual;
  } catch (error) {
    console.error("Erro ao carregar responsáveis:", error);
  }
}

async function salvarAlteracoes(id, tipo) {
  const btnSalvar = document.getElementById("btnSalvar");
  const originalBtnHTML = btnSalvar.innerHTML;
  btnSalvar.disabled = true;
  btnSalvar.innerHTML =
    '<i class="fas fa-spinner fa-spin me-1"></i> Salvando...';

  const form = document.getElementById("editarServicoForm");
  const formData = new FormData(form);

  const apiUrl =
    tipo === "legado" ? `/api/servicos/${id}` : `/api/ordens-servico/${id}`;

  try {
    const response = await fetch(apiUrl, {
      method: "PUT",
      body: formData,
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || "Erro ao salvar alterações.");
    }

    alert(result.message || "Alterações salvas com sucesso!");

    const btnVoltar = document.getElementById("btn-voltar-detalhes");
    if (btnVoltar && btnVoltar.href) {
      window.location.href = btnVoltar.href;
    } else {
      window.location.href = "/gestao-servicos";
    }
  } catch (error) {
    alert("Erro: " + error.message);
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.innerHTML = originalBtnHTML;
  }
}
