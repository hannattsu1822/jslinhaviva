const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const {
  NIVEL_ADMIN_FIBRA,
  NIVEL_ACESSO_MIN,
} = require("../fibra.permissions");
const controller = require("./mapa.controller");

router.get(
  "/mapa_fibra",
  autenticar,
  verificarNivel(NIVEL_ADMIN_FIBRA),
  controller.carregarPaginaMapa
);
router.get(
  "/api/fibra/todos-os-pontos",
  autenticar,
  verificarNivel(NIVEL_ADMIN_FIBRA),
  controller.obterTodosOsPontos
);
router.post(
  "/api/fibra/salvar-pontos-mapa",
  autenticar,
  verificarNivel(NIVEL_ADMIN_FIBRA),
  controller.salvarPontos
);
router.get(
  "/ponto-fibra/:id/editar",
  autenticar,
  verificarNivel(NIVEL_ADMIN_FIBRA),
  controller.carregarPaginaEdicao
);
router.post(
  "/api/fibra/ponto-mapa/:id/editar",
  autenticar,
  verificarNivel(NIVEL_ADMIN_FIBRA),
  controller.editarPonto
);
router.delete(
  "/api/fibra/ponto-mapa/:id",
  autenticar,
  verificarNivel(NIVEL_ADMIN_FIBRA),
  controller.excluirPonto
);

module.exports = router;
