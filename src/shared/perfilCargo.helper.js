const {
  NIVEL_ADMIN,
  ehCargoConstrucaoAcompanhamento,
  ehCargoTransporteDirecao,
  ehCargoCOD,
} = require("./moduloNivel.permissions");

function usuarioConstrucaoRestrito(user) {
  return (user?.nivel ?? 0) < NIVEL_ADMIN && ehCargoConstrucaoAcompanhamento(user);
}

function usuarioTransporteRestrito(user) {
  return (user?.nivel ?? 0) < NIVEL_ADMIN && ehCargoTransporteDirecao(user);
}

function usuarioCodRestrito(user) {
  return ehCargoCOD(user);
}

function redirecionarConstrucaoRestrito(req, res, next) {
  if (usuarioConstrucaoRestrito(req.user)) {
    return res.redirect("/acompanhamento_construcao");
  }
  next();
}

function redirecionarTransporteRestrito(req, res, next) {
  if (usuarioTransporteRestrito(req.user)) {
    return res.redirect("/frota_controle");
  }
  next();
}

function redirecionarCodRestrito(req, res, next) {
  if (usuarioCodRestrito(req.user)) {
    return res.redirect("/centro-operacoes");
  }
  next();
}

function bloquearConstrucaoRestritoApi(req, res, next) {
  if (usuarioConstrucaoRestrito(req.user)) {
    return res.status(403).json({
      message:
        "Perfil de Construção: acesso permitido apenas ao acompanhamento de construção e avulsos.",
    });
  }
  next();
}

function bloquearTransporteRestritoApi(req, res, next) {
  if (usuarioTransporteRestrito(req.user)) {
    return res.status(403).json({
      message:
        "Perfil de Transporte: acesso permitido apenas ao controle de frota.",
    });
  }
  next();
}

function bloquearCodRestritoApi(req, res, next) {
  if (usuarioCodRestrito(req.user)) {
    return res.status(403).json({
      message:
        "Perfil COD: acesso permitido apenas ao monitoramento e centro de operações.",
    });
  }
  next();
}

module.exports = {
  ehCargoCOD,
  usuarioConstrucaoRestrito,
  usuarioTransporteRestrito,
  usuarioCodRestrito,
  redirecionarConstrucaoRestrito,
  redirecionarTransporteRestrito,
  redirecionarCodRestrito,
  bloquearConstrucaoRestritoApi,
  bloquearTransporteRestritoApi,
  bloquearCodRestritoApi,
};
