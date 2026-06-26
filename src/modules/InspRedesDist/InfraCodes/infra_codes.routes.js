const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const {
  NIVEL_ADMIN_REDE,
  NIVEL_ACESSO_MIN,
} = require("../rede.permissions");
const controller = require("./infra_codes.controller");

router.get(
  "/gerenciar-codigos",
  autenticar,
  verificarNivel(NIVEL_ADMIN_REDE),
  controller.renderizarPaginaGerenciamento
);

router.get(
  "/api/codigos/tipos",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.handleListarTipos
);

router.post(
  "/api/codigos/tipos",
  autenticar,
  verificarNivel(NIVEL_ADMIN_REDE),
  controller.handleCriarTipo
);

router.put(
  "/api/codigos/tipos/:id",
  autenticar,
  verificarNivel(NIVEL_ADMIN_REDE),
  controller.handleAtualizarTipo
);

router.delete(
  "/api/codigos/tipos/:id",
  autenticar,
  verificarNivel(NIVEL_ADMIN_REDE),
  controller.handleDeletarTipo
);

router.get(
  "/api/codigos/tags",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.handleListarTags
);

router.post(
  "/api/codigos/tags",
  autenticar,
  verificarNivel(NIVEL_ADMIN_REDE),
  controller.handleCriarTag
);

router.put(
  "/api/codigos/tags/:id",
  autenticar,
  verificarNivel(NIVEL_ADMIN_REDE),
  controller.handleAtualizarTag
);

router.delete(
  "/api/codigos/tags/:id",
  autenticar,
  verificarNivel(NIVEL_ADMIN_REDE),
  controller.handleDeletarTag
);

module.exports = router;
