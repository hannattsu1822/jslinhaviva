const express = require("express");
const router = express.Router();
const path = require("path");
const { autenticar, verificarNivel } = require("../../auth");
const { projectRootDir } = require("../../shared/path.helper");

const horasExtrasRoutes = require("./horasExtras/horasExtras.routes");
const basRoutes = require("./bas/bas.routes");

// Rotas de Páginas HTML
router.get("/avulsos-dashboard", autenticar, verificarNivel(2), (req, res) => {
  res.render("pages/avulsos/dashboard_avulsos.html", { user: req.user });
});

router.get(
  "/autorizacao-horas-extras",
  autenticar,
  verificarNivel(2),
  (req, res) => {
    res.render("pages/avulsos/autorizacao_horas_extras.html", {
      user: req.user,
    });
  }
);

router.get(
  "/bas-importar-dados-pagina",
  autenticar,
  verificarNivel(2),
  (req, res) => {
    res.render("pages/avulsos/bas_importar_dados.html", { user: req.user });
  }
);

router.get(
  "/gerar-formulario-txt-bas",
  autenticar,
  verificarNivel(2),
  (req, res) => {
    res.render("pages/avulsos/gerar_formulario_txt_bas.html", {
      user: req.user,
    });
  }
);

router.get(
  "/gerar-formulario-txt-bas-linhaviva",
  autenticar,
  verificarNivel(2),
  (req, res) => {
    res.render("pages/avulsos/gerar_formulario_txt_bas_linhaviva.html", {
      user: req.user,
    });
  }
);

// Agregando as rotas da API das sub-gavetas
router.use(horasExtrasRoutes);
router.use(basRoutes);

module.exports = router;
