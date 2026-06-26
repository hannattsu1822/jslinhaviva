const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const { upload } = require("../../../infrastructure/uploads");
const {
  NIVEL_ADMIN,
  NIVEL_ACESSO_MIN,
} = require("../fibra.permissions");
const controller = require("./servicos.controller");

router.get(
  "/registro_projeto_fibra",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  controller.obterResponsaveis
);
router.post(
  "/registro_projeto_fibra",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  upload.array("anexos", 10),
  controller.registrarProjeto
);
router.get(
  "/projetos_fibra_andamento",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.listarProjetosAndamento
);
router.get(
  "/projetos_fibra_concluidos",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.listarProjetosConcluidos
);
router.get(
  "/fibra/servico/:id",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.obterDetalhesServico
);
router.get(
  "/fibra/servico/:id/editar",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  controller.obterDadosParaEdicao
);
router.post(
  "/fibra/servico/:id/editar",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  upload.array("anexos", 10),
  controller.editarServico
);
router.get(
  "/api/fibra/encarregados",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  controller.listarEncarregados
);
router.post(
  "/api/fibra/modificar-atribuicao",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  controller.modificarAtribuicao
);
router.post(
  "/api/fibra/finalizar-servico",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  upload.array("anexosConclusao", 10),
  controller.finalizarServico
);
router.post(
  "/api/fibra/reabrir-servico",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  controller.reabrirServico
);
router.post(
  "/api/fibra/upload-apr",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  upload.array("anexosAPR", 5),
  controller.anexarAPR
);
router.delete(
  "/api/fibra/servico/:id",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  controller.excluirServico
);
router.get(
  "/api/fibra/servico/:id/aprs",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  controller.obterAnexosAPR
);
router.delete(
  "/api/fibra/anexo-apr/:id",
  autenticar,
  verificarNivel(NIVEL_ADMIN),
  controller.excluirAnexoAPR
);

module.exports = router;
