const express = require("express");
const path = require("path");
const fs = require("fs");
const { upload, promisePool } = require("../../init");
const { autenticar, verificarNivel, verificarCargo } = require("../../auth");
const { projectRootDir } = require("../../shared/path.helper");

const coreController = require("./core/core.controller");
const anexoController = require("./anexo/anexo.controller");
const lifecycleController = require("./lifecycle/lifecycle.controller");
const queryController = require("./query/query.controller");
const relatorioController = require("./relatorio/relatorio.controller");

const router = express.Router();

router.get("/gestao-servicos", autenticar, verificarNivel(2), (req, res) => {
  res.sendFile(
    path.join(projectRootDir, "public/pages/servicos/gestao_servico.html")
  );
});

router.get("/registro_servicos", autenticar, verificarNivel(4), (req, res) => {
  res.sendFile(
    path.join(projectRootDir, "public/pages/servicos/registro_servicos.html")
  );
});

router.get("/servicos_ativos", autenticar, verificarNivel(3), (req, res) => {
  res.sendFile(
    path.join(projectRootDir, "public/pages/servicos/servicos_ativos.html")
  );
});

router.get(
  "/servicos_concluidos",
  autenticar,
  verificarNivel(2),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/servicos/servicos_concluidos.html"
      )
    );
  }
);

router.get("/detalhes_servico", autenticar, verificarNivel(2), (req, res) => {
  res.sendFile(
    path.join(projectRootDir, "public/pages/servicos/detalhes_servico.html")
  );
});

router.get(
  "/servicos_atribuidos",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/servicos/servicos_atribuidos.html"
      )
    );
  }
);

router.get("/editar_servico", autenticar, verificarNivel(4), (req, res) => {
  res.sendFile(
    path.join(projectRootDir, "public/pages/servicos/editar_servico.html")
  );
});

router.get(
  "/acompanhamento_construcao",
  autenticar,
  verificarCargo(["Construção", "ADM", "ADMIN", "Engenheiro"]),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/servicos/servicos_construcao.html"
      )
    );
  }
);

router.post(
  "/api/servicos",
  autenticar,
  verificarNivel(4),
  upload.array("anexos", 5),
  coreController.criarServico
);

router.get(
  "/api/servicos",
  autenticar,
  verificarNivel(2),
  coreController.listarServicos
);

router.get(
  "/api/servicos/origem/:origem",
  autenticar,
  verificarCargo(["Construção", "ADM", "ADMIN", "Engenheiro"]),
  (req, res, next) => {
    const origemOriginal = req.params.origem;
    const origemDecoded = decodeURIComponent(origemOriginal);
    
    console.log(`[ROTA] Parâmetro recebido (raw): "${origemOriginal}"`);
    console.log(`[ROTA] Parâmetro decodificado: "${origemDecoded}"`);
    console.log(`[ROTA] Bytes do decodificado:`, Buffer.from(origemDecoded, 'utf8'));
    
    req.params.origem = origemDecoded;
    next();
  },
  queryController.listarServicosPorOrigem
);

router.get(
  "/api/servicos/:id",
  autenticar,
  verificarNivel(2),
  coreController.obterDetalhesServico
);

router.put(
  "/api/servicos/:id",
  autenticar,
  verificarNivel(4),
  upload.array("anexos", 5),
  coreController.atualizarServico
);

router.post(
  "/api/servicos/:servicoId/upload-apr",
  autenticar,
  verificarNivel(3),
  upload.single("apr_file"),
  anexoController.anexarAPR
);

router.delete(
  "/api/servicos/:id",
  autenticar,
  verificarNivel(4),
  coreController.deletarServico
);

router.post(
  "/api/servicos/:id/concluir",
  autenticar,
  verificarNivel(3),
  lifecycleController.atualizarStatusParteServico
);

router.post(
  "/api/servicos/:servicoId/upload-foto-conclusao",
  autenticar,
  verificarNivel(3),
  upload.single("foto_conclusao"),
  anexoController.uploadFotoConclusao
);

router.patch(
  "/api/servicos/:id/reativar",
  autenticar,
  verificarNivel(4),
  lifecycleController.reativarServico
);

router.get("/api/upload_arquivos/:identificador/:filename", (req, res) => {
  const { identificador, filename } = req.params;
  const filePath = path.join(
    projectRootDir,
    "upload_arquivos",
    identificador,
    filename
  );

  if (!fs.existsSync(filePath)) {
    return res
      .status(404)
      .json({ success: false, message: "Arquivo não encontrado" });
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
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  }

  fs.createReadStream(filePath).pipe(res);
});

router.delete(
  "/api/servicos/:servicoId/anexos/:anexoId",
  autenticar,
  verificarNivel(4),
  anexoController.deletarAnexo
);

router.get(
  "/api/servicos/contador",
  autenticar,
  verificarNivel(3),
  queryController.contarServicos
);

router.get(
  "/api/encarregados",
  autenticar,
  verificarNivel(3),
  queryController.listarEncarregados
);

router.get(
  "/api/subestacoes",
  autenticar,
  verificarNivel(3),
  queryController.listarSubestacoes
);

router.patch(
  "/api/servicos/:id/responsavel",
  autenticar,
  verificarNivel(3),
  lifecycleController.atribuirResponsavel
);

router.get(
  "/api/servicos/:id/consolidar-pdfs",
  autenticar,
  verificarNivel(2),
  relatorioController.gerarPdfConsolidado
);

router.post("/api/push/subscribe", autenticar, async (req, res) => {
  try {
    const { subscription } = req.body;
    const matricula = req.user.matricula;

    console.log(
      `DEBUG: [Backend] Rota /api/push/subscribe foi chamada pela matrícula: ${matricula}`
    );
    console.log(
      "DEBUG: [Backend] Objeto de inscrição recebido do frontend:",
      subscription
    );

    if (!subscription || !subscription.endpoint) {
      console.error("DEBUG: [Backend] Objeto de inscrição inválido recebido.");
      return res
        .status(400)
        .json({ success: false, message: "Objeto de inscrição inválido." });
    }

    const subscriptionString = JSON.stringify(subscription);
    console.log(
      `DEBUG: [Backend] Salvando a string de inscrição no banco de dados para a matrícula ${matricula}...`
    );

    await promisePool.query(
      "UPDATE users SET push_subscription = ? WHERE matricula = ?",
      [subscriptionString, matricula]
    );

    console.log(
      `DEBUG: [Backend] Inscrição salva com sucesso para a matrícula ${matricula}.`
    );

    res.status(201).json({ success: true });
  } catch (error) {
    console.error(
      "DEBUG: [Backend] Erro ao salvar a inscrição no banco de dados:",
      error
    );
    res
      .status(500)
      .json({ success: false, message: "Erro interno do servidor." });
  }
});

module.exports = router;
