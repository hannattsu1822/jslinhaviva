const express = require("express");
const { autenticar } = require("../../auth");
const { publicPage } = require("../../shared/path.helper");
const {
  redirecionarCodRestrito,
  redirecionarTransporteRestrito,
} = require("../../shared/perfilCargo.helper");
const { podeAcessarModuloConstrucao } = require("./construcao.permissions");
const servicosController = require("./servicos/servicos.controller");

const router = express.Router();

function verificarAcessoModuloConstrucao(req, res, next) {
  if (podeAcessarModuloConstrucao(req.user)) {
    return next();
  }
  if (req.accepts("html")) {
    return res.redirect("/gestao-servicos");
  }
  return res.status(403).json({
    success: false,
    message: "Acesso negado ao módulo de acompanhamento de construção.",
  });
}

const middlewareModulo = [
  autenticar,
  verificarAcessoModuloConstrucao,
  redirecionarCodRestrito,
  redirecionarTransporteRestrito,
];

router.get("/acompanhamento_construcao", ...middlewareModulo, (req, res) => {
  res.sendFile(publicPage("servicos/servicos_construcao.html"));
});

router.get("/construcao/detalhes_servico", ...middlewareModulo, (req, res) => {
  res.sendFile(publicPage("construcao/detalhes_servico.html"));
});

router.get("/api/construcao/servicos/ativos", autenticar, verificarAcessoModuloConstrucao, servicosController.listarAtivos);
router.get("/api/construcao/servicos/concluidos", autenticar, verificarAcessoModuloConstrucao, servicosController.listarConcluidos);
router.get("/api/construcao/servicos/:id", autenticar, verificarAcessoModuloConstrucao, servicosController.obterDetalhes);
router.get("/api/construcao/servicos/:id/pdf", autenticar, verificarAcessoModuloConstrucao, servicosController.gerarPdf);

module.exports = router;
