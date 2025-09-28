// public/scripts/trafos_reformados/transformadores_reformados.js

let accessDeniedModalInstance;
let developmentModalInstance;
let user = null; // Para dados do usuário, se esta página precisar para lógica específica

document.addEventListener("DOMContentLoaded", function () {
  user = JSON.parse(localStorage.getItem("user"));

  if (
    typeof bootstrap !== "undefined" &&
    typeof bootstrap.Modal !== "undefined"
  ) {
    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);

    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);

    console.log(
      "Transformadores Reformados: Modais Bootstrap inicializados (ou tentativa)."
    );
  } else {
    console.warn(
      "Transformadores Reformados: Bootstrap JS não carregado ou bootstrap.Modal não está definido."
    );
  }
  console.log(
    "Transformadores Reformados: Script específico da página carregado."
  );
});

window.navigateTo = async function (pageNameOrUrl) {
  let urlToNavigate = pageNameOrUrl;
  if (!pageNameOrUrl.startsWith("/") && !pageNameOrUrl.startsWith("http")) {
    urlToNavigate = `/${pageNameOrUrl}`;
  }

  if (
    window.location.pathname === urlToNavigate &&
    !urlToNavigate.includes("?")
  ) {
    console.log(
      `Transformadores Reformados (navigateTo): Já está na página ${urlToNavigate}.`
    );
    return;
  }

  console.log(
    `Transformadores Reformados (navigateTo): Tentando navegar para: ${urlToNavigate}`
  );
  try {
    const response = await fetch(urlToNavigate, {
      method: "HEAD",
    });

    if (
      response.ok ||
      response.status === 401 ||
      response.status === 403 ||
      response.redirected
    ) {
      window.location.href = urlToNavigate;
    } else if (response.status === 404) {
      if (developmentModalInstance) developmentModalInstance.show();
      else alert("Página não encontrada ou em desenvolvimento.");
    } else {
      console.error(
        `Transformadores Reformados (navigateTo): Erro ${response.status} ao testar acesso a ${urlToNavigate}.`
      );
      if (developmentModalInstance) developmentModalInstance.show();
      else alert("Erro ao tentar acessar a página.");
    }
  } catch (error) {
    console.error(
      "Transformadores Reformados (navigateTo): Erro de rede ou na requisição:",
      error
    );
    window.location.href = urlToNavigate;
  }
};
