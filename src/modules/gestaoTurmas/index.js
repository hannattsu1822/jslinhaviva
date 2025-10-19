const express = require("express");
const router = express.Router();
const path = require("path");
const { autenticar, verificarNivel } = require("../../auth");
const { projectRootDir } = require("../../shared/path.helper");

const turmasRoutes = require("./turmas/turmas.routes");
const diariasRoutes = require("./diarias/diarias.routes");
const statusRoutes = require("./status/status.routes");

// Rotas de Páginas HTML que pertenciam ao módulo
router.get("/gestao-turmas", autenticar, verificarNivel(3), (req, res) => {
  res.sendFile(
    path.join(projectRootDir, "public/pages/gestao_turmas/gestao-turmas.html")
  );
});

router.get("/diarias", autenticar, verificarNivel(3), (req, res) => {
  res.sendFile(
    path.join(projectRootDir, "public/pages/gestao_turmas/diarias.html")
  );
});

router.get("/turmas_ativas", autenticar, verificarNivel(4), (req, res) => {
  res.sendFile(
    path.join(projectRootDir, "public/pages/gestao_turmas/turmas_ativas.html")
  );
});

router.get("/controle-status", autenticar, verificarNivel(3), (req, res) => {
  res.sendFile(
    path.join(projectRootDir, "public/pages/gestao_turmas/controle-status.html")
  );
});

router.use(turmasRoutes);
router.use(diariasRoutes);
router.use(statusRoutes);

module.exports = router;
