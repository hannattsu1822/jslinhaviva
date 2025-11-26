const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../auth");
const { upload } = require("../../init");
const checklistController = require("./checklistDaily.controller");

// Rota para o usuário comum (Motorista)
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

router.post(
  "/api/checklist/salvar",
  autenticar,
  verificarNivel(4),
  upload.array("fotos_veiculo", 10),
  checklistController.salvarChecklist
);

// --- ROTAS DE GESTÃO (Nível 5+) ---

// Página HTML
router.get(
  "/gestao/checklists",
  autenticar,
  verificarNivel(5), // Nível de Gestor
  checklistController.renderizarPaginaGestao
);

// API para popular a tabela
router.get(
  "/api/gestao/checklists",
  autenticar,
  verificarNivel(5),
  checklistController.listarGestaoAPI
);

// API para pegar as fotos de um checklist
router.get(
  "/api/gestao/checklists/:id/fotos",
  autenticar,
  verificarNivel(5),
  checklistController.detalhesGestaoAPI
);

// API para excluir / reenviar
// ALTERADO DE 10 PARA 5 PARA PERMITIR QUE O GESTOR EXCLUA/REENVIE
router.delete(
  "/api/gestao/checklists/:id",
  autenticar,
  verificarNivel(5),
  checklistController.excluirChecklistAPI
);

module.exports = router;
