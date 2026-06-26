const express = require("express");
const router = express.Router();
const path = require("path");
const { autenticar, verificarNivel } = require("../../auth");
const {
  NIVEL_ADMIN,
  NIVEL_ACESSO_MIN,
} = require("./subestacoes.permissions");
const { projectRootDir, publicDir, publicPage, viewsDir, viewsPage } = require("../../shared/path.helper");

const infraRoutes = require("./infra/infra.routes");
const servicosRoutes = require("./servicos");
const checklistRoutes = require("./checklist");

router.get(
  "/subestacoes-dashboard",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  (req, res) => {
    res.sendFile(
      publicPage("subestacoes/subestacoes-dashboard.html")
    );
  }
);

router.get(
  "/subestacao",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  (req, res) => {
    res.redirect("/subestacoes-dashboard");
  }
);

router.get(
  "/pagina-subestacoes-admin",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  (req, res) => {
    res.sendFile(
      publicPage("subestacoes/subestacoes.html")
    );
  }
);

router.use(infraRoutes);
router.use(servicosRoutes);
router.use(checklistRoutes);

module.exports = router;
