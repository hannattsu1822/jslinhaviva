const express = require("express");
const path = require("path");
const { autenticar } = require("./auth");

const rotasAuth = require("./routes/rotas_auth");
const rotasAuditoria = require("./routes/rotas_auditoria");
const rotasFrota = require("./routes/rotas_frota");
const rotasGestaoServicos = require("./routes/rotas_gestao_servicos");
const rotasGestaoTurmas = require("./routes/rotas_gestao_turmas");
const rotasTransformadoresReformados = require("./routes/rotas_transformadores_reformados");
const rotasTransformadores = require("./routes/rotas_transformadores");
const rotasFibraOptica = require("./routes/rotas_fibra_optica");
const rotasInspecoesRedes = require("./routes/rotas_inspecoes_redes");
const rotasAvulsos = require("./routes/rotas_avulsos");
const rotasRelatorios = require("./routes/rotas_relatorios");
const rotasSubestacoesInfra = require("./routes/rotas_subestacoes_infra");
const rotasSubestacoesServicos = require("./routes/rotas_subestacoes_servicos");
const rotasSubestacoesChecklist = require("./routes/rotas_subestacoes_checklist");
const rotasPaginasDirect = require("./routes/rotas_paginas_direct");
const rotasGerenciamentoUsuarios = require("./routes/rotas_gerenciamento_usuarios");
const rotasLogbox = require("./routes/rotas_logbox");

const router = express.Router();

router.use("/", rotasAuth);
router.use("/", rotasAuditoria);
router.use("/", rotasFrota);
router.use("/", rotasGestaoServicos);
router.use("/", rotasGestaoTurmas);
router.use("/", rotasTransformadoresReformados);
router.use("/", rotasTransformadores);
router.use("/", rotasFibraOptica);
router.use("/", rotasInspecoesRedes);
router.use("/", rotasAvulsos);
router.use("/", rotasRelatorios);
router.use("/", rotasSubestacoesInfra);
router.use("/", rotasSubestacoesServicos);
router.use("/", rotasSubestacoesChecklist);
router.use("/", rotasPaginasDirect);
router.use("/", rotasGerenciamentoUsuarios);
router.use("/", rotasLogbox);

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
