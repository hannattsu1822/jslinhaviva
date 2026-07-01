function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeUser() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      await existingSubscription.unsubscribe();
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      if (permission === "denied") {
        alert(
          "As notificações estão bloqueadas. Para reativá-las, clique no cadeado na barra de endereços e mude a permissão de notificações para 'Permitir'."
        );
      }
      return;
    }

    const vapidPublicKey =
      "BOJqp3DYakKat9iZiLBpbXZkoHRep5ZJ6SoaVXmEMo5JK5rT4Ti4rPKYuF3zjii0qonZ0QIlTWJtAO5g6Gxb2xc";
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription }),
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Login] Falha ao inscrever notificações push:", error);
  }
}

const loginForm = document.getElementById("loginForm");
const matriculaInput = document.getElementById("matricula");
const senhaInput = document.getElementById("senha");
const messageEl = document.getElementById("login-message");
const loginButton = loginForm?.querySelector(".login-btn");
const loginButtonSpan = loginButton?.querySelector("span");
const originalButtonTextContent = loginButtonSpan?.textContent || "Acessar Sistema";
const togglePasswordBtn = document.getElementById("togglePassword");

const welcomeOverlayEl = document.getElementById("welcomeOverlay");
const welcomeCardAvatarEl = document.getElementById("welcomeCardAvatar");
const welcomeCardUserNameEl = document.getElementById("welcomeCardUserName");
const welcomeCardLastAccessEl = document.getElementById("welcomeCardLastAccess");
const closeWelcomeCardBtn = document.getElementById("closeWelcomeCard");

function getInitials(name) {
  if (!name) return "LV";
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDateTime(date) {
  return `${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function resetLoginForm() {
  if (matriculaInput) matriculaInput.value = "";
  if (senhaInput) {
    senhaInput.value = "";
    senhaInput.type = "password";
  }
  if (togglePasswordBtn) {
    togglePasswordBtn.innerHTML = '<i class="fas fa-eye"></i>';
    togglePasswordBtn.setAttribute("aria-label", "Mostrar senha");
  }
  hideMessage();
  if (loginButton && loginButtonSpan) {
    loginButton.disabled = false;
    loginButtonSpan.textContent = originalButtonTextContent;
  }
}

function showWelcomeCard(userData) {
  if (
    !welcomeOverlayEl ||
    !welcomeCardUserNameEl ||
    !welcomeCardLastAccessEl ||
    !welcomeCardAvatarEl
  ) {
    return;
  }

  const nome = userData.nome || "Usuário";
  welcomeCardUserNameEl.textContent = nome;
  welcomeCardAvatarEl.textContent = getInitials(nome);

  let lastAccessDisplay = "Primeiro acesso ao sistema";

  if (userData.ultimoAcesso) {
    lastAccessDisplay = formatDateTime(new Date(userData.ultimoAcesso));
  }

  welcomeCardLastAccessEl.textContent = lastAccessDisplay;

  welcomeOverlayEl.classList.add("show");
  welcomeOverlayEl.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function hideWelcomeCard() {
  welcomeOverlayEl?.classList.remove("show");
  welcomeOverlayEl?.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

async function performLogin() {
  const matricula = matriculaInput.value.trim();
  const senha = senhaInput.value.trim();

  if (!matricula || !senha) {
    showMessage("Matrícula e senha são obrigatórios.", "error");
    return;
  }

  hideMessage();
  loginButton.disabled = true;
  loginButtonSpan.textContent = "Acessando...";

  let responseOk = false;

  try {
    const response = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matricula, senha }),
    });
    const result = await response.json();

    if (response.ok) {
      responseOk = true;

      showWelcomeCard({
        nome: result.user?.nome || "Usuário",
        ultimoAcesso: result.user?.ultimoAcesso || null,
      });

      localStorage.setItem(
        "user",
        JSON.stringify({
          nome: result.user?.nome,
          matricula: result.user?.matricula,
          cargo: result.user?.cargo,
          nivel: result.user?.nivel,
        })
      );

      await subscribeUser();
      document.removeEventListener("keydown", handleEnterKey);

      setTimeout(() => {
        const cargo = String(result.user?.cargo || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toLowerCase();
        const nivel = result.user?.nivel ?? 0;

        if (cargo.includes("construcao") && nivel < 7) {
          window.location.href = "/acompanhamento_construcao";
          return;
        }

        if (
          (cargo.includes("transporte") || cargo.includes("direcao")) &&
          nivel < 2
        ) {
          window.location.href = "/frota_controle";
          return;
        }

        window.location.href = "/dashboard";
      }, 2750);
    } else {
      showMessage(result.message || "Credenciais inválidas. Verifique seus dados.", "error");
      senhaInput.value = "";
      senhaInput.focus();
    }
  } catch {
    showMessage("Erro de conexão ou falha inesperada. Tente novamente.", "error");
    senhaInput.value = "";
    senhaInput.focus();
  } finally {
    if (!responseOk) {
      loginButton.disabled = false;
      loginButtonSpan.textContent = originalButtonTextContent;
    } else if (loginButtonSpan.textContent === "Acessando...") {
      loginButtonSpan.textContent = "Redirecionando...";
    }
  }
}

function showMessage(message, type = "error") {
  messageEl.textContent = message;
  messageEl.className = `login-alert login-alert--${type} login-alert--visible`;
}

function hideMessage() {
  messageEl.className = "login-alert";
  messageEl.textContent = "";
}

function handleLoginAttempt() {
  if (!loginButton?.disabled) performLogin();
}

function handleEnterKey(event) {
  if (event.key === "Enter" || event.keyCode === 13) {
    event.preventDefault();
    handleLoginAttempt();
  }
}

function togglePasswordVisibility() {
  const isPassword = senhaInput.type === "password";
  senhaInput.type = isPassword ? "text" : "password";
  togglePasswordBtn.innerHTML = isPassword
    ? '<i class="fas fa-eye-slash"></i>'
    : '<i class="fas fa-eye"></i>';
  togglePasswordBtn.setAttribute("aria-label", isPassword ? "Ocultar senha" : "Mostrar senha");
}

window.handleLoginAttempt = handleLoginAttempt;

loginForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  handleLoginAttempt();
});

togglePasswordBtn?.addEventListener("click", togglePasswordVisibility);
closeWelcomeCardBtn?.addEventListener("click", hideWelcomeCard);
document.addEventListener("keydown", handleEnterKey);

window.addEventListener("pageshow", () => {
  resetLoginForm();
  document.removeEventListener("keydown", handleEnterKey);
  document.addEventListener("keydown", handleEnterKey);
});

resetLoginForm();
