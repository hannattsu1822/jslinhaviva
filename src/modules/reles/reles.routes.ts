import express from "express";
import { autenticar, verificarNivel } from "../../auth";
import * as controller from "./reles.controller";

const router = express.Router();

router.get("/api/reles", autenticar, verificarNivel(1), controller.listarReles);
router.get("/api/reles/:id", autenticar, verificarNivel(1), controller.obterRelePorId);
router.post("/api/reles", autenticar, verificarNivel(2), controller.criarRele);
router.put("/api/reles/:id", autenticar, verificarNivel(2), controller.atualizarRele);
router.delete("/api/reles/:id", autenticar, verificarNivel(2), controller.deletarRele);
router.get(
  "/api/reles/:id/leituras",
  autenticar,
  verificarNivel(1),
  controller.obterLeituras
);

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

export default router;
