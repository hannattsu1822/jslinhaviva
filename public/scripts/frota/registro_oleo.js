// public/scripts/frota/registro_oleo.js

let accessDeniedModalInstance;
let developmentModalInstance;
let currentUser = null; // Variável para armazenar o usuário logado, se necessário para lógica da página

async function loadVeiculos() {
  try {
    const response = await fetch("/api/veiculos_oleo", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (!response.ok)
      throw new Error(`Erro ao carregar veículos: ${response.statusText}`);
    const veiculos = await response.json();
    const select = document.getElementById("veiculoId");
    if (!select) return;
    select.innerHTML = '<option value="">Selecione um veículo</option>';
    veiculos.forEach((veiculo) => {
      const option = document.createElement("option");
      option.value = veiculo.id;
      option.textContent = `${veiculo.placa} - ${veiculo.modelo || "N/A"}`;
      option.dataset.placa = veiculo.placa;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Erro em loadVeiculos:", error);
    alert("Falha ao carregar lista de veículos: " + error.message);
  }
}

async function loadResponsaveis() {
  try {
    const response = await fetch("/api/tecnicos_oleo", {
      /* Confirmar se esta API retorna IDs e não só matrículas */
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (!response.ok)
      throw new Error(`Erro ao carregar responsáveis: ${response.statusText}`);
    const tecnicos = await response.json();
    const select = document.getElementById("responsavelId");
    if (!select) return;
    select.innerHTML = '<option value="">Selecione o responsável</option>';
    tecnicos.forEach((tecnico) => {
      const option = document.createElement("option");
      option.value = tecnico.id; // Assumindo que a API retorna tecnico.id
      option.textContent = `${tecnico.nome} (${tecnico.matricula})`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Erro em loadResponsaveis:", error);
    alert("Falha ao carregar lista de responsáveis: " + error.message);
  }
}

async function updateHorimetroInfoDisplay(placa) {
  const horimetroInfoDiv = document.getElementById("horimetroInfo");
  if (!placa) {
    if (horimetroInfoDiv) horimetroInfoDiv.style.display = "none";
    return;
  }
  try {
    const inspecaoResponse = await fetch(
      `/api/ultimo_horimetro?placa=${placa}`,
      {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      }
    );
    let horimetroInspecao = 0;
    if (inspecaoResponse.ok) {
      const inspecaoData = await inspecaoResponse.json();
      horimetroInspecao = parseFloat(inspecaoData.horimetro) || 0;
    } else if (inspecaoResponse.status !== 404) {
      console.warn(
        `Problema ao buscar horímetro de inspeção para placa ${placa}: ${inspecaoResponse.statusText}`
      );
    }

    const veiculoId = document.getElementById("veiculoId").value;
    let horimetroUltimaTrocaOleo = 0;
    if (veiculoId) {
      const trocaResponse = await fetch(`/api/historico_oleo/${veiculoId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (trocaResponse.ok) {
        const trocaData = await trocaResponse.json();
        if (trocaData.length > 0) {
          horimetroUltimaTrocaOleo = parseFloat(trocaData[0].horimetro) || 0;
        }
      } else if (trocaResponse.status !== 404) {
        console.warn(
          `Problema ao buscar histórico de troca de óleo para veículo ID ${veiculoId}: ${trocaResponse.statusText}`
        );
      }
    }

    const horimetroAtualInputEl = document.getElementById("horimetro");
    const horimetroAtualInput = horimetroAtualInputEl
      ? parseFloat(horimetroAtualInputEl.value) || 0
      : 0;
    const horimetroBaseParaCalculo =
      horimetroAtualInput > 0 ? horimetroAtualInput : horimetroUltimaTrocaOleo;

    const ultimaInspecaoEl = document.getElementById("ultimaInspecao");
    const ultimaTrocaOleoEl = document.getElementById("ultimaTrocaOleo");
    const proximaTrocaOleoEl = document.getElementById("proximaTrocaOleo");

    if (ultimaInspecaoEl)
      ultimaInspecaoEl.textContent = `${horimetroInspecao.toFixed(0)} h`;
    if (ultimaTrocaOleoEl)
      ultimaTrocaOleoEl.textContent = `${horimetroUltimaTrocaOleo.toFixed(
        0
      )} h`;
    if (proximaTrocaOleoEl)
      proximaTrocaOleoEl.textContent = `${
        Math.floor(horimetroBaseParaCalculo) + 300
      } h`;

    if (horimetroInfoDiv) horimetroInfoDiv.style.display = "block";
  } catch (error) {
    console.error("Erro ao atualizar informações do horímetro:", error);
    if (horimetroInfoDiv) horimetroInfoDiv.style.display = "none";
  }
}

async function handleSubmitOleo(event) {
  event.preventDefault();
  const horimetroInput = document.getElementById("horimetro");
  const horimetroValue = parseFloat(horimetroInput.value);

  if (isNaN(horimetroValue) || horimetroValue < 0) {
    alert("O valor do horímetro deve ser um número positivo.");
    horimetroInput.focus();
    return;
  }

  const formData = {
    veiculo_id: document.getElementById("veiculoId").value,
    responsavel_id: document.getElementById("responsavelId").value,
    data_troca: document.getElementById("dataTroca").value,
    horimetro: horimetroValue,
    observacoes: document.getElementById("observacoes").value.trim() || null,
  };

  const submitButton = event.target.querySelector('button[type="submit"]');
  const originalButtonHTML = submitButton.innerHTML;
  submitButton.disabled = true;
  submitButton.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i>Registrando...';

  try {
    const response = await fetch("/api/registrar_oleo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(formData),
    });
    const result = await response.json();
    if (response.ok) {
      alert(result.message || "Troca de óleo registrada com sucesso!");
      loadHistorico(document.getElementById("veiculoId").value || null);
      document.getElementById("oleoForm").reset();
      const horimetroInfoDiv = document.getElementById("horimetroInfo");
      if (horimetroInfoDiv) horimetroInfoDiv.style.display = "none";
      const veiculoSelect = document.getElementById("veiculoId");
      if (veiculoSelect) veiculoSelect.dispatchEvent(new Event("change"));
    } else {
      throw new Error(
        result.message || "Erro desconhecido ao registrar troca."
      );
    }
  } catch (error) {
    console.error("Erro em handleSubmitOleo:", error);
    alert(`Erro ao registrar troca: ${error.message}`);
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = originalButtonHTML;
  }
}

async function loadHistorico(veiculoId = null) {
  const tbody = document.querySelector("#historicoTable tbody");
  const noHistoryDiv = document.getElementById("noHistory");
  if (!tbody || !noHistoryDiv) return;

  tbody.innerHTML = `<tr><td colspan="8" class="text-center">Carregando histórico... <i class="fas fa-spinner fa-spin"></i></td></tr>`;
  noHistoryDiv.style.display = "none";

  try {
    let url = "/api/historico_oleo";
    if (
      veiculoId &&
      veiculoId !== "undefined" &&
      veiculoId !== "null" &&
      veiculoId !== ""
    ) {
      url = `/api/historico_oleo/${veiculoId}`;
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (!response.ok)
      throw new Error(
        `Erro ao carregar histórico: ${response.statusText} (${response.status})`
      );
    const historico = await response.json();

    tbody.innerHTML = "";

    if (historico.length > 0) {
      noHistoryDiv.style.display = "none";
      historico.forEach((item) => {
        const row = document.createElement("tr");
        const dataTroca =
          item.data_troca_formatada ||
          (item.data_troca
            ? new Date(item.data_troca).toLocaleDateString("pt-BR", {
                timeZone: "UTC",
              })
            : "N/A");
        const dataRegistro =
          item.data_registro ||
          (item.created_at
            ? new Date(item.created_at).toLocaleString("pt-BR", {
                timeZone: "UTC",
              })
            : "N/A");
        row.innerHTML = `
            <td>${dataTroca}</td>
            <td>${item.placa || "N/A"}</td>
            <td>${item.modelo || "N/A"}</td>
            <td>${
              item.horimetro
                ? parseFloat(item.horimetro).toFixed(0) + " h"
                : "N/A"
            }</td>
            <td>${item.responsavel_nome || "N/A"}</td>
            <td>${dataRegistro}</td>
            <td>${item.observacoes || "-"}</td>
            <td>
                <button class="btn btn-sm btn-delete" onclick="excluirTrocaOleo(${
                  item.id
                }, this)" title="Excluir">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>`;
        tbody.appendChild(row);
      });
    } else {
      noHistoryDiv.style.display = "block";
      tbody.innerHTML = "";
    }
  } catch (error) {
    console.error("Erro em loadHistorico:", error);
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Erro ao carregar histórico: ${error.message}</td></tr>`;
    noHistoryDiv.style.display = "none";
  }
}

window.excluirTrocaOleo = async function (trocaId, buttonElement) {
  if (
    !confirm(
      "Tem certeza que deseja excluir este registro de troca de óleo? Esta ação não pode ser desfeita."
    )
  ) {
    return;
  }
  const originalButtonHTML = buttonElement.innerHTML;
  buttonElement.disabled = true;
  buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  try {
    const cleanTrocaId = String(trocaId).split(":")[0];
    const response = await fetch(
      `/api/trocas_oleo/${encodeURIComponent(cleanTrocaId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      }
    );
    const contentType = response.headers.get("content-type");
    const responseText = await response.text();
    let jsonData = null;
    if (contentType && contentType.includes("application/json")) {
      try {
        jsonData = JSON.parse(responseText);
      } catch (jsonError) {
        if (!response.ok)
          throw new Error(
            responseText ||
              `Erro ${response.status} do servidor com resposta JSON inválida.`
          );
        jsonData = {
          message: "Resposta JSON inválida, mas operação pode ter sido OK.",
        };
      }
    }
    if (response.ok) {
      alert(
        jsonData && jsonData.message
          ? jsonData.message
          : responseText || "Registro de troca de óleo excluído com sucesso!"
      );
      loadHistorico(document.getElementById("veiculoId").value || null);
    } else {
      const errorMessageFromServer =
        jsonData && jsonData.message ? jsonData.message : responseText;
      throw new Error(
        errorMessageFromServer ||
          `Erro ao excluir o registro: ${response.status}`
      );
    }
  } catch (error) {
    console.error("Erro ao excluir troca de óleo:", error);
    const errorMessageContent =
      error.message &&
      error.message.trim().toLowerCase().startsWith("<!doctype html>")
        ? "Ocorreu um erro inesperado no servidor ao tentar excluir."
        : error.message;
    alert(`Erro: ${errorMessageContent}`);
  } finally {
    if (buttonElement) {
      buttonElement.disabled = false;
      buttonElement.innerHTML = originalButtonHTML;
    }
  }
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

document.addEventListener("DOMContentLoaded", async function () {
  currentUser = JSON.parse(localStorage.getItem("user"));
  if (
    !currentUser &&
    window.location.pathname !== "/login" &&
    window.location.pathname !== "/"
  ) {
    // Se sidebar.js não redirecionar, esta página pode fazê-lo se não for pública
    // window.location.href = "/login";
  }

  if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);

    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
  }

  await loadVeiculos();
  await loadResponsaveis();

  const oleoForm = document.getElementById("oleoForm");
  if (oleoForm) oleoForm.addEventListener("submit", handleSubmitOleo);

  const veiculoSelect = document.getElementById("veiculoId");
  if (veiculoSelect) {
    veiculoSelect.addEventListener("change", function () {
      const veiculoId = this.value || null;
      loadHistorico(veiculoId);
      if (veiculoId) {
        const selectedOption = this.options[this.selectedIndex];
        if (selectedOption && selectedOption.dataset.placa) {
          const placa = selectedOption.dataset.placa;
          updateHorimetroInfoDisplay(placa);
        }
      } else {
        const horimetroInfoDiv = document.getElementById("horimetroInfo");
        if (horimetroInfoDiv) horimetroInfoDiv.style.display = "none";
      }
    });
  }

  const horimetroInput = document.getElementById("horimetro");
  if (horimetroInput && veiculoSelect) {
    horimetroInput.addEventListener("input", function () {
      if (veiculoSelect.value) {
        const selectedOption =
          veiculoSelect.options[veiculoSelect.selectedIndex];
        if (selectedOption && selectedOption.dataset.placa) {
          const placaSelecionada = selectedOption.dataset.placa;
          updateHorimetroInfoDisplay(placaSelecionada);
        }
      }
    });
  }
  loadHistorico();
});
