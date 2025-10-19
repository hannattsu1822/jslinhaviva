const express = require("express");
const path = require("path");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const controller = require("./oleo.controller");
const { projectRootDir } = require("../../../shared/path.helper");

router.get("/registro_oleo", autenticar, verificarNivel(4), (req, res) => {
  res.sendFile(
    path.join(projectRootDir, "public/pages/frota/registro_oleo.html")
  );
});

router.get("/proxima_troca_oleo", autenticar, verificarNivel(4), (req, res) => {
  res.sendFile(
    path.join(projectRootDir, "public/pages/frota/proxima_troca_oleo.html")
  );
});

router.get(
  "/api/veiculos_oleo",
  autenticar,
  verificarNivel(2),
  controller.listarVeiculosParaOleo
);

router.get(
  "/api/tecnicos_oleo",
  autenticar,
  verificarNivel(2),
  controller.listarTecnicosParaOleo
);

router.post(
  "/api/registrar_oleo",
  autenticar,
  verificarNivel(4),
  controller.registrarTrocaOleo
);

router.get(
  "/api/historico_oleo/:veiculo_id?",
  autenticar,
  verificarNivel(2),
  controller.listarHistoricoOleo
);

router.get(
  "/api/proxima_troca_oleo",
  autenticar,
  verificarNivel(4),
  controller.calcularProximasTrocas
);

router.delete(
  "/api/trocas_oleo/:id",
  autenticar,
  verificarNivel(4),
  controller.deletarTrocaOleo
);

module.exports = router;
