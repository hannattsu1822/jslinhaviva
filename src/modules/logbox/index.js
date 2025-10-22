const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../auth");

const dispositivosRoutes = require("./dispositivos/dispositivos.routes");
const monitoramentoRoutes = require("./monitoramento/monitoramento.routes");

// Rotas de Páginas HTML que pertenciam ao módulo
router.get("/monitoramento-hub", autenticar, verificarNivel(4), (req, res) => {
  res.render("pages/logbox/monitoramento-hub", {
    pageTitle: "Hub de Monitoramento",
    user: req.session.user,
  });
});

// Agregando as rotas das sub-gavetas
router.use(dispositivosRoutes);
router.use(monitoramentoRoutes);

module.exports = router;
