const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../auth");
const controller = require("./prv.controller");
const { projectRootDir } = require("../../shared/path.helper");
const path = require("path");

router.get("/prv", autenticar, (req, res) => {
  res.render("pages/prv/prv.html", {
    user: req.session.user,
  });
});

router.get("/api/prv/veiculos", autenticar, verificarNivel(1), controller.listarVeiculos);
router.get(
  "/api/prv/motoristas",
  autenticar,
  verificarNivel(7),
  controller.listarMotoristas
);
router.get("/api/prv/ultimo-km", autenticar, verificarNivel(1), controller.obterUltimoKm);
router.get("/api/prv/status", autenticar, verificarNivel(1), controller.obterStatusViagem);
router.get("/api/prv/registros", autenticar, verificarNivel(1), controller.listarRegistros);
router.post("/api/prv/registros", autenticar, verificarNivel(1), controller.iniciarViagem);
router.put("/api/prv/registros/:id", autenticar, verificarNivel(1), controller.finalizarViagem);
router.delete("/api/prv/registros/:id", autenticar, verificarNivel(1), controller.excluirRegistro);

module.exports = router;
