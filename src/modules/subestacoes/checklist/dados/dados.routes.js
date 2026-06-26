const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../../auth");
const { NIVEL_ACESSO_MIN } = require("../../subestacoes.permissions");
const controller = require("./dados.controller");

router.post(
  "/api/inspecoes/detalhes-para-servico",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.obterDetalhesParaServico
);

module.exports = router;
