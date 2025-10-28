// public/scripts/servicos/gestao_servico.js

let accessDeniedModalInstance;
let developmentModalInstance;

document.addEventListener("DOMContentLoaded", function () {
  if (
    typeof bootstrap !== "undefined" &&
    typeof bootstrap.Modal !== "undefined"
  ) {
    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);

    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
  }

  const user = JSON.parse(localStorage.getItem("user"));
  if (user) {
    const cardPermissions = {
      "card-registro-servico": { nivel: 5 },
      "card-servicos-ativos": { nivel: 3 },
      "card-servicos-concluidos": { nivel: 3 },
      "card-relatorios": { nivel: 5 },
      "card-acompanhamento-construcao": {
        cargos: ["Construção", "Engenheiro", "ADMIN", "ADM"],
      },
    };

    for (const cardId in cardPermissions) {
      const card = document.getElementById(cardId);
      if (card) {
        const perm = cardPermissions[cardId];
        let hasPermission = false;

        if (perm.nivel && user.nivel >= perm.nivel) {
          hasPermission = true;
        }

        if (perm.cargos && perm.cargos.includes(user.cargo)) {
          hasPermission = true;
        }

        if (hasPermission) {
          card.style.display = "block";
        }
      }
    }
  }
});

window.navigateTo = async function (pageNameOrUrl) {
  let urlToNavigate = pageNameOrUrl;
  if (!pageNameOrUrl.startsWith("/") && !pageNameOrUrl.startsWith("http")) {
    urlToNavigate = `/${pageNameOrUrl}`;
  }

  if (window.location.pathname === urlToNavigate) {
    return;
  }

  try {
    const response = await fetch(urlToNavigate, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

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
      else alert("Erro ao tentar acessar a página. Verifique o console.");
    }
  } catch (error) {
    if (developmentModalInstance) developmentModalInstance.show();
    else alert("Erro de rede ou falha na navegação.");
  }
};
