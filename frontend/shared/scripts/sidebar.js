(function loadPwaScript() {
  if (window.__linhavivaPwaInit || document.querySelector('script[data-pwa="true"]')) return;
  const script = document.createElement("script");
  script.src = "/shared/scripts/pwa.js";
  script.defer = true;
  script.dataset.pwa = "true";
  document.head.appendChild(script);
})();

(function patchFetchWithCsrf() {
  if (window.__csrfFetchPatched || typeof window.fetch !== "function") return;
  window.__csrfFetchPatched = true;

  let csrfToken = null;
  let csrfPromise = null;

  async function loadCsrfToken() {
    if (csrfToken) return csrfToken;
    if (csrfPromise) return csrfPromise;

    csrfPromise = fetch("/api/csrf-token", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = await response.json();
        csrfToken = data.csrfToken || null;
        return csrfToken;
      })
      .catch(() => null)
      .finally(() => {
        csrfPromise = null;
      });

    return csrfPromise;
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function csrfAwareFetch(input, init = {}) {
    const options = { ...init };
    const method = (options.method || "GET").toUpperCase();

    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const token = await loadCsrfToken();
      if (token) {
        const headers = new Headers(options.headers || {});
        headers.set("X-CSRF-Token", token);
        options.headers = headers;
      }
    }

    return originalFetch(input, options);
  };

  window.refreshCsrfToken = async function refreshCsrfToken() {
    csrfToken = null;
    return loadCsrfToken();
  };

  loadCsrfToken();
})();

const NIVEL_ADMIN = 7;
const NIVEL_ACESSO_MIN = 2;

const SIDEBAR_PARTIAL_URL = "/shared/partials/sidebar.html";

const SIDEBAR_PERMISSIONS_BY_LEVEL = {
  "sidebar-subestacoes-link": NIVEL_ACESSO_MIN,
  "sidebar-transformadores-link": 5,
  "sidebar-frota-link": NIVEL_ACESSO_MIN,
  "sidebar-gestao-servicos-link": NIVEL_ACESSO_MIN,
  "sidebar-gestao-turmas-link": 3,
  "sidebar-fibra-optica-link": NIVEL_ACESSO_MIN,
  "sidebar-inspecoes-redes-link": NIVEL_ACESSO_MIN,
  "sidebar-avulsos-link": NIVEL_ACESSO_MIN,
  "sidebar-monitoramento-link": 5,
  "sidebar-gestao-link": 5,
  "sidebar-auditoria-link": 10,
};

const SIDEBAR_MODULE_ROUTES = {
  "/dashboard": ["/dashboard"],
  "/subestacoes-dashboard": [
    "/subestacoes-dashboard",
    "/subestacao",
    "/pagina-subestacoes-admin",
    "/pagina-servicos-subestacoes",
    "/pagina-servicos-concluidos",
    "/registrar-servico-subestacao",
    "/pagina-checklist-inspecao-subestacao",
    "/pagina-listagem-inspecoes-subestacoes",
    "/inspecoes-checklist-subestacoes",
    "/listagem-inspecoes",
    "/detalhes-inspecao-checklist",
  ],
  "/transformadores": [
    "/transformadores",
    "/filtrar_transformadores",
    "/formulario_transformadores",
    "/transformadores_reformados",
    "/trafos_reformados_filtrar",
    "/consultar_historicos",
    "/historico_checklist",
    "/trafos_reformados_importar",
    "/relatorio_formulario",
  ],
  "/frota": [
    "/frota",
    "/filtrar_veiculos",
    "/frota_veiculos_cadastro",
    "/frota_motoristas_cadastro",
    "/frota_estoque_cadastro",
    "/frota_controle",
    "/checklist_veiculos",
    "/agendar_checklist",
    "/editar_inspecao",
    "/relatorio_veiculos",
    "/registro_oleo",
    "/proxima_troca_oleo",
  ],
  "/gestao-servicos": [
    "/gestao-servicos",
    "/registro_servicos",
    "/servicos_ativos",
    "/servicos_concluidos",
    "/servicos_construcao",
    "/relatorios-servicos",
    "/relatorios_servicos",
    "/detalhes_servico",
    "/editar_servico",
    "/apr_formulario",
    "/acompanhamento_construcao",
  ],
  "/acompanhamento_construcao": [
    "/acompanhamento_construcao",
    "/servicos_construcao",
  ],
  "/gestao-turmas": [
    "/gestao-turmas",
    "/turmas_ativas",
    "/diarias",
    "/controle-status",
  ],
  "/fibra-optica": [
    "/fibra-optica",
    "/registro_projeto_fibra",
    "/projetos_fibra_andamento",
    "/projetos_fibra_concluidos",
    "/fibra/servico",
    "/mapa_fibra",
    "/visualizacao_mapa",
    "/gerenciar_pontos_fibra",
    "/editar_ponto_fibra",
  ],
  "/inspecoes-redes": [
    "/inspecoes-redes",
    "/inspecoes_redes_principal",
    "/inspecoes_redes",
    "/inspecoes.html",
  ],
  "/avulsos-dashboard": [
    "/avulsos-dashboard",
    "/autorizacao-horas-extras",
    "/bas-importar-dados-pagina",
    "/gerar-formulario-txt-bas",
    "/gerar-formulario-txt-bas-linhaviva",
  ],
  "/monitoramento-hub": ["/monitoramento-hub"],
  "/dashboard-gestor": [
    "/dashboard-gestor",
    "/pagina-gerenciamento-usuarios",
    "/pagina-gerenciamento-frota",
    "/pagina-relatorios-prv",
  ],
  "/auditoria": ["/auditoria"],
  "/prv": ["/prv"],
  "/checklist-diario": ["/checklist-diario", "/checklist_diario"],
  "/centro-operacoes": ["/centro-operacoes"],
};

