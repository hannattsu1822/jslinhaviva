const express = require("express");
const { autenticar } = require("./auth");
const { publicPage } = require("./shared/path.helper");

const rotasAuth = require("./routes/rotas_auth");
const rotasAuditoria = require("./routes/rotas_auditoria");

const rotasFrota = require("./modules/frota");
const rotasGestaoServicos = require("./modules/gestaoServicos");
const rotasGestao = require("./modules/gestao");
const rotasGestaoTurmas = require("./modules/gestaoTurmas");
const rotasTransformadores = require("./modules/transformadores");
const rotasTransformadoresReformados = require("./modules/trafosReformados");
const rotasFibraOptica = require("./modules/fibraOptica");
const rotasAvulsos = require("./modules/avulsos");
const rotasUteis = require("./modules/uteis");
const rotasSubestacoes = require("./modules/subestacoes");
const rotasLogbox = require("./modules/logbox");
const rotasPrv = require("./modules/prv");
const rotasReles = require("./modules/reles");
const rotasInspRedesDist = require("./modules/InspRedesDist");

// --- ADICIONE AQUI O IMPORT DO NOC ---
const rotasNoc = require("./modules/noc/noc.routes"); 

const rotasChecklistDaily = require("./modules/checklistDaily/checklistDaily.routes");

const router = express.Router();

router.use("/", rotasAuth);
router.use("/", rotasAuditoria);
router.use("/", rotasFrota);
router.use("/", rotasGestaoServicos);
router.use("/", rotasGestao);
router.use("/", rotasGestaoTurmas);
router.use("/", rotasTransformadores);
router.use("/", rotasTransformadoresReformados);
router.use("/", rotasFibraOptica);
router.use("/", rotasAvulsos);
router.use("/", rotasUteis);
router.use("/", rotasSubestacoes);
router.use("/", rotasLogbox);
router.use("/", rotasPrv);
router.use("/", rotasReles);
router.use("/", rotasInspRedesDist);

// --- ADICIONE AQUI O USO DA ROTA ---
router.use("/", rotasNoc);

router.use("/", rotasChecklistDaily);

router.get("/", (req, res) => {
  if (req.session && req.session.user) {
    res.redirect("/dashboard");
  } else {
    res.redirect("/login");
  }
});

router.get("/login", (req, res) => {
  res.sendFile(publicPage("login/login.html"));
});

router.get("/dashboard", autenticar, (req, res) => {
  res.sendFile(publicPage("into/dashboard.html"));
});

module.exports = router;
