document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.querySelector(".sidebar");
  const toggleButton = document.querySelector(".sidebar-toggle-button");
  const overlay = document.querySelector(".sidebar-overlay");
  const logoutButton = document.getElementById("sidebar-logout-btn");
  const logoutForm = document.getElementById("logout-form");

  const toggleSidebar = () => {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("open");
  };

  if (toggleButton && sidebar && overlay) {
    toggleButton.addEventListener("click", toggleSidebar);
    overlay.addEventListener("click", toggleSidebar);
  }

  if (logoutButton && logoutForm) {
    logoutButton.addEventListener("click", (event) => {
      event.preventDefault();
      if (confirm("Tem certeza que deseja sair do sistema?")) {
        logoutForm.submit();
      }
    });
  }

  function setActiveLink() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll(".sidebar .nav-link");
    const pageModuleMap = {
      "/dashboard-gestor": [
        "/dashboard-gestor",
        "/pagina-gerenciamento-usuarios",
      ],
      "/subestacoes-dashboard": [
        "/subestacoes-dashboard",
        "/pagina-subestacoes-admin",
        "/pagina-servicos-subestacoes",
        "/pagina-servicos-concluidos",
        "/registrar-servico-subestacao",
        "/pagina-checklist-inspecao-subestacao",
        "/pagina-listagem-inspecoes-subestacoes",
      ],
      // ESTA É A LINHA CORRIGIDA
      "/fibra-optica": [
        "/fibra-optica",
        "/registro_projeto_fibra",
        "/projetos_fibra_andamento",
        "/projetos_fibra_concluidos",
        "/fibra/servico",
        "/mapa_fibra",
      ],
    };

    let activeLinkFound = false;
    navLinks.forEach((link) => {
      link.classList.remove("active");
      const linkPath = link.getAttribute("href");
      if (linkPath === currentPath) {
        link.classList.add("active");
        activeLinkFound = true;
      }
    });

    if (!activeLinkFound) {
      for (const mainLinkHref in pageModuleMap) {
        const pagesInModule = pageModuleMap[mainLinkHref];
        if (pagesInModule.some((page) => currentPath.startsWith(page))) {
          const mainLinkElement = document.querySelector(
            `.sidebar .nav-link[href="${mainLinkHref}"]`
          );
          if (mainLinkElement) {
            mainLinkElement.classList.add("active");
          }
          break;
        }
      }
    }
  }

  function updateDateTime() {
    const dateEl = document.getElementById("sidebar-date");
    const timeEl = document.getElementById("sidebar-time");
    if (!dateEl || !timeEl) return;

    const now = new Date();
    dateEl.textContent = now.toLocaleDateString("pt-BR");
    timeEl.textContent = now.toLocaleTimeString("pt-BR");
  }

  setActiveLink();
  updateDateTime();
  setInterval(updateDateTime, 1000);
});
