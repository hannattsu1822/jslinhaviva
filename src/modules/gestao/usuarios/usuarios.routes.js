const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const controller = require("./usuarios.controller");

router.get(
  "/api/gerenciamento/usuarios",
  autenticar,
  verificarNivel(4),
  controller.listarUsuarios
);

router.get(
  "/api/gerenciamento/usuarios/:id",
  autenticar,
  verificarNivel(4),
  controller.obterUsuarioPorId
);

router.post(
  "/api/gerenciamento/usuarios",
  autenticar,
  verificarNivel(4),
  controller.criarUsuario
);

router.put(
  "/api/gerenciamento/usuarios/:id",
  autenticar,
  verificarNivel(4),
  controller.atualizarUsuario
);

router.put(
  "/api/gerenciamento/usuarios/:id/status",
  autenticar,
  verificarNivel(4),
  controller.atualizarStatusUsuario
);

router.delete(
  "/api/gerenciamento/usuarios/:id",
  autenticar,
  verificarNivel(5),
  controller.deletarUsuario
);

module.exports = router;
