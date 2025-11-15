document.addEventListener("DOMContentLoaded", function () {
  const servicoId = window.location.pathname.split("/")[3];
  const LOCAL_STORAGE_KEY = `pontos_offline_${servicoId}`;
  let isSyncing = false;
  let allTags = [];
  let pontos = [];

  const pageTitleProcesso = document.getElementById("page-title-processo");
  const infoServicoContainer = document.getElementById(
    "info-servico-container"
  );
  const accordionPontos = document.getElementById("accordion-pontos");
  const offlineAlert = document.getElementById("offline-alert");
  const btnFinalizarInspecao = document.getElementById(
    "btn-finalizar-inspecao"
  );

  const modalSyncEl = document.getElementById("modal-sync-progress");
  const modalSync = new bootstrap.Modal(modalSyncEl);
  const syncProgressBar = document.getElementById("sync-progress-bar");
  const syncMessage = document.getElementById("sync-message");
  const syncStatusDetail = document.getElementById("sync-status-detail");

  const modalPontoEl = document.getElementById("modal-ponto");
  const modalPonto = new bootstrap.Modal(modalPontoEl);
  const formPonto = document.getElementById("form-ponto");
  const selectTagDefeito = document.getElementById("id_code_tag");
  const btnGetGps = document.getElementById("btn-get-gps");
  const btnAbrirCamera = document.getElementById("btn-abrir-camera");
  const btnInserirAnexo = document.getElementById("btn-inserir-anexo");
  const inputCamera = document.getElementById("input-camera");
  const inputAnexo = document.getElementById("input-anexo");
  const previewArea = document.getElementById("preview-area");
  const fileStore = new DataTransfer();

  const modalFinalizarEl = document.getElementById("modal-finalizar");
  const modalFinalizar = new bootstrap.Modal(modalFinalizarEl);
  const formFinalizar = document.getElementById("form-finalizar");
  const inputDataFinalizacao = document.getElementById("data_finalizacao");

  let dataFinalizacaoCache = null;

  function carregarPontosLocalmente() {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Erro ao carregar pontos do localStorage:", e);
      return [];
    }
  }

  function salvarPontosLocalmente() {
    try {
      const pontosParaSalvar = pontos.filter((p) => p.syncStatus !== "synced");
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(pontosParaSalvar));
    } catch (e) {
      console.error("Erro ao salvar pontos no localStorage:", e);
      alert(
        "Atenção: O armazenamento local está cheio. Não foi possível salvar mais dados."
      );
    }
  }

  function updateOnlineStatus() {
    if (!navigator.onLine) {
      offlineAlert.innerHTML = `<div class="alert alert-secondary"><strong>Modo Offline Ativo.</strong> Suas alterações serão salvas no dispositivo.</div>`;
      btnFinalizarInspecao.disabled = true;
    } else if (isSyncing) {
      offlineAlert.innerHTML = `<div class="alert alert-info">Sincronizando dados com o servidor...</div>`;
      btnFinalizarInspecao.disabled = true;
    } else {
      const pontosPendentes = pontos.some((p) => p.syncStatus !== "synced");
      if (pontosPendentes) {
        offlineAlert.innerHTML = `<div class="alert alert-warning">Você possui alterações locais que precisam ser sincronizadas.</div>`;
      } else {
        offlineAlert.innerHTML = "";
      }
      btnFinalizarInspecao.disabled = false;
    }
  }

  function renderInfoGerais(servico) {
    const dataFormatada = servico.data_servico
      ? new Date(servico.data_servico).toLocaleDateString("pt-BR", {
          timeZone: "UTC",
        })
      : "N/A";
    const equipe =
      servico.responsaveis_execucao && servico.responsaveis_execucao.length > 0
        ? servico.responsaveis_execucao.map((r) => r.nome).join(", ")
        : '<span class="text-muted">Pendente de atribuição</span>';

    pageTitleProcesso.textContent = `Coleta de Pontos: ${
      servico.processo || "Serviço Offline"
    }`;

    infoServicoContainer.innerHTML = `
      <div class="card">
        <div class="card-header"><h5 class="mb-0">Informações Gerais do Serviço</h5></div>
        <div class="card-body">
          <div class="row">
            <div class="col-md-4 mb-3"><strong>Processo:</strong> ${
              servico.processo || "N/A"
            }</div>
            <div class="col-md-4 mb-3"><strong>Data Prevista:</strong> ${dataFormatada}</div>
            <div class="col-md-4 mb-3"><strong>Tipo de Ordem:</strong> ${
              servico.tipo_ordem || "N/A"
            }</div>
            <div class="col-md-4 mb-3"><strong>Criador da OS:</strong> ${
              servico.nome_criador || "N/A"
            }</div>
            <div class="col-md-8 mb-3"><strong>Equipe de Execução:</strong> ${equipe}</div>
            <div class="col-md-12"><strong>Descrição:</strong> ${
              servico.descricao || "Nenhuma descrição fornecida."
            }</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderListaDePontos() {
    accordionPontos.innerHTML = "";
    const pontosVisiveis = pontos.filter(
      (p) => p.syncStatus !== "pending_delete"
    );

    if (pontosVisiveis.length === 0) {
      accordionPontos.innerHTML = `<div class="text-center p-5 bg-light rounded"><p class="mb-0">Nenhum ponto registrado.</p></div>`;
      return;
    }

    pontosVisiveis.sort((a, b) => {
      const idA = a.servidorId || a.localId;
      const idB = b.servidorId || b.localId;
      return idA - idB;
    });

    pontosVisiveis.forEach((ponto) => {
      const dados = ponto.dados;
      const tagInfo = allTags.find((t) => t.id == dados.id_code_tag) || {
        tag_code: "Desconhecida",
        ponto_defeito: "Tag não encontrada",
      };

      let statusIcon = "";
      if (ponto.syncStatus === "pending_create") {
        statusIcon =
          '<span class="material-icons text-info me-2" title="Novo, pendente de sincronização">add_circle</span>';
      } else if (ponto.syncStatus === "pending_update") {
        statusIcon =
          '<span class="material-icons text-warning me-2" title="Modificado, pendente de sincronização">edit_circle</span>';
      }

      let anexosHtml =
        '<p class="text-muted">Nenhum anexo para este ponto.</p>';
      const anexosServidor = dados.anexos || [];

      if (anexosServidor.length > 0) {
        anexosHtml = anexosServidor
          .map((anexo) => {
            const isImage =
              anexo.tipo_arquivo && anexo.tipo_arquivo.startsWith("image/");
            const url = anexo.caminho_arquivo;
            const nome = anexo.nome_original;

            if (isImage) {
              return `
                <a href="${url}" class="anexo-thumbnail" data-bs-toggle="modal" data-bs-target="#image-viewer-modal" title="${nome}">
                    <img src="${url}" alt="${nome}">
                </a>`;
            } else {
              return `
                <a href="${url}" target="_blank" class="anexo-thumbnail" title="${nome}">
                    <span class="material-icons">description</span>
                    <span class="anexo-thumbnail-caption">${nome}</span>
                </a>`;
            }
          })
          .join("");
      }

      const pontoHtml = `
        <div class="accordion-item" id="ponto-item-${ponto.localId}">
          <h2 class="accordion-header">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-ponto-${
              ponto.localId
            }">
              ${statusIcon}
              <strong>Ponto #${
                ponto.servidorId || `(local ${ponto.localId})`
              }:</strong>&nbsp;${tagInfo.tag_code} - ${tagInfo.ponto_defeito}
            </button>
          </h2>
          <div id="collapse-ponto-${
            ponto.localId
          }" class="accordion-collapse collapse" data-bs-parent="#accordion-pontos">
            <div class="accordion-body">
              <p><strong>Numeração:</strong> ${
                dados.numeracao_equipamento || "N/A"
              }</p>
              <p><strong>Coordenadas:</strong> ${dados.coordenada_x}, ${
        dados.coordenada_y
      }</p>
              <p><strong>Observações:</strong> ${
                dados.observacoes || "Nenhuma."
              }</p>
              <div class="anexos-container mb-3">
                <strong>Anexos:</strong>
                <div class="anexos-list mt-2">
                  ${anexosHtml}
                </div>
              </div>
              <div class="text-end">
                <button class='btn btn-outline-primary btn-sm btn-editar-ponto' data-local-id='${
                  ponto.localId
                }'>Editar Ponto</button>
                <button class="btn btn-outline-danger btn-sm btn-deletar-ponto" data-local-id="${
                  ponto.localId
                }">Excluir Ponto</button>
              </div>
            </div>
          </div>
        </div>
      `;
      accordionPontos.insertAdjacentHTML("beforeend", pontoHtml);
    });
  }

  function renderizarTudo(servico) {
    selectTagDefeito.innerHTML =
      '<option value="" selected disabled>Selecione...</option>';
    allTags.forEach((tag) => {
      const option = new Option(
        `${tag.tag_code} - ${tag.ponto_defeito}`,
        tag.id
      );
      selectTagDefeito.add(option);
    });

    renderInfoGerais(
      servico || { processo: "Carregando...", responsaveis_execucao: [] }
    );
    renderListaDePontos();
    updateOnlineStatus();
  }

  async function carregarDadosIniciais() {
    let servico = {};
    let tags = [];
    let pontosServidor = [];
    const pontosLocais = carregarPontosLocalmente();

    try {
      if (navigator.onLine) {
        const [servicoResponse, tagsResponse] = await Promise.all([
          fetch(`/inspecoes/api/servicos/${servicoId}/dados`),
          fetch("/inspecoes/api/codigos/tags"),
        ]);
        if (!servicoResponse.ok)
          throw new Error("Falha ao carregar dados do serviço.");

        servico = await servicoResponse.json();
        tags = await tagsResponse.json();

        localStorage.setItem(`servico_${servicoId}`, JSON.stringify(servico));
        localStorage.setItem("tags_cache", JSON.stringify(tags));

        pontosServidor = servico.pontos.map((p) => ({
          localId: p.id,
          servidorId: p.id,
          dados: p,
          syncStatus: "synced",
        }));
      } else {
        servico =
          JSON.parse(localStorage.getItem(`servico_${servicoId}`)) || {};
        tags = JSON.parse(localStorage.getItem("tags_cache")) || [];
      }
    } catch (error) {
      console.error("Erro na inicialização:", error);
      offlineAlert.innerHTML = `<div class="alert alert-danger">Não foi possível carregar dados essenciais. Verifique sua conexão.</div>`;
      servico = JSON.parse(localStorage.getItem(`servico_${servicoId}`)) || {};
      tags = JSON.parse(localStorage.getItem("tags_cache")) || [];
    }

    allTags = tags || [];
    const pontosServidorMap = new Map(
      pontosServidor.map((p) => [p.servidorId, p])
    );
    const pontosLocaisMap = new Map(pontosLocais.map((p) => [p.localId, p]));

    const pontosCombinados = new Map();

    pontosServidorMap.forEach((p, id) => pontosCombinados.set(id, p));
    pontosLocaisMap.forEach((p, id) => {
      const key = p.servidorId || p.localId;
      pontosCombinados.set(key, p);
    });

    pontos = Array.from(pontosCombinados.values());

    renderizarTudo(servico);
  }

  async function sincronizarComServidor(isFinalizing = false) {
    if (isSyncing || !navigator.onLine) {
      updateOnlineStatus();
      return;
    }

    const pontosParaSincronizar = pontos.filter(
      (p) => p.syncStatus !== "synced"
    );
    if (pontosParaSincronizar.length === 0) {
      if (isFinalizing) {
        await finalizarServicoAPI(dataFinalizacaoCache);
      }
      return;
    }

    isSyncing = true;
    updateOnlineStatus();

    if (isFinalizing) {
      modalFinalizar.hide();
      modalSync.show();
      syncMessage.textContent = "Sincronizando dados...";
      syncProgressBar.style.width = "50%";
    }

    try {
      const syncPayload = {
        pontosParaCriar: pontos
          .filter((p) => p.syncStatus === "pending_create")
          .map((p) => ({ tempId: p.localId, dados: p.dados })),
        pontosParaAtualizar: pontos
          .filter((p) => p.syncStatus === "pending_update")
          .map((p) => ({ id: p.servidorId, dados: p.dados })),
        pontosParaDeletar: pontos
          .filter((p) => p.syncStatus === "pending_delete")
          .map((p) => p.servidorId),
      };

      const response = await fetch(
        `/inspecoes/api/servicos/${servicoId}/sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(syncPayload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Falha na sincronização com o servidor."
        );
      }

      const result = await response.json();

      pontos = pontos.filter((p) => p.syncStatus !== "pending_delete");

      pontos.forEach((ponto) => {
        if (
          ponto.syncStatus === "pending_create" &&
          result.idMap[ponto.localId]
        ) {
          ponto.servidorId = result.idMap[ponto.localId];
          ponto.localId = ponto.servidorId;
          ponto.syncStatus = "synced";
        } else if (ponto.syncStatus === "pending_update") {
          ponto.syncStatus = "synced";
        }
      });

      salvarPontosLocalmente();

      if (isFinalizing) {
        await finalizarServicoAPI(dataFinalizacaoCache);
      }
    } catch (error) {
      console.error("Erro durante a sincronização:", error);
      if (isFinalizing) {
        modalSync.hide();
        alert(
          `Falha crítica na sincronização. O serviço não pode ser finalizado. Erro: ${error.message}`
        );
      }
    } finally {
      isSyncing = false;
      renderListaDePontos();
      updateOnlineStatus();
      if (isFinalizing) {
        modalSync.hide();
      }
    }
  }

  async function finalizarServicoAPI(dataFinalizacao) {
    syncMessage.textContent = "Finalizando serviço...";
    syncProgressBar.style.width = "100%";

    try {
      const response = await fetch(
        `/inspecoes/api/servicos/${servicoId}/finalizar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data_finalizacao: dataFinalizacao }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Falha ao finalizar o serviço na API."
        );
      }

      localStorage.removeItem(LOCAL_STORAGE_KEY);
      alert("Serviço finalizado e sincronizado com sucesso!");
      window.location.href = "/inspecoes/servicos";
    } catch (error) {
      alert(
        `Erro ao finalizar o serviço: ${error.message}. O serviço foi sincronizado, mas não foi marcado como finalizado.`
      );
    }
  }

  function handleFiles(files) {
    for (const file of files) {
      if ([...fileStore.files].some((f) => f.name === file.name)) continue;
      fileStore.items.add(file);
      createPreview(file);
    }
  }

  function createPreview(file) {
    const fileId = `file-${Math.random().toString(36).substr(2, 9)}`;
    const previewElement = document.createElement("div");
    previewElement.className = "preview-item";
    previewElement.id = fileId;

    const fileName = file.name || file.nome_original;
    const isImage = file.type
      ? file.type.startsWith("image/")
      : file.tipo_arquivo && file.tipo_arquivo.startsWith("image/");
    const url = file.caminho_arquivo || URL.createObjectURL(file);

    const removeButton = `<button type="button" class="btn-remove-preview" data-file-id="${fileId}" data-file-name="${fileName}">&times;</button>`;

    if (isImage) {
      previewElement.innerHTML = `<img src="${url}" class="preview-thumbnail"><div class="preview-info"><strong>${fileName}</strong></div>${removeButton}`;
    } else {
      previewElement.innerHTML = `<div class="preview-icon"><span class="material-icons">description</span></div><div class="preview-info"><strong>${fileName}</strong></div>${removeButton}`;
    }
    previewArea.appendChild(previewElement);
  }

  function removeFileFromStore(fileName) {
    const newFiles = new DataTransfer();
    for (const file of fileStore.files) {
      if (file.name !== fileName) newFiles.items.add(file);
    }
    fileStore.clearData();
    for (const file of newFiles.files) newFiles.items.add(file);
  }

  function abrirModalPontoParaCriar() {
    formPonto.reset();
    previewArea.innerHTML = "";
    fileStore.clearData();
    document.getElementById("ponto-localId").value = "";
    document.getElementById("ponto-servidorId").value = "";
    document.getElementById("modal-ponto-title").textContent =
      "Adicionar Novo Ponto";
    modalPonto.show();
  }

  function abrirModalPontoParaEditar(localId) {
    formPonto.reset();
    previewArea.innerHTML = "";
    fileStore.clearData();

    const ponto = pontos.find((p) => p.localId == localId);
    if (!ponto) {
      alert("Ponto não encontrado.");
      return;
    }
    const dados = ponto.dados;

    document.getElementById("ponto-localId").value = ponto.localId;
    document.getElementById("ponto-servidorId").value = ponto.servidorId || "";
    document.getElementById("id_code_tag").value = dados.id_code_tag;
    document.getElementById("numeracao_equipamento").value =
      dados.numeracao_equipamento;
    document.getElementById("coordenada_x").value = dados.coordenada_x;
    document.getElementById("coordenada_y").value = dados.coordenada_y;
    document.getElementById("observacoes").value = dados.observacoes;

    document.getElementById("modal-ponto-title").textContent = `Editar Ponto #${
      ponto.servidorId || `(local ${ponto.localId})`
    }`;
    modalPonto.show();
  }

  function handleGetGps() {
    if (!navigator.geolocation) return alert("Geolocalização não é suportada.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        document.getElementById("coordenada_y").value =
          pos.coords.latitude.toFixed(8);
        document.getElementById("coordenada_x").value =
          pos.coords.longitude.toFixed(8);
      },
      (err) => alert(`Erro ao obter GPS: ${err.message}`),
      { enableHighAccuracy: true }
    );
  }

  async function handleSalvarPonto() {
    const submitButton = document.getElementById("btn-salvar-ponto");
    submitButton.disabled = true;

    const formData = new FormData(formPonto);
    const dados = Object.fromEntries(formData.entries());
    const localId = dados.localId ? parseInt(dados.localId) : null;
    const servidorId = dados.servidorId ? parseInt(dados.servidorId) : null;
    const files = [...fileStore.files];
    delete dados.localId;
    delete dados.servidorId;

    if (navigator.onLine) {
      try {
        const url = servidorId
          ? `/inspecoes/api/pontos/${servidorId}`
          : `/inspecoes/api/servicos/${servicoId}/pontos`;
        const method = servidorId ? "PUT" : "POST";

        const responsePonto = await fetch(url, {
          method: method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dados),
        });

        const resultPonto = await responsePonto.json();
        if (!responsePonto.ok) throw new Error(resultPonto.message);

        let pontoSalvo = resultPonto.ponto;

        if (files.length > 0) {
          const formDataAnexos = new FormData();
          files.forEach((file) => formDataAnexos.append("anexos", file));

          const responseAnexos = await fetch(
            `/inspecoes/api/servicos/${servicoId}/pontos/${pontoSalvo.id}/anexos`,
            {
              method: "POST",
              body: formDataAnexos,
            }
          );

          if (!responseAnexos.ok) {
            const resultAnexos = await responseAnexos.json();
            alert(
              `Ponto salvo com sucesso, mas falha ao enviar anexos: ${resultAnexos.message}`
            );
          }
        }

        const pontoCompletoResponse = await fetch(
          `/inspecoes/api/pontos/${pontoSalvo.id}`
        );
        const pontoCompletoResult = await pontoCompletoResponse.json();
        pontoSalvo = pontoCompletoResult.ponto;

        const pontoAtualizadoParaEstado = {
          localId: pontoSalvo.id,
          servidorId: pontoSalvo.id,
          dados: pontoSalvo,
          syncStatus: "synced",
        };

        const index = pontos.findIndex(
          (p) => p.localId === localId || p.servidorId === servidorId
        );

        if (index !== -1) {
          pontos[index] = pontoAtualizadoParaEstado;
        } else {
          pontos.push(pontoAtualizadoParaEstado);
        }

        renderListaDePontos();
        updateOnlineStatus();
        salvarPontosLocalmente();
        alert(`Ponto ${servidorId ? "atualizado" : "criado"} com sucesso!`);
      } catch (error) {
        alert(`Erro ao salvar ponto no servidor: ${error.message}`);
      }
    } else {
      if (localId) {
        const index = pontos.findIndex((p) => p.localId === localId);
        if (index !== -1) {
          pontos[index].dados = dados;
          if (pontos[index].syncStatus !== "pending_create") {
            pontos[index].syncStatus = "pending_update";
          }
        }
      } else {
        const novoPonto = {
          localId: Date.now(),
          servidorId: null,
          dados: dados,
          syncStatus: "pending_create",
        };
        pontos.push(novoPonto);
      }
      salvarPontosLocalmente();
      renderListaDePontos();
      updateOnlineStatus();
      alert("Ponto salvo localmente (offline).");
    }

    modalPonto.hide();
    submitButton.disabled = false;
  }

  async function handleDeletarPonto(localId) {
    if (!confirm(`Tem certeza que deseja excluir este ponto?`)) return;

    const pontoIndex = pontos.findIndex((p) => p.localId == localId);
    if (pontoIndex === -1) return;

    const ponto = pontos[pontoIndex];

    if (navigator.onLine && ponto.servidorId) {
      try {
        const response = await fetch(
          `/inspecoes/api/pontos/${ponto.servidorId}`,
          { method: "DELETE" }
        );
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Falha ao deletar no servidor.");
        }
        pontos.splice(pontoIndex, 1);
        alert("Ponto excluído com sucesso!");
      } catch (error) {
        alert(`Erro ao excluir ponto: ${error.message}`);
      }
    } else {
      if (ponto.syncStatus === "pending_create") {
        pontos.splice(pontoIndex, 1);
      } else {
        ponto.syncStatus = "pending_delete";
      }
      alert("Ponto marcado para exclusão.");
    }

    salvarPontosLocalmente();
    renderListaDePontos();
    updateOnlineStatus();
  }

  btnFinalizarInspecao.addEventListener("click", () => {
    if (!navigator.onLine) {
      alert(
        "Você está offline. Conecte-se à internet para finalizar o serviço."
      );
      return;
    }
    const pontosPendentes = pontos.some((p) => p.syncStatus !== "synced");
    if (pontosPendentes) {
      alert(
        "Você possui alterações não sincronizadas. A sincronização será forçada antes de finalizar."
      );
    }

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    inputDataFinalizacao.value = now.toISOString().slice(0, 16);
    modalFinalizar.show();
  });

  formFinalizar.addEventListener("submit", (event) => {
    event.preventDefault();
    const dataFinalizacao = inputDataFinalizacao.value;
    if (!dataFinalizacao) {
      alert("Por favor, insira a data e hora da finalização.");
      return;
    }
    dataFinalizacaoCache = dataFinalizacao;
    sincronizarComServidor(true);
  });

  document
    .getElementById("btn-adicionar-ponto")
    .addEventListener("click", abrirModalPontoParaCriar);
  document
    .getElementById("btn-salvar-ponto")
    .addEventListener("click", handleSalvarPonto);
  btnGetGps.addEventListener("click", handleGetGps);
  btnAbrirCamera.addEventListener("click", () => inputCamera.click());
  btnInserirAnexo.addEventListener("click", () => inputAnexo.click());
  inputCamera.addEventListener("change", () => handleFiles(inputCamera.files));
  inputAnexo.addEventListener("change", () => handleFiles(inputAnexo.files));

  previewArea.addEventListener("click", (e) => {
    const target = e.target.closest(".btn-remove-preview");
    if (!target) return;
    const fileId = target.dataset.fileId;
    const fileName = target.dataset.fileName;
    document.getElementById(fileId).remove();
    removeFileFromStore(fileName);
  });

  document.body.addEventListener("click", function (event) {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.classList.contains("btn-editar-ponto")) {
      abrirModalPontoParaEditar(parseInt(button.dataset.localId));
    }
    if (button.classList.contains("btn-deletar-ponto")) {
      handleDeletarPonto(parseInt(button.dataset.localId));
    }
  });

  const imageViewerModal = document.getElementById("image-viewer-modal");
  if (imageViewerModal) {
    imageViewerModal.addEventListener("show.bs.modal", function (event) {
      const triggerElement = event.relatedTarget;
      const imageUrl = triggerElement.getAttribute("href");
      const imageElement = imageViewerModal.querySelector("#image-viewer-img");
      imageElement.setAttribute("src", imageUrl);
    });
  }

  window.addEventListener("online", sincronizarComServidor);
  window.addEventListener("offline", updateOnlineStatus);

  carregarDadosIniciais().then(() => {
    sincronizarComServidor();
  });
});
