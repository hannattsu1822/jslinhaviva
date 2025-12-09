// routes/trafos_reformados/checklist.routes.js
const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const controller = require("./checklist.controller");
const { uploadAnexoChecklist } = require("../../../init");

router.get(
  "/api/checklist_por_registro/:registroId",
  autenticar,
  verificarNivel(3),
  controller.obterChecklistPorRegistroId
);

router.get(
  "/api/historico_por_serie/:numero_serie",
  autenticar,
  verificarNivel(3),
  controller.obterHistoricoPorSerie
);

router.put(
  "/api/transformadores_reformados/:id/avaliar_completo",
  autenticar,
  verificarNivel(3),
  uploadAnexoChecklist.array("anexos_imagem", 6),
  controller.avaliarCompleto
);

router.post(
  "/api/gerar_pdf_checklist_especifico",
  autenticar,
  verificarNivel(3),
  controller.gerarPdfChecklist
);

router.post(
  "/api/gerar_pdf_tabela_historico",
  autenticar,
  verificarNivel(3),
  controller.gerarPdfTabelaHistorico
);

router.delete(
  "/api/checklist_anexos/:anexoId",
  autenticar,
  verificarNivel(3),
  controller.excluirAnexo
);

module.exports = router;
