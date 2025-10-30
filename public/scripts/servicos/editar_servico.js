document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("editarServicoForm");
  const servicoIdInput = document.getElementById("servicoId");
  const btnVoltar = document.getElementById("btn-voltar-detalhes");
  const btnSalvar = document.getElementById("btnSalvar");

  // Campos do formulário
  const processoInput = document.getElementById("processo");
  const tipoProcessoSelect = document.getElementById("tipo_processo");
  const origemSelect = document.getElementById("origem");
  const dataPrevistaInput = document.getElementById("data_prevista_execucao");
  const subestacaoInput = document.getElementById("subestacao");
  const alimentadorInput = document.getElementById("alimentador");
  const chaveMontanteInput = document.getElementById("chaveMontante");
  const desligamentoSelect = document.getElementById("desligamento");
  const horariosContainer = document.getElementById("horariosContainer");
  const horaInicioInput = document.getElementById("horaInicio");
  const horaFimInput = document.getElementById("horaFim");
  const ordemObraSelect = document.getElementById("ordem_obra");
  const mapsInput = document.getElementById("maps");
  const descricaoTextarea = document.getElementById("descricao_servico");
  const observacoesTextarea = document.getElementById("observacoes");
  const anexosAtuaisContainer = document.getElementById("anexosAtuais");
  const novosAnexosInput = document.getElementById("novosAnexos");
  const previewNovosAnexosContainer =
    document.getElementById("previewNovosAnexos");
  const semAnexosMsg = document.getElementById("semAnexos");

  let anexosParaDeletar = new Set();
  let novosAnexosFiles = [];

  function getServicoId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  }

  function toggleHorarios() {
    if (desligamentoSelect.value === "SIM") {
      horariosContainer.style.display = "block";
      horaInicioInput.required = true;
      horaFimInput.required = true;
    } else {
      horariosContainer.style.display = "none";
      horaInicioInput.required = false;
      horaFimInput.required = false;
      horaInicioInput.value = "";
      horaFimInput.value = "";
    }
  }

  function formatarDataParaInput(dataISO) {
    if (!dataISO) return "";
    return dataISO.split("T")[0];
  }

  function renderizarAnexosAtuais(anexos) {
    anexosAtuaisContainer.innerHTML = "";
    if (!anexos || anexos.length === 0) {
      anexosAtuaisContainer.appendChild(semAnexosMsg);
      semAnexosMsg.style.display = "block";
      return;
    }

    semAnexosMsg.style.display = "none";

    anexos.forEach((anexo) => {
      const anexoItem = document.createElement("div");
      anexoItem.className = "attachment-item";
      anexoItem.dataset.anexoId = anexo.id;

      const isImage = anexo.tipo === "imagem";
      const iconClass = isImage ? "" : "fas fa-file-alt fa-2x";

      anexoItem.innerHTML = `
        ${
          isImage
            ? `<img src="${anexo.caminho}" alt="${anexo.nomeOriginal}">`
            : `<i class="${iconClass}"></i>`
        }
        <small class="text-muted" title="${anexo.nomeOriginal}">${
        anexo.nomeOriginal
      }</small>
        <button type="button" class="remove-attachment" title="Remover anexo">&times;</button>
      `;

      anexoItem
        .querySelector(".remove-attachment")
        .addEventListener("click", () => {
          if (
            confirm(
              `Tem certeza que deseja remover o anexo "${anexo.nomeOriginal}"?`
            )
          ) {
            anexosParaDeletar.add(anexo.id);
            anexoItem.remove();
            if (anexosAtuaisContainer.childElementCount === 0) {
              semAnexosMsg.style.display = "block";
            }
          }
        });

      anexosAtuaisContainer.appendChild(anexoItem);
    });
  }

  function renderizarPreviewNovosAnexos() {
    previewNovosAnexosContainer.innerHTML = "";
    novosAnexosFiles.forEach((file, index) => {
      const anexoItem = document.createElement("div");
      anexoItem.className = "preview-item";

      const isImage = file.type.startsWith("image/");
      const iconClass = isImage ? "" : "fas fa-file-alt fa-2x";
      const previewSrc = isImage ? URL.createObjectURL(file) : "";

      anexoItem.innerHTML = `
        ${
          isImage
            ? `<img src="${previewSrc}" alt="${file.name}">`
            : `<i class="${iconClass}"></i>`
        }
        <small class="text-muted" title="${file.name}">${file.name}</small>
        <button type="button" class="remove-attachment" title="Remover anexo">&times;</button>
      `;

      anexoItem
        .querySelector(".remove-attachment")
        .addEventListener("click", () => {
          novosAnexosFiles.splice(index, 1);
          renderizarPreviewNovosAnexos();
        });

      previewNovosAnexosContainer.appendChild(anexoItem);
    });
  }

  async function carregarDadosServico(id) {
    try {
      const response = await fetch(`/api/servicos/${id}`);
      if (!response.ok) {
        throw new Error("Serviço não encontrado ou erro na requisição.");
      }
      const resultado = await response.json();
      const servico = resultado.data;

      servicoIdInput.value = servico.id;
      processoInput.value = servico.processo;
      tipoProcessoSelect.value = servico.tipo;
      origemSelect.value = servico.origem;
      dataPrevistaInput.value = formatarDataParaInput(
        servico.data_prevista_execucao
      );
      subestacaoInput.value = servico.subestacao;
      alimentadorInput.value = servico.alimentador;
      chaveMontanteInput.value = servico.chave_montante;
      desligamentoSelect.value = servico.desligamento;
      horaInicioInput.value = servico.hora_inicio || "";
      horaFimInput.value = servico.hora_fim || "";
      ordemObraSelect.value = servico.ordem_obra || "";
      mapsInput.value = servico.maps || "";
      descricaoTextarea.value = servico.descricao_servico || "";
      observacoesTextarea.value = servico.observacoes || "";

      if (servico.tipo === "Emergencial") {
        processoInput.readOnly = true;
        processoInput.title =
          "Não é possível editar o processo de um serviço emergencial.";
      }

      toggleHorarios();
      renderizarAnexosAtuais(servico.anexos);
    } catch (error) {
      console.error("Erro ao carregar dados do serviço:", error);
      alert(
        "Não foi possível carregar os dados do serviço. Verifique o console para mais detalhes."
      );
      form.innerHTML =
        "<p class='text-danger text-center'>Erro ao carregar. Tente recarregar a página.</p>";
    }
  }

  async function handleFormSubmit(event) {
    event.preventDefault();
    btnSalvar.disabled = true;
    btnSalvar.innerHTML =
      '<i class="fas fa-spinner fa-spin me-2"></i>Salvando...';

    const formData = new FormData();
    formData.append("processo", processoInput.value);
    formData.append("tipo_processo", tipoProcessoSelect.value);
    formData.append("origem", origemSelect.value);
    formData.append("data_prevista_execucao", dataPrevistaInput.value);
    formData.append("subestacao", subestacaoInput.value);
    formData.append("alimentador", alimentadorInput.value);
    formData.append("chave_montante", chaveMontanteInput.value);
    formData.append("desligamento", desligamentoSelect.value);
    formData.append("hora_inicio", horaInicioInput.value);
    formData.append("hora_fim", horaFimInput.value);
    formData.append("ordem_obra", ordemObraSelect.value);
    formData.append("maps", mapsInput.value);
    formData.append("descricao_servico", descricaoTextarea.value);
    formData.append("observacoes", observacoesTextarea.value);

    novosAnexosFiles.forEach((file) => {
      formData.append("anexos", file);
    });

    // Adiciona a lista de IDs de anexos a serem deletados
    formData.append(
      "anexosParaDeletar",
      JSON.stringify(Array.from(anexosParaDeletar))
    );

    const id = getServicoId();
    try {
      const response = await fetch(`/api/servicos/${id}`, {
        method: "PUT",
        body: formData,
      });

      const resultado = await response.json();

      if (!response.ok) {
        throw new Error(resultado.message || "Erro desconhecido ao salvar.");
      }

      alert(resultado.message);
      window.location.href = resultado.redirect;
    } catch (error) {
      console.error("Erro ao salvar alterações:", error);
      alert(`Erro ao salvar: ${error.message}`);
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = '<i class="fas fa-save me-2"></i>Salvar Alterações';
    }
  }

  const servicoId = getServicoId();
  if (servicoId) {
    btnVoltar.href = `/detalhes_servico?id=${servicoId}`;
    carregarDadosServico(servicoId);
  } else {
    alert("ID do serviço não encontrado na URL.");
    form.innerHTML =
      "<p class='text-danger text-center'>ID do serviço inválido.</p>";
  }

  desligamentoSelect.addEventListener("change", toggleHorarios);
  novosAnexosInput.addEventListener("change", (event) => {
    novosAnexosFiles.push(...event.target.files);
    renderizarPreviewNovosAnexos();
  });
  form.addEventListener("submit", handleFormSubmit);
});
