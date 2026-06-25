(function loadUnifiedSidebar() {
  if (document.querySelector('script[data-unified-sidebar="true"]')) return;
  const script = document.createElement("script");
  script.src = "/shared/scripts/sidebar.js";
  script.dataset.unifiedSidebar = "true";
  document.head.appendChild(script);
})();
