const express = require("express");
const router = express.Router();
const path = require("path");
const { autenticar, verificarNivel } = require("../../auth");
const { projectRootDir, publicDir, publicPage, viewsDir, viewsPage } = require("../../shared/path.helper");

const ciclosRoutes = require("./ciclos/ciclos.routes");
const checklistRoutes = require("./checklist/checklist.routes");

// Rotas de Páginas HTML
router.get(
  "/transformadores_reformados",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.redirect(302, "/transformadores?contexto=reformados");
  }
);

router.get(
  "/trafos_reformados_filtrar.html",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      publicPage("trafos/reformados/trafos_reformados_filtrar.html")
    );
  }
);

router.get(
  "/trafos_reformados_importar.html",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      publicPage("trafos/reformados/trafos_reformados_importar.html")
    );
  }
);

router.get(
  "/consultar_historicos.html",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      publicPage("trafos/reformados/consultar_historicos.html")
    );
  }
);

router.get(
  "/transformadores/historico/:numero_serie",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      publicPage("trafos/reformados/historico_checklist.html")
    );
  }
);

router.use(ciclosRoutes);
router.use(checklistRoutes);

module.exports = router;
