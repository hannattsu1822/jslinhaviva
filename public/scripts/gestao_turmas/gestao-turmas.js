// public/scripts/gestao_turmas/gestao_turmas.js

let accessDeniedModalInstance;
let developmentModalInstance;

document.addEventListener("DOMContentLoaded", function () {
  const user = JSON.parse(localStorage.getItem("user"));
  if (
    !user &&
    window.location.pathname !== "/login" &&
    window.location.pathname !== "/"
  ) {
    // console.warn("Gestao-Turmas.js: Usuário não encontrado no localStorage."); // Removido conforme solicitado
  }

  if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);

    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
  } else {
    // console.warn( // Removido conforme solicitado
    //   "Gestao-Turmas.js: Bootstrap JS não carregado ou bootstrap.Modal não está definido."
    // );
  }
  // console.log("Gestão de Turmas: Script específico da página carregado."); // Removido conforme solicitado
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
    return;
  }

  // console.log( // Removido conforme solicitado
  //   `Gestão de Turmas (navigateTo): Tentando navegar para: ${urlToNavigate}`
  // );
  try {
    const response = await fetch(urlToNavigate); // ALTERADO DE { method: "HEAD" } PARA GET PADRÃO

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
      if (developmentModalInstance) developmentModalInstance.show();
      else alert("Erro ao tentar acessar a página.");
    }
  } catch (error) {
    // Em caso de erro de rede no fetch (ex: CORS, DNS, servidor offline),
    // tenta navegar diretamente como um fallback.
    // Pode ser útil se a verificação de fetch falhar por motivos de rede
    // mas a navegação direta ainda puder ser resolvida pelo navegador.
    window.location.href = urlToNavigate;
  }
};

window.showDevelopmentModal = function () {
  if (
    !developmentModalInstance &&
    typeof bootstrap !== "undefined" &&
    bootstrap.Modal
  ) {
    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
  }

  if (developmentModalInstance) {
    developmentModalInstance.show();
  } else {
    alert("Este recurso está em desenvolvimento e estará disponível em breve.");
  }
};
