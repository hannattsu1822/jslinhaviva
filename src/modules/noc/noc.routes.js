const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../auth");
const controller = require("./noc.controller");

// Rota acessível para nível 1 (Visualização) ou superior
router.get("/centro-operacoes", autenticar, verificarNivel(1), controller.renderizarPainelNOC);

module.exports = router;
