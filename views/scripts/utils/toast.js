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

/**
 * Exibe uma notificação toast na tela.
 * @param {string} message A mensagem a ser exibida.
 * @param {string} [type='success'] O tipo de toast ('success' ou 'error').
 * @param {number} [duration=4000]
 */
function showToast(message, type = "success", duration = 4000) {
  const container = document.getElementById("toast-container");
  if (!container) {
    console.error("Elemento #toast-container não encontrado no DOM.");
    alert(`${type.toUpperCase()}: ${message}`);
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast align-items-center text-white border-0 ${
    type === "success" ? "bg-success" : "bg-danger"
  }`;
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "assertive");
  toast.setAttribute("aria-atomic", "true");

  const iconName = type === "success" ? "fa-check-circle" : "fa-circle-xmark";

  const toastBody = document.createElement("div");
  toastBody.className = "d-flex";
  toastBody.innerHTML = `
    <div class="toast-body">
      <i class="fa-solid ${iconName} me-2"></i>
      ${message}
    </div>
    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
  `;

  toast.appendChild(toastBody);
  container.appendChild(toast);

  const toastInstance = new bootstrap.Toast(toast, {
    delay: duration,
    autohide: true,
  });

  toast.addEventListener("hidden.bs.toast", () => {
    toast.remove();
  });

  toastInstance.show();
}

const toastContainerStyle = document.createElement("style");
toastContainerStyle.innerHTML = `
    #toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
    }
`;
document.head.appendChild(toastContainerStyle);
