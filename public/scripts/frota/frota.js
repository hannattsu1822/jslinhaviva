// public/scripts/frota/frota.js

let accessDeniedModalInstance;
let developmentModalInstance; // Para o caso de navigateTo usar
// A variável 'user' será pega pelo sidebar.js e populada na interface.
// Se esta página precisar do 'user' para alguma lógica específica, pegue do localStorage aqui.

document.addEventListener("DOMContentLoaded", function () {
  // Inicializa tooltips do Bootstrap (se houver algum nesta página)
  const tooltipTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="tooltip"]')
  );
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Inicializa modais padrão que navigateTo pode usar
  if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);

    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
  } else {
    console.warn(
      "Frota.js: Bootstrap JS não carregado ou bootstrap.Modal não está definido."
    );
  }
  console.log("Frota: Script específico da página carregado e DOM pronto.");
});

// Função navigateTo padronizada para os links da sidebar e cards
window.navigateTo = async function (pageNameOrUrl) {
  let urlToNavigate = pageNameOrUrl;
  if (!pageNameOrUrl.startsWith("/") && !pageNameOrUrl.startsWith("http")) {
    urlToNavigate = `/${pageNameOrUrl}`;
  }

  if (
    window.location.pathname === urlToNavigate &&
    !urlToNavigate.includes("?")
  ) {
    console.log(`Frota (navigateTo): Já está na página ${urlToNavigate}.`);
    return;
  }

  console.log(`Frota (navigateTo): Tentando navegar para: ${urlToNavigate}`);
  try {
    // Para navegação simples de menu, o fetch pode não ser sempre necessário
    // a menos que você queira verificar a existência da rota/permissão antes.
    // Se a rota não existir, o servidor já retornará um 404.
    // Se a rota for protegida, o middleware 'autenticar' do servidor redirecionará para /login.
    // A lógica de fetch abaixo é mais útil se a API da rota pode retornar 403 para permissão.
    const response = await fetch(urlToNavigate, {
      // Testando a rota
      method: "HEAD", // Usar HEAD pode ser mais leve se só queremos checar existência/permissão
    });

    if (response.ok || response.status === 401 || response.status === 403) {
      // 401/403 serão tratados pelo autenticar no servidor
      window.location.href = urlToNavigate;
    } else if (response.status === 404) {
      if (developmentModalInstance) developmentModalInstance.show();
      else alert("Página não encontrada ou em desenvolvimento.");
    } else {
      console.error(
        `Frota (navigateTo): Erro ${response.status} ao testar acesso a ${urlToNavigate}.`
      );
      if (developmentModalInstance) developmentModalInstance.show();
      else alert("Erro ao tentar acessar a página.");
    }
  } catch (error) {
    console.error("Frota (navigateTo): Erro de rede ou na requisição:", error);
    // Se o fetch falhar (rede offline), apenas tenta navegar diretamente.
    // O navegador mostrará seu próprio erro se não conseguir.
    // Ou, mostre um modal de erro de rede.
    window.location.href = urlToNavigate;
    // if (developmentModalInstance) developmentModalInstance.show();
    // else alert("Erro de rede ou falha na navegação.");
  }
};
