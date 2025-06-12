// src/routes.js
const express = require("express");
const path = require("path");
const { autenticar } = require("./auth");

// Importando todos os módulos de rota criados
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
const rotasSubestacoes = require("./routes/rotas_subestacoes"); // Importa as novas rotas

const router = express.Router();

// Usando os módulos de rota
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
router.use("/", rotasSubestacoes);

// Rota raiz básica
router.get("/", (req, res) => {
  if (req.session && req.session.user) {
    res.redirect("/dashboard");
  } else {
    res.redirect("/login");
  }
});

// Rota para servir a página de dashboard
router.get("/dashboard", autenticar, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/pages/into/dashboard.html"));
});

module.exports = router;
