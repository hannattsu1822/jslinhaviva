// src/routes/subestacoes/servicos/itens/itens.routes.js

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

// Rota para concluir um item de serviço, agora corrigida para aceitar um formulário misto
router.put(
  "/api/servicos/itens/:itemEscopoId/concluir",
  autenticar,
  verificarNivel(3),
  upload.fields([{ name: "anexosConclusaoItem", maxCount: 5 }]),
  controller.concluirItem
);

module.exports = router;
