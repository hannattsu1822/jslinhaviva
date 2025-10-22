const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../auth");
const controller = require("./uteis.controller");
const path = require("path");
const { projectRootDir } = require("../../shared/path.helper");

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
  verificarNivel(4),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/servicos/relatorios_servicos.html"
      )
    );
  }
);

// Rotas de API
router.get(
  "/api/relatorios/servicos-por-encarregado",
  autenticar,
  verificarNivel(4),
  controller.relatorioServicosPorEncarregado
);
router.get(
  "/api/relatorios/servicos-por-desligamento",
  autenticar,
  verificarNivel(4),
  controller.relatorioServicosPorDesligamento
);
router.get(
  "/api/relatorios/servicos-concluidos-por-mes",
  autenticar,
  verificarNivel(4),
  controller.relatorioServicosConcluidosPorMes
);
router.get(
  "/api/relatorios/status-finalizacao",
  autenticar,
  verificarNivel(4),
  controller.relatorioStatusFinalizacao
);

module.exports = router;
