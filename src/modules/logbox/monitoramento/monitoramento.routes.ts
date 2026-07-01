import express from "express";
import { autenticar, verificarNivelOuCargo } from "../../../auth";
import * as controller from "./monitoramento.controller";

const router = express.Router();
const acessoMonitoramento = verificarNivelOuCargo(2, ["cod"]);
const acessoMonitoramentoBasico = verificarNivelOuCargo(1, ["cod"]);

router.get(
  "/logbox-device/:serialNumber",
  autenticar,
  acessoMonitoramento,
  controller.renderizarPaginaDetalhe
);
router.get(
  "/relatorios-logbox",
  autenticar,
  acessoMonitoramento,
  controller.renderizarPaginaRelatorios
);
router.get(
  "/api/logbox-device/:serialNumber/leituras",
  autenticar,
  acessoMonitoramento,
  controller.obterLeituras
);
router.get(
  "/api/logbox-device/:serialNumber/status",
  autenticar,
  acessoMonitoramento,
  controller.obterStatus
);
router.get(
  "/api/logbox-device/:serialNumber/latest",
  autenticar,
  acessoMonitoramento,
  controller.obterUltimaLeitura
);
router.get(
  "/api/logbox-device/:serialNumber/stats-detail",
  autenticar,
  acessoMonitoramento,
  controller.obterEstatisticas
);
router.get(
  "/api/logbox-device/:serialNumber/fan-stats",
  autenticar,
  acessoMonitoramento,
  controller.obterEstatisticasVentilacao
);
router.get(
  "/api/logbox-device/:serialNumber/ventilation-history",
  autenticar,
  acessoMonitoramento,
  controller.obterHistoricoVentilacao
);
router.get(
  "/api/logbox-device/:serialNumber/connection-history",
  autenticar,
  acessoMonitoramento,
  controller.obterHistoricoConexao
);
router.post(
  "/api/relatorios/gerar",
  autenticar,
  acessoMonitoramento,
  controller.gerarRelatorioVisual
);
router.post(
  "/api/relatorios/pdf",
  autenticar,
  acessoMonitoramentoBasico,
  controller.gerarPdfRelatorio
);

export default router;
