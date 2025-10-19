const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const controller = require("./status.controller");

router.get(
  "/api/status-tipos",
  autenticar,
  verificarNivel(3),
  controller.obterTiposStatus
);

router.post(
  "/api/controle-status",
  autenticar,
  verificarNivel(3),
  controller.registrarStatus
);

router.get(
  "/api/controle-status",
  autenticar,
  verificarNivel(3),
  controller.listarStatus
);

router.put(
  "/api/controle-status/:id",
  autenticar,
  verificarNivel(3),
  controller.atualizarStatus
);

router.delete(
  "/api/controle-status/:id",
  autenticar,
  verificarNivel(3),
  controller.removerStatus
);

module.exports = router;
