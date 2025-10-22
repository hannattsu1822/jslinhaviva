const express = require("express");
const router = express.Router();
const path = require("path");
const { autenticar, verificarNivel } = require("../../auth");
const { projectRootDir } = require("../../shared/path.helper");

const infraRoutes = require("./infra/infra.routes");
const servicosRoutes = require("./servicos");
const checklistRoutes = require("./checklist");

router.get(
  "/subestacoes-dashboard",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/subestacoes-dashboard.html"
      )
    );
  }
);

router.get(
  "/pagina-subestacoes-admin",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(projectRootDir, "public/pages/subestacoes/subestacoes.html")
    );
  }
);

router.use(infraRoutes);
router.use(servicosRoutes);
router.use(checklistRoutes);

module.exports = router;
