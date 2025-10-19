const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const controller = require("./diarias.controller");

router.get(
  "/api/funcionarios/:matricula/ultimos-processos",
  autenticar,
  verificarNivel(3),
  controller.listarUltimosProcessos
);

router.post(
  "/api/diarias",
  autenticar,
  verificarNivel(3),
  controller.adicionarDiaria
);

router.get(
  "/api/diarias",
  autenticar,
  verificarNivel(3),
  controller.listarDiarias
);

router.delete(
  "/api/diarias/:id",
  autenticar,
  verificarNivel(3),
  controller.removerDiaria
);

router.post(
  "/api/gerar_pdf_diarias",
  autenticar,
  verificarNivel(3),
  controller.gerarPdfDiarias
);

module.exports = router;
