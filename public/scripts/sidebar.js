async function logout() {
  console.log("Logout Padrão (sidebar.js) - Iniciando processo de logout.");
  try {
    const response = await fetch("/api/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(
        `Logout Padrão (sidebar.js) - Chamada para /api/logout no servidor falhou.`
      );
    }
  } catch (networkError) {
    console.error(
      "Logout Padrão (sidebar.js) - Erro de rede ao tentar chamar /api/logout:",
      networkError
    );
  } finally {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "/login";
  }
}

function updateDateTimeSidebar() {
  const now = new Date();
  const dateElement = document.getElementById("current-date");
  const timeElement = document.getElementById("current-time");

  if (dateElement) {
    dateElement.textContent = now.toLocaleDateString("pt-BR");
  }
  if (timeElement) {
    timeElement.textContent = now.toLocaleTimeString("pt-BR");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const user = JSON.parse(localStorage.getItem("user"));

  if (user) {
    const userNameElement = document.getElementById("user-name");
    const userMatriculaElement = document.getElementById("user-matricula");
    const userCargoElement = document.getElementById("user-cargo");

    if (userNameElement)
      userNameElement.textContent = user.nome || "Usuário Desconhecido";
    if (userMatriculaElement)
      userMatriculaElement.textContent = user.matricula || "N/A";
    if (userCargoElement) userCargoElement.textContent = user.cargo || "N/A";

    updateDateTimeSidebar();
    setInterval(updateDateTimeSidebar, 1000);

    // Mapeamento centralizado das permissões dos links da sidebar
    const sidebarPermissions = {
      "sidebar-subestacoes-link": 3,
      "sidebar-transformadores-link": 5,
      "sidebar-frota-link": 2, // ATUALIZADO
      "sidebar-gestao-servicos-link": 2, // ATUALIZADO
      "sidebar-gestao-turmas-link": 3,
      "sidebar-fibra-optica-link": 3,
      "sidebar-inspecoes-redes-link": 3,
      "sidebar-avulsos-link": 2,
      "sidebar-monitoramento-link": 5,
      "sidebar-gestao-link": 5,
      "sidebar-auditoria-link": 10,
    };

    // Itera sobre as permissões baseadas em NÍVEL
    for (const linkId in sidebarPermissions) {
      const requiredLevel = sidebarPermissions[linkId];
      const linkElement = document.getElementById(linkId);
      if (linkElement && user.nivel >= requiredLevel) {
        linkElement.style.display = "list-item";
      }
    }

    // Lógica específica para permissões baseadas em CARGO (se houver)
    const sidebarConstrucaoLink = document.getElementById(
      "sidebar-construcao-link"
    );
    if (sidebarConstrucaoLink) {
      const cargosPermitidos = ["Construção", "Engenheiro", "ADMIN", "ADM"];
      if (cargosPermitidos.includes(user.cargo)) {
        sidebarConstrucaoLink.style.display = "list-item";
      }
    }
  } else {
    if (
      window.location.pathname !== "/login" &&
      window.location.pathname !== "/"
    ) {
      window.location.href = "/login";
    }
  }

  const sidebarElement = document.querySelector(".sidebar");
  const sidebarToggleButton = document.querySelector(".sidebar-toggle-button");
  const mainContentOverlayElement = document.querySelector(
    ".main-content-overlay"
  );

  if (sidebarToggleButton && sidebarElement) {
    sidebarToggleButton.addEventListener("click", function () {
      sidebarElement.classList.toggle("active");
      if (mainContentOverlayElement) {
        mainContentOverlayElement.classList.toggle("active");
      }
    });
  }

  if (mainContentOverlayElement && sidebarElement) {
    mainContentOverlayElement.addEventListener("click", function () {
      sidebarElement.classList.remove("active");
      mainContentOverlayElement.classList.remove("active");
    });
  }
});
