const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const controller = require("./monitoramento.controller");

router.get(
  "/logbox-device/:serialNumber",
  autenticar,
  verificarNivel(2),
  controller.renderizarPaginaDetalhe
);

router.get(
  "/relatorios-logbox",
  autenticar,
  verificarNivel(2),
  controller.renderizarPaginaRelatorios
);

router.get(
  "/api/logbox-device/:serialNumber/leituras",
  autenticar,
  verificarNivel(2),
  controller.obterLeituras
);
router.get(
  "/api/logbox-device/:serialNumber/status",
  autenticar,
  verificarNivel(2),
  controller.obterStatus
);
router.get(
  "/api/logbox-device/:serialNumber/latest",
  autenticar,
  verificarNivel(2),
  controller.obterUltimaLeitura
);
router.get(
  "/api/logbox-device/:serialNumber/stats-detail",
  autenticar,
  verificarNivel(2),
  controller.obterEstatisticas
);
router.get(
  "/api/logbox-device/:serialNumber/ventilation-history",
  autenticar,
  verificarNivel(2),
  controller.obterHistoricoVentilacao
);
router.get(
  "/api/logbox-device/:serialNumber/connection-history",
  autenticar,
  verificarNivel(2),
  controller.obterHistoricoConexao
);

router.post(
  "/api/relatorios/gerar",
  autenticar,
  verificarNivel(2),
  controller.gerarRelatorioVisual
);

router.post(
  "/api/relatorios/pdf",
  autenticar,
  verificarNivel(1),
  controller.gerarPdfRelatorio
);

module.exports = router;
