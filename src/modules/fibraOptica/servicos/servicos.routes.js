const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const { upload } = require("../../../init");
const controller = require("./servicos.controller");

router.get(
  "/registro_projeto_fibra",
  autenticar,
  verificarNivel(3),
  controller.obterResponsaveis
);
router.post(
  "/registro_projeto_fibra",
  autenticar,
  verificarNivel(4),
  upload.array("anexos", 10),
  controller.registrarProjeto
);
router.get(
  "/projetos_fibra_andamento",
  autenticar,
  verificarNivel(3),
  controller.listarProjetosAndamento
);
router.get(
  "/projetos_fibra_concluidos",
  autenticar,
  verificarNivel(3),
  controller.listarProjetosConcluidos
);
router.get(
  "/fibra/servico/:id",
  autenticar,
  verificarNivel(3),
  controller.obterDetalhesServico
);
router.get(
  "/fibra/servico/:id/editar",
  autenticar,
  verificarNivel(4),
  controller.obterDadosParaEdicao
);
router.post(
  "/fibra/servico/:id/editar",
  autenticar,
  verificarNivel(4),
  upload.array("anexos", 10),
  controller.editarServico
);
router.get(
  "/api/fibra/encarregados",
  autenticar,
  verificarNivel(3),
  controller.listarEncarregados
);
router.post(
  "/api/fibra/modificar-atribuicao",
  autenticar,
  verificarNivel(4),
  controller.modificarAtribuicao
);
router.post(
  "/api/fibra/finalizar-servico",
  autenticar,
  verificarNivel(3),
  upload.array("anexosConclusao", 10),
  controller.finalizarServico
);
router.post(
  "/api/fibra/reabrir-servico",
  autenticar,
  verificarNivel(4),
  controller.reabrirServico
);
router.post(
  "/api/fibra/upload-apr",
  autenticar,
  verificarNivel(3),
  upload.array("anexosAPR", 5),
  controller.anexarAPR
);
router.delete(
  "/api/fibra/servico/:id",
  autenticar,
  verificarNivel(5),
  controller.excluirServico
);
router.get(
  "/api/fibra/servico/:id/aprs",
  autenticar,
  verificarNivel(3),
  controller.obterAnexosAPR
);
router.delete(
  "/api/fibra/anexo-apr/:id",
  autenticar,
  verificarNivel(4),
  controller.excluirAnexoAPR
);

module.exports = router;
