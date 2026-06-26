(function initUiActions() {
  if (window.__uiActionsInitialized) return;
  window.__uiActionsInitialized = true;

  function callGlobalAction(action, el, event) {
    const fn = window[action];
    if (typeof fn !== "function") return false;

    if (el.dataset.id !== undefined && el.dataset.target !== undefined) {
      fn(el.dataset.id, el.dataset.target, el, event);
      return true;
    }

    if (el.dataset.id !== undefined) {
      const raw = el.dataset.id;
      const asNumber = Number(raw);
      fn(
        Number.isFinite(asNumber) && String(asNumber) === raw ? asNumber : raw,
        el,
        event
      );
      return true;
    }

    if (el.dataset.target !== undefined) {
      fn(el.dataset.target, el, event);
      return true;
    }

    if (el.dataset.bool !== undefined) {
      fn(el.dataset.bool === "true", el, event);
      return true;
    }

    fn(el, event);
    return true;
  }

  document.addEventListener("click", (event) => {
    const el = event.target.closest("[data-action]");
    if (!el) return;

    const action = el.dataset.action;
    if (!action) return;

    if (el.tagName === "A" || el.dataset.preventDefault === "true") {
      event.preventDefault();
    }

    if (el.dataset.stopPropagation === "true") {
      event.stopPropagation();
    }

    if (action === "navigate") {
      event.preventDefault();
      const href = el.dataset.href || el.dataset.target || el.getAttribute("href");
      if (href) window.location.href = href;
      return;
    }

    if (action === "back") {
      event.preventDefault();
      window.history.back();
      return;
    }

    if (action === "reload") {
      event.preventDefault();
      window.location.reload();
      return;
    }

    if (action === "print") {
      event.preventDefault();
      window.print();
      return;
    }

    if (action === "open-file") {
      event.preventDefault();
      const inputId = el.dataset.input;
      if (inputId) document.getElementById(inputId)?.click();
      return;
    }

    if (action === "dismiss-parent") {
      event.preventDefault();
      el.parentElement?.remove();
      return;
    }

    if (action === "open-url") {
      event.preventDefault();
      const url = el.dataset.url;
      const target = el.dataset.window || "_blank";
      if (url) window.open(url, target);
      return;
    }

    if (action === "navigate-referrer") {
      event.preventDefault();
      const fallback = el.dataset.fallback || "/";
      const href =
        document.referrer && document.referrer !== window.location.href
          ? document.referrer
          : fallback;
      window.location.href = href;
      return;
    }

    if (action === "paginate") {
      event.preventDefault();
      const page = Number(el.dataset.page);
      const handler = window[el.dataset.handler || "goToPage"];
      if (typeof handler === "function" && Number.isFinite(page)) {
        handler(page, el, event);
      }
      return;
    }

    callGlobalAction(action, el, event);
  });
})();
