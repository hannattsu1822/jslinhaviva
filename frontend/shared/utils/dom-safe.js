(function initDomSafe() {
  if (window.__domSafeInitialized) return;
  window.__domSafeInitialized = true;

  function escapeHtml(value) {
    if (value == null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeHtml(strings, ...values) {
    let result = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) {
      result += escapeHtml(values[i]) + (strings[i + 1] ?? "");
    }
    return result;
  }

  function setHtmlSafe(element, strings, ...values) {
    if (!element) return;
    element.innerHTML = safeHtml(strings, ...values);
  }

  function clearElement(element) {
    if (!element) return;
    element.replaceChildren();
  }

  window.escapeHtml = escapeHtml;
  window.safeHtml = safeHtml;
  window.setHtmlSafe = setHtmlSafe;
  window.clearElement = clearElement;
})();
