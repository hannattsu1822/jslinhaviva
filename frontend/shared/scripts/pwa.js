(function initLinhaVivaPwa() {
  if (window.__linhavivaPwaInit) return;
  window.__linhavivaPwaInit = true;

  const THEME_COLOR = "#0b1220";
  const ICON_192 = "/static/icons/icon-192.png";

  function ensureMeta(name, content) {
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.name = name;
      document.head.appendChild(el);
    }
    el.content = content;
  }

  function ensureLink(rel, href, extra = {}) {
    let el = document.querySelector(`link[rel="${rel}"][href="${href}"]`);
    if (!el) {
      el = document.createElement("link");
      el.rel = rel;
      el.href = href;
      Object.assign(el, extra);
      document.head.appendChild(el);
    }
  }

  function injectPwaHeadTags() {
    ensureLink("manifest", "/manifest.json");
    ensureLink("icon", ICON_192, { type: "image/png", sizes: "192x192" });
    ensureLink("apple-touch-icon", ICON_192);
    ensureMeta("theme-color", THEME_COLOR);
    ensureMeta("mobile-web-app-capable", "yes");
    ensureMeta("apple-mobile-web-app-capable", "yes");
    ensureMeta("apple-mobile-web-app-title", "Linha Viva");
    ensureMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return null;
    try {
      return await navigator.serviceWorker.register("/sw.js");
    } catch (error) {
      console.warn("[PWA] Falha ao registrar service worker:", error);
      return null;
    }
  }

  injectPwaHeadTags();
  registerServiceWorker();
})();
