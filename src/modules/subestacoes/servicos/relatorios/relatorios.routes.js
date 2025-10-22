// src/modules/subestacoes/servicos/relatorios/relatorios.routes.js

const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../../auth");
const controller = require("./relatorios.controller");

// Rota para gerar o PDF de um relatório de serviço
router.get(
  "/api/servicos/:id/relatorio-pdf",
  autenticar,
  verificarNivel(3),
  controller.gerarPdfRelatorio
);

module.exports = router;
