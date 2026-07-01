const express = require("express");
const router = express.Router();
const { autenticar, verificarNivelOuCargo } = require("../../../auth");
const { upload } = require("../../../infrastructure/uploads");
const controller = require("./bas.controller");

router.post(
  "/api/bas/importar-dados-processos",
  autenticar,
  verificarNivelOuCargo(2, ["construcao", "construção"]),
  upload.single("csvFile"),
  controller.importarDadosProcessos
);
router.get(
  "/api/bas/user-info",
  autenticar,
  verificarNivelOuCargo(2, ["construcao", "construção"]),
  controller.obterInfoUsuario
);
router.get(
  "/api/bas/processos-construcao",
  autenticar,
  verificarNivelOuCargo(2, ["construcao", "construção"]),
  controller.listarProcessosConstrucao
);
router.get(
  "/api/bas/processos-linhaviva",
  autenticar,
  verificarNivelOuCargo(2, ["construcao", "construção"]),
  controller.listarProcessosLinhaViva
);
router.post(
  "/api/bas/salvar-bas-cadastro",
  autenticar,
  verificarNivelOuCargo(2, ["construcao", "construção"]),
  controller.salvarCadastroBas
);
router.post(
  "/api/bas/gerar-relatorio-processos-txt",
  autenticar,
  verificarNivelOuCargo(2, ["construcao", "construção"]),
  controller.gerarRelatorioTxt
);
router.post(
  "/api/bas/gerar-relatorio-processos-txt-linhaviva",
  autenticar,
  verificarNivelOuCargo(2, ["construcao", "construção"]),
  controller.gerarRelatorioTxtLinhaViva
);

module.exports = router;
