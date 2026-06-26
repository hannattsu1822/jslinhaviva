document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".fibra-module-card[data-url]");

  cards.forEach((card) => {
    const url = card.dataset.url;
    if (!url) return;

    card.addEventListener("click", () => {
      window.location.href = url;
    });

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        window.location.href = url;
      }
    });
  });

  UiPermissoes.aguardarUsuario((user) => {
    if (!user) return;
    UiPermissoes.aplicarCardsPorId(user, {
      "card-fibra-registro": (u) =>
        FibraPermissions.podeRegistrarServicoFibra?.(u),
      "card-fibra-andamento": (u) =>
        FibraPermissions.podeAcessarModuloFibra?.(u),
      "card-fibra-concluidos": (u) =>
        FibraPermissions.podeAcessarModuloFibra?.(u),
      "card-fibra-coletar": (u) =>
        FibraPermissions.podeColetarPontosFibra?.(u),
      "card-fibra-visualizar-mapa": (u) =>
        FibraPermissions.podeVisualizarMapaFibra?.(u),
      "card-fibra-gerenciar-pontos": (u) =>
        FibraPermissions.podeGerenciarPontosFibra?.(u),
    });
  });
});
