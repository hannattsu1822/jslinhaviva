const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const controller = require("./dispositivos.controller");

router.get(
  "/gerenciar-dispositivos",
  autenticar,
  verificarNivel(4),
  controller.renderizarPaginaGerenciamento
);
router.get(
  "/logbox-devices",
  autenticar,
  verificarNivel(4),
  controller.renderizarPaginaLista
);
router.get(
  "/api/dispositivos",
  autenticar,
  verificarNivel(4),
  controller.listarDispositivosApi
);
router.get(
  "/api/dispositivos/:id",
  autenticar,
  verificarNivel(4),
  controller.obterDispositivoPorId
);
router.post(
  "/api/dispositivos",
  autenticar,
  verificarNivel(4),
  controller.salvarDispositivo
);
router.delete(
  "/api/dispositivos/:id",
  autenticar,
  verificarNivel(4),
  controller.excluirDispositivo
);

module.exports = router;
