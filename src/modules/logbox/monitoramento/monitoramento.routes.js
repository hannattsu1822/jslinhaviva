const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const controller = require("./monitoramento.controller");

router.get(
  "/logbox-device/:serialNumber",
  autenticar,
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
  controller.obterLeituras
);
router.get(
  "/api/logbox-device/:serialNumber/status",
  autenticar,
  controller.obterStatus
);
router.get(
  "/api/logbox-device/:serialNumber/latest",
  autenticar,
  controller.obterUltimaLeitura
);
router.get(
  "/api/logbox-device/:serialNumber/stats-detail",
  autenticar,
  controller.obterEstatisticas
);
router.get(
  "/api/logbox-device/:serialNumber/ventilation-history",
  autenticar,
  controller.obterHistoricoVentilacao
);
router.get(
  "/api/logbox-device/:serialNumber/connection-history",
  autenticar,
  controller.obterHistoricoConexao
);

router.post(
  "/api/relatorios/gerar",
  autenticar,
  controller.gerarRelatorioVisual
);

router.post(
  "/api/relatorios/pdf",
  autenticar,
  verificarNivel(1),
  controller.gerarPdfRelatorio
);

module.exports = router;
