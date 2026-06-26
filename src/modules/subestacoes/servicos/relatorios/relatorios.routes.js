const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../../auth");
const { NIVEL_ACESSO_MIN } = require("../../subestacoes.permissions");
const controller = require("./relatorios.controller");

router.get(
  "/api/servicos/:id/relatorio-pdf",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.gerarPdfRelatorio
);

module.exports = router;
