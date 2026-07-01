const express = require("express");
const path = require("path");
const { promisePool } = require("../../infrastructure/database");
const { upload } = require("../../infrastructure/uploads");
const { autenticar, verificarNivel, verificarNivelOuCargo } = require("../../auth");
const {
  redirecionarConstrucaoRestrito,
  redirecionarTransporteRestrito,
  redirecionarCodRestrito,
  bloquearConstrucaoRestritoApi,
} = require("../../shared/perfilCargo.helper");
const {
  NIVEL_ADMIN_SERVICOS,
  NIVEL_ACESSO_MIN,
  ehCargoConstrucaoAcompanhamento,
} = require("./servicos.permissions");
const { projectRootDir, publicDir, publicPage, viewsDir, viewsPage } = require("../../shared/path.helper");
const { resolvePathWithinBase, sendSafeFile } = require("../../shared/pathSecurity.helper");
const {
  assertAcessoServicoGestao,
  extrairServicoIdDoIdentificador,
} = require("../../shared/accessControl.helper");
const coreController = require("./core/core.controller");
const anexoController = require("./anexo/anexo.controller");
const lifecycleController = require("./lifecycle/lifecycle.controller");
const queryController = require("./query/query.controller");
const relatorioController = require("./relatorio/relatorio.controller");

const router = express.Router();

router.get("/gestao-servicos", autenticar, verificarNivel(NIVEL_ACESSO_MIN), redirecionarConstrucaoRestrito, redirecionarCodRestrito, redirecionarTransporteRestrito, (req, res) => {
  res.sendFile(
    publicPage("servicos/gestao_servico.html"),
  );
});

router.get("/registro_servicos", autenticar, verificarNivel(NIVEL_ADMIN_SERVICOS), (req, res) => {
  res.sendFile(
    publicPage("servicos/registro_servicos.html"),
  );
});

router.get("/servicos_ativos", autenticar, verificarNivel(NIVEL_ACESSO_MIN), redirecionarConstrucaoRestrito, (req, res) => {
  res.sendFile(
    publicPage("servicos/servicos_ativos.html"),
  );
});

router.get(
  "/servicos_concluidos",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  redirecionarConstrucaoRestrito,
  (req, res) => {
    res.sendFile(
      publicPage("servicos/servicos_concluidos.html"),
    );
  },
);

router.get("/detalhes_servico", autenticar, verificarNivel(NIVEL_ACESSO_MIN), redirecionarConstrucaoRestrito, (req, res) => {
  res.sendFile(
    publicPage("servicos/detalhes_servico.html"),
  );
});

router.get(
  "/servicos_atribuidos",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  redirecionarConstrucaoRestrito,
  (req, res) => {
    res.sendFile(
      publicPage("servicos/servicos_atribuidos.html"),
    );
  },
);

router.get("/editar_servico", autenticar, verificarNivel(NIVEL_ADMIN_SERVICOS), (req, res) => {
  res.sendFile(
    publicPage("servicos/editar_servico.html"),
  );
});

router.get("/apr_formulario", autenticar, verificarNivel(NIVEL_ACESSO_MIN), redirecionarConstrucaoRestrito, (req, res) => {
  res.sendFile(publicPage("servicos/apr_formulario.html"));
});

router.get(
  "/acompanhamento_construcao",
  autenticar,
  verificarNivelOuCargo(NIVEL_ADMIN_SERVICOS, ["construcao", "construção"]),
  redirecionarCodRestrito,
  redirecionarTransporteRestrito,
  (req, res) => {
    res.sendFile(
      publicPage("servicos/servicos_construcao.html"),
    );
  },
);

router.post(
  "/api/servicos",
  autenticar,
  verificarNivel(NIVEL_ADMIN_SERVICOS),
  upload.array("anexos", 5),
  coreController.criarServico,
);

router.get(
  "/api/servicos",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  bloquearConstrucaoRestritoApi,
  coreController.listarServicos,
);

