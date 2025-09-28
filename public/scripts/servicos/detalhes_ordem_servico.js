document.addEventListener("DOMContentLoaded", async function () {
  const urlParams = new URLSearchParams(window.location.search);
  const osId = urlParams.get("id");
  const loadingSpinner = document.getElementById("loading-spinner");
  const detailsContent = document.getElementById("details-content");
  const user = JSON.parse(localStorage.getItem("user"));

  if (!osId) {
    showError("ID da Ordem de Serviço não fornecido.");
    return;
  }

  try {
    const response = await fetch(`/api/ordens-servico/${osId}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Erro ${response.status}`);
    }
    const { data } = await response.json();

    preencherInformacoesGerais(data);
    preencherLocalizacao(data.maps);
    preencherItens(data.itens, user);
    preencherAnexosRegistro(data.anexos); // Renomeado para clareza

    if (user && user.nivel < 5) {
        const btnEditar = document.getElementById("btn-editar-os");
        if (btnEditar) {
            btnEditar.style.display = 'none';
        }
    }

    loadingSpinner.classList.add("d-none");
    detailsContent.classList.remove("d-none");
  } catch (error) {
    console.error("Erro ao carregar detalhes da OS:", error);
    showError(`Erro ao carregar detalhes: ${error.message}`);
  }

  const btnEditarModerno = document.getElementById("btn-editar-os");
  if (btnEditarModerno && osId) {
    btnEditarModerno.addEventListener("click", () => {
      window.location.href = `/editar_servico?id=${osId}&tipo=moderno`;
    });
  }
});

function showError(message) {
  const loadingSpinner = document.getElementById("loading-spinner");
  const detailsContent = document.getElementById("details-content");
  detailsContent.innerHTML = `<div class="alert alert-danger">${message}</div>`;
  loadingSpinner.classList.add("d-none");
  detailsContent.classList.remove("d-none");
}

function preencherInformacoesGerais(data) {
  document.getElementById("os-processo-header").textContent =
    data.processo || `ID ${data.id}`;
  document.getElementById("os-id").textContent = data.id;
  document.getElementById("os-processo").textContent = data.processo || "N/A";

  const statusBadge = document.getElementById("os-status");
  statusBadge.textContent = data.status.replace("_", " ").toUpperCase();
  statusBadge.className = `badge status-${data.status}`;

  document.getElementById("os-data-prevista").textContent = new Date(
    data.data_prevista_execucao
  ).toLocaleDateString("pt-BR", { timeZone: "UTC" });
  document.getElementById("os-subestacao").textContent = data.subestacao;
  document.getElementById("os-alimentador").textContent =
    data.alimentador || "N/A";
  document.getElementById("os-ordem-obra").textContent =
    data.ordem_obra || "N/A";
  document.getElementById("os-desligamento").textContent = data.desligamento;
  document.getElementById("os-horario").textContent =
    data.desligamento === "SIM"
      ? `${data.hora_inicio || "--:--"} às ${data.hora_fim || "--:--"}`
      : "Não se aplica";

  document.getElementById("os-descricao").textContent =
    data.descricao_geral || "Nenhuma descrição fornecida.";
  document.getElementById("os-observacoes").textContent =
    data.observacoes_gerais || "Nenhuma observação fornecida.";
}

function preencherLocalizacao(mapsUrl) {
  const container = document.getElementById("location-card-container");
  let content = "";
  if (mapsUrl) {
    content = `
            <div class="location-card h-100">
                <i class="fas fa-map-marked-alt location-icon"></i>
                <h5 class="mb-3">Localização</h5>
                <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-maps">
                    <i class="fas fa-external-link-alt me-2"></i>Abrir no Google Maps
                </a>
            </div>
        `;
  } else {
    content = `
            <div class="location-card h-100 bg-secondary">
                <i class="fas fa-map-marker-slash location-icon"></i>
                <h5 class="mb-0">Localização não informada</h5>
            </div>
        `;
  }
  container.innerHTML = content;
}