async function logout() {
  try {
    let csrfToken = null;
    try {
      const csrfResponse = await fetch("/api/csrf-token", {
        credentials: "same-origin",
      });
      if (csrfResponse.ok) {
        const csrfData = await csrfResponse.json();
        csrfToken = csrfData.csrfToken;
      }
    } catch (csrfError) {
      console.warn("Logout - não foi possível obter token CSRF.", csrfError);
    }

    const response = await fetch("/api/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
    });

    if (!response.ok) {
      console.warn("Logout - chamada para /api/logout falhou.");
    }
  } catch (networkError) {
    console.error("Logout - erro de rede:", networkError);
  } finally {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "/login";
  }
}

async function loadSidebarPartial() {
  const root = document.getElementById("sidebar-root");
  if (!root) return false;

  const response = await fetch(SIDEBAR_PARTIAL_URL, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    console.error("Não foi possível carregar a sidebar reutilizável.");
    return false;
  }

  root.outerHTML = await response.text();
  return true;
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

function hideSidebarItem(id) {
  const element = document.getElementById(id);
  if (element) element.style.display = "none";
}

function showSidebarItem(id, display = "list-item") {
  const element = document.getElementById(id);
  if (element) element.style.display = display;
}

function hideDashboardNavItem() {
  const dashboardNavItem = document.querySelector(
    '.sidebar-nav .nav-list .nav-item a[href="/dashboard"]'
  );
  if (dashboardNavItem && dashboardNavItem.closest("li")) {
    dashboardNavItem.closest("li").style.display = "none";
  }
}

function applySidebarPermissions(user) {
  const userCargo = String(user.cargo || "")
    .trim()
    .toLowerCase();
  const userCargoNormalized = userCargo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const isMotorista = userCargo === "motorista";
  const isCOD = userCargo === "cod";
  const isConstrucaoAcompanhamento =
    userCargoNormalized.includes("construcao");
  const isTransporteDirecao =
    userCargoNormalized.includes("transporte") ||
    userCargoNormalized.includes("direcao");
  const isTransporteRestrito =
    isTransporteDirecao && (user.nivel ?? 0) < NIVEL_ACESSO_MIN;
  const isConstrucaoRestrito =
    isConstrucaoAcompanhamento && (user.nivel ?? 0) < NIVEL_ACESSO_MIN;

  const allManagedIds = [
    ...Object.keys(SIDEBAR_PERMISSIONS_BY_LEVEL),
    "sidebar-construcao-link",
    "sidebar-prv-link",
    "sidebar-checklist-link",
    "sidebar-noc-link",
  ];

  if (isCOD) {
    allManagedIds.forEach((id) => hideSidebarItem(id));
    showSidebarItem("sidebar-noc-link");
    hideDashboardNavItem();
    return;
  }

  if (isMotorista) {
    allManagedIds.forEach((id) => hideSidebarItem(id));
    showSidebarItem("sidebar-prv-link");
    showSidebarItem("sidebar-checklist-link");
    hideDashboardNavItem();
    return;
  }

  if (isTransporteRestrito) {
    allManagedIds.forEach((id) => hideSidebarItem(id));
    showSidebarItem("sidebar-frota-link");
    const frotaLink = document.querySelector(
      '.sidebar .nav-link[href="/frota"]'
    );
    if (frotaLink) frotaLink.setAttribute("href", "/frota_controle");
    hideDashboardNavItem();
    return;
  }

  if (isConstrucaoRestrito) {
    allManagedIds.forEach((id) => hideSidebarItem(id));
    showSidebarItem("sidebar-construcao-link");
    const construcaoLink = document.querySelector(
      '.sidebar .nav-link[href="/acompanhamento_construcao"]'
    );
    if (construcaoLink)
      construcaoLink.setAttribute("href", "/acompanhamento_construcao");
    hideDashboardNavItem();
    return;
  }

  for (const [linkId, requiredLevel] of Object.entries(
    SIDEBAR_PERMISSIONS_BY_LEVEL
  )) {
    if (user.nivel >= requiredLevel) {
      showSidebarItem(linkId);
    }
  }

  if (isTransporteDirecao) {
    showSidebarItem("sidebar-frota-link");
  }

  const sidebarConstrucaoLink = document.getElementById(
    "sidebar-construcao-link"
  );
  if (
    sidebarConstrucaoLink &&
    ((user.nivel ?? 0) >= NIVEL_ADMIN || isConstrucaoAcompanhamento)
  ) {
    showSidebarItem("sidebar-construcao-link");
  }
}

function setActiveSidebarLink() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll(".sidebar .nav-link");

  let activeLinkFound = false;

  navLinks.forEach((link) => {
    link.classList.remove("active");
    const linkPath = link.getAttribute("href");
    if (linkPath === currentPath) {
      link.classList.add("active");
      activeLinkFound = true;
    }
  });

  if (activeLinkFound) return;

  for (const [mainLinkHref, pagesInModule] of Object.entries(
    SIDEBAR_MODULE_ROUTES
  )) {
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

function initSidebarInteractions() {
  const sidebarElement = document.querySelector(".sidebar");
  const sidebarToggleButton = document.querySelector(".sidebar-toggle-button");
  const mainContentOverlayElement = document.querySelector(
    ".main-content-overlay"
  );
  const logoutButton = document.getElementById("sidebar-logout-btn");

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

  if (logoutButton) {
    logoutButton.addEventListener("click", logout);
  }
}

function getUserInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function populateUserInfo(user) {
  const userNameElement = document.getElementById("user-name");
  const userAvatarElement = document.getElementById("sidebar-user-avatar");
  const userMatriculaElement = document.getElementById("user-matricula");
  const userCargoElement = document.getElementById("user-cargo");

  const displayName = user.nome || "Usuário Desconhecido";

  if (userNameElement) {
    userNameElement.textContent = displayName;
  }
  if (userAvatarElement) {
    userAvatarElement.textContent = getUserInitials(displayName);
  }
  if (userMatriculaElement) {
    const matricula = user.matricula || "N/A";
    userMatriculaElement.textContent = String(matricula).startsWith("Matrícula:")
      ? matricula
      : `Matrícula: ${matricula}`;
  }
  if (userCargoElement) {
    const cargo = user.cargo || "N/A";
    userCargoElement.textContent = String(cargo).startsWith("Cargo:")
      ? cargo
      : `Cargo: ${cargo}`;
  }
}

function initSidebar(user) {
  if (!user) {
    if (
      window.location.pathname !== "/login" &&
      window.location.pathname !== "/"
    ) {
      window.location.href = "/login";
    }
    return;
  }

  populateUserInfo(user);
  applySidebarPermissions(user);
  setActiveSidebarLink();
  updateDateTimeSidebar();
  setInterval(updateDateTimeSidebar, 1000);
  initSidebarInteractions();
}

async function resolveSidebarUser() {
  if (window.__INITIAL_USER__) {
    return window.__INITIAL_USER__;
  }

  try {
    const cached = JSON.parse(localStorage.getItem("user"));
    if (cached) return cached;
  } catch {
    /* ignora cache inválido */
  }

  try {
    const response = await fetch("/api/me", { credentials: "same-origin" });
    if (response.ok) {
      const user = await response.json();
      localStorage.setItem("user", JSON.stringify(user));
      return user;
    }
  } catch {
    /* ignora falha de rede */
  }

  return null;
}

document.addEventListener("DOMContentLoaded", async function () {
  await loadSidebarPartial();
  const user = await resolveSidebarUser();
  initSidebar(user);
  document.dispatchEvent(
    new CustomEvent("sidebar:ready", { detail: { user } })
  );
});
