const express = require("express");
const router = express.Router();
const path = require("path");
const { autenticar, verificarNivel } = require("../../../auth");
const {
  NIVEL_ADMIN,
  NIVEL_ACESSO_MIN,
} = require("../subestacoes.permissions");
const { projectRootDir, publicDir, publicPage, viewsDir, viewsPage } = require("../../../shared/path.helper");

const coreRoutes = require("./core/core.routes");
const anexosRoutes = require("./anexos/anexos.routes");
const dadosRoutes = require("./dados/dados.routes");

router.get(
  "/pagina-checklist-inspecao-subestacao",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  (req, res) => {
    res.sendFile(
      publicPage("subestacoes/inspecoes-checklist-subestacoes.html")
    );
  }
);

router.get(
  "/pagina-listagem-inspecoes-subestacoes",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  (req, res) => {
    res.sendFile(
      publicPage("subestacoes/listagem-inspecoes.html")
    );
  }
);

router.get(
  "/inspecoes-subestacoes/detalhes/:id",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  (req, res) => {
    res.sendFile(
      publicPage("subestacoes/detalhes-inspecao-checklist.html")
    );
  }
);

router.use(coreRoutes);
router.use(anexosRoutes);
router.use(dadosRoutes);

module.exports = router;
