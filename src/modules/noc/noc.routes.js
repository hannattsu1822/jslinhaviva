const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../auth");
const {
  NIVEL_ADMIN,
  ehCargoConstrucaoAcompanhamento,
} = require("../../shared/moduloNivel.permissions");
const controller = require("./noc.controller");

function redirecionarConstrucaoRestrito(req, res, next) {
  if ((req.user?.nivel ?? 0) < NIVEL_ADMIN && ehCargoConstrucaoAcompanhamento(req.user)) {
    return res.redirect("/acompanhamento_construcao");
  }
  next();
}

// Rota acessível para nível 1 (Visualização) ou superior
router.get(
  "/centro-operacoes",
  autenticar,
  verificarNivel(1),
  redirecionarConstrucaoRestrito,
  controller.renderizarPainelNOC
);

module.exports = router;
