const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const controller = require("./checklist.controller");

router.get(
  "/api/transformadores_sem_checklist",
  autenticar,
  verificarNivel(3),
  controller.listarTrafosSemChecklist
);
router.get(
  "/api/trafos_da_remessa_para_checklist_v2",
  autenticar,
  verificarNivel(3),
  controller.listarTrafosDaRemessa
);
router.get(
  "/api/historico_remessas_transformador/:numero_serie",
  autenticar,
  verificarNivel(3),
  controller.obterHistoricoRemessas
);
router.post(
  "/api/salvar_checklist",
  autenticar,
  verificarNivel(3),
  controller.salvarChecklist
);
router.get(
  "/api/checklist_transformadores_publico/:id",
  controller.obterChecklistPublico
);
router.delete(
  "/api/excluir_transformador/:id",
  autenticar,
  verificarNivel(3),
  controller.excluirChecklist
);
router.post(
  "/api/filtrar_transformadores",
  autenticar,
  verificarNivel(3),
  controller.filtrarChecklists
);
router.get(
  "/api/gerar_pdf/:id",
  autenticar,
  verificarNivel(3),
  controller.gerarPdfChecklist
);
router.post(
  "/api/gerar_pdf_tabela_transformadores",
  autenticar,
  verificarNivel(3),
  controller.gerarPdfTabela
);

module.exports = router;
