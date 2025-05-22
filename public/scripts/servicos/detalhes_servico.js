let confirmModalInstance;
let accessDeniedModalInstance;
let developmentModalInstance;

function tratarValor(valor) {
  return valor || "Não informado";
}

function formatarValoresConcatenados(valor) {
  if (!valor) return "Não informado";
  return valor
    .split(",")
    .map((item) => item.trim())
    .join(", ");
}

function formatarDataParaExibicao(dataString, includeTime = true) {
  if (!dataString) return "Não informado";
  try {
    const data = new Date(dataString);
    if (isNaN(data.getTime())) {
      const parts = dataString.split(/[\s/:\-T]+/);
      if (parts.length >= 3) {
        let year = parseInt(parts[0], 10);
        let month = parseInt(parts[1], 10) - 1;
        let day = parseInt(parts[2], 10);

        if (
          parts[0].length <= 2 &&
          parts[1].length <= 2 &&
          parts[2].length === 4
        ) {
          day = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          year = parseInt(parts[2], 10);
        }

        let hours = 0,
          minutes = 0;
        if (parts.length >= 5 && includeTime) {
          hours = parseInt(parts[3], 10);
          minutes = parseInt(parts[4], 10);
        }
        const testDate = new Date(Date.UTC(year, month, day, hours, minutes));
        if (!isNaN(testDate.getTime())) {
          const options = {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            timeZone: "UTC",
          };
          if (includeTime) {
            options.hour = "2-digit";
            options.minute = "2-digit";
          }
          return testDate.toLocaleString("pt-BR", options).replace(",", "");
        }
      }
      return "Data inválida";
    }
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
    if (partes.length >= 2) {
      return `${partes[0]}:${partes[1]}`;
    }
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
    const response = await fetch(`/api/servicos/${servicoId}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData
          ? errorData.message
          : `Erro ao carregar detalhes do serviço: ${response.status}`
      );
    }

    const { success, data, message } = await response.json();

    if (!success || !data) {
      throw new Error(
        message ||
          "Detalhes do serviço não encontrados ou formato de resposta inválido."
      );
    }

    document.getElementById("servico-id").textContent = data.id || "-";
    document.getElementById("servico-processo").textContent =
      data.processo || "Não informado";
    document.getElementById("servico-subestacao").textContent =
      data.subestacao || "Não informado";
    document.getElementById("servico-alimentador").textContent =
      data.alimentador || "Não informado";
    document.getElementById("servico-chave-montante").textContent =
      data.chave_montante || "Não informado";
    document.getElementById("servico-responsavel").textContent =
      data.responsavel_matricula && data.responsavel_matricula !== "pendente"
        ? `${data.responsavel_matricula} - ${
            data.responsavel_nome || "Nome não disponível"
          }`
        : data.responsavel_matricula === "pendente"
        ? "Pendente de atribuição"
        : "Não informado";
    document.getElementById("servico-data-prevista").textContent =
      formatarDataParaExibicao(data.data_prevista_execucao, false);

    const desligamentoElement = document.getElementById("servico-desligamento");
    const horaInicioContainer = document.getElementById(
      "hora-inicio-container"
    );
    const horaFimContainer = document.getElementById("hora-fim-container");

    if (data.desligamento === "SIM") {
      if (desligamentoElement) desligamentoElement.textContent = "Sim";
      if (horaInicioContainer) horaInicioContainer.style.display = "block";
      if (horaFimContainer) horaFimContainer.style.display = "block";
      document.getElementById("servico-hora-inicio").textContent = formatarHora(
        data.hora_inicio
      );
      document.getElementById("servico-hora-fim").textContent = formatarHora(
        data.hora_fim
      );
    } else {
      if (desligamentoElement) desligamentoElement.textContent = "Não";
      if (horaInicioContainer) horaInicioContainer.style.display = "none";
      if (horaFimContainer) horaFimContainer.style.display = "none";
    }

    const statusElement = document.getElementById("servico-status");
    if (statusElement) {
      statusElement.textContent =
        data.status === "ativo"
          ? "Ativo"
          : data.status === "concluido"
          ? "Concluído"
          : data.status || "Desconhecido";
      statusElement.className = "status-badge ";
      if (data.status === "ativo")
        statusElement.classList.add("bg-warning", "text-dark");
      else if (data.status === "concluido")
        statusElement.classList.add("bg-success", "text-white");
      else statusElement.classList.add("bg-secondary", "text-white");
    }

    const locationCard = document.getElementById("location-card");
    const mapsLink = document.getElementById("maps-link");
    const mapsLinkParagraph = locationCard
      ? locationCard.querySelector("p")
      : null;

    if (mapsLink && locationCard && mapsLinkParagraph) {
      if (data.maps && data.maps.trim() !== "") {
        let mapsUrl = data.maps.trim();
        if (!mapsUrl.startsWith("http://") && !mapsUrl.startsWith("https://")) {
          mapsUrl = "https://" + mapsUrl;
        }
        mapsLink.href = mapsUrl;
        mapsLink.target = "_blank";
        locationCard.classList.add("hover-effect");
        locationCard.style.cursor = "pointer";
        mapsLinkParagraph.textContent = "Clique para abrir no Google Maps";
      } else {
        locationCard.style.cursor = "default";
        mapsLink.removeAttribute("href");
        mapsLink.onclick = (e) => e.preventDefault();
        const icon = locationCard.querySelector(".fa-map-marked-alt");
        if (icon) icon.classList.replace("text-primary", "text-muted");
        mapsLinkParagraph.textContent = "Link do Google Maps não fornecido";
      }
    }

    const conclusaoContainer = document.getElementById("conclusao-container");
    if (data.status === "concluido" && conclusaoContainer) {
      conclusaoContainer.classList.remove("d-none");
      document.getElementById("servico-data-conclusao").textContent =
        formatarDataParaExibicao(data.data_conclusao);
      document.getElementById("servico-observacoes").textContent =
        data.observacoes_conclusao || "Nenhuma observação de conclusão.";
    } else if (conclusaoContainer) {
      conclusaoContainer.classList.add("d-none");
    }

    preencherAnexos(data.anexos || []);
  } catch (error) {
    console.error("Erro ao carregar detalhes do serviço:", error);
    mostrarErroDetalhes(
      error.message || "Falha ao carregar informações do serviço."
    );
  }
}

function preencherAnexos(anexos) {
  const anexosContainer = document.getElementById("anexos-container");
  if (!anexosContainer) return;
  anexosContainer.innerHTML = "";

  if (!anexos || anexos.length === 0) {
    anexosContainer.innerHTML = `<div class="col-12"><p class="text-center text-muted py-3">Nenhum anexo encontrado.</p></div>`;
    return;
  }

  anexos.forEach((anexo) => {
    const anexoElement = document.createElement("div");
    anexoElement.className =
      "col-xl-3 col-lg-4 col-md-6 col-sm-6 col-12 mb-3 d-flex align-items-stretch";

    let caminhoCorretoAnexo = "#";
    const nomeOriginalDoAnexo = anexo.nomeOriginal || "arquivo";
    const tamanhoFormatadoAnexo = anexo.tamanho || "";
    const tipoAnexoApi = anexo.tipo || "";

    if (
      anexo &&
      typeof anexo.caminho === "string" &&
      anexo.caminho.trim() !== ""
    ) {
      caminhoCorretoAnexo = anexo.caminho.startsWith("/")
        ? anexo.caminho
        : `/${anexo.caminho}`;
    } else {
      console.warn("Anexo sem caminho válido:", anexo);
    }

    let previewHTML = "";
    const isImage =
      tipoAnexoApi.toLowerCase() === "imagem" ||
      /\.(jpe?g|png|gif|bmp|webp)$/i.test(nomeOriginalDoAnexo);

    if (isImage && caminhoCorretoAnexo !== "#") {
      previewHTML = `<img src="${caminhoCorretoAnexo}" alt="Preview de ${nomeOriginalDoAnexo}" class="attachment-preview-img">`;
    } else {
      previewHTML = `<i class="fas ${getFileIcon(
        nomeOriginalDoAnexo
      )} fa-3x attachment-preview-icon"></i>`;
    }

    anexoElement.innerHTML = `
            <div class="attachment-card card h-100 w-100">
                <div class="card-body text-center d-flex flex-column justify-content-between align-items-center">
                    <div class="attachment-thumbnail mb-2">
                        ${previewHTML}
                    </div>
                    <div>
                        <p class="attachment-name small mb-1" title="${nomeOriginalDoAnexo}">${truncateFilename(
      nomeOriginalDoAnexo,
      25
    )}</p>
                        <p class="attachment-size small text-muted mb-2">${tamanhoFormatadoAnexo}</p>
                    </div>
                    <div class="btn-group mt-auto">
                        <a href="${caminhoCorretoAnexo}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary ${
      caminhoCorretoAnexo === "#" ? "disabled" : ""
    }" title="Visualizar ${nomeOriginalDoAnexo}">
                            <i class="fas fa-eye"></i>
                        </a>
                        <a href="${caminhoCorretoAnexo}" download="${nomeOriginalDoAnexo}" class="btn btn-sm btn-outline-secondary ${
      caminhoCorretoAnexo === "#" ? "disabled" : ""
    }" title="Baixar ${nomeOriginalDoAnexo}">
                            <i class="fas fa-download"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;
    anexosContainer.appendChild(anexoElement);
  });
}
function truncateFilename(filename, maxLength = 22) {
  if (!filename || filename.length <= maxLength) return filename || "";
  const extIndex = filename.lastIndexOf(".");
  if (extIndex === -1 || extIndex === 0 || extIndex === filename.length - 1) {
    return filename.substring(0, maxLength - 3) + "...";
  }
  const ext = filename.substring(extIndex);
  const name = filename.substring(0, extIndex);
  if (name.length + ext.length <= maxLength) return filename;
  return name.substring(0, maxLength - ext.length - 3) + "..." + ext;
}

function getFileIcon(filename) {
  if (!filename) return "fa-file text-secondary";
  const ext = filename.split(".").pop().toLowerCase();
  const icons = {
    pdf: "fa-file-pdf text-danger",
    doc: "fa-file-word text-primary",
    docx: "fa-file-word text-primary",
    xls: "fa-file-excel text-success",
    xlsx: "fa-file-excel text-success",
    ppt: "fa-file-powerpoint text-warning",
    pptx: "fa-file-powerpoint text-warning",
    jpg: "fa-file-image text-info",
    jpeg: "fa-file-image text-info",
    png: "fa-file-image text-info",
    gif: "fa-file-image text-info",
    zip: "fa-file-archive text-secondary",
    rar: "fa-file-archive text-secondary",
    txt: "fa-file-alt text-secondary",
    csv: "fa-file-csv text-success",
  };
  return icons[ext] || "fa-file text-secondary";
}

function mostrarErroDetalhes(mensagem) {
  const containerPrincipal = document.querySelector(
    ".main-content .container.py-4 #alerta-container-detalhes"
  );
  if (containerPrincipal) {
    const alertaExistente = containerPrincipal.querySelector(
      ".alert.alert-danger"
    );
    if (alertaExistente) alertaExistente.remove();

    const alerta = document.createElement("div");
    alerta.className = "alert alert-danger mt-0 mb-3"; // Ajustado para ficar no topo
    alerta.setAttribute("role", "alert");
    alerta.textContent = mensagem;

    if (containerPrincipal.firstChild) {
      containerPrincipal.insertBefore(alerta, containerPrincipal.firstChild);
    } else {
      containerPrincipal.appendChild(alerta);
    }
  } else {
    alert(mensagem);
  }
}

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

document.addEventListener("DOMContentLoaded", async () => {
  if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
    const confirmModalEl = document.getElementById("confirmModal");
    if (confirmModalEl)
      confirmModalInstance = new bootstrap.Modal(confirmModalEl);

    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);

    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
  } else {
    console.warn(
      "Detalhes Serviço: Bootstrap não está carregado, modais podem não funcionar."
    );
  }

  await carregarDetalhesServico();

  const urlParams = new URLSearchParams(window.location.search);
  const servicoId = urlParams.get("id");

  const btnEditar = document.getElementById("btn-editar");
  if (btnEditar && servicoId) {
    btnEditar.addEventListener("click", () => {
      window.location.href = `/editar_servico?id=${servicoId}`;
    });
  }

  const btnExcluir = document.getElementById("btn-excluir");
  if (btnExcluir && confirmModalInstance) {
    btnExcluir.addEventListener("click", () => {
      if (confirmModalInstance) confirmModalInstance.show();
    });
  }

  const confirmDeleteBtn = document.getElementById("confirmDelete");
  if (confirmDeleteBtn && servicoId) {
    confirmDeleteBtn.addEventListener("click", async () => {
      const originalBtnText = confirmDeleteBtn.innerHTML;
      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Excluindo...';
      try {
        const response = await fetch(`/api/servicos/${servicoId}`, {
          method: "DELETE",
        });
        if (response.ok) {
          alert("Serviço excluído com sucesso!");
          window.location.href = "/servicos_ativos";
        } else {
          const errorData = await response
            .json()
            .catch(() => ({ message: "Erro desconhecido ao excluir." }));
          throw new Error(errorData.message || "Erro ao excluir serviço");
        }
      } catch (error) {
        console.error("Erro ao excluir serviço:", error);
        alert("Erro ao excluir serviço: " + error.message);
      } finally {
        if (confirmModalInstance) confirmModalInstance.hide();
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.innerHTML = originalBtnText;
      }
    });
  }
});

console.log("Detalhes Serviço: Script específico da página carregado.");
