document.addEventListener("DOMContentLoaded", () => {
  const avaliarSelect = document.getElementById("avaliarTipoSelect");
  const importarSelect = document.getElementById("importarTipoSelect");
  const btnAvaliacao = document.getElementById("btnIrAvaliacao");
  const btnImportacao = document.getElementById("btnIrImportacao");

  const avaliarRoutes = {
    avariados: "/avariados_pendentes",
    reformados: "/trafos_reformados_filtrar.html",
  };

  const importarRoutes = {
    avariados: "/upload_transformadores",
    reformados: "/trafos_reformados_importar.html",
  };

  function updateButtons() {
    if (btnAvaliacao) btnAvaliacao.disabled = !avaliarSelect?.value;
    if (btnImportacao) btnImportacao.disabled = !importarSelect?.value;
  }

  if (avaliarSelect) {
    avaliarSelect.addEventListener("change", updateButtons);
  }
  if (importarSelect) {
    importarSelect.addEventListener("change", updateButtons);
  }

  if (btnAvaliacao) {
    btnAvaliacao.addEventListener("click", () => {
      const route = avaliarRoutes[avaliarSelect?.value];
      if (route) window.location.href = route;
    });
  }

  if (btnImportacao) {
    btnImportacao.addEventListener("click", () => {
      const route = importarRoutes[importarSelect?.value];
      if (!route) return;
      window.location.href = route;
    });
  }

  updateButtons();
});
