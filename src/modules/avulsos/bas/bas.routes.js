const express = require("express");
const router = express.Router();
const { autenticar, verificarNivel, verificarNivelOuCargo } = require("../../../auth");
const { upload } = require("../../../infrastructure/uploads");
const controller = require("./bas.controller");

const acessoAvulsos = verificarNivelOuCargo(2, ["construcao", "construção"]);

router.post(
  "/api/bas/importar-dados-processos",
  autenticar,
  acessoAvulsos,
  upload.single("csvFile"),
  controller.importarDadosProcessos
);
router.get(
  "/api/bas/user-info",
  autenticar,
  acessoAvulsos,
  controller.obterInfoUsuario
);
router.get(
  "/api/bas/processos-construcao",
  autenticar,
  acessoAvulsos,
  controller.listarProcessosConstrucao
);
router.get(
  "/api/bas/processos-linhaviva",
  autenticar,
  acessoAvulsos,
  controller.listarProcessosLinhaViva
);
router.post(
  "/api/bas/salvar-bas-cadastro",
  autenticar,
  acessoAvulsos,
  controller.salvarCadastroBas
);
router.post(
  "/api/bas/gerar-relatorio-processos-txt",
  autenticar,
  acessoAvulsos,
  controller.gerarRelatorioTxt
);
router.post(
  "/api/bas/gerar-relatorio-processos-txt-linhaviva",
  autenticar,
  acessoAvulsos,
  controller.gerarRelatorioTxtLinhaViva
);

module.exports = router;
