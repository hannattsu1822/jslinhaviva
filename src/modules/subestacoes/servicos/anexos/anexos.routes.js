const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../../auth");
const { upload } = require("../../../../init");
const controller = require("./anexos.controller");

router.post(
  "/api/servicos/:servicoId/anexar-posterior",
  autenticar,
  verificarNivel(3),
  upload.array("anexosServico", 5),
  controller.anexarPosterior
);
router.post(
  "/api/servicos/:servicoId/anexar-apr",
  autenticar,
  verificarNivel(3),
  upload.array("anexosAPR", 5),
  controller.anexarAPR
);
router.delete(
  "/api/servicos/anexos/:anexoId",
  autenticar,
  verificarNivel(3),
  controller.excluirAnexo
);

module.exports = router;
