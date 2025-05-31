async function logout() {
  console.log("Logout Padrão (sidebar.js) - Iniciando processo de logout.");
  try {
    console.log(
      "Logout Padrão (sidebar.js) - Tentando chamar POST /api/logout no servidor..."
    );
    const response = await fetch("/api/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const result = await response.json();
      console.log(
        "Logout Padrão (sidebar.js) - Resposta do servidor para /api/logout:",
        result.message
      );
    } else {
      let errorMsg = `Status: ${response.status}`;
      try {
        const errorResult = await response.json();
        errorMsg += `, Mensagem: ${errorResult.message}`;
      } catch (e) {
        // No-op
      }
      console.warn(
        `Logout Padrão (sidebar.js) - Chamada para /api/logout no servidor falhou. ${errorMsg}`
      );
    }
  } catch (networkError) {
    console.error(
      "Logout Padrão (sidebar.js) - Erro de rede ao tentar chamar /api/logout:",
      networkError
    );
  } finally {
    console.log(
      "Logout Padrão (sidebar.js) - Limpando dados locais e redirecionando."
    );
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    console.log(
      "Logout Padrão (sidebar.js) - localStorage 'user' e 'token' removidos."
    );

    window.location.href = "/login";
    console.log(
      "Logout Padrão (sidebar.js) - Redirecionamento para '/login' iniciado."
    );
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
  console.log("Padrão (sidebar.js): DOMContentLoaded disparado.");

  // *** CORREÇÃO APLICADA AQUI ***
  // Adiciona o evento de clique ao botão de logout para chamar a função logout.
  const logoutButton = document.getElementById("logoutButton");
  if (logoutButton) {
    logoutButton.addEventListener("click", logout);
  }
  // *** FIM DA CORREÇÃO ***

  const user = JSON.parse(localStorage.getItem("user"));

  if (user) {
    console.log(
      "Padrão (sidebar.js): Usuário encontrado no localStorage:",
      user
    );
    const userNameElement = document.getElementById("user-name");
    const userMatriculaElement = document.getElementById("user-matricula");
    const userCargoElement = document.getElementById("user-cargo");

    if (userNameElement) {
      userNameElement.textContent = user.nome || "Usuário Desconhecido";
    }
    if (userMatriculaElement) {
      // O HTML já tem "Matrícula:", então só precisamos do valor.
      userMatriculaElement.textContent = user.matricula || "N/A";
    }
    if (userCargoElement) {
      // O HTML já tem "Cargo:", então só precisamos do valor.
      userCargoElement.textContent = user.cargo || "N/A";
    }

    updateDateTimeSidebar();
    setInterval(updateDateTimeSidebar, 1000);

    const auditoriaCard = document.getElementById("auditoria-card");
    const sidebarAuditoriaLink = document.getElementById(
      "sidebar-auditoria-link"
    );
    const cargosPermitidosAuditoria = ["Técnico", "Engenheiro", "ADMIN"];
    const temPermissaoAuditoria = cargosPermitidosAuditoria.includes(
      user.cargo
    );

    if (auditoriaCard) {
      auditoriaCard.style.display = temPermissaoAuditoria ? "block" : "none";
    }
    if (sidebarAuditoriaLink) {
      sidebarAuditoriaLink.style.display = temPermissaoAuditoria
        ? "list-item"
        : "none";
    }
  } else {
    console.warn(
      "Padrão (sidebar.js): Usuário não encontrado no localStorage ao carregar a página."
    );
    if (
      window.location.pathname !== "/login" &&
      window.location.pathname !== "/" &&
      window.location.pathname !== "/index.html"
    ) {
      console.log(
        "Padrão (sidebar.js): Usuário não logado. Redirecionamento para login DESATIVADO em sidebar.js nesta página."
      );
      // window.location.href = "/login";
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
  console.log(
    "Padrão (sidebar.js): Configuração do DOMContentLoaded finalizada."
  );
});

console.log("Padrão (sidebar.js): Arquivo completamente carregado e pronto.");
