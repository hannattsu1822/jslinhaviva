const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const controller = require("./prv.controller");

router.get(
  "/pagina-relatorios-prv",
  autenticar,
  verificarNivel(4),
  (req, res) => {
    res.render("pages/gestor/relatorios-prv.html", { user: req.session.user });
  }
);

router.get(
  "/api/relatorios/prv",
  autenticar,
  verificarNivel(4),
  controller.listarRegistrosPrv
);

router.get(
  "/api/relatorios/prv/export",
  autenticar,
  verificarNivel(4),
  controller.exportarRegistrosPrv
);

module.exports = router;
