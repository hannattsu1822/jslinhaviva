document.addEventListener("DOMContentLoaded", () => {
  function normalizarTexto(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  function usuarioTransporteRestrito(user) {
    const nivel = Number(user?.nivel || 0);
    if (nivel >= 2) return false;
    const cargo = normalizarTexto(user?.cargo || "");
    return cargo.includes("transporte") || cargo.includes("direcao");
  }

  function aplicarModoSomenteVisualizacao() {
    const btnVoltar = document.getElementById("btnVoltarFrota");
    if (btnVoltar) {
      // Evita link para /frota para perfil sem acesso a essa hub.
      btnVoltar.setAttribute("href", "/dashboard");
    }

    document.querySelectorAll(".card-text").forEach((el) => {
      const texto = normalizarTexto(el.textContent);
      if (texto.includes("cadastre") || texto.includes("gerencie")) {
        el.textContent = "Visualize as informacoes deste modulo.";
      }
    });
  }

  fetch("/api/me", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((user) => {
      if (usuarioTransporteRestrito(user)) {
        aplicarModoSomenteVisualizacao();
      }
    })
    .catch(() => {});
});
