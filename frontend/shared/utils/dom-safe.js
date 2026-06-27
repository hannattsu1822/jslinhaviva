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

  function rawHtml(value) {
    return { __html: String(value ?? "") };
  }

  function isRawHtml(value) {
    return (
      value != null &&
      typeof value === "object" &&
      Object.prototype.hasOwnProperty.call(value, "__html")
    );
  }

  function safeHtml(strings, ...values) {
    let result = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i];
      result += (isRawHtml(value) ? value.__html : escapeHtml(value));
      result += strings[i + 1] ?? "";
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
  window.rawHtml = rawHtml;
  window.safeHtml = safeHtml;
  window.setHtmlSafe = setHtmlSafe;
  window.clearElement = clearElement;
})();
