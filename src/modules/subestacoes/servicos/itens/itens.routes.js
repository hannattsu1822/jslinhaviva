const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../../auth");
const { upload } = require("../../../../infrastructure/uploads");
const {
  NIVEL_ADMIN,
  NIVEL_ACESSO_MIN,
} = require("../../subestacoes.permissions");
const controller = require("./itens.controller");

router.put(
  "/api/servicos/:servicoId/itens/encarregados",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  controller.atualizarEncarregados
);

router.put(
  "/api/servicos/itens/:itemEscopoId/concluir",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  upload.any(),
  controller.concluirItem
);

module.exports = router;
