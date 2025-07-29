document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.querySelector(".sidebar");
  const toggleButton = document.querySelector(".sidebar-toggle-button");
  const overlay = document.querySelector(".sidebar-overlay");

  const openSidebar = () => {
    sidebar.classList.add("open");
    overlay.classList.add("open");
  };

  const closeSidebar = () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("open");
  };

  if (toggleButton) {
    toggleButton.addEventListener("click", openSidebar);
  }

  if (overlay) {
    overlay.addEventListener("click", closeSidebar);
  }

  const logoutButton = document.getElementById("sidebar-logout-btn");

  const confirmationModal = document.getElementById("confirmation-modal");
  const toastContainer = document.getElementById("toast-container");
  let confirmCallback = null;

  const showConfirmation = (title, message, onConfirm) => {
    if (!confirmationModal) {
      if (confirm(message)) {
        onConfirm();
      }
      return;
    }

    const confirmationTitle = confirmationModal.querySelector(
      "#confirmation-title"
    );
    const confirmationMessage = confirmationModal.querySelector(
      "#confirmation-message"
    );

    if (confirmationTitle) confirmationTitle.textContent = title;
    if (confirmationMessage) confirmationMessage.textContent = message;

    confirmCallback = onConfirm;
    confirmationModal.classList.remove("hidden");
  };

  if (confirmationModal) {
    const confirmationCancelBtn = confirmationModal.querySelector(
      "#confirmation-cancel-btn"
    );
    const confirmationConfirmBtn = confirmationModal.querySelector(
      "#confirmation-confirm-btn"
    );

    const hideConfirmation = () => {
      confirmationModal.classList.add("hidden");
      confirmCallback = null;
    };

    if (confirmationConfirmBtn) {
      confirmationConfirmBtn.addEventListener("click", () => {
        if (typeof confirmCallback === "function") {
          confirmCallback();
        }
        hideConfirmation();
      });
    }
    if (confirmationCancelBtn) {
      confirmationCancelBtn.addEventListener("click", hideConfirmation);
    }
  }

  const showToast = (message, type = "success") => {
    if (!toastContainer) {
      alert(message);
      return;
    }
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const icon = type === "success" ? "check_circle" : "error";
    toast.innerHTML = `<span class="material-symbols-outlined toast-icon">${icon}</span> <p>${message}</p>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
      toast.classList.remove("show");
      toast.addEventListener("transitionend", () => toast.remove());
    }, 4000);
  };

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      showConfirmation(
        "Confirmar Logout",
        "Tem certeza que deseja sair do sistema?",
        async () => {
          try {
            const response = await fetch("/api/logout", { method: "POST" });
            if (response.ok) {
              showToast("Logout realizado com sucesso!", "success");
              setTimeout(() => {
                window.location.href = "/login";
              }, 1000);
            } else {
              throw new Error("Falha ao fazer logout.");
            }
          } catch (error) {
            console.error("Erro no logout:", error);
            showToast("Erro de conexão ao tentar sair.", "error");
          }
        }
      );
    });
  }

  async function fetchUserData() {
    try {
      const response = await fetch("/api/me");
      if (!response.ok) {
        window.location.href = "/login";
        return;
      }
      const user = await response.json();

      const userNameEl = document.getElementById("sidebar-user-name");
      const userRoleEl = document.getElementById("sidebar-user-cargo");
      if (userNameEl) userNameEl.textContent = user.nome || "Usuário";
      if (userRoleEl)
        userRoleEl.textContent = user.cargo || "Cargo não definido";

      const userLevel = user.nivel || 0;
      const auditoriaLink = document.getElementById("sidebar-auditoria-link");
      const gestaoLink = document.getElementById("sidebar-gestao-link");

      if (auditoriaLink && userLevel >= 10) {
        auditoriaLink.style.display = "block";
      }
      if (gestaoLink && userLevel >= 4) {
        gestaoLink.style.display = "block";
      }
    } catch (error) {
      console.error(error);
      window.location.href = "/login";
    }
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
    };

    let activeLinkFound = false;

    navLinks.forEach((link) => {
      link.classList.remove("active");
      if (link.getAttribute("href") === currentPath) {
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
    const dateOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
    const timeOptions = {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    };

    dateEl.textContent = now.toLocaleDateString("pt-BR", dateOptions);
    timeEl.textContent = now.toLocaleTimeString("pt-BR", timeOptions);
  }

  fetchUserData();
  setActiveLink();
  updateDateTime();
  setInterval(updateDateTime, 1000);
});
