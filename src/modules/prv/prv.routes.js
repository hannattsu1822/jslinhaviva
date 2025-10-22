const express = require("express");
const router = express.Router();
const { autenticar } = require("../../auth");
const controller = require("./prv.controller");
const { projectRootDir } = require("../../shared/path.helper");
const path = require("path");

router.get("/prv", autenticar, (req, res) => {
  res.render("pages/prv/prv.html", {
    user: req.session.user,
  });
});

router.get("/api/prv/veiculos", autenticar, controller.listarVeiculos);
router.get("/api/prv/ultimo-km", autenticar, controller.obterUltimoKm);
router.get("/api/prv/status", autenticar, controller.obterStatusViagem);
router.get("/api/prv/registros", autenticar, controller.listarRegistros);
router.post("/api/prv/registros", autenticar, controller.iniciarViagem);
router.put("/api/prv/registros/:id", autenticar, controller.finalizarViagem);
router.delete("/api/prv/registros/:id", autenticar, controller.excluirRegistro);

module.exports = router;
