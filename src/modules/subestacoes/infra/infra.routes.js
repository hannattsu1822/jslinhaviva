const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const {
  NIVEL_ADMIN,
  NIVEL_ACESSO_MIN,
} = require("../subestacoes.permissions");
const controller = require("./infra.controller");

router.get(
  "/subestacoes",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.listarSubestacoes
);
router.get(
  "/subestacoes/:id",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.obterSubestacaoPorId
);
router.post(
  "/subestacoes",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  controller.criarSubestacao
);
router.put(
  "/subestacoes/:id",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  controller.atualizarSubestacao
);
router.delete(
  "/subestacoes/:id",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  controller.deletarSubestacao
);

router.get(
  "/api/catalogo/equipamentos",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.listarCatalogo
);
router.post(
  "/api/catalogo/equipamentos",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  controller.criarItemCatalogo
);
router.put(
  "/api/catalogo/equipamentos/:id",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  controller.atualizarItemCatalogo
);
router.delete(
  "/api/catalogo/equipamentos/:id",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  controller.deletarItemCatalogo
);

module.exports = router;
