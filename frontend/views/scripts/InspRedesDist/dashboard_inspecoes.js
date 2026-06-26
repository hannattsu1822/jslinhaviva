document.addEventListener("DOMContentLoaded", function () {
  UiPermissoes.aguardarUsuario((user) => {
    if (!user) return;
    UiPermissoes.aplicarCardsPorId(user, {
      "card-register-inspection": (u) =>
        RedePermissions.podeRegistrarInspecao?.(u),
      "card-consult-inspections": (u) =>
        RedePermissions.podeAcessarModuloRede?.(u),
      "card-completed-inspections": (u) =>
        RedePermissions.podeAcessarModuloRede?.(u),
      "card-infra-codes": (u) => RedePermissions.podeGerenciarCodigos?.(u),
    });
  });
});
