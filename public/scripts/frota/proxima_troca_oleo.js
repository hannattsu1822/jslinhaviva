// public/scripts/frota/proxima_troca_oleo.js

let accessDeniedModalInstance;
let developmentModalInstance;

async function carregarProximasTrocas() {
  const container = document.querySelector(".cards-container");
  if (!container) {
    console.error("Elemento .cards-container não encontrado.");
    return;
  }
  container.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i> Carregando dados dos veículos...</div>`;

  try {
    const response = await fetch("/api/proxima_troca_oleo", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, // Assumindo que a API é protegida
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Erro ao carregar dados: ${response.status} ${errorText}`
      );
    }
    const data = await response.json();
    container.innerHTML = "";

    if (!data || data.length === 0) {
      container.innerHTML = `<div class="no-vehicles"><i class="fas fa-info-circle"></i> Nenhum veículo encontrado para próximas trocas.</div>`;
      return;
    }

    data.forEach((veiculo) => {
      const card = document.createElement("div");
      card.className = "card shadow-sm"; // Adicionando sombra leve

      const ultimaTroca = parseInt(veiculo.ultimaTroca) || 0;
      const horimetroInspecao = parseInt(veiculo.horimetroInspecao) || 0;
      const proximaTrocaIdeal = ultimaTroca + 300;
      const horasRestantes = proximaTrocaIdeal - horimetroInspecao;

      let statusClass = "ok";
      let statusText = "EM DIA";
      let horasStatusText = "Horas restantes:";

      if (horimetroInspecao >= proximaTrocaIdeal) {
        statusClass = "urgent";
        statusText = "ATRASADO";
        horasStatusText = "Horas em atraso:";
      } else if (horasRestantes <= 60) {
        statusClass = "warning";
        statusText = "ATENÇÃO";
      }

      card.innerHTML = `
                <div class="card-header ${statusClass}">
                    <h3><i class="fas fa-truck me-2"></i>${
                      veiculo.placa || "N/A"
                    }</h3>
                    <span class="badge ${statusClass}">${statusText}</span>
                </div>
                <div class="card-body">
                    <div class="info-row">
                        <span>Modelo:</span>
                        <strong>${veiculo.modelo || "N/A"}</strong>
                    </div>
                    <div class="horimetro-info">
                        <div class="horimetro-item">
                            <span class="horimetro-label">Horímetro últ. troca:</span>
                            <span class="horimetro-value">${ultimaTroca} h</span>
                        </div>
                        <div class="horimetro-item">
                            <span class="horimetro-label">Horímetro atual (insp.):</span>
                            <span class="horimetro-value">${horimetroInspecao} h</span>
                        </div>
                        <div class="horimetro-item proxima-troca">
                            <span class="horimetro-label">Próxima troca ideal:</span>
                            <span class="horimetro-value">${proximaTrocaIdeal} h</span>
                        </div>
                        <div class="horimetro-item ${statusClass}">
                            <span class="horimetro-label">${horasStatusText}</span>
                            <span class="horimetro-value">${Math.abs(
                              horasRestantes
                            )} h</span>
                        </div>
                    </div>
                </div>
            `;
      container.appendChild(card);
    });
  } catch (error) {
    console.error("Erro ao carregar próximas trocas:", error);
    container.innerHTML = `<div class="error"><i class="fas fa-exclamation-triangle"></i> Erro ao carregar dados dos veículos: ${error.message}</div>`;
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

document.addEventListener("DOMContentLoaded", function () {
  if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);

    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
  } else {
    console.warn(
      "Próxima Troca Óleo: Bootstrap JS não carregado, modais padrão podem não funcionar."
    );
  }
  carregarProximasTrocas();
});
