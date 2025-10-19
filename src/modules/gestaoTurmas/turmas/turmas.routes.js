const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const controller = require("./turmas.controller");

router.get(
  "/api/turmas",
  autenticar,
  verificarNivel(3),
  controller.listarMembros
);

router.post(
  "/api/turmas/adicionar",
  autenticar,
  verificarNivel(4),
  controller.adicionarMembro
);

router.put(
  "/api/turmas/:id",
  autenticar,
  verificarNivel(4),
  controller.atualizarMembro
);

router.delete(
  "/api/turmas/:id",
  autenticar,
  verificarNivel(4),
  controller.removerMembro
);

router.get(
  "/api/funcionarios_por_turma/:turma_encarregado_id",
  autenticar,
  verificarNivel(3),
  controller.listarFuncionariosPorTurma
);

router.get(
  "/api/user-team-details",
  autenticar,
  verificarNivel(3),
  controller.obterDetalhesTurmaUsuario
);

module.exports = router;
