const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel, verificarNivelOuCargo } = require("../../auth");
const {
  redirecionarCodRestrito,
  redirecionarTransporteRestrito,
} = require("../../shared/perfilCargo.helper");

const horasExtrasRoutes = require("./horasExtras/horasExtras.routes");
const basRoutes = require("./bas/bas.routes");

const acessoAvulsos = verificarNivelOuCargo(2, ["construcao", "construção"]);
const bloquearOutrosPerfis = [redirecionarCodRestrito, redirecionarTransporteRestrito];

router.get(
  "/avulsos-dashboard",
  autenticar,
  acessoAvulsos,
  ...bloquearOutrosPerfis,
  (req, res) => {
    res.render("pages/avulsos/dashboard_avulsos.html", { user: req.user });
  }
);

router.get(
  "/autorizacao-horas-extras",
  autenticar,
  acessoAvulsos,
  ...bloquearOutrosPerfis,
  (req, res) => {
    res.render("pages/avulsos/autorizacao_horas_extras.html", {
      user: req.user,
    });
  }
);

router.get(
  "/bas-importar-dados-pagina",
  autenticar,
  acessoAvulsos,
  ...bloquearOutrosPerfis,
  (req, res) => {
    res.render("pages/avulsos/bas_importar_dados.html", { user: req.user });
  }
);

router.get(
  "/gerar-formulario-txt-bas",
  autenticar,
  acessoAvulsos,
  ...bloquearOutrosPerfis,
  (req, res) => {
    res.render("pages/avulsos/gerar_formulario_txt_bas.html", {
      user: req.user,
    });
  }
);

router.get(
  "/gerar-formulario-txt-bas-linhaviva",
  autenticar,
  acessoAvulsos,
  ...bloquearOutrosPerfis,
  (req, res) => {
    res.render("pages/avulsos/gerar_formulario_txt_bas_linhaviva.html", {
      user: req.user,
    });
  }
);

router.use(horasExtrasRoutes);
router.use(basRoutes);

module.exports = router;
