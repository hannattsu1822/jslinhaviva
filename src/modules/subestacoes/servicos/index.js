const express = require("express");
const router = express.Router();
const path = require("path");
const { autenticar, verificarNivel } = require("../../../auth");
const {
  NIVEL_ADMIN,
  NIVEL_ACESSO_MIN,
} = require("../subestacoes.permissions");
const { projectRootDir, publicDir, publicPage, viewsDir, viewsPage } = require("../../../shared/path.helper");

const coreRoutes = require("./core");
const itensRoutes = require("./itens");
const anexosRoutes = require("./anexos");
const relatoriosRoutes = require("./relatorios");

router.get(
  "/pagina-servicos-subestacoes",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  (req, res) => {
    res.sendFile(
      publicPage("subestacoes/servicos-subestacoes-servicos.html")
    );
  }
);

router.get(
  "/pagina-servicos-concluidos",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  (req, res) => {
    res.sendFile(
      publicPage("subestacoes/servicos-concluidos.html")
    );
  }
);

router.get(
  "/registrar-servico-subestacao",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  (req, res) => {
    res.sendFile(
      publicPage("subestacoes/registrar-servico-subestacao.html")
    );
  }
);

router.get(
  "/servicos/:servicoId/detalhes-pagina",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  (req, res) => {
    res.sendFile(
      publicPage("subestacoes/servico-detalhes-pagina.html")
    );
  }
);

router.get(
  "/servicos/:servicoId/detalhes-concluido",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  (req, res) => {
    res.sendFile(
      publicPage("subestacoes/servico-concluido-detalhes.html")
    );
  }
);

router.use(coreRoutes);
router.use(itensRoutes);
router.use(anexosRoutes);
router.use(relatoriosRoutes);

module.exports = router;
