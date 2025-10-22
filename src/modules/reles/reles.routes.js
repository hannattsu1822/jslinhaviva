const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../auth");
const controller = require("./reles.controller");

// Rotas de API
router.get("/api/reles", autenticar, verificarNivel(1), controller.listarReles);
router.get(
  "/api/reles/:id",
  autenticar,
  verificarNivel(1),
  controller.obterRelePorId
);
router.post("/api/reles", autenticar, verificarNivel(2), controller.criarRele);
router.put(
  "/api/reles/:id",
  autenticar,
  verificarNivel(2),
  controller.atualizarRele
);
router.delete(
  "/api/reles/:id",
  autenticar,
  verificarNivel(2),
  controller.deletarRele
);
router.get(
  "/api/reles/:id/leituras",
  autenticar,
  verificarNivel(1),
  controller.obterLeituras
);

// Rotas de Páginas
router.get("/gerenciar-reles", autenticar, verificarNivel(2), (req, res) => {
  res.render("pages/rele/gerenciar_reles.html", {
    pageTitle: "Gerenciamento de Relés",
    user: req.user,
  });
});

router.get("/visualizar-reles", autenticar, verificarNivel(1), (req, res) => {
  res.render("pages/rele/listar_reles.html", {
    pageTitle: "Selecionar Relé para Monitoramento",
    user: req.user,
  });
});

router.get(
  "/visualizar-reles/:id",
  autenticar,
  verificarNivel(1),
  controller.renderizarPaginaDetalhe
);

module.exports = router;
