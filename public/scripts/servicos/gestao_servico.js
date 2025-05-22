// public/scripts/servicos/gestao_servico.js

let accessDeniedModalInstance;
let developmentModalInstance; // Adicionado para consistência com navigateTo

document.addEventListener("DOMContentLoaded", function () {
  if (
    typeof bootstrap !== "undefined" &&
    typeof bootstrap.Modal !== "undefined"
  ) {
    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);

    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);

    console.log(
      "Gestão de Serviços: Modais Bootstrap inicializados (ou tentativa)."
    );
  } else {
    console.warn(
      "Gestão de Serviços: Bootstrap JS não carregado ou bootstrap.Modal não está definido."
    );
  }
});

window.navigateTo = async function (pageNameOrUrl) {
  let urlToNavigate = pageNameOrUrl;
  if (!pageNameOrUrl.startsWith("/") && !pageNameOrUrl.startsWith("http")) {
    urlToNavigate = `/${pageNameOrUrl}`;
  }

  console.log(
    `Gestão de Serviços (navigateTo): Tentando navegar para: ${urlToNavigate}`
  );

  if (window.location.pathname === urlToNavigate) {
    console.log(
      `Gestão de Serviços (navigateTo): Já está na página ${urlToNavigate}.`
    );
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
      console.error(
        `Gestão de Serviços (navigateTo): Erro ${response.status} ao acessar ${urlToNavigate}.`
      );
      if (developmentModalInstance) developmentModalInstance.show();
      else alert("Erro ao tentar acessar a página. Verifique o console.");
    }
  } catch (error) {
    console.error(
      "Gestão de Serviços (navigateTo): Erro de rede ou na requisição:",
      error
    );
    if (developmentModalInstance) developmentModalInstance.show();
    else alert("Erro de rede ou falha na navegação.");
  }
};

console.log("Gestão de Serviços: Script específico da página carregado.");
