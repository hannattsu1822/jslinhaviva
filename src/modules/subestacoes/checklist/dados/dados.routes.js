const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../../auth");
const controller = require("./dados.controller");

router.post(
  "/api/inspecoes/detalhes-para-servico",
  autenticar,
  verificarNivel(3),
  controller.obterDetalhesParaServico
);

module.exports = router;
