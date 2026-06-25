(function initApiClient() {
  if (window.__apiClientInitialized) return;
  window.__apiClientInitialized = true;

  const API_BASE = (window.__API_BASE_URL__ || "").replace(/\/$/, "");

  function apiUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${API_BASE}${normalized}`;
  }

  async function parseJsonResponse(response) {
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        (data && (data.message || data.error)) ||
        `Erro HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  window.apiUrl = apiUrl;

  window.apiFetch = function apiFetch(path, init = {}) {
    return fetch(apiUrl(path), {
      credentials: "include",
      ...init,
    });
  };

  window.apiJson = async function apiJson(path, init = {}) {
    const response = await apiFetch(path, init);
    return parseJsonResponse(response);
  };

  window.apiGet = (path) => apiJson(path);

  window.apiPost = (path, body, init = {}) =>
    apiJson(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
      body: JSON.stringify(body),
      ...init,
    });

  window.apiPut = (path, body, init = {}) =>
    apiJson(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
      body: JSON.stringify(body),
      ...init,
    });

  window.apiDelete = (path, init = {}) =>
    apiJson(path, { method: "DELETE", ...init });
})();
