// public/scripts/servicos/gestao_servico.js

let accessDeniedModalInstance;
let developmentModalInstance;

function aplicarCardsGestaoServicos(user) {
  if (!user) return;
  const P = window.ServicosPermissions || {};
  const cardIds = [
    "card-registro-servico",
    "card-servicos-ativos",
    "card-servicos-concluidos",
    "card-relatorios",
    "card-acompanhamento-construcao",
  ];
  cardIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  const construcaoRestrito =
    P.ehCargoConstrucaoAcompanhamento?.(user) && !P.temControleTotal?.(user);

  if (construcaoRestrito) {
    const cardAcompanhamento = document.getElementById(
      "card-acompanhamento-construcao"
    );
    if (cardAcompanhamento) cardAcompanhamento.style.display = "block";
    return;
  }

  const cardPermissions = {
    "card-registro-servico": { check: () => P.podeRegistrarServico?.(user) },
    "card-servicos-ativos": { check: () => P.podeAcessarModuloServicos?.(user) },
    "card-servicos-concluidos": {
      check: () => P.podeAcessarModuloServicos?.(user),
    },
    "card-relatorios": { check: () => P.temControleTotal?.(user) },
    "card-acompanhamento-construcao": {
      check: () => P.podeAcompanharConstrucao?.(user),
    },
  };

  for (const cardId in cardPermissions) {
    const card = document.getElementById(cardId);
    if (card && cardPermissions[cardId].check()) {
      card.style.display = "block";
    }
  }
}

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

  document.addEventListener("sidebar:ready", (event) => {
    aplicarCardsGestaoServicos(event.detail?.user);
  });

  fetch("/api/me", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((user) => {
      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
        aplicarCardsGestaoServicos(user);
      }
    })
    .catch(() => {
      try {
        aplicarCardsGestaoServicos(JSON.parse(localStorage.getItem("user")));
      } catch {
        /* ignora */
      }
    });
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
