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

// ... (código das permissões e outras rotas permanece o mesmo) ...

// ... (código das permissões e outras rotas permanece o mesmo) ...

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

router.get(
  "/inspecoes-subestacoes/detalhes/:id",
  autenticar,
  podeGerenciarPaginaInspecoes,
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/detalhes-inspecao-checklist.html"
      )
    );
  }
);

router.get("/api/checklist/modelo/padrao", autenticar, async (req, res) => {
  try {
    const [grupos] = await promisePool.query(
      `SELECT id, nome_grupo, icone FROM checklist_grupos WHERE modelo_id = 1 ORDER BY ordem ASC`
    );
    for (const grupo of grupos) {
      const [itens] = await promisePool.query(
        `SELECT id, descricao_item, ordem FROM checklist_itens WHERE grupo_id = ? ORDER BY ordem ASC`,
        [grupo.id]
      );
      grupo.itens = itens;
    }
    res.json(grupos);
  } catch (error) {
    console.error("Erro ao buscar modelo de checklist:", error);
    res.status(500).json({
      message: "Erro interno ao buscar modelo de checklist.",
      detalhes: error.message,
    });
  }
});

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
    } = req.body;
    const connection = await promisePool.getConnection();
    let novaInspecaoId;
    let arquivosMovidosComSucessoParaRollback = [];

    try {
      if (
        !subestacao_id ||
        !responsavel_levantamento_id ||
        !tipo_inspecao ||
        !data_avaliacao ||
        !hora_inicial
      ) {
        await limparArquivosTemporariosUpload(req.files);
        return res.status(400).json({
          message: "Campos obrigatórios do cabeçalho não foram preenchidos.",
        });
      }

      const itensDoChecklist = req.body.itens ? JSON.parse(req.body.itens) : [];
      const registrosDinamicos = req.body.registros
        ? JSON.parse(req.body.registros)
        : [];

      await connection.beginTransaction();

      const [rI] = await connection.query(
        `INSERT INTO inspecoes_subestacoes (processo, subestacao_id, responsavel_levantamento_id, tipo_inspecao, data_avaliacao, hora_inicial, hora_final, status_inspecao, observacoes_gerais, formulario_inspecao_num) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.body.processo || null,
          subestacao_id,
          responsavel_levantamento_id,
          tipo_inspecao,
          data_avaliacao,
          hora_inicial,
          req.body.hora_final || null,
          "EM_ANDAMENTO",
          req.body.observacoes_gerais || null,
          null,
        ]
      );
      novaInspecaoId = rI.insertId;
      await connection.query(
        "UPDATE inspecoes_subestacoes SET formulario_inspecao_num = ? WHERE id = ?",
        [String(novaInspecaoId), novaInspecaoId]
      );

      const inspecaoRootDir = path.join(
        uploadsSubestacoesDir,
        "checklist",
        `checklist_${String(novaInspecaoId)}`
      );
      await fs.mkdir(inspecaoRootDir, { recursive: true });

      const mapaRespostas = {};
      const mapaEspecificacoes = {};

      for (const item of itensDoChecklist) {
        const [resultResposta] = await connection.query(
          `INSERT INTO inspecoes_itens_respostas (inspecao_id, item_checklist_id, avaliacao, observacao_item) VALUES (?, ?, ?, ?)`,
          [
            novaInspecaoId,
            item.item_checklist_id,
            item.avaliacao,
            item.observacao_item || null,
          ]
        );
        const novaRespostaId = resultResposta.insertId;
        mapaRespostas[item.item_checklist_id] = novaRespostaId;

        if (item.especificacoes && item.especificacoes.length > 0) {
          for (const especificacao of item.especificacoes) {
            const [resultEsp] = await connection.query(
              `INSERT INTO inspecoes_item_especificacoes (item_resposta_id, descricao_equipamento, observacao) VALUES (?, ?, ?)`,
              [
                novaRespostaId,
                especificacao.descricao_equipamento,
                especificacao.observacao || null,
              ]
            );
            mapaEspecificacoes[especificacao.temp_id] = resultEsp.insertId;
          }
        }
      }

      for (const file of req.files) {
        if (file.fieldname.startsWith("item_anexo__")) {
          const parts = file.fieldname.split("__");
          const itemId = parts[1];
          const associacao = parts[2];

          const respostaId = mapaRespostas[itemId];
          if (!respostaId) continue;

          const especificacaoDbId =
            associacao === "geral" ? null : mapaEspecificacoes[associacao];

          const itemAnexosDir = path.join(
            inspecaoRootDir,
            "respostas_itens",
            `resposta_${respostaId}`,
            "anexos"
          );
          await fs.mkdir(itemAnexosDir, { recursive: true });

          const nomeUnico = `${Date.now()}_${file.originalname.replace(
            /[^a-zA-Z0-9.\-_]/g,
            "_"
          )}`;
          const caminhoDestino = path.join(itemAnexosDir, nomeUnico);
          await fs.rename(file.path, caminhoDestino);
          arquivosMovidosComSucessoParaRollback.push(caminhoDestino);

          const caminhoRelativo = `checklist/checklist_${novaInspecaoId}/respostas_itens/resposta_${respostaId}/anexos/${nomeUnico}`;
          await connection.query(
            `INSERT INTO inspecoes_anexos (inspecao_id, item_resposta_id, item_especificacao_id, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              novaInspecaoId,
              respostaId,
              especificacaoDbId,
              file.originalname,
              `/upload_arquivos_subestacoes/${caminhoRelativo}`,
              file.mimetype,
              file.size,
              "ITEM_ANEXO",
            ]
          );
        } else if (file.fieldname === "anexosInspecao") {
          const anexosGeraisDir = path.join(
            inspecaoRootDir,
            "anexos_gerais_inspecao"
          );
          await fs.mkdir(anexosGeraisDir, { recursive: true });
          const nomeUnico = `${Date.now()}_${file.originalname.replace(
            /[^a-zA-Z0-9.\-_]/g,
            "_"
          )}`;
          const caminhoDestino = path.join(anexosGeraisDir, nomeUnico);
          await fs.rename(file.path, caminhoDestino);
          arquivosMovidosComSucessoParaRollback.push(caminhoDestino);
          const caminhoRelativo = `checklist/checklist_${novaInspecaoId}/anexos_gerais_inspecao/${nomeUnico}`;
          await connection.query(
            `INSERT INTO inspecoes_anexos (inspecao_id, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              novaInspecaoId,
              file.originalname,
              `/upload_arquivos_subestacoes/${caminhoRelativo}`,
              file.mimetype,
              file.size,
              "INSPECAO_GERAL",
            ]
          );
        }
      }

      for (const registro of registrosDinamicos) {
        const [resultRegistro] = await connection.query(
          `INSERT INTO inspecoes_registros (inspecao_id, categoria_registro, tipo_especifico, tag_equipamento, descricao_item, valor_numerico, valor_texto, unidade_medida, referencia_externa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            novaInspecaoId,
            registro.categoria_registro,
            registro.tipo_especifico || null,
            registro.tag_equipamento || null,
            registro.descricao_item || null,
            registro.valor_numerico || null,
            registro.valor_texto || null,
            registro.unidade_medida || null,
            registro.referencia_externa || null,
          ]
        );
        const novoRegistroId = resultRegistro.insertId;

        const anexosDoRegistro = req.files.filter(
          (f) => f.fieldname === `registro_anexo__${registro.originalDataId}`
        );

        if (anexosDoRegistro.length > 0) {
          const registroDir = path.join(
            inspecaoRootDir,
            "registros",
            `registro_${novoRegistroId}`
          );
          await fs.mkdir(registroDir, { recursive: true });
          for (const file of anexosDoRegistro) {
            const nomeUnico = `${Date.now()}_${file.originalname.replace(
              /[^a-zA-Z0-9.\-_]/g,
              "_"
            )}`;
            const caminhoDestino = path.join(registroDir, nomeUnico);
            await fs.rename(file.path, caminhoDestino);
            arquivosMovidosComSucessoParaRollback.push(caminhoDestino);
            const caminhoRelativo = `checklist/checklist_${novaInspecaoId}/registros/registro_${novoRegistroId}/${nomeUnico}`;
            await connection.query(
              `INSERT INTO inspecoes_anexos (inspecao_id, registro_id, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                novaInspecaoId,
                novoRegistroId,
                file.originalname,
                `/upload_arquivos_subestacoes/${caminhoRelativo}`,
                file.mimetype,
                file.size,
                "REGISTRO_FOTO",
              ]
            );
          }
        }
      }

      await connection.commit();
      await registrarAuditoria(
        req.user.matricula,
        "CREATE_INSPECAO_SUBESTACAO",
        `Inspeção ID ${novaInspecaoId} criada.`,
        connection
      );
      res.status(201).json({
        id: novaInspecaoId,
        formulario_inspecao_num: String(novaInspecaoId),
        message: "Inspeção registrada com sucesso!",
      });
    } catch (error) {
      if (connection) await connection.rollback();
      for (const caminho of arquivosMovidosComSucessoParaRollback) {
        try {
          await fs.unlink(caminho);
        } catch (e) {}
      }
      await limparArquivosTemporariosUpload(req.files);
      console.error("Erro ao registrar inspeção:", error);
      res.status(500).json({
        message: "Erro interno ao registrar a inspeção.",
        detalhes: error.message,
      });
    } finally {
      if (connection) connection.release();
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
      const [inspecaoRows] = await promisePool.query(
        `SELECT i.id, i.processo, i.subestacao_id, i.formulario_inspecao_num, i.responsavel_levantamento_id, 
                    DATE_FORMAT(i.data_avaliacao, '%d/%m/%Y') as data_avaliacao_fmt, i.data_avaliacao, 
                    i.hora_inicial, i.hora_final, i.status_inspecao, i.observacoes_gerais, 
                    s.sigla as subestacao_sigla, s.nome as subestacao_nome, 
                    u.nome as responsavel_nome 
             FROM inspecoes_subestacoes i 
             JOIN subestacoes s ON i.subestacao_id = s.Id 
             JOIN users u ON i.responsavel_levantamento_id = u.id 
             WHERE i.id = ?`,
        [id]
      );
      if (inspecaoRows.length === 0)
        return res
          .status(404)
          .json({ message: `Inspeção ID ${id} não encontrada.` });
      const inspecao = inspecaoRows[0];

      const [respostasRows] = await promisePool.query(
        `SELECT
                r.id as resposta_id, r.avaliacao, r.observacao_item,
                ci.id as item_checklist_id, ci.descricao_item,
                cg.nome_grupo, cg.ordem as grupo_ordem, ci.ordem as item_ordem
            FROM inspecoes_itens_respostas r
            JOIN checklist_itens ci ON r.item_checklist_id = ci.id
            JOIN checklist_grupos cg ON ci.grupo_id = cg.id
            WHERE r.inspecao_id = ? 
            ORDER BY cg.ordem, ci.ordem ASC`,
        [id]
      );

      const idRespostas = respostasRows.map((r) => r.resposta_id);
      let especificacoesRows = [];
      if (idRespostas.length > 0) {
        [especificacoesRows] = await promisePool.query(
          `SELECT id, item_resposta_id, descricao_equipamento, observacao 
           FROM inspecoes_item_especificacoes WHERE item_resposta_id IN (?)`,
          [idRespostas]
        );
      }

      const [registrosRows] = await promisePool.query(
        `SELECT id, categoria_registro, tipo_especifico, tag_equipamento, descricao_item, valor_numerico, valor_texto, unidade_medida, referencia_externa 
             FROM inspecoes_registros WHERE inspecao_id = ? ORDER BY id ASC`,
        [id]
      );

      const [anexosRows] = await promisePool.query(
        `SELECT id, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo, descricao_anexo, 
                    item_resposta_id, item_especificacao_id, registro_id 
             FROM inspecoes_anexos WHERE inspecao_id = ?`,
        [id]
      );

      const respostaFinal = {
        ...inspecao,
        itens: respostasRows.map((r) => ({
          ...r,
          especificacoes: especificacoesRows.filter(
            (e) => e.item_resposta_id === r.resposta_id
          ),
        })),
        registros: registrosRows,
        anexos: anexosRows,
      };

      res.json(respostaFinal);
    } catch (error) {
      console.error("Erro ao buscar detalhes da inspeção:", error);
      res.status(500).json({
        message: "Erro interno ao buscar detalhes da inspeção.",
        detalhes: error.message,
      });
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
      res
        .status(500)
        .json({ message: "Erro interno ao reabrir.", detalhes: error.message });
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
        "checklist",
        `checklist_${String(inspecaoId)}`,
        "anexos_escritorio"
      );
      await fs.mkdir(iEUD, { recursive: true });
      let aSI = [];
      for (const f of arquivos) {
        const nUA = `${Date.now()}_ESCRITORIO_${f.originalname.replace(
          /[^a-zA-Z0-9.\-_]/g,
          "_"
        )}`;
        const cD = path.join(iEUD, nUA);
        const cRS = `checklist/checklist_${inspecaoId}/anexos_escritorio/${nUA}`;
        await fs.rename(f.path, cD);
        arquivosMovidosComSucesso.push(cD);
        const [rA] = await connection.query(
          `INSERT INTO inspecoes_anexos (inspecao_id, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo, descricao_anexo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            inspecaoId,
            f.originalname,
            `/upload_arquivos_subestacoes/${cRS}`,
            f.mimetype,
            f.size,
            "ESCRITORIO",
            req.body.descricao_anexo_escritorio || null,
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
      let query = `
        SELECT 
          i.id, 
          i.processo, 
          i.formulario_inspecao_num,
          DATE_FORMAT(i.data_avaliacao, '%Y-%m-%d') as data_avaliacao, 
          i.status_inspecao, 
          s.sigla as subestacao_sigla, 
          u.nome as responsavel_nome
        FROM inspecoes_subestacoes i
        JOIN subestacoes s ON i.subestacao_id = s.Id
        JOIN users u ON i.responsavel_levantamento_id = u.id
        WHERE 1=1
      `;
      const params = [];

      if (req.query.subestacao_id) {
        query += " AND i.subestacao_id = ?";
        params.push(req.query.subestacao_id);
      }
      if (req.query.status_inspecao) {
        query += " AND i.status_inspecao = ?";
        params.push(req.query.status_inspecao);
      }
      if (req.query.processo) {
        query += " AND i.processo LIKE ?";
        params.push(`%${req.query.processo}%`);
      }
      if (req.query.responsavel_id) {
        query += " AND i.responsavel_levantamento_id = ?";
        params.push(req.query.responsavel_id);
      }
      if (req.query.data_avaliacao_de) {
        query += " AND i.data_avaliacao >= ?";
        params.push(req.query.data_avaliacao_de);
      }
      if (req.query.data_avaliacao_ate) {
        query += " AND i.data_avaliacao <= ?";
        params.push(req.query.data_avaliacao_ate);
      }

      query += " ORDER BY i.data_avaliacao DESC, i.id DESC";

      const [rows] = await promisePool.query(query, params);
      res.json(rows);
    } catch (error) {
      console.error("Erro ao listar inspeções de subestações:", error);
      res.status(500).json({
        message: "Erro interno ao listar inspeções.",
        detalhes: error.message,
      });
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
      await connection.query("DELETE FROM inspecoes_subestacoes WHERE id = ?", [
        inspecaoId,
      ]);

      const inspecaoDir = path.join(
        uploadsSubestacoesDir,
        "checklist",
        `checklist_${String(inspecaoId)}`
      );
      await fs
        .rm(inspecaoDir, { recursive: true, force: true })
        .catch((err) => {
          if (err.code !== "ENOENT")
            console.warn(
              `Falha ao excluir diretório ${inspecaoDir}: ${err.message}`
            );
        });

      await connection.commit();
      await registrarAuditoria(
        req.user.matricula,
        "DELETE_INSPECAO_SUBESTACAO",
        `Inspeção ID ${inspecaoId} (Form: ${
          inspecaoInfo.formulario_inspecao_num || "N/A"
        }) e seus anexos foram excluídos.`,
        connection
      );
      res.json({ message: `Inspeção ID ${inspecaoId} excluída com sucesso.` });
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

router.post(
  "/api/inspecoes/detalhes-para-servico",
  autenticar,
  podeGerenciarPaginaInspecoes,
  async (req, res) => {
    const { inspecao_ids } = req.body;

    if (!Array.isArray(inspecao_ids) || inspecao_ids.length === 0) {
      return res
        .status(400)
        .json({ message: "A lista de IDs de inspeção é obrigatória." });
    }

    const placeholders = inspecao_ids.map(() => "?").join(",");

    try {
      const [inspecoes] = await promisePool.query(
        `SELECT i.id, i.formulario_inspecao_num, s.sigla as subestacao_sigla 
             FROM inspecoes_subestacoes i
             JOIN subestacoes s ON i.subestacao_id = s.Id
             WHERE i.id IN (${placeholders})`,
        inspecao_ids
      );

      for (const inspecao of inspecoes) {
        const [itensAnormais] = await promisePool.query(
          `SELECT r.id as resposta_id, ci.descricao_item, r.observacao_item,
                        (SELECT JSON_ARRAYAGG(JSON_OBJECT('caminho_servidor', a.caminho_servidor, 'nome_original', a.nome_original)) 
                         FROM inspecoes_anexos a WHERE a.item_resposta_id = r.id) as anexos
                 FROM inspecoes_itens_respostas r
                 JOIN checklist_itens ci ON r.item_checklist_id = ci.id
                 WHERE r.inspecao_id = ? AND r.avaliacao = 'A'`,
          [inspecao.id]
        );
        inspecao.itens_anormais = itensAnormais.map((item) => {
          item.anexos = item.anexos ? JSON.parse(item.anexos) : [];
          return item;
        });
      }

      res.json(inspecoes);
    } catch (error) {
      console.error("Erro ao buscar detalhes de múltiplas inspeções:", error);
      res.status(500).json({
        message: "Erro interno ao buscar detalhes das inspeções.",
        detalhes: error.message,
      });
    }
  }
);

router.post(
  "/inspecoes-subestacoes/:inspecaoId/item/:itemChecklistId/anexos-termografia",
  autenticar,
  podeGerenciarPaginaInspecoes,
  verificarInspecaoExiste,
  upload.array("fotosTermografiaItem", 10),
  async (req, res) => {
    const { inspecaoId } = req;
    const itemChecklistId = parseInt(req.params.itemChecklistId, 10);
    const { descricao_anexo_termografico, item_especificacao_id } = req.body;
    const arquivos = req.files;

    if (isNaN(itemChecklistId) || itemChecklistId <= 0) {
      await limparArquivosTemporariosUpload(req.files);
      return res.status(400).json({ message: "ID do item inválido." });
    }
    if (!arquivos || arquivos.length === 0) {
      return res.status(400).json({ message: "Nenhum arquivo enviado." });
    }

    const connection = await promisePool.getConnection();
    let arquivosMovidosComSucesso = [];
    try {
      await connection.beginTransaction();

      const [respostaCheck] = await connection.query(
        `SELECT id FROM inspecoes_itens_respostas WHERE inspecao_id = ? AND item_checklist_id = ?`,
        [inspecaoId, itemChecklistId]
      );
      if (respostaCheck.length === 0) {
        await limparArquivosTemporariosUpload(req.files);
        await connection.rollback();
        return res.status(404).json({
          message: `Resposta para o item ${itemChecklistId} não encontrada na inspeção ${inspecaoId}.`,
        });
      }
      const itemRespostaId = respostaCheck[0].id;
      const especificacaoIdFinal =
        item_especificacao_id && item_especificacao_id !== "geral"
          ? parseInt(item_especificacao_id, 10)
          : null;

      const itemTermografiaUploadDir = path.join(
        uploadsSubestacoesDir,
        "checklist",
        `checklist_${String(inspecaoId)}`,
        "respostas_itens",
        `resposta_${itemRespostaId}`,
        "termografia"
      );
      await fs.mkdir(itemTermografiaUploadDir, { recursive: true });

      let anexosSalvosInfo = [];
      for (const file of arquivos) {
        const nomeUnicoArquivo = `${Date.now()}_TERM_${file.originalname.replace(
          /[^a-zA-Z0-9.\-_]/g,
          "_"
        )}`;
        const caminhoDestino = path.join(
          itemTermografiaUploadDir,
          nomeUnicoArquivo
        );
        const caminhoRelativoServidor = `checklist/checklist_${inspecaoId}/respostas_itens/resposta_${itemRespostaId}/termografia/${nomeUnicoArquivo}`;

        await fs.rename(file.path, caminhoDestino);
        arquivosMovidosComSucesso.push(caminhoDestino);

        const [resultAnexo] = await connection.query(
          `INSERT INTO inspecoes_anexos (inspecao_id, item_resposta_id, item_especificacao_id, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo, descricao_anexo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            inspecaoId,
            itemRespostaId,
            especificacaoIdFinal,
            file.originalname,
            `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
            file.mimetype,
            file.size,
            "ITEM_TERMOGRAFIA",
            descricao_anexo_termografico ||
              `Termografia Item ID ${itemChecklistId}`,
          ]
        );
        anexosSalvosInfo.push({
          id: resultAnexo.insertId,
          nome_original: file.originalname,
          caminho_servidor: `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
        });
      }

      await connection.commit();
      if (req.user?.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "UPLOAD_TERMOGRAFIA_ITEM_INSPECAO",
          `Imagens termográficas adicionadas ao Item ID ${itemChecklistId} da Inspeção ID ${inspecaoId}.`,
          connection
        );
      }
      res.status(201).json({
        message: "Imagens termográficas salvas com sucesso!",
        anexos: anexosSalvosInfo,
      });
    } catch (error) {
      await connection.rollback();
      for (const caminho of arquivosMovidosComSucesso) {
        try {
          await fs.unlink(caminho);
        } catch (e) {}
      }
      await limparArquivosTemporariosUpload(req.files);
      res.status(500).json({
        message: "Erro interno ao salvar imagens termográficas do item.",
        detalhes: error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

module.exports = router;
