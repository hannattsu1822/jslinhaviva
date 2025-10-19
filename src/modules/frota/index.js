const express = require("express");
const router = express.Router();

const agendamentosRoutes = require("./agendamentos/agendamentos.routes");
const inspecoesRoutes = require("./inspecoes/inspecoes.routes");
const oleoRoutes = require("./oleo/oleo.routes");
const veiculosRoutes = require("./veiculos/veiculos.routes");

router.use(agendamentosRoutes);
router.use(inspecoesRoutes);
router.use(oleoRoutes);
router.use(veiculosRoutes);

module.exports = router;