function preencherItens(itens, user) {
  const container = document.getElementById("itens-container");
  container.innerHTML = "";

  if (!itens || itens.length === 0) {
    container.innerHTML =
      '<p class="text-muted">Nenhum item encontrado para este serviço.</p>';
    return;
  }

  let hasPendingItemsForUser = false;

  itens.forEach((item) => {
    const isMyItem = item.responsavel_matricula === user.matricula;
    const isPending = item.status === "pendente";
    if (isMyItem && isPending) {
      hasPendingItemsForUser = true;
    }

    let anexosItemHtml = '';
    if (item.anexos && item.anexos.length > 0) {
        anexosItemHtml += `<hr><p class="mb-2"><strong>Anexos do Item:</strong></p>
                           <div class="item-anexos-container" id="gallery-item-${item.item_id}">`;
        
        item.anexos.forEach(anexo => {
            const isImage = /\.(jpg|jpeg|png|gif)$/i.test(anexo.nome_original);
            if (isImage) {
                anexosItemHtml += `
                    <a href="${anexo.caminho_servidor}" data-sub-html="<h4>${anexo.nome_original}</h4>">
                        <img src="${anexo.caminho_servidor}" class="item-anexo-thumbnail" alt="${anexo.nome_original}">
                    </a>
                `;
            } else {
                anexosItemHtml += `
                    <a href="${anexo.caminho_servidor}" target="_blank" class="btn btn-sm btn-outline-secondary">
                        <i class="fas fa-paperclip me-1"></i> ${anexo.nome_original}
                    </a>
                `;
            }
        });
        anexosItemHtml += '</div>';
    }

    const itemHtml = `
            <div class="card item-card mb-3 ${isMyItem ? "my-item" : ""}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <strong>${item.codigo} - ${item.ponto_defeito || item.descricao}</strong>
                    <span class="badge status-${item.status}">${item.status
      .replace("_", " ")
      .toUpperCase()}</span>
                </div>
                <div class="card-body">
                    <p><strong>Descrição do Problema:</strong> ${
                      item.descricao
                    }</p>
                    <p><strong>Responsável:</strong> ${
                      item.responsavel_nome || item.responsavel_matricula
                    }</p>
                    <p class="mb-0"><strong>Observações do Item:</strong> ${
                      item.observacoes || "Nenhuma."
                    }</p>
                    ${anexosItemHtml}
                </div>
            </div>
        `;
    container.innerHTML += itemHtml;
  });

  // Inicializa a lightGallery para cada item que tiver uma galeria
  itens.forEach(item => {
    if (item.anexos && item.anexos.length > 0) {
        const galleryElement = document.getElementById(`gallery-item-${item.item_id}`);
        if (galleryElement) {
            lightGallery(galleryElement, {
                selector: 'a',
                download: true,
            });
        }
    }
  });

  const btnConcluir = document.getElementById("btn-concluir-itens");
  if (hasPendingItemsForUser) {
    btnConcluir.classList.remove("d-none");
  }
}

function preencherAnexosRegistro(anexos) {
  const container = document.getElementById("anexos-container");
  container.innerHTML = "";

  if (!anexos || anexos.length === 0) {
    container.innerHTML =
      '<div class="col-12"><p class="text-muted">Nenhum anexo de registro encontrado.</p></div>';
    return;
  }

  anexos.forEach((anexo) => {
    const { iconClass, colorClass } = getFileIconAndColor(anexo.nome_original);
    const anexoHtml = `
            <div class="col-md-4 mb-3">
                <a href="${
                  anexo.caminho_servidor
                }" target="_blank" class="anexo-card">
                    <div class="anexo-icon-wrapper" style="background-color: ${colorClass};">
                        <i class="fas ${iconClass} anexo-icon"></i>
                    </div>
                    <div class="anexo-info">
                        <p class="anexo-nome">${anexo.nome_original}</p>
                        <p class="anexo-tamanho">${(
                          anexo.tamanho / 1024
                        ).toFixed(2)} KB</p>
                    </div>
                </a>
            </div>
        `;
    container.innerHTML += anexoHtml;
  });
}

function getFileIconAndColor(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const types = {
    pdf: { icon: "fa-file-pdf", color: "#dc3545" },
    doc: { icon: "fa-file-word", color: "#2a5298" },
    docx: { icon: "fa-file-word", color: "#2a5298" },
    xls: { icon: "fa-file-excel", color: "#198754" },
    xlsx: { icon: "fa-file-excel", color: "#198754" },
    jpg: { icon: "fa-file-image", color: "#0dcaf0" },
    jpeg: { icon: "fa-file-image", color: "#0dcaf0" },
    png: { icon: "fa-file-image", color: "#0dcaf0" },
  };
  const fileType = types[ext] || { icon: "fa-file-alt", color: "#6c757d" };
  return { iconClass: fileType.icon, colorClass: fileType.color };
}