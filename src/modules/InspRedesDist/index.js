const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../auth");
const { NIVEL_ACESSO_MIN } = require("./rede.permissions");
const { publicPage } = require("../../shared/path.helper");

router.get("/inspecoes-redes", autenticar, verificarNivel(NIVEL_ACESSO_MIN), (req, res) => {
  res.render("pages/InspRedesDist/dashboard_inspecoes.html", {
    user: req.session.user,
  });
});

router.get(
  "/inspecoes_redes_principal",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  (req, res) => {
    res.sendFile(publicPage("inspecoes_redes/inspecoes_redes_principal.html"));
  }
);

// Importa as rotas dos submódulos
const infraCodesRoutes = require("./InfraCodes/infra_codes.routes");
const gestaoServicosRoutes = require("./GestaoServicos/servicos.routes");

router.use("/inspecoes", infraCodesRoutes);
router.use("/inspecoes", gestaoServicosRoutes);

module.exports = router;
