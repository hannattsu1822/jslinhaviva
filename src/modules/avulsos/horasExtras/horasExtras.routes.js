const express = require("express");
const router = express.Router();
const { autenticar, verificarNivelOuCargo } = require("../../../auth");
const controller = require("./horasExtras.controller");

const acessoAvulsos = verificarNivelOuCargo(2, ["construcao", "construção"]);

router.get("/api/avulsos/turmas-encarregados", autenticar, acessoAvulsos, controller.listarTurmasEncarregados);
router.post("/api/avulsos/solicitacao-horas-extras", autenticar, acessoAvulsos, controller.solicitarHorasExtras);

module.exports = router;