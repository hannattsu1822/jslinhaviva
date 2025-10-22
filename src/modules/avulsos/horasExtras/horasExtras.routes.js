const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const controller = require("./horasExtras.controller");

router.get("/api/avulsos/turmas-encarregados", autenticar, verificarNivel(2), controller.listarTurmasEncarregados);
router.post("/api/avulsos/solicitacao-horas-extras", autenticar, verificarNivel(2), controller.solicitarHorasExtras);

module.exports = router;