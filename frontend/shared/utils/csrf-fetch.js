(function patchFetchWithCsrf() {
  if (window.__csrfFetchPatched || typeof window.fetch !== "function") return;
  window.__csrfFetchPatched = true;

  let csrfToken = null;
  let csrfPromise = null;

  async function loadCsrfToken() {
    if (csrfToken) return csrfToken;
    if (csrfPromise) return csrfPromise;

    const csrfUrl =
      typeof window.apiUrl === "function"
        ? window.apiUrl("/api/csrf-token")
        : "/api/csrf-token";

    csrfPromise = fetch(csrfUrl, { credentials: "include" })
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
