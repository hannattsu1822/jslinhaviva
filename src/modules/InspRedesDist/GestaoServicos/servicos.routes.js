const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const { upload } = require("../../../infrastructure/uploads");
const {
  NIVEL_ADMIN_REDE,
  NIVEL_ACESSO_MIN,
} = require("../rede.permissions");
const controller = require("./servicos.controller");

router.get(
  "/servicos",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.renderizarPaginaListagem
);

router.get(
  "/servicos/concluidos",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.renderizarPaginaConcluidos
);

router.get(
  "/servicos/novo",
  autenticar,
  verificarNivel(NIVEL_ADMIN_REDE),
  controller.renderizarPaginaCriacao
);

router.get(
  "/servicos/:id",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.renderizarPaginaDetalhes
);

router.get(
  "/servicos/:id/coletar",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.renderizarPaginaColeta
);

router.get(
  "/servicos/:id/relatorio",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.handleGerarRelatorio
);

router.get(
  "/api/servicos/lista",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.handleListarServicos
);

router.get(
  "/api/servicos/concluidos",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.handleListarServicosConcluidos
);

router.get(
  "/api/responsaveis",
  autenticar,
  verificarNivel(NIVEL_ADMIN_REDE),
  controller.handleObterResponsaveis
);

router.get(
  "/api/servicos/:id/dados",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.handleObterDadosServico
);

router.post(
  "/api/servicos",
  autenticar,
  verificarNivel(NIVEL_ADMIN_REDE),
  upload.array("anexos_gerais", 10),
  controller.handleCriarServico
);

router.post(
  "/api/servicos/:id/anexos-gerais",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  upload.array("anexos_gerais", 10),
  controller.handleAdicionarAnexosGerais
);

router.post(
  "/api/servicos/:id/atribuir",
  autenticar,
  verificarNivel(NIVEL_ADMIN_REDE),
  controller.handleAtribuirResponsaveis
);

router.put(
  "/api/servicos/:id",
  autenticar,
  verificarNivel(NIVEL_ADMIN_REDE),
  controller.handleAtualizarServico
);

router.post(
  "/api/servicos/:id/finalizar",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.handleFinalizarServico
);

router.post(
  "/api/servicos/:id/reativar",
  autenticar,
  verificarNivel(NIVEL_ADMIN_REDE),
  controller.handleReativarServico
);

router.delete(
  "/api/servicos/:id",
  autenticar,
  verificarNivel(NIVEL_ADMIN_REDE),
  controller.handleDeletarServico
);

router.post(
  "/api/servicos/:id/pontos",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.handleAdicionarPonto
);

router.post(
  "/api/servicos/:idServico/sync",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.handleSincronizarPontos
);

router.get(
  "/api/pontos/:idPonto",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.handleObterDadosPonto
);

router.put(
  "/api/pontos/:idPonto",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.handleAtualizarPonto
);

router.delete(
  "/api/pontos/:idPonto",
  autenticar,
  verificarNivel(NIVEL_ADMIN_REDE),
  controller.handleDeletarPonto
);

router.post(
  "/api/servicos/:idServico/pontos/:idPonto/anexos",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  upload.array("anexos", 25),
  controller.handleAdicionarAnexos
);

router.delete(
  "/api/anexos/:idAnexo",
  autenticar,
  verificarNivel(NIVEL_ADMIN_REDE),
  controller.handleDeletarAnexo
);

module.exports = router;
