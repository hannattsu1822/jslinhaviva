const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const controller = require("./mapa.controller");

router.get(
  "/mapa_fibra",
  autenticar,
  verificarNivel(3),
  controller.carregarPaginaMapa
);
router.get(
  "/api/fibra/todos-os-pontos",
  autenticar,
  verificarNivel(3),
  controller.obterTodosOsPontos
);
router.post(
  "/api/fibra/salvar-pontos-mapa",
  autenticar,
  verificarNivel(3),
  controller.salvarPontos
);
router.get(
  "/ponto-fibra/:id/editar",
  autenticar,
  verificarNivel(4),
  controller.carregarPaginaEdicao
);
router.post(
  "/api/fibra/ponto-mapa/:id/editar",
  autenticar,
  verificarNivel(4),
  controller.editarPonto
);
router.delete(
  "/api/fibra/ponto-mapa/:id",
  autenticar,
  verificarNivel(4),
  controller.excluirPonto
);

module.exports = router;
