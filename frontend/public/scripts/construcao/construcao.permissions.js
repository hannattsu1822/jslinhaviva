(function (global) {
  const base = global.ModuloNivelPermissions;
  if (!base) return;

  global.ConstrucaoPermissions = {
    podeAcessarModuloConstrucao: (user) => {
      if (!user) return false;
      if ((user.nivel ?? 0) < base.NIVEL_ACESSO_MIN) return false;
      return (
        base.temControleTotal?.(user) ||
        base.ehCargoConstrucaoAcompanhamento?.(user)
      );
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
