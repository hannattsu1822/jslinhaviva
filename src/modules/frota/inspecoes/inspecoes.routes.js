const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const controller = require("./inspecoes.controller");

router.get(
  "/api/inspecoes",
  autenticar,
  verificarNivel(2),
  controller.listarInspecoes
);

router.get(
  "/api/inspecoes/:id",
  autenticar,
  verificarNivel(2),
  controller.obterInspecaoPorId
);

router.post(
  "/api/salvar_inspecao",
  autenticar,
  verificarNivel(3),
  controller.salvarInspecao
);

router.post(
  "/api/filtrar_inspecoes",
  autenticar,
  verificarNivel(4),
  controller.filtrarInspecoes
);

router.delete(
  "/api/excluir_inspecao/:id",
  autenticar,
  verificarNivel(4),
  controller.excluirInspecao
);

router.get(
  "/api/editar_inspecao/:id",
  autenticar,
  verificarNivel(4),
  controller.obterInspecaoPorId
);

router.post(
  "/api/editar_inspecao/:id",
  autenticar,
  verificarNivel(4),
  controller.atualizarInspecao
);

router.get(
  "/api/ultimo_horimetro",
  autenticar,
  verificarNivel(3),
  controller.obterUltimoHorimetro
);

router.get("/api/gerar_pdf_veiculos/:id", controller.gerarPdfInspecao);

router.get("/api/inspecoes_publico/:id", controller.obterInspecaoPublica);

module.exports = router;
