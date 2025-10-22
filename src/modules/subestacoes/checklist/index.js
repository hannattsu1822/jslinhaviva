const express = require("express");
const router = express.Router();
const path = require("path");
const { autenticar, verificarNivel } = require("../../../auth");
const { projectRootDir } = require("../../../shared/path.helper");

const coreRoutes = require("./core/core.routes");
const anexosRoutes = require("./anexos/anexos.routes");
const dadosRoutes = require("./dados/dados.routes");

router.get(
  "/pagina-checklist-inspecao-subestacao",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/inspecoes-checklist-subestacoes.html"
      )
    );
  }
);

router.get(
  "/pagina-listagem-inspecoes-subestacoes",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/listagem-inspecoes.html"
      )
    );
  }
);

router.get(
  "/inspecoes-subestacoes/detalhes/:id",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/detalhes-inspecao-checklist.html"
      )
    );
  }
);

router.use(coreRoutes);
router.use(anexosRoutes);
router.use(dadosRoutes);

module.exports = router;
