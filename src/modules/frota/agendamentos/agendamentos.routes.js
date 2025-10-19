const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const controller = require("./agendamentos.controller");

router.post(
  "/api/agendar_checklist",
  autenticar,
  verificarNivel(4),
  controller.agendarChecklist
);

router.get(
  "/api/agendamentos_checklist/:id",
  autenticar,
  verificarNivel(2),
  controller.obterAgendamentoPorId
);

router.delete(
  "/api/agendamentos_checklist/:id",
  autenticar,
  verificarNivel(4),
  controller.deletarAgendamento
);

router.get(
  "/api/agendamentos_checklist",
  autenticar,
  verificarNivel(2),
  controller.listarAgendamentos
);

router.get(
  "/api/agendamentos_abertos",
  autenticar,
  verificarNivel(3),
  controller.listarAgendamentosAbertos
);

module.exports = router;
