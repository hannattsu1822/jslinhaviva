const express = require("express");
const router = express.Router();
const { autenticar } = require("../../../auth");
const controller = require("./dispositivos.controller");

router.get(
  "/gerenciar-dispositivos",
  autenticar,
  controller.renderizarPaginaGerenciamento
);
router.get("/logbox-devices", autenticar, controller.renderizarPaginaLista);
router.get("/api/dispositivos", autenticar, controller.listarDispositivosApi);
router.get(
  "/api/dispositivos/:id",
  autenticar,
  controller.obterDispositivoPorId
);
router.post("/api/dispositivos", autenticar, controller.salvarDispositivo);
router.delete(
  "/api/dispositivos/:id",
  autenticar,
  controller.excluirDispositivo
);

module.exports = router;
