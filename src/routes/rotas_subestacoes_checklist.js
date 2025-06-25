const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs").promises;
const {
  promisePool,
  upload,
  projectRootDir,
  uploadsSubestacoesDir,
} = require("../init");
const { autenticar, registrarAuditoria } = require("../auth");
const PdfPrinter = require("pdfmake");

async function imagePathToBase64(relativeServerPath) {
  if (!relativeServerPath) return null;
  try {
    const cleanRelativePath = relativeServerPath.replace(
      /^\/upload_arquivos_subestacoes\//,
      ""
    );
    const absolutePath = path.join(uploadsSubestacoesDir, cleanRelativePath);
    const img = await fs.readFile(absolutePath);
    let mimeType = "image/jpeg";
    const ext = path.extname(absolutePath).toLowerCase();
    if (ext === ".png") mimeType = "image/png";
    else if (ext === ".gif") mimeType = "image/gif";
    return `data:${mimeType};base64,` + Buffer.from(img).toString("base64");
  } catch (error) {
    console.warn(
      `Erro ao ler imagem para PDF ${relativeServerPath}:`,
      error.message
    );
    return null;
  }
}

const podeRealizarInspecao = (req, res, next) => {
  const cargosPermitidos = [
    "ADMIN",
    "Engenheiro",
    "Técnico",
    "Inspetor",
    "Encarregado",
    "Estagiário",
  ];
  if (req.user && cargosPermitidos.includes(req.user.cargo)) next();
  else res.status(403).json({ message: "Acesso negado." });
};

const podeGerenciarPaginaInspecoes = (req, res, next) => {
  const cargosPermitidos = [
    "ADMIN",
    "Engenheiro",
    "Técnico",
    "Inspetor",
    "Gerente",
    "Encarregado",
    "Estagiário",
  ];
  if (req.user && cargosPermitidos.includes(req.user.cargo)) next();
  else res.status(403).json({ message: "Acesso negado." });
};

async function verificarInspecaoExiste(req, res, next) {
  const idParaVerificar = req.params.inspecaoId || req.params.id;
  if (isNaN(parseInt(idParaVerificar, 10)))
    return res
      .status(400)
      .json({ message: `ID da inspeção inválido: ${idParaVerificar}` });
  try {
    const [inspecao] = await promisePool.query(
      "SELECT id, formulario_inspecao_num FROM inspecoes_subestacoes WHERE id = ?",
      [idParaVerificar]
    );
    if (inspecao.length === 0)
      return res.status(404).json({
        message: `Inspeção com ID ${idParaVerificar} não encontrada.`,
      });
    req.inspecao = inspecao[0];
    req.inspecaoId = parseInt(idParaVerificar, 10);
    next();
  } catch (error) {
    console.error("Erro ao verificar inspeção:", error);
    res.status(500).json({ message: "Erro interno ao verificar inspeção." });
  }
}

async function limparArquivosTemporariosUpload(files) {
  if (files && files.length > 0) {
    for (const file of files) {
      if (file.path) {
        try {
          await fs.access(file.path);
          await fs.unlink(file.path);
        } catch (e) {}
      }
    }
  }
}

router.get(
  "/pagina-checklist-inspecao-subestacao",
  autenticar,
  podeRealizarInspecao,
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/inspecoes-checklist-subestacoes.html"
      )
    );
  }
);

router.get(
  "/pagina-listagem-inspecoes-subestacoes",
  autenticar,
  podeGerenciarPaginaInspecoes,
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/listagem-inspecoes.html"
      )
    );
  }
);

