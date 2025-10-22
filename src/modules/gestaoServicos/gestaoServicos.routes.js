const express = require("express");
const path = require("path");
const fs = require("fs");
const { upload, promisePool } = require("../../init");
const { autenticar, verificarNivel } = require("../../auth");
const controller = require("./gestaoServicos.controller");
const { projectRootDir } = require("../../shared/path.helper");

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

router.post(
  "/api/servicos",
  autenticar,
  verificarNivel(4),
  upload.array("anexos", 5),
  controller.criarServico
);

router.get(
  "/api/servicos",
  autenticar,
  verificarNivel(2),
  controller.listarServicos
);

router.get(
  "/api/servicos/:id",
  autenticar,
  verificarNivel(2),
  controller.obterDetalhesServico
);

router.put(
  "/api/servicos/:id",
  autenticar,
  verificarNivel(4),
  upload.array("anexos", 5),
  controller.atualizarServico
);

router.post(
  "/api/servicos/:servicoId/upload-apr",
  autenticar,
  verificarNivel(3),
  upload.single("apr_file"),
  controller.anexarAPR
);

router.delete(
  "/api/servicos/:id",
  autenticar,
  verificarNivel(4),
  controller.deletarServico
);

router.post(
  "/api/servicos/:id/concluir",
  autenticar,
  verificarNivel(3),
  controller.concluirServico
);

router.post(
  "/api/servicos/:servicoId/upload-foto-conclusao",
  autenticar,
  verificarNivel(3),
  upload.single("foto_conclusao"),
  controller.uploadFotoConclusao
);

router.patch(
  "/api/servicos/:id/reativar",
  autenticar,
  verificarNivel(4),
  controller.reativarServico
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
  controller.deletarAnexo
);

router.get(
  "/api/servicos/contador",
  autenticar,
  verificarNivel(3),
  controller.contarServicos
);

router.get(
  "/api/encarregados",
  autenticar,
  verificarNivel(3),
  controller.listarEncarregados
);

router.get(
  "/api/subestacoes",
  autenticar,
  verificarNivel(3),
  controller.listarSubestacoes
);

router.patch(
  "/api/servicos/:id/responsavel",
  autenticar,
  verificarNivel(3),
  controller.atribuirResponsavel
);

router.get(
  "/api/servicos/:id/consolidar-pdfs",
  autenticar,
  verificarNivel(2),
  controller.gerarPdfConsolidado
);

router.post('/api/push/subscribe', autenticar, async (req, res) => {
  try {
    const { subscription } = req.body;
    const matricula = req.user.matricula;
    console.log(`DEBUG: [Backend] Rota /api/push/subscribe foi chamada pela matrícula: ${matricula}`);
    console.log("DEBUG: [Backend] Objeto de inscrição recebido do frontend:", subscription);
    if (!subscription || !subscription.endpoint) {
      console.error("DEBUG: [Backend] Objeto de inscrição inválido recebido.");
      return res.status(400).json({ success: false, message: 'Objeto de inscrição inválido.' });
    }
    const subscriptionString = JSON.stringify(subscription);
    console.log(`DEBUG: [Backend] Salvando a string de inscrição no banco de dados para a matrícula ${matricula}...`);
    await promisePool.query(
      'UPDATE users SET push_subscription = ? WHERE matricula = ?',
      [subscriptionString, matricula]
    );
    console.log(`DEBUG: [Backend] Inscrição salva com sucesso para a matrícula ${matricula}.`);
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("DEBUG: [Backend] Erro ao salvar a inscrição no banco de dados:", error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

module.exports = router;
