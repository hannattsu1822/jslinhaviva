const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../auth");

// --- Rota para a página principal do módulo ---
// Esta rota permanece como está.
router.get("/inspecoes-redes", autenticar, verificarNivel(3), (req, res) => {
  res.render("pages/InspRedesDist/dashboard_inspecoes.html", {
    user: req.session.user,
  });
});

// Importa as rotas dos submódulos
const infraCodesRoutes = require("./InfraCodes/infra_codes.routes");
const gestaoServicosRoutes = require("./GestaoServicos/servicos.routes");

router.use("/inspecoes", infraCodesRoutes);
router.use("/inspecoes", gestaoServicosRoutes);

module.exports = router;
