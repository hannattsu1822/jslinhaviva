const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const { upload } = require("../../../init");
const controller = require("./servicos.controller");

// --- Rotas para renderização de páginas HTML ---

router.get(
  "/servicos",
  autenticar,
  verificarNivel(3),
  controller.renderizarPaginaListagem
);

router.get(
  "/servicos/concluidos",
  autenticar,
  verificarNivel(3),
  controller.renderizarPaginaConcluidos
);

router.get(
  "/servicos/novo",
  autenticar,
  verificarNivel(4),
  controller.renderizarPaginaCriacao
);

router.get(
  "/servicos/:id",
  autenticar,
  verificarNivel(3),
  controller.renderizarPaginaDetalhes
);

router.get(
  "/servicos/:id/coletar",
  autenticar,
  verificarNivel(3),
  controller.renderizarPaginaColeta
);

router.get(
  "/servicos/:id/relatorio",
  autenticar,
  verificarNivel(3),
  controller.handleGerarRelatorio
);

// --- Rotas da API para o CRUD de Serviços ---

router.get(
  "/api/servicos/lista",
  autenticar,
  verificarNivel(3),
  controller.handleListarServicos
);

router.get(
  "/api/servicos/concluidos",
  autenticar,
  verificarNivel(3),
  controller.handleListarServicosConcluidos
);

router.get(
  "/api/responsaveis",
  autenticar,
  verificarNivel(4),
  controller.handleObterResponsaveis
);

router.get(
  "/api/servicos/:id/dados",
  autenticar,
  verificarNivel(3),
  controller.handleObterDadosServico
);

router.post(
  "/api/servicos",
  autenticar,
  verificarNivel(4),
  upload.array("anexos_gerais", 10),
  controller.handleCriarServico
);

router.post(
  "/api/servicos/:id/anexos-gerais",
  autenticar,
  verificarNivel(3),
  upload.array("anexos_gerais", 10),
  controller.handleAdicionarAnexosGerais
);

router.post(
  "/api/servicos/:id/atribuir",
  autenticar,
  verificarNivel(4),
  controller.handleAtribuirResponsaveis
);

router.put(
  "/api/servicos/:id",
  autenticar,
  verificarNivel(4),
  controller.handleAtualizarServico
);

router.post(
  "/api/servicos/:id/finalizar",
  autenticar,
  verificarNivel(4),
  controller.handleFinalizarServico
);

router.post(
  "/api/servicos/:id/reativar",
  autenticar,
  verificarNivel(4),
  controller.handleReativarServico
);

router.delete(
  "/api/servicos/:id",
  autenticar,
  verificarNivel(5),
  controller.handleDeletarServico
);

// --- Rotas da API para Pontos e Anexos de Pontos ---

router.post(
  "/api/servicos/:id/pontos",
  autenticar,
  verificarNivel(3),
  controller.handleAdicionarPonto
);

router.post(
  "/api/servicos/:idServico/sync",
  autenticar,
  verificarNivel(3),
  controller.handleSincronizarPontos
);

router.get(
  "/api/pontos/:idPonto",
  autenticar,
  verificarNivel(3),
  controller.handleObterDadosPonto
);

router.put(
  "/api/pontos/:idPonto",
  autenticar,
  verificarNivel(3),
  controller.handleAtualizarPonto
);

router.delete(
  "/api/pontos/:idPonto",
  autenticar,
  verificarNivel(4),
  controller.handleDeletarPonto
);

router.post(
  "/api/servicos/:idServico/pontos/:idPonto/anexos",
  autenticar,
  verificarNivel(3),
  upload.array("anexos", 25),
  controller.handleAdicionarAnexos
);

router.delete(
  "/api/anexos/:idAnexo",
  autenticar,
  verificarNivel(4),
  controller.handleDeletarAnexo
);

module.exports = router;
