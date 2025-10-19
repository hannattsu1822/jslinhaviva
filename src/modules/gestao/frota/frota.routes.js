const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const controller = require("./frota.controller");

router.get(
  "/pagina-gerenciamento-frota",
  autenticar,
  verificarNivel(4),
  (req, res) => {
    res.render("pages/gestor/gerenciamento-frota.html", {
      user: req.session.user,
    });
  }
);

router.get(
  "/api/gestao-frota/veiculos",
  autenticar,
  verificarNivel(4),
  controller.listarVeiculos
);

router.get(
  "/api/gestao-frota/veiculos/:id",
  autenticar,
  verificarNivel(4),
  controller.obterVeiculoPorId
);

router.post(
  "/api/gestao-frota/veiculos",
  autenticar,
  verificarNivel(4),
  controller.criarVeiculo
);

router.put(
  "/api/gestao-frota/veiculos/:id",
  autenticar,
  verificarNivel(4),
  controller.atualizarVeiculo
);

router.delete(
  "/api/gestao-frota/veiculos/:id",
  autenticar,
  verificarNivel(5),
  controller.deletarVeiculo
);

module.exports = router;
