const express = require("express");
const router = express.Router();
const path = require("path");
const { autenticar, verificarNivel } = require("../../../auth");
const { projectRootDir } = require("../../../shared/path.helper");

const coreRoutes = require("./core");
const itensRoutes = require("./itens");
const anexosRoutes = require("./anexos");
const relatoriosRoutes = require("./relatorios");

// Rotas de Páginas HTML que pertencem a este submódulo
router.get(
  "/pagina-servicos-subestacoes",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/servicos-subestacoes-servicos.html"
      )
    );
  }
);

router.get(
  "/pagina-servicos-concluidos",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/servicos-concluidos.html"
      )
    );
  }
);

router.get(
  "/registrar-servico-subestacao",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/registrar-servico-subestacao.html"
      )
    );
  }
);

router.get(
  "/servicos/:servicoId/detalhes-pagina",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/servico-detalhes-pagina.html"
      )
    );
  }
);

router.get(
  "/servicos/:servicoId/detalhes-concluido",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/servico-concluido-detalhes.html"
      )
    );
  }
);

// Agregando as rotas da API das sub-gavetas
router.use(coreRoutes);
router.use(itensRoutes);
router.use(anexosRoutes);
router.use(relatoriosRoutes);

module.exports = router;
