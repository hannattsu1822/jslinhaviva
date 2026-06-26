(function (global) {
  const P = () => global.ModuloNivelPermissions || {};

  async function obterUsuarioAtual() {
    try {
      const response = await fetch("/api/me", { credentials: "same-origin" });
      if (response.ok) {
        const user = await response.json();
        localStorage.setItem("user", JSON.stringify(user));
        return user;
      }
    } catch {
      /* ignora falha de rede */
    }

    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }

  function isAdmin(user) {
    return Boolean(P().temControleTotal?.(user));
  }

  function podeAcessarModulo(user) {
    return Boolean(P().podeAcessarModulo?.(user));
  }

  function aplicarCardsPorId(user, regras) {
    for (const [id, check] of Object.entries(regras)) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.style.display = check(user) ? "" : "none";
    }
  }

  function ocultarElementos(seletores) {
    seletores.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        el.style.display = "none";
      });
    });
  }

  function redirecionarSeNaoAdmin(user, destino) {
    if (isAdmin(user)) return true;
    window.location.replace(destino);
    return false;
  }

  function aguardarUsuario(callback) {
    document.addEventListener("sidebar:ready", (event) => {
      callback(event.detail?.user || null);
    });

    obterUsuarioAtual().then((user) => {
      if (user) callback(user);
    });
  }

  global.UiPermissoes = {
    P,
    obterUsuarioAtual,
    isAdmin,
    podeAcessarModulo,
    aplicarCardsPorId,
    ocultarElementos,
    redirecionarSeNaoAdmin,
    aguardarUsuario,
  };
})(typeof window !== "undefined" ? window : globalThis);
