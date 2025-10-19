const express = require("express");
const router = express.Router();
const path = require("path");
const { autenticar, verificarNivel } = require("../../auth");
const { projectRootDir } = require("../../shared/path.helper");

const ciclosRoutes = require("./ciclos/ciclos.routes");
const checklistRoutes = require("./checklist/checklist.routes");

// Rotas de Páginas HTML
router.get(
  "/transformadores_reformados",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/trafos/reformados/transformadores_reformados.html"
      )
    );
  }
);

router.get(
  "/trafos_reformados_filtrar.html",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/trafos/reformados/trafos_reformados_filtrar.html"
      )
    );
  }
);

router.get(
  "/trafos_reformados_importar.html",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/trafos/reformados/trafos_reformados_importar.html"
      )
    );
  }
);

router.get(
  "/consultar_historicos.html",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/trafos/reformados/consultar_historicos.html"
      )
    );
  }
);

router.get(
  "/transformadores/historico/:numero_serie",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/trafos/reformados/historico_checklist.html"
      )
    );
  }
);

router.use(ciclosRoutes);
router.use(checklistRoutes);

module.exports = router;
