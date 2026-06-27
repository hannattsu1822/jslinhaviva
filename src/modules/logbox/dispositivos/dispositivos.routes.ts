import express from "express";
import { autenticar, verificarNivel } from "../../../auth";
import * as controller from "./dispositivos.controller";

const router = express.Router();

router.get(
  "/gerenciar-dispositivos",
  autenticar,
  verificarNivel(4),
  controller.renderizarPaginaGerenciamento
);
router.get(
  "/logbox-devices",
  autenticar,
  verificarNivel(4),
  controller.renderizarPaginaLista
);
router.get(
  "/api/dispositivos",
  autenticar,
  verificarNivel(4),
  controller.listarDispositivosApi
);
router.get(
  "/api/dispositivos/:id",
  autenticar,
  verificarNivel(4),
  controller.obterDispositivoPorId
);
router.post(
  "/api/dispositivos",
  autenticar,
  verificarNivel(4),
  controller.salvarDispositivo
);
router.delete(
  "/api/dispositivos/:id",
  autenticar,
  verificarNivel(4),
  controller.excluirDispositivo
);

export default router;
