const express = require("express");
const path = require("path");
const { autenticar } = require("./auth");

const rotasAuth = require("./routes/rotas_auth");
const rotasAuditoria = require("./routes/rotas_auditoria");
const rotasFrota = require("./modules/frota");
const rotasGestaoServicos = require("./modules/gestaoServicos/gestaoServicos.routes");
const rotasGestao = require("./modules/gestao");
const rotasGestaoTurmas = require("./modules/gestaoTurmas");
const rotasTransformadores = require("./modules/transformadores");
const rotasTransformadoresReformados = require("./modules/trafosReformados");
const rotasFibraOptica = require("./modules/fibraOptica");
const rotasInspecoesRedes = require("./routes/rotas_inspecoes_redes");
const rotasAvulsos = require("./routes/rotas_avulsos");
const rotasRelatorios = require("./routes/rotas_relatorios");
const rotasSubestacoesInfra = require("./routes/rotas_subestacoes_infra");
const rotasSubestacoesServicos = require("./routes/rotas_subestacoes_servicos");
const rotasSubestacoesChecklist = require("./routes/rotas_subestacoes_checklist");
const rotasPaginasDirect = require("./routes/rotas_paginas_direct");
const rotasLogbox = require("./routes/rotas_logbox");
const rotasPrv = require("./routes/rotas_prv");
const rotasReles = require("./routes/rotas_reles");

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
router.use("/", rotasInspecoesRedes);
router.use("/", rotasAvulsos);
router.use("/", rotasRelatorios);
router.use("/", rotasSubestacoesInfra);
router.use("/", rotasSubestacoesServicos);
router.use("/", rotasSubestacoesChecklist);
router.use("/", rotasPaginasDirect);
router.use("/", rotasLogbox);
router.use("/", rotasPrv);
router.use("/", rotasReles);

router.get("/", (req, res) => {
  if (req.session && req.session.user) {
    res.redirect("/dashboard");
  } else {
    res.redirect("/login");
  }
});

router.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/pages/login/login.html"));
});

router.get("/dashboard", autenticar, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/pages/into/dashboard.html"));
});

module.exports = router;
