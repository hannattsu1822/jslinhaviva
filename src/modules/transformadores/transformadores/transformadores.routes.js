const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const { upload } = require("../../../init");
const controller = require("./transformadores.controller");

router.post(
  "/api/upload_transformadores",
  autenticar,
  verificarNivel(3),
  upload.single("planilha"),
  controller.uploadPlanilha
);

router.get(
  "/api/responsaveis",
  autenticar,
  verificarNivel(3),
  controller.listarResponsaveis
);

router.get(
  "/api/supervisores",
  autenticar,
  verificarNivel(3),
  controller.listarSupervisores
);

module.exports = router;
