// src/modules/subestacoes/servicos/itens/itens.routes.js

const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../../auth");
const { upload } = require("../../../../init");
const controller = require("./itens.controller");

// Rota para atualizar os encarregados de múltiplos itens de um serviço
router.put(
  "/api/servicos/:servicoId/itens/encarregados",
  autenticar,
  verificarNivel(3),
  controller.atualizarEncarregados
);

// Rota para concluir um item de escopo específico, permitindo anexos
router.post(
  "/api/servicos/itens/:itemEscopoId/concluir",
  autenticar,
  verificarNivel(3),
  upload.array("anexosConclusaoItem", 5), // 'anexosConclusaoItem' é um nome de campo sugerido
  controller.concluirItem
);

module.exports = router;