router.post(
  "/inspecoes-subestacoes",
  autenticar,
  podeRealizarInspecao,
  upload.any(),
  async (req, res) => {
    const {
      subestacao_id,
      responsavel_levantamento_id,
      tipo_inspecao,
      data_avaliacao,
      hora_inicial,
      hora_final,
      status_inspecao,
      observacoes_gerais,
    } = req.body;
    const filesGrouped = {
      generalAttachments: [],
      itemPhotos: {},
      measurementPhotos: {},
      equipmentObservedPhotos: {},
    };
    const MAX_FOTOS_ITEM = 10,
      MAX_FOTOS_MED = 5,
      MAX_FOTOS_EQUIP = 5,
      MAX_ANEXOS_GERAIS = 10;

    if (req.files?.length) {
      req.files.forEach((file) => {
        if (file.fieldname === "anexosInspecao") {
          if (filesGrouped.generalAttachments.length < MAX_ANEXOS_GERAIS)
            filesGrouped.generalAttachments.push(file);
          else
            try {
              fs.unlink(file.path).catch(() => {});
            } catch (e) {}
        } else if (file.fieldname.startsWith("foto_item_")) {
          const iN = file.fieldname.split("_")[2];
          if (!filesGrouped.itemPhotos[iN]) filesGrouped.itemPhotos[iN] = [];
          if (filesGrouped.itemPhotos[iN].length < MAX_FOTOS_ITEM)
            filesGrouped.itemPhotos[iN].push(file);
          else
            try {
              fs.unlink(file.path).catch(() => {});
            } catch (e) {}
        } else if (file.fieldname.startsWith("foto_medicao_")) {
          const mOI = file.fieldname.substring("foto_medicao_".length);
          if (!filesGrouped.measurementPhotos[mOI])
            filesGrouped.measurementPhotos[mOI] = [];
          if (filesGrouped.measurementPhotos[mOI].length < MAX_FOTOS_MED)
            filesGrouped.measurementPhotos[mOI].push(file);
          else
            try {
              fs.unlink(file.path).catch(() => {});
            } catch (e) {}
        } else if (file.fieldname.startsWith("foto_equip_obs_")) {
          const eOI = file.fieldname.substring("foto_equip_obs_".length);
          if (!filesGrouped.equipmentObservedPhotos[eOI])
            filesGrouped.equipmentObservedPhotos[eOI] = [];
          if (
            filesGrouped.equipmentObservedPhotos[eOI].length < MAX_FOTOS_EQUIP
          )
            filesGrouped.equipmentObservedPhotos[eOI].push(file);
          else
            try {
              fs.unlink(file.path).catch(() => {});
            } catch (e) {}
        } else {
          try {
            fs.unlink(file.path).catch(() => {});
          } catch (e) {}
        }
      });
    }
    let itensDoChecklist,
      medicoesDinamicasJson,
      equipamentosObservadosJson,
      verificacoesAdicionaisJson;
    try {
      if (req.body.itens && typeof req.body.itens === "string")
        itensDoChecklist = JSON.parse(req.body.itens);
      else throw new Error("Itens do checklist ausentes ou malformados.");
      medicoesDinamicasJson = req.body.medicoes
        ? JSON.parse(req.body.medicoes)
        : [];
      equipamentosObservadosJson = req.body.equipamentos_observados
        ? JSON.parse(req.body.equipamentos_observados)
        : [];
      verificacoesAdicionaisJson = req.body.verificacoes_adicionais
        ? JSON.parse(req.body.verificacoes_adicionais)
        : [];
    } catch (e) {
      await limparArquivosTemporariosUpload(req.files);
      return res.status(400).json({
        message: "Formato inválido para dados do formulário.",
        detalhes: e.message,
      });
    }

    if (
      !subestacao_id ||
      !responsavel_levantamento_id ||
      !tipo_inspecao ||
      !data_avaliacao ||
      !hora_inicial ||
      !itensDoChecklist ||
      !Array.isArray(itensDoChecklist) ||
      itensDoChecklist.length === 0
    ) {
      await limparArquivosTemporariosUpload(req.files);
      return res.status(400).json({
        message: "Campos obrigatórios e itens do checklist são necessários.",
      });
    }
    for (const item of itensDoChecklist) {
      if (
        item.item_num == null ||
        !item.grupo_item ||
        !item.descricao_item_original ||
        !item.avaliacao
      ) {
        await limparArquivosTemporariosUpload(req.files);
        return res.status(400).json({
          message: `Dados incompletos para item: ${JSON.stringify(item)}`,
        });
      }
      if (!["N", "A", "NA"].includes(item.avaliacao)) {
        await limparArquivosTemporariosUpload(req.files);
        return res.status(400).json({
          message: `Avaliação inválida ('${item.avaliacao}') item ${item.item_num}.`,
        });
      }
      if (
        item.avaliacao === "A" &&
        (!filesGrouped.itemPhotos[item.item_num] ||
          filesGrouped.itemPhotos[item.item_num].length === 0)
      ) {
        await limparArquivosTemporariosUpload(req.files);
        return res.status(400).json({
          message: `Item ${item.item_num} (${item.descricao_item_original}) Anormal requer foto.`,
        });
      }
    }
    for (const med of medicoesDinamicasJson) {
      if (!med.tipo_medicao || !med.valor_medido) {
        await limparArquivosTemporariosUpload(req.files);
        return res.status(400).json({
          message: `Medição (idx ${med.originalDataId}), Tipo e Valor obrigatórios.`,
        });
      }
    }
    for (const equip of equipamentosObservadosJson) {
      if (!equip.tipo_equipamento) {
        await limparArquivosTemporariosUpload(req.files);
        return res.status(400).json({
          message: `Equipamento observado (idx ${equip.originalDataId}), Tipo obrigatório.`,
        });
      }
    }
    for (const verif of verificacoesAdicionaisJson) {
      if (!verif.item_verificado || !verif.estado_item) {
        await limparArquivosTemporariosUpload(req.files);
        return res.status(400).json({
          message: `Ponto de verificação, Item e Estado obrigatórios.`,
        });
      }
    }

    const connection = await promisePool.getConnection();
    let novaInspecaoId;
    let arquivosMovidosComSucessoParaRollback = [];
    try {
      await connection.beginTransaction();
      const [rI] = await connection.query(
        `INSERT INTO inspecoes_subestacoes (subestacao_id, responsavel_levantamento_id, tipo_inspecao, data_avaliacao, hora_inicial, hora_final, status_inspecao, observacoes_gerais, formulario_inspecao_num) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          subestacao_id,
          responsavel_levantamento_id,
          tipo_inspecao,
          data_avaliacao,
          hora_inicial,
          hora_final || null,
          status_inspecao || "EM_ANDAMENTO",
          observacoes_gerais || null,
          null,
        ]
      );
      novaInspecaoId = rI.insertId;
      await connection.query(
        "UPDATE inspecoes_subestacoes SET formulario_inspecao_num = ? WHERE id = ?",
        [String(novaInspecaoId), novaInspecaoId]
      );

      const iPI = itensDoChecklist.map((i) => [
        novaInspecaoId,
        i.item_num,
        i.grupo_item,
        i.descricao_item_original,
        i.avaliacao,
        i.observacao_item || null,
      ]);
      if (iPI.length > 0)
        await connection.query(
          `INSERT INTO inspecoes_subestacoes_itens (inspecao_id,item_num,grupo_item,descricao_item_original,avaliacao,observacao_item) VALUES ?`,
          [iPI]
        );

      const iUD = path.join(
        uploadsSubestacoesDir,
        "checklist",
        `checklist_${String(novaInspecaoId)}`
      );
      await fs.mkdir(iUD, { recursive: true });
      const mFUD = path.join(iUD, "medicoes_fotos");
      await fs.mkdir(mFUD, { recursive: true });
      const eOFUD = path.join(iUD, "equipamentos_observados_fotos");
      await fs.mkdir(eOFUD, { recursive: true });

      for (const medJson of medicoesDinamicasJson) {
        let vN = null,
          vT = medJson.valor_medido;
        if (
          [
            "TEMPERATURA_TRAFO",
            "TEMPERATURA_OLEO",
            "TEMPERATURA_ENROLAMENTO",
            "BATERIA_MONITOR",
          ].includes(medJson.tipo_medicao) &&
          !isNaN(parseFloat(medJson.valor_medido))
        )
          vN = parseFloat(medJson.valor_medido);
        else if (
          medJson.tipo_medicao === "CONTADOR_RELIGADOR" &&
          !isNaN(parseInt(medJson.valor_medido))
        )
          vN = parseInt(medJson.valor_medido);
        const [rM] = await connection.query(
          `INSERT INTO inspecoes_subestacoes_medicoes (inspecao_id,tipo_medicao,tag_equipamento,valor_medido_numerico,valor_medido_texto,unidade_medida,observacao) VALUES (?,?,?,?,?,?,?)`,
          [
            novaInspecaoId,
            medJson.tipo_medicao,
            medJson.tag_equipamento || null,
            vN,
            vT,
            medJson.unidade_medida || null,
            medJson.observacao || null,
          ]
        );
        const nMID = rM.insertId;
        const fPEM =
          filesGrouped.measurementPhotos[medJson.originalDataId] || [];
        for (const fF of fPEM) {
          const nUFM = `${Date.now()}_MEDFOTO_${nMID}_${fF.originalname.replace(
            /[^a-zA-Z0-9.\-_]/g,
            "_"
          )}`;
          const cDFM = path.join(mFUD, nUFM);
          await fs.rename(fF.path, cDFM);
          arquivosMovidosComSucessoParaRollback.push(cDFM);
          const cFRSp = `checklist/checklist_${novaInspecaoId}/medicoes_fotos/${nUFM}`;
          await connection.query(
            `INSERT INTO inspecoes_subestacoes_medicoes_anexos (medicao_id,nome_original,caminho_servidor,tipo_mime,tamanho) VALUES (?,?,?,?,?)`,
            [
              nMID,
              fF.originalname,
              `/upload_arquivos_subestacoes/${cFRSp}`,
              fF.mimetype,
              fF.size,
            ]
          );
        }
      }
      for (const equipJson of equipamentosObservadosJson) {
        const [rEO] = await connection.query(
          `INSERT INTO inspecoes_equipamentos_observados (inspecao_id,tipo_equipamento,tag_equipamento,observacao) VALUES (?,?,?,?)`,
          [
            novaInspecaoId,
            equipJson.tipo_equipamento,
            equipJson.tag_equipamento || null,
            equipJson.observacao || null,
          ]
        );
        const nEOID = rEO.insertId;
        const fPEE =
          filesGrouped.equipmentObservedPhotos[equipJson.originalDataId] || [];
        for (const fF of fPEE) {
          const nUFEO = `${Date.now()}_EQUIPFOTO_${nEOID}_${fF.originalname.replace(
            /[^a-zA-Z0-9.\-_]/g,
            "_"
          )}`;
          const cDFEO = path.join(eOFUD, nUFEO);
          await fs.rename(fF.path, cDFEO);
          arquivosMovidosComSucessoParaRollback.push(cDFEO);
          const cFREOp = `checklist/checklist_${novaInspecaoId}/equipamentos_observados_fotos/${nUFEO}`;
          await connection.query(
            `INSERT INTO inspecoes_equipamentos_observados_anexos (equipamento_observado_id,nome_original,caminho_servidor,tipo_mime,tamanho) VALUES (?,?,?,?,?)`,
            [
              nEOID,
              fF.originalname,
              `/upload_arquivos_subestacoes/${cFREOp}`,
              fF.mimetype,
              fF.size,
            ]
          );
        }
      }
      for (const verifJson of verificacoesAdicionaisJson) {
        await connection.query(
          `INSERT INTO inspecoes_itens_verificacao_adicional (inspecao_id,item_verificado,estado_item,num_formulario_referencia,detalhes_observacao) VALUES (?,?,?,?,?)`,
          [
            novaInspecaoId,
            verifJson.item_verificado,
            verifJson.estado_item,
            verifJson.num_formulario_referencia || null,
            verifJson.detalhes_observacao || null,
          ]
        );
      }
      let aSI = [];
      for (const f of filesGrouped.generalAttachments) {
        const nUA = `${Date.now()}_GA_${f.originalname.replace(
          /[^a-zA-Z0-9.\-_]/g,
          "_"
        )}`;
        const cD = path.join(iUD, nUA);
        const cRS = `checklist/checklist_${novaInspecaoId}/${nUA}`;
        await fs.rename(f.path, cD);
        arquivosMovidosComSucessoParaRollback.push(cD);
        const [rA] = await connection.query(
          `INSERT INTO inspecoes_subestacoes_anexos (inspecao_id,nome_original,caminho_servidor,tipo_mime,tamanho,categoria_anexo,descricao_anexo,item_num_associado) VALUES (?,?,?,?,?,?,?,?)`,
          [
            novaInspecaoId,
            f.originalname,
            `/upload_arquivos_subestacoes/${cRS}`,
            f.mimetype,
            f.size,
            "FOTO_EVIDENCIA_GERAL",
            req.body.descricao_anexo_geral || null,
            null,
          ]
        );
        aSI.push({
          id: rA.insertId,
          nome_original: f.originalname,
          caminho_servidor: `/upload_arquivos_subestacoes/${cRS}`,
          type: "general",
        });
      }
      for (const iNK in filesGrouped.itemPhotos) {
        const fDI = filesGrouped.itemPhotos[iNK];
        for (const f of fDI) {
          const nUAF = `${Date.now()}_ITEM${iNK}_${f.originalname.replace(
            /[^a-zA-Z0-9.\-_]/g,
            "_"
          )}`;
          const cDF = path.join(iUD, nUAF);
          const cRFS = `checklist/checklist_${novaInspecaoId}/${nUAF}`;
          await fs.rename(f.path, cDF);
          arquivosMovidosComSucessoParaRollback.push(cDF);
          const [rAI] = await connection.query(
            `INSERT INTO inspecoes_subestacoes_anexos (inspecao_id,nome_original,caminho_servidor,tipo_mime,tamanho,categoria_anexo,item_num_associado) VALUES (?,?,?,?,?,?,?)`,
            [
              novaInspecaoId,
              f.originalname,
              `/upload_arquivos_subestacoes/${cRFS}`,
              f.mimetype,
              f.size,
              "FOTO_EVIDENCIA_ITEM",
              parseInt(iNK),
            ]
          );
          aSI.push({
            id: rAI.insertId,
            item_num: parseInt(iNK),
            nome_original: f.originalname,
            caminho_servidor: `/upload_arquivos_subestacoes/${cRFS}`,
            type: "item_specific",
          });
        }
      }
      await connection.commit();
      if (req.user?.matricula)
        await registrarAuditoria(
          req.user.matricula,
          "CREATE_INSPECAO_SUBESTACAO",
          `Inspeção ID ${novaInspecaoId} para subestação ID ${subestacao_id} criada.`,
          connection
        );
      res.status(201).json({
        id: novaInspecaoId,
        formulario_inspecao_num: String(novaInspecaoId),
        message: "Inspeção registrada!",
        anexos: aSI,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao registrar inspeção:", error);
      for (const c of arquivosMovidosComSucessoParaRollback) {
        try {
          await fs.unlink(c);
        } catch (e) {}
      }
      await limparArquivosTemporariosUpload(req.files);
      if (error.code === "ER_DUP_ENTRY")
        return res.status(409).json({
          message: "Erro: Dados duplicados.",
          detalhes: error.message,
        });
      res.status(500).json({
        message: "Erro interno ao registrar.",
        detalhes: error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.post(
  "/inspecoes-subestacoes/:inspecaoId/anexos-escritorio",
  autenticar,
  podeGerenciarPaginaInspecoes,
  verificarInspecaoExiste,
  upload.array("anexosEscritorio", 5),
  async (req, res) => {
    const { inspecaoId } = req;
    const arquivos = req.files;
    if (!arquivos?.length)
      return res.status(400).json({ message: "Nenhum arquivo enviado." });
    const connection = await promisePool.getConnection();
    let arquivosMovidosComSucesso = [];
    try {
      await connection.beginTransaction();
      const iEUD = path.join(
        uploadsSubestacoesDir,
        "inspecoes_escritorio",
        `inspecao_escritorio_${String(inspecaoId)}`
      );
      await fs.mkdir(iEUD, { recursive: true });
      let aSI = [];
      for (const f of arquivos) {
        const nUA = `${Date.now()}_ESCRITORIO_${f.originalname.replace(
          /[^a-zA-Z0-9.\-_]/g,
          "_"
        )}`;
        const cD = path.join(iEUD, nUA);
        const cRS = `inspecoes_escritorio/inspecao_escritorio_${inspecaoId}/${nUA}`;
        await fs.rename(f.path, cD);
        arquivosMovidosComSucesso.push(cD);
        const cAF = "DOCUMENTO_ESCRITORIO";
        const dAF = req.body.descricao_anexo_escritorio || null;
        const [rA] = await connection.query(
          `INSERT INTO inspecoes_subestacoes_anexos (inspecao_id,nome_original,caminho_servidor,tipo_mime,tamanho,categoria_anexo,descricao_anexo,item_num_associado) VALUES (?,?,?,?,?,?,?,?)`,
          [
            inspecaoId,
            f.originalname,
            `/upload_arquivos_subestacoes/${cRS}`,
            f.mimetype,
            f.size,
            cAF,
            dAF,
            null,
          ]
        );
        aSI.push({
          id: rA.insertId,
          nome_original: f.originalname,
          caminho_servidor: `/upload_arquivos_subestacoes/${cRS}`,
        });
      }
      await connection.commit();
      if (req.user?.matricula)
        await registrarAuditoria(
          req.user.matricula,
          "UPLOAD_ANEXO_ESCRITORIO_INSPECAO",
          `Anexos escritório adicionados à Inspeção ID ${inspecaoId}. Arquivos: ${aSI
            .map((a) => a.nome_original)
            .join(", ")}`,
          connection
        );
      res
        .status(201)
        .json({ message: "Anexos de escritório salvos!", anexos: aSI });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao salvar anexos de escritório:", error);
      for (const c of arquivosMovidosComSucesso) {
        try {
          await fs.unlink(c);
        } catch (e) {}
      }
      await limparArquivosTemporariosUpload(req.files);
      res.status(500).json({
        message: "Erro interno ao salvar anexos escritório.",
        detalhes: error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.get(
  "/inspecoes-subestacoes",
  autenticar,
  podeGerenciarPaginaInspecoes,
  async (req, res) => {
    try {
      let q = ` SELECT i.id, i.formulario_inspecao_num, DATE_FORMAT(i.data_avaliacao, '%Y-%m-%d') as data_avaliacao, i.hora_inicial, i.hora_final, i.status_inspecao, s.sigla as subestacao_sigla, s.nome as subestacao_nome, u.nome as responsavel_nome FROM inspecoes_subestacoes i JOIN subestacoes s ON i.subestacao_id = s.Id JOIN users u ON i.responsavel_levantamento_id = u.id WHERE 1=1 `;
      const p = [];
      if (req.query.subestacao_id) {
        q += " AND i.subestacao_id = ?";
        p.push(req.query.subestacao_id);
      }
      if (req.query.status_inspecao) {
        q += " AND i.status_inspecao = ?";
        p.push(req.query.status_inspecao);
      }
      if (req.query.responsavel_id) {
        q += " AND i.responsavel_levantamento_id = ?";
        p.push(req.query.responsavel_id);
      }
      if (req.query.data_avaliacao_de) {
        q += " AND i.data_avaliacao >= ?";
        p.push(req.query.data_avaliacao_de);
      }
      if (req.query.data_avaliacao_ate) {
        q += " AND i.data_avaliacao <= ?";
        p.push(req.query.data_avaliacao_ate);
      }
      q += " ORDER BY i.data_avaliacao DESC, i.id DESC";
      const [rows] = await promisePool.query(q, p);
      res.json(rows);
    } catch (error) {
      console.error("Erro interno ao listar inspeções:", error);
      res.status(500).json({
        message: "Erro ao listar inspeções.",
        detalhes: error.message,
      });
    }
  }
);

router.get(
  "/inspecoes-subestacoes/:id",
  autenticar,
  podeGerenciarPaginaInspecoes,
  async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id, 10)))
      return res
        .status(400)
        .json({ message: `ID da inspeção inválido: ${id}` });
    try {
      const [iHR] = await promisePool.query(
        `SELECT i.id, i.subestacao_id, i.formulario_inspecao_num, i.responsavel_levantamento_id, DATE_FORMAT(i.data_avaliacao, '%d/%m/%Y') as data_avaliacao_fmt, i.data_avaliacao, i.hora_inicial, i.hora_final, i.status_inspecao, i.observacoes_gerais, s.sigla as subestacao_sigla, s.nome as subestacao_nome, u.nome as responsavel_nome FROM inspecoes_subestacoes i JOIN subestacoes s ON i.subestacao_id = s.Id JOIN users u ON i.responsavel_levantamento_id = u.id WHERE i.id = ?`,
        [id]
      );
      if (iHR.length === 0)
        return res
          .status(404)
          .json({ message: `Inspeção ID ${id} não encontrada.` });
      const iH = iHR[0];
      const [iIR] = await promisePool.query(
        `SELECT id, item_num, grupo_item, descricao_item_original, avaliacao, observacao_item FROM inspecoes_subestacoes_itens WHERE inspecao_id = ? ORDER BY item_num ASC`,
        [id]
      );
      const [aIR] = await promisePool.query(
        `SELECT id as anexo_id, item_num_associado, caminho_servidor, nome_original FROM inspecoes_subestacoes_anexos WHERE inspecao_id = ? AND item_num_associado IS NOT NULL AND categoria_anexo = 'FOTO_EVIDENCIA_ITEM'`,
        [id]
      );
      const aPI = {};
      aIR.forEach((a) => {
        if (!aPI[a.item_num_associado]) aPI[a.item_num_associado] = [];
        aPI[a.item_num_associado].push({
          id: a.anexo_id,
          nome: a.nome_original,
          caminho: a.caminho_servidor,
        });
      });
      const iAG = {};
      if (iIR.length > 0)
        iIR.forEach((item) => {
          if (!iAG[item.grupo_item]) iAG[item.grupo_item] = [];
          iAG[item.grupo_item].push({
            id: item.id,
            num: item.item_num,
            desc: item.descricao_item_original,
            avaliacao: item.avaliacao,
            obs: item.observacao_item,
            anexos: aPI[item.item_num] || [],
          });
        });
      const [aGR] = await promisePool.query(
        `SELECT id, nome_original, caminho_servidor, categoria_anexo, descricao_anexo FROM inspecoes_subestacoes_anexos WHERE inspecao_id = ? AND (item_num_associado IS NULL OR categoria_anexo != 'FOTO_EVIDENCIA_ITEM')`,
        [id]
      );
      const [mR] = await promisePool.query(
        `SELECT m.id, m.tipo_medicao, m.tag_equipamento, m.valor_medido_numerico, m.valor_medido_texto, m.unidade_medida, m.observacao, (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', ma.id, 'nome_original', ma.nome_original, 'caminho_servidor', ma.caminho_servidor)) FROM inspecoes_subestacoes_medicoes_anexos ma WHERE ma.medicao_id = m.id) as anexos_medicao FROM inspecoes_subestacoes_medicoes m WHERE m.inspecao_id = ? ORDER BY m.id ASC`,
        [id]
      );
      const [eOR] = await promisePool.query(
        `SELECT eo.id, eo.tipo_equipamento, eo.tag_equipamento, eo.observacao, (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', eoa.id, 'nome_original', eoa.nome_original, 'caminho_servidor', eoa.caminho_servidor)) FROM inspecoes_equipamentos_observados_anexos eoa WHERE eoa.equipamento_observado_id = eo.id) as anexos_equip_obs FROM inspecoes_equipamentos_observados eo WHERE eo.inspecao_id = ? ORDER BY eo.id ASC`,
        [id]
      );
      const [vAR] = await promisePool.query(
        `SELECT id, item_verificado, estado_item, num_formulario_referencia, detalhes_observacao FROM inspecoes_itens_verificacao_adicional WHERE inspecao_id = ? ORDER BY id ASC`,
        [id]
      );

      const rC = {
        ...iH,
        gruposDeItens: iAG,
        medicoes: mR.map((m) => ({
          ...m,
          anexos_medicao: m.anexos_medicao ? JSON.parse(m.anexos_medicao) : [],
        })),
        equipamentos_observados: eOR.map((eq) => ({
          ...eq,
          anexos_equip_obs: eq.anexos_equip_obs
            ? JSON.parse(eq.anexos_equip_obs)
            : [],
        })),
        verificacoes_adicionais: vAR,
        anexosGerais: aGR.map((a) => ({
          id: a.id,
          nome: a.nome_original,
          caminho: a.caminho_servidor,
          categoria: a.categoria_anexo,
          descricao: a.descricao_anexo,
        })),
      };
      res.json(rC);
    } catch (error) {
      console.error("Erro ao buscar detalhes da inspeção:", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar detalhes.", detalhes: error.message });
    }
  }
);

router.get(
  "/inspecoes-subestacoes/:id/pdf",
  autenticar,
  podeGerenciarPaginaInspecoes,
  async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id, 10)))
      return res.status(400).json({ message: `ID inválido: ${id}` });
    try {
      const currentDir = __dirname;
      const projectRootGuess = path.resolve(currentDir, "../../");
      const fontsDir = path.join(projectRootGuess, "public", "fonts");
      const fontsConfig = {
        Roboto: {
          normal: path.join(fontsDir, "Roboto-Regular.ttf"),
          bold: path.join(fontsDir, "Roboto-Medium.ttf"),
          italics: path.join(fontsDir, "Roboto-Italic.ttf"),
          bolditalics: path.join(fontsDir, "Roboto-MediumItalic.ttf"),
        },
      };
      const localPrinter = new PdfPrinter(fontsConfig);

      const [iHR] = await promisePool.query(
        `SELECT i.id, i.subestacao_id, i.formulario_inspecao_num, i.responsavel_levantamento_id, DATE_FORMAT(i.data_avaliacao, '%d/%m/%Y') as data_avaliacao_fmt, i.hora_inicial, i.hora_final, i.status_inspecao, i.observacoes_gerais, s.sigla as subestacao_sigla, s.nome as subestacao_nome, u.nome as responsavel_nome FROM inspecoes_subestacoes i JOIN subestacoes s ON i.subestacao_id = s.Id JOIN users u ON i.responsavel_levantamento_id = u.id WHERE i.id = ?`,
        [id]
      );
      if (iHR.length === 0)
        return res.status(404).json({ message: "Inspeção não encontrada." });
      const iH = iHR[0];
      const [iIR] = await promisePool.query(
        `SELECT item_num, grupo_item, descricao_item_original, avaliacao, observacao_item FROM inspecoes_subestacoes_itens WHERE inspecao_id = ? ORDER BY item_num ASC`,
        [id]
      );
      const [aIR] = await promisePool.query(
        `SELECT item_num_associado, caminho_servidor FROM inspecoes_subestacoes_anexos WHERE inspecao_id = ? AND item_num_associado IS NOT NULL AND categoria_anexo = 'FOTO_EVIDENCIA_ITEM'`,
        [id]
      );
      const [mR] = await promisePool.query(
        `SELECT m.id, m.tipo_medicao, m.tag_equipamento, m.valor_medido_numerico, m.valor_medido_texto, m.unidade_medida, m.observacao, (SELECT JSON_ARRAYAGG(JSON_OBJECT('caminho_servidor', ma.caminho_servidor)) FROM inspecoes_subestacoes_medicoes_anexos ma WHERE ma.medicao_id = m.id) as anexos_medicao FROM inspecoes_subestacoes_medicoes m WHERE m.inspecao_id = ? ORDER BY m.id ASC`,
        [id]
      );
      const [eOR] = await promisePool.query(
        `SELECT eo.id, eo.tipo_equipamento, eo.tag_equipamento, eo.observacao, (SELECT JSON_ARRAYAGG(JSON_OBJECT('caminho_servidor', eoa.caminho_servidor)) FROM inspecoes_equipamentos_observados_anexos eoa WHERE eoa.equipamento_observado_id = eo.id) as anexos_equip_obs FROM inspecoes_equipamentos_observados eo WHERE eo.inspecao_id = ? ORDER BY eo.id ASC`,
        [id]
      );
      const [vAR] = await promisePool.query(
        `SELECT item_verificado, estado_item, num_formulario_referencia, detalhes_observacao FROM inspecoes_itens_verificacao_adicional WHERE inspecao_id = ? ORDER BY id ASC`,
        [id]
      );

      let content = [
        {
          text: `Relatório Inspeção Subestação #${
            iH.formulario_inspecao_num || iH.id
          }`,
          style: "header",
        },
        {
          text: `Subestação: ${iH.subestacao_sigla} - ${iH.subestacao_nome}`,
          style: "subheader",
        },
        {
          text: `Data: ${
            iH.data_avaliacao_fmt
          } Horário: ${iH.hora_inicial.substring(0, 5)}${
            iH.hora_final ? " às " + iH.hora_final.substring(0, 5) : ""
          }`,
          style: "subheader",
        },
        { text: `Responsável: ${iH.responsavel_nome}`, style: "subheader" },
        {
          text: `Status: ${iH.status_inspecao.replace("_", " ")}`,
          style: "subheader",
          marginBottom: 20,
        },
      ];
      content.push({ text: "Itens do Checklist", style: "sectionHeader" });
      const iAG = {};
      iIR.forEach((item) => {
        if (!iAG[item.grupo_item]) iAG[item.grupo_item] = [];
        const aDI = aIR.filter((a) => a.item_num_associado === item.item_num);
        iAG[item.grupo_item].push({ ...item, anexos: aDI });
      });
      for (const gN in iAG) {
        content.push({
          text: gN,
          style: "groupHeader",
          marginTop: 10,
          tocItem: true,
          tocTitle: gN,
        });
        const tB = [
          [
            { text: "Nº", style: "tableHeader", alignment: "center" },
            { text: "Descrição", style: "tableHeader" },
            { text: "Aval.", style: "tableHeader", alignment: "center" },
            { text: "Obs/Evidências", style: "tableHeader" },
          ],
        ];
        for (const item of iAG[gN]) {
          let oEA = [];
          if (item.observacao_item)
            oEA.push({
              text: item.observacao_item,
              style: "observation",
              italics: true,
            });
          if (item.anexos?.length) {
            let iR = [],
              iC = [];
            for (const anexo of item.anexos) {
              const iB64 = await imagePathToBase64(anexo.caminho_servidor);
              if (iB64) {
                iR.push({ image: iB64, width: 50, margin: [0, 2, 4, 2] });
                if (iR.length === 4) {
                  iC.push({ columns: iR, columnGap: 5 });
                  iR = [];
                }
              }
            }
            if (iR.length > 0) iC.push({ columns: iR, columnGap: 5 });
            if (iC.length > 0) oEA.push({ stack: iC, margin: [0, 5, 0, 0] });
          }
          if (oEA.length === 0) oEA.push({ text: "-", alignment: "center" });
          tB.push([
            {
              text: `${item.item_num}.`,
              alignment: "center",
              style: "tableCell",
            },
            { text: item.descricao_item_original, style: "tableCell" },
            {
              text: item.avaliacao,
              alignment: "center",
              style:
                item.avaliacao === "A" ? "avaliacaoAnormalCell" : "tableCell",
            },
            oEA.length > 0
              ? { stack: oEA, style: "tableCell" }
              : { text: "-", style: "tableCell", alignment: "center" },
          ]);
        }
        content.push({
          table: { widths: ["auto", "*", "auto", "40%"], body: tB },
          layout: "lightHorizontalLines",
        });
      }
      content.push({ text: "", pageBreak: "after" });
      if (mR?.length) {
        content.push({
          text: "Medições Dinâmicas",
          style: "sectionHeader",
          tocItem: true,
          tocTitle: "Medições Dinâmicas",
        });
        for (const med of mR) {
          let mS = [
            {
              text: `Tipo: ${med.tipo_medicao.replace(/_/g, " ")}${
                med.tag_equipamento ? " (TAG: " + med.tag_equipamento + ")" : ""
              }`,
              style: "itemDescription",
            },
            {
              text: `Valor: ${
                med.valor_medido_texto || med.valor_medido_numerico || "-"
              } ${med.unidade_medida || ""}`,
              style: "itemDescription",
            },
          ];
          if (med.observacao)
            mS.push({
              text: `Obs: ${med.observacao}`,
              style: "observation",
              italics: true,
            });
          const aM = med.anexos_medicao ? JSON.parse(med.anexos_medicao) : [];
          if (aM.length > 0) {
            let iRM = [],
              iCM = [];
            for (const aMed of aM) {
              const iB64 = await imagePathToBase64(aMed.caminho_servidor);
              if (iB64) {
                iRM.push({ image: iB64, width: 60, margin: [0, 2, 4, 2] });
                if (iRM.length === 4) {
                  iCM.push({
                    columns: iRM,
                    columnGap: 5,
                    margin: [0, 5, 0, 0],
                  });
                  iRM = [];
                }
              }
            }
            if (iRM.length > 0)
              iCM.push({ columns: iRM, columnGap: 5, margin: [0, 5, 0, 0] });
            if (iCM.length > 0) mS.push({ stack: iCM });
          }
          content.push({ stack: mS, style: "listItemContainer" });
        }
      }
      if (eOR?.length) {
        content.push({
          text: "Equipamentos Observados",
          style: "sectionHeader",
          tocItem: true,
          tocTitle: "Equipamentos Observados",
        });
        for (const equip of eOR) {
          let eS = [
            {
              text: `Tipo: ${equip.tipo_equipamento}${
                equip.tag_equipamento
                  ? " (TAG: " + equip.tag_equipamento + ")"
                  : ""
              }`,
              style: "itemDescription",
            },
          ];
          if (equip.observacao)
            eS.push({
              text: `Obs: ${equip.observacao}`,
              style: "observation",
              italics: true,
            });
          const aEO = equip.anexos_equip_obs
            ? JSON.parse(equip.anexos_equip_obs)
            : [];
          if (aEO.length > 0) {
            let iRE = [],
              iCE = [];
            for (const aEq of aEO) {
              const iB64 = await imagePathToBase64(aEq.caminho_servidor);
              if (iB64) {
                iRE.push({ image: iB64, width: 60, margin: [0, 2, 4, 2] });
                if (iRE.length === 4) {
                  iCE.push({
                    columns: iRE,
                    columnGap: 5,
                    margin: [0, 5, 0, 0],
                  });
                  iRE = [];
                }
              }
            }
            if (iRE.length > 0)
              iCE.push({ columns: iRE, columnGap: 5, margin: [0, 5, 0, 0] });
            if (iCE.length > 0) eS.push({ stack: iCE });
          }
          content.push({ stack: eS, style: "listItemContainer" });
        }
      }
      if (vAR?.length) {
        content.push({
          text: "Verificações Adicionais",
          style: "sectionHeader",
          tocItem: true,
          tocTitle: "Verificações Adicionais",
        });
        vAR.forEach((v) => {
          let vS = [
            { text: `Item: ${v.item_verificado}`, style: "itemDescription" },
            { text: `Estado: ${v.estado_item}`, style: "itemDescription" },
          ];
          if (v.num_formulario_referencia)
            vS.push({
              text: `Form.Ref.: ${v.num_formulario_referencia}`,
              style: "itemDescription",
            });
          if (v.detalhes_observacao)
            vS.push({
              text: `Detalhes: ${v.detalhes_observacao}`,
              style: "observation",
              italics: true,
            });
          content.push({ stack: vS, style: "listItemContainer" });
        });
      }
      if (iH.observacoes_gerais) {
        content.push({ text: "Observações Gerais", style: "sectionHeader" });
        content.push({ text: iH.observacoes_gerais, margin: [0, 0, 0, 10] });
      }

      const docDefinition = {
        pageMargins: [40, 60, 40, 60],
        header: (cP, pC, pS) => ({
          columns: [
            {
              text: `Insp.Subestação: ${iH.subestacao_sigla || "N/A"}`,
              alignment: "left",
              margin: [40, 30, 0, 0],
              fontSize: 9,
              color: "gray",
            },
            {
              text: `Página ${cP} de ${pC}`,
              alignment: "right",
              margin: [0, 30, 40, 0],
              fontSize: 9,
              color: "gray",
            },
          ],
        }),
        footer: (cP, pC) => ({
          text: `Form: ${iH.formulario_inspecao_num || iH.id} - ${
            iH.data_avaliacao_fmt || ""
          }`,
          alignment: "center",
          fontSize: 9,
          color: "gray",
          margin: [0, 0, 0, 30],
        }),
        content: content,
        styles: {
          header: {
            fontSize: 18,
            bold: true,
            alignment: "center",
            margin: [0, 0, 0, 15],
          },
          subheader: { fontSize: 11, margin: [0, 0, 0, 3], color: "#333333" },
          sectionHeader: {
            fontSize: 14,
            bold: true,
            margin: [0, 15, 0, 8],
            color: "#192a56",
          },
          groupHeader: {
            fontSize: 12,
            bold: true,
            margin: [0, 10, 0, 5],
            color: "#444444",
          },
          itemDescription: { fontSize: 10, margin: [0, 1, 0, 1] },
          tableHeader: {
            bold: true,
            fontSize: 9,
            color: "black",
            fillColor: "#eeeeee",
            margin: [0, 2, 0, 2],
          },
          tableCell: { fontSize: 9, margin: [0, 2, 0, 2] },
          avaliacaoAnormalCell: { fontSize: 9, color: "red", bold: true },
          observation: { fontSize: 9, italics: true, color: "#555555" },
          listItemContainer: {
            margin: [0, 5, 0, 10],
            padding: [0, 0, 0, 5],
            border: [false, false, false, true],
            borderColor: ["#cccccc", "#cccccc", "#cccccc", "#cccccc"],
          },
        },
        defaultStyle: { font: "Roboto", fontSize: 10, lineHeight: 1.3 },
      };
      const pdfDoc = localPrinter.createPdfKitDocument(docDefinition);
      let chunks = [];
      pdfDoc.on("data", (chunk) => chunks.push(chunk));
      pdfDoc.on("end", () => {
        const result = Buffer.concat(chunks);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `inline; filename=inspecao_${iH.formulario_inspecao_num || id}.pdf`
        );
        res.send(result);
      });
      pdfDoc.end();
    } catch (error) {
      console.error("Erro ao gerar PDF da inspeção:", error);
      res
        .status(500)
        .json({ message: "Erro ao gerar PDF.", detalhes: error.message });
    }
  }
);

