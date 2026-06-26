const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../../auth");
const { upload } = require("../../../../infrastructure/uploads");
const {
  NIVEL_ADMIN,
  NIVEL_ACESSO_MIN,
} = require("../../subestacoes.permissions");
const controller = require("./anexos.controller");

router.post(
  "/api/servicos/:servicoId/anexar-posterior",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  upload.array("anexosServico", 5),
  controller.anexarPosterior
);
router.post(
  "/api/servicos/:servicoId/anexar-apr",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  upload.array("anexosAPR", 5),
  controller.anexarAPR
);
router.delete(
  "/api/servicos/anexos/:anexoId",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  controller.excluirAnexo
);

module.exports = router;
