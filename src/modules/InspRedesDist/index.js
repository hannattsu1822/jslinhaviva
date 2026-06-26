const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../auth");
const { NIVEL_ACESSO_MIN } = require("./rede.permissions");

router.get("/inspecoes-redes", autenticar, verificarNivel(NIVEL_ACESSO_MIN), (req, res) => {
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
