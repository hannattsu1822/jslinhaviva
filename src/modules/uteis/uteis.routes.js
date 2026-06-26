const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../auth");
const {
  NIVEL_ADMIN_SERVICOS,
} = require("../gestaoServicos/servicos.permissions");
const controller = require("./uteis.controller");
const path = require("path");
const { projectRootDir, publicDir, publicPage, viewsDir, viewsPage } = require("../../shared/path.helper");

// Rotas de Páginas
router.get(
  "/pagina-gerenciamento-usuarios",
  autenticar,
  verificarNivel(4),
  (req, res) => {
    res.render("pages/gestor/gerenciamento-usuarios", { user: req.user });
  }
);

router.get("/dashboard-gestor", autenticar, verificarNivel(4), (req, res) => {
  res.render("pages/gestor/dashboard-gestor", { user: req.user });
});

router.get(
  "/logbox-devices",
  autenticar,
  verificarNivel(4),
  controller.renderizarPaginaLogboxDevices
);

router.get("/monitoramento-hub", autenticar, verificarNivel(4), (req, res) => {
  res.render("pages/logbox/monitoramento-hub", {
    pageTitle: "Hub de Monitoramento",
    user: req.session.user,
  });
});

router.get(
  "/relatorios-servicos",
  autenticar,
  verificarNivel(NIVEL_ADMIN_SERVICOS),
  (req, res) => {
    res.sendFile(
      publicPage("servicos/relatorios_servicos.html")
    );
  }
);

// Rotas de API
router.get(
  "/api/relatorios/servicos-por-encarregado",
  autenticar,
  verificarNivel(NIVEL_ADMIN_SERVICOS),
  controller.relatorioServicosPorEncarregado
);
router.get(
  "/api/relatorios/servicos-por-desligamento",
  autenticar,
  verificarNivel(NIVEL_ADMIN_SERVICOS),
  controller.relatorioServicosPorDesligamento
);
router.get(
  "/api/relatorios/servicos-concluidos-por-mes",
  autenticar,
  verificarNivel(NIVEL_ADMIN_SERVICOS),
  controller.relatorioServicosConcluidosPorMes
);
router.get(
  "/api/relatorios/status-finalizacao",
  autenticar,
  verificarNivel(NIVEL_ADMIN_SERVICOS),
  controller.relatorioStatusFinalizacao
);

module.exports = router;
