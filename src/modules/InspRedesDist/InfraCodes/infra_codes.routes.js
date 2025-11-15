const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const controller = require("./infra_codes.controller");

// Rota para a página de gerenciamento
// CORREÇÃO: Removido o prefixo '/inspecoes'
router.get(
  "/gerenciar-codigos",
  autenticar,
  verificarNivel(4),
  controller.renderizarPaginaGerenciamento
);

// --- API Endpoints para Tipos de Código (redes_code_types) ---
// CORREÇÃO: Removido o prefixo '/api/inspecoes' de todas as rotas da API

router.get(
  "/api/codigos/tipos",
  autenticar,
  verificarNivel(4),
  controller.handleListarTipos
);

router.post(
  "/api/codigos/tipos",
  autenticar,
  verificarNivel(4),
  controller.handleCriarTipo
);

router.put(
  "/api/codigos/tipos/:id",
  autenticar,
  verificarNivel(4),
  controller.handleAtualizarTipo
);

router.delete(
  "/api/codigos/tipos/:id",
  autenticar,
  verificarNivel(5),
  controller.handleDeletarTipo
);

// --- API Endpoints para Tags de Código (redes_code_tags) ---

router.get(
  "/api/codigos/tags",
  autenticar,
  verificarNivel(4),
  controller.handleListarTags
);

router.post(
  "/api/codigos/tags",
  autenticar,
  verificarNivel(4),
  controller.handleCriarTag
);

router.put(
  "/api/codigos/tags/:id",
  autenticar,
  verificarNivel(4),
  controller.handleAtualizarTag
);

router.delete(
  "/api/codigos/tags/:id",
  autenticar,
  verificarNivel(5),
  controller.handleDeletarTag
);

module.exports = router;
