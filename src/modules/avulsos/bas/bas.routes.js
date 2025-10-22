const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel } = require("../../../auth");
const { upload } = require("../../../init");
const controller = require("./bas.controller");

router.post(
  "/api/bas/importar-dados-processos",
  autenticar,
  verificarNivel(2),
  upload.single("csvFile"),
  controller.importarDadosProcessos
);
router.get(
  "/api/bas/user-info",
  autenticar,
  verificarNivel(2),
  controller.obterInfoUsuario
);
router.get(
  "/api/bas/processos-construcao",
  autenticar,
  verificarNivel(2),
  controller.listarProcessosConstrucao
);
router.get(
  "/api/bas/processos-linhaviva",
  autenticar,
  verificarNivel(2),
  controller.listarProcessosLinhaViva
);
router.post(
  "/api/bas/salvar-bas-cadastro",
  autenticar,
  verificarNivel(2),
  controller.salvarCadastroBas
);
router.post(
  "/api/bas/gerar-relatorio-processos-txt",
  autenticar,
  verificarNivel(2),
  controller.gerarRelatorioTxt
);
router.post(
  "/api/bas/gerar-relatorio-processos-txt-linhaviva",
  autenticar,
  verificarNivel(2),
  controller.gerarRelatorioTxtLinhaViva
);

module.exports = router;