router.put(
  "/inspecoes-subestacoes/:inspecaoId/concluir",
  autenticar,
  podeGerenciarPaginaInspecoes,
  verificarInspecaoExiste,
  async (req, res) => {
    const { inspecaoId } = req;
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();
      const [cIR] = await connection.query(
        "SELECT status_inspecao, hora_final FROM inspecoes_subestacoes WHERE id = ?",
        [inspecaoId]
      );
      if (cIR.length === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({ message: `Inspeção ${inspecaoId} não encontrada.` });
      }
      const cS = cIR[0].status_inspecao;
      let hFA = cIR[0].hora_final;
      if (cS === "CONCLUIDA" || cS === "CANCELADA") {
        await connection.rollback();
        return res
          .status(400)
          .json({ message: `Inspeção ${inspecaoId} já está ${cS}.` });
      }
      let sUQ =
        "UPDATE inspecoes_subestacoes SET status_inspecao = 'CONCLUIDA'";
      const pU = [];
      if (!hFA) {
        const now = new Date();
        hFA = now.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        sUQ += ", hora_final = ?";
        pU.push(hFA);
      }
      sUQ += " WHERE id = ?";
      pU.push(inspecaoId);
      const [result] = await connection.query(sUQ, pU);
      if (result.affectedRows === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({ message: "Falha ao atualizar. Nenhuma linha afetada." });
      }
      if (req.user?.matricula)
        await registrarAuditoria(
          req.user.matricula,
          "CONCLUDE_INSPECAO_SUBESTACAO",
          `Inspeção ${inspecaoId} marcada como CONCLUÍDA.`,
          connection
        );
      await connection.commit();
      res.json({ message: `Inspeção ID ${inspecaoId} concluída!` });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao concluir inspeção:", error);
      res.status(500).json({
        message: "Erro interno ao concluir.",
        detalhes: error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.put(
  "/inspecoes-subestacoes/:inspecaoId/reabrir",
  autenticar,
  podeGerenciarPaginaInspecoes,
  verificarInspecaoExiste,
  async (req, res) => {
    const { inspecaoId } = req;
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();
      const [cIR] = await connection.query(
        "SELECT status_inspecao FROM inspecoes_subestacoes WHERE id = ?",
        [inspecaoId]
      );
      if (cIR.length === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({ message: `Inspeção ${inspecaoId} não encontrada.` });
      }
      const cS = cIR[0].status_inspecao;
      const sR = ["CONCLUIDA", "CANCELADA"];
      if (!sR.includes(cS)) {
        await connection.rollback();
        return res.status(400).json({
          message: `Inspeção ${inspecaoId} (${cS}) não pode ser reaberta.`,
        });
      }
      const [result] = await connection.query(
        "UPDATE inspecoes_subestacoes SET status_inspecao = 'EM_ANDAMENTO', hora_final = NULL WHERE id = ?",
        [inspecaoId]
      );
      if (result.affectedRows === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({ message: "Falha ao reabrir. Nenhuma linha afetada." });
      }
      if (req.user?.matricula)
        await registrarAuditoria(
          req.user.matricula,
          "REOPEN_INSPECAO_SUBESTACAO",
          `Inspeção ${inspecaoId} reaberta (EM_ANDAMENTO).`,
          connection
        );
      await connection.commit();
      res.json({ message: `Inspeção ID ${inspecaoId} reaberta!` });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao reabrir inspeção:", error);
      res
        .status(500)
        .json({ message: "Erro interno ao reabrir.", detalhes: error.message });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.delete(
  "/inspecoes-subestacoes/:inspecaoId",
  autenticar,
  podeGerenciarPaginaInspecoes,
  verificarInspecaoExiste,
  async (req, res) => {
    const { inspecaoId, inspecao: inspecaoInfo } = req;
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();
      const [aIGDB] = await connection.query(
        "SELECT caminho_servidor FROM inspecoes_subestacoes_anexos WHERE inspecao_id = ?",
        [inspecaoId]
      );
      const [aMDB] = await connection.query(
        `SELECT ma.caminho_servidor FROM inspecoes_subestacoes_medicoes_anexos ma JOIN inspecoes_subestacoes_medicoes m ON ma.medicao_id = m.id WHERE m.inspecao_id = ?`,
        [inspecaoId]
      );
      const [aEODB] = await connection.query(
        `SELECT eoa.caminho_servidor FROM inspecoes_equipamentos_observados_anexos eoa JOIN inspecoes_equipamentos_observados eo ON eoa.equipamento_observado_id = eo.id WHERE eo.inspecao_id = ?`,
        [inspecaoId]
      );

      const [mIR] = await connection.query(
        "SELECT id FROM inspecoes_subestacoes_medicoes WHERE inspecao_id = ?",
        [inspecaoId]
      );
      if (mIR.length > 0)
        await connection.query(
          "DELETE FROM inspecoes_subestacoes_medicoes_anexos WHERE medicao_id IN (?)",
          [mIR.map((m) => m.id)]
        );
      await connection.query(
        "DELETE FROM inspecoes_subestacoes_medicoes WHERE inspecao_id = ?",
        [inspecaoId]
      );
      const [eOIR] = await connection.query(
        "SELECT id FROM inspecoes_equipamentos_observados WHERE inspecao_id = ?",
        [inspecaoId]
      );
      if (eOIR.length > 0)
        await connection.query(
          "DELETE FROM inspecoes_equipamentos_observados_anexos WHERE equipamento_observado_id IN (?)",
          [eOIR.map((eq) => eq.id)]
        );
      await connection.query(
        "DELETE FROM inspecoes_equipamentos_observados WHERE inspecao_id = ?",
        [inspecaoId]
      );
      await connection.query(
        "DELETE FROM inspecoes_itens_verificacao_adicional WHERE inspecao_id = ?",
        [inspecaoId]
      );
      await connection.query(
        "DELETE FROM inspecoes_subestacoes_anexos WHERE inspecao_id = ?",
        [inspecaoId]
      );
      await connection.query(
        "DELETE FROM inspecoes_subestacoes_itens WHERE inspecao_id = ?",
        [inspecaoId]
      );

      const [result] = await connection.query(
        "DELETE FROM inspecoes_subestacoes WHERE id = ?",
        [inspecaoId]
      );
      if (result.affectedRows === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({ message: `Inspeção ${inspecaoId} não encontrada.` });
      }

      const tAEFS = [
        ...aIGDB.map((a) => a.caminho_servidor),
        ...aMDB.map((m) => m.caminho_servidor),
        ...aEODB.map((eq) => eq.caminho_servidor),
      ];
      if (tAEFS.length > 0) {
        for (const cR of tAEFS) {
          if (!cR) continue;
          const cRL = cR.replace(/^\/upload_arquivos_subestacoes\//, "");
          const cC = path.join(uploadsSubestacoesDir, cRL);
          try {
            await fs.access(cC);
            await fs.unlink(cC);
          } catch (err) {
            if (err.code !== "ENOENT")
              console.warn(`Falha ao excluir ${cC}: ${err.message}`);
          }
        }
        const aCBDir = path.join(
          uploadsSubestacoesDir,
          "checklist",
          `checklist_${String(inspecaoId)}`
        );
        const aEBDir = path.join(
          uploadsSubestacoesDir,
          "inspecoes_escritorio",
          `inspecao_escritorio_${String(inspecaoId)}`
        );
        try {
          await fs.rm(path.join(aCBDir, "medicoes_fotos"), {
            recursive: true,
            force: true,
          });
        } catch (e) {
          if (e.code !== "ENOENT") {
          }
        }
        try {
          await fs.rm(path.join(aCBDir, "equipamentos_observados_fotos"), {
            recursive: true,
            force: true,
          });
        } catch (e) {
          if (e.code !== "ENOENT") {
          }
        }
        try {
          await fs.rm(aCBDir, { recursive: true, force: true });
        } catch (e) {
          if (e.code !== "ENOENT") {
          }
        }
        try {
          await fs.rm(aEBDir, { recursive: true, force: true });
        } catch (e) {
          if (e.code !== "ENOENT") {
          }
        }
      }
      await connection.commit();
      if (req.user?.matricula)
        await registrarAuditoria(
          req.user.matricula,
          "DELETE_INSPECAO_SUBESTACAO",
          `Inspeção ID ${inspecaoId} (Form: ${
            inspecaoInfo.formulario_inspecao_num || "N/A"
          }) excluída.`,
          connection
        );
      res.json({ message: `Inspeção ID ${inspecaoId} excluída.` });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao excluir inspeção:", error);
      res
        .status(500)
        .json({ message: "Erro interno ao excluir.", detalhes: error.message });
    } finally {
      if (connection) connection.release();
    }
  }
);

module.exports = router;
