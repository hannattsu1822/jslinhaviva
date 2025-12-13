const express = require("express");

const router = express.Router();

const { autenticar, verificarNivel } = require("../../auth");

const { upload } = require("../../init");

const checklistController = require("./checklistDaily.controller");

router.get(
  "/checklist-diario",
  autenticar,
  verificarNivel(4),
  checklistController.renderizarPagina
);

router.get(
  "/api/checklist/status",
  autenticar,
  verificarNivel(4),
  checklistController.verificarStatus
);

router.get(
  "/api/checklist_status",
  autenticar,
  verificarNivel(4),
  checklistController.verificarStatus
);

router.post(
  "/api/checklist/salvar",
  autenticar,
  verificarNivel(4),
  upload.fields([
    { name: "fotos_veiculo", maxCount: 10 },
    { name: "fotosveiculo", maxCount: 10 },
  ]),
  checklistController.salvarChecklist
);

router.get(
  "/gestao/checklists",
  autenticar,
  verificarNivel(5),
  checklistController.renderizarPaginaGestao
);

router.get(
  "/api/gestao/checklists",
  autenticar,
  verificarNivel(5),
  checklistController.listarGestaoAPI
);

router.get(
  "/api/gestao/checklists/:id/fotos",
  autenticar,
  verificarNivel(5),
  checklistController.detalhesGestaoAPI
);

router.delete(
  "/api/gestao/checklists/:id",
  autenticar,
  verificarNivel(5),
  checklistController.excluirChecklistAPI
);

module.exports = router;
