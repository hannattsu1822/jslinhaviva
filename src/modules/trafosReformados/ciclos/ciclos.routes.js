const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const { upload } = require("../../../init");
const controller = require("./ciclos.controller");

router.get(
  "/api/transformadores_reformados",
  autenticar,
  verificarNivel(3),
  controller.listarCiclos
);
router.get(
  "/api/transformadores_reformados/:id",
  autenticar,
  verificarNivel(3),
  controller.obterCicloPorId
);
router.put(
  "/api/transformadores/:id/reverter",
  autenticar,
  verificarNivel(3),
  controller.reverterStatusCiclo
);
router.post(
  "/api/importar_trafos_reformados",
  autenticar,
  verificarNivel(3),
  upload.single("planilha"),
  controller.importarCiclos
);
router.delete(
  "/api/trafos_pendentes",
  autenticar,
  verificarNivel(3),
  controller.limparPendentes
);
router.delete(
  "/api/transformadores_reformados/:id",
  autenticar,
  verificarNivel(3),
  controller.excluirCiclo
);
router.get(
  "/api/tecnicos_responsaveis_trafos_reformados",
  autenticar,
  verificarNivel(3),
  controller.listarTecnicosResponsaveis
);
router.get(
  "/api/fabricantes_trafos_reformados",
  autenticar,
  verificarNivel(3),
  controller.listarFabricantes
);
router.get(
  "/api/potencias_trafos_reformados",
  autenticar,
  verificarNivel(3),
  controller.listarPotencias
);

module.exports = router;
