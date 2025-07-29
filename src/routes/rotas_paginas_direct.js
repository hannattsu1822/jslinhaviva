const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../auth");

router.get(
  "/pagina-gerenciamento-usuarios",
  autenticar,
  verificarNivel(4), // <-- ALTERADO AQUI TAMBÉM PARA CONSISTÊNCIA
  (req, res) => {
    res.render("pages/gestor/gerenciamento-usuarios", {
      user: req.user,
    });
  }
);

router.get(
  "/dashboard-gestor",
  autenticar,
  verificarNivel(4), // <-- ALTERADO AQUI
  (req, res) => {
    res.render("pages/gestor/dashboard-gestor", {
      user: req.user,
    });
  }
);

module.exports = router;
