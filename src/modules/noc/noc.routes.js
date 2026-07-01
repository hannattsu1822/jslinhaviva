const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel, verificarNivelOuCargo } = require("../../auth");
const {
  redirecionarConstrucaoRestrito,
  redirecionarTransporteRestrito,
} = require("../../shared/perfilCargo.helper");
const controller = require("./noc.controller");

router.get(
  "/centro-operacoes",
  autenticar,
  verificarNivelOuCargo(1, ["cod"]),
  redirecionarConstrucaoRestrito,
  redirecionarTransporteRestrito,
  controller.renderizarPainelNOC
);

module.exports = router;
