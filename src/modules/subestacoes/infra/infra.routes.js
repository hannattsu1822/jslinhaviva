const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const controller = require("./infra.controller");

router.get(
  "/subestacoes",
  autenticar,
  verificarNivel(3),
  controller.listarSubestacoes
);
router.get(
  "/subestacoes/:id",
  autenticar,
  verificarNivel(3),
  controller.obterSubestacaoPorId
);
router.post(
  "/subestacoes",
  autenticar,
  verificarNivel(3),
  controller.criarSubestacao
);
router.put(
  "/subestacoes/:id",
  autenticar,
  verificarNivel(3),
  controller.atualizarSubestacao
);
router.delete(
  "/subestacoes/:id",
  autenticar,
  verificarNivel(3),
  controller.deletarSubestacao
);

router.get(
  "/api/catalogo/equipamentos",
  autenticar,
  verificarNivel(3),
  controller.listarCatalogo
);
router.post(
  "/api/catalogo/equipamentos",
  autenticar,
  verificarNivel(3),
  controller.criarItemCatalogo
);
router.put(
  "/api/catalogo/equipamentos/:id",
  autenticar,
  verificarNivel(3),
  controller.atualizarItemCatalogo
);
router.delete(
  "/api/catalogo/equipamentos/:id",
  autenticar,
  verificarNivel(3),
  controller.deletarItemCatalogo
);

module.exports = router;