router.get(
  "/api/servicos/origem/:origem",
  autenticar,
  verificarNivelOuCargo(NIVEL_ADMIN_SERVICOS, ["construcao", "construção"]),
  (req, res, next) => {
    const origemOriginal = req.params.origem;
    const origemDecoded = decodeURIComponent(origemOriginal);
    req.params.origem = origemDecoded;

    const ehAdmin = (req.user?.nivel ?? 0) >= NIVEL_ADMIN_SERVICOS;
    const ehConstrucao = ehCargoConstrucaoAcompanhamento(req.user);
    const origemNormalizada = String(origemDecoded || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

    if (!ehAdmin) {
      if (!ehConstrucao) {
        return res.status(403).json({ message: "Acesso negado." });
      }
      if (origemNormalizada !== "construcao") {
        return res.status(403).json({
          message: "Acesso permitido apenas para origem Construção.",
        });
      }
    }

    next();
  },
  queryController.listarServicosPorOrigem,
);

router.get(
  "/api/servicos/:id",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  bloquearConstrucaoRestritoApi,
  coreController.obterDetalhesServico,
);

router.put(
  "/api/servicos/:id",
  autenticar,
  verificarNivel(NIVEL_ADMIN_SERVICOS),
  upload.array("anexos", 5),
  coreController.atualizarServico,
);

router.post(
  "/api/servicos/:servicoId/upload-apr",
  autenticar,
  verificarNivel(NIVEL_ADMIN_SERVICOS),
  upload.single("apr_file"),
  anexoController.anexarAPR,
);

router.delete(
  "/api/servicos/:id",
  autenticar,
  verificarNivel(NIVEL_ADMIN_SERVICOS),
  coreController.deletarServico,
);

router.post(
  "/api/servicos/:id/concluir",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  bloquearConstrucaoRestritoApi,
  lifecycleController.atualizarStatusParteServico,
);

router.post(
  "/api/servicos/:id/forcar-conclusao",
  autenticar,
  verificarNivel(NIVEL_ADMIN_SERVICOS),
  lifecycleController.forcarConclusaoServico,
);

router.post(
  "/api/servicos/:id/concluir-admin",
  autenticar,
  verificarNivel(NIVEL_ADMIN_SERVICOS),
  lifecycleController.concluirServicoAdministrativo,
);

router.post(
  "/api/servicos/:servicoId/upload-foto-conclusao",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  bloquearConstrucaoRestritoApi,
  upload.single("foto_conclusao"),
  anexoController.uploadFotoConclusao,
);

router.post(
  "/api/servicos/:servicoId/anexos-posteriores",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  bloquearConstrucaoRestritoApi,
  upload.array("anexos", 5),
  anexoController.anexarPosteriores,
);

router.patch(
  "/api/servicos/:id/reativar",
  autenticar,
  verificarNivel(NIVEL_ADMIN_SERVICOS),
  lifecycleController.reativarServico,
);

router.get(
  "/api/upload_arquivos/:identificador/:filename",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  bloquearConstrucaoRestritoApi,
  async (req, res) => {
    const { identificador, filename } = req.params;
    const servicoId = extrairServicoIdDoIdentificador(identificador);

    if (!servicoId) {
      return res.status(400).json({ success: false, message: "Identificador inválido." });
    }

    try {
      await assertAcessoServicoGestao(req.user, servicoId);
    } catch (error) {
      return res.status(error.statusCode || 403).json({
        success: false,
        message: error.message || "Acesso negado.",
      });
    }

    const baseDir = path.join(projectRootDir, "upload_arquivos");
    const filePath = resolvePathWithinBase(baseDir, identificador, filename);

    if (!filePath) {
      return res.status(400).json({ success: false, message: "Caminho inválido." });
    }

    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".pdf": "application/pdf",
      ".xls": "application/vnd.ms-excel",
      ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".csv": "text/csv",
    };
    res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
    if (req.query.download === "true") {
      res.setHeader("Content-Disposition", `attachment; filename="${path.basename(filename)}"`);
    }
    return sendSafeFile(res, filePath);
  }
);

router.delete(
  "/api/servicos/:servicoId/anexos/:anexoId",
  autenticar,
  verificarNivel(NIVEL_ADMIN_SERVICOS),
  anexoController.deletarAnexo,
);

router.get(
  "/api/servicos/contador",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  bloquearConstrucaoRestritoApi,
  queryController.contarServicos,
);

router.get(
  "/api/encarregados",
  autenticar,
  verificarNivel(NIVEL_ADMIN_SERVICOS),
  queryController.listarEncarregados,
);

router.get(
  "/api/subestacoes",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  bloquearConstrucaoRestritoApi,
  queryController.listarSubestacoes,
);

router.patch(
  "/api/servicos/:id/responsavel",
  autenticar,
  verificarNivel(NIVEL_ADMIN_SERVICOS),
  lifecycleController.atribuirResponsavel,
);

router.delete(
  "/api/servicos/:id/responsavel/:matricula",
  autenticar,
  verificarNivel(NIVEL_ADMIN_SERVICOS),
  lifecycleController.removerResponsavelUnico,
);

router.get(
  "/api/servicos/:id/consolidar-pdfs",
  autenticar,
  verificarNivel(NIVEL_ACESSO_MIN),
  bloquearConstrucaoRestritoApi,
  relatorioController.gerarPdfConsolidado,
);

router.post("/api/push/subscribe", autenticar, async (req, res) => {
  try {
    const { subscription } = req.body;
    const matricula = req.user.matricula;
    if (!subscription || !subscription.endpoint) {
      return res
        .status(400)
        .json({ success: false, message: "Objeto de inscrição inválido." });
    }
    const subscriptionString = JSON.stringify(subscription);
    await promisePool.query(
      "UPDATE users SET push_subscription = ? WHERE matricula = ?",
      [subscriptionString, matricula],
    );
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("Erro ao salvar a inscrição push:", error);
    res
      .status(500)
      .json({ success: false, message: "Erro interno do servidor." });
  }
});

module.exports = router;
