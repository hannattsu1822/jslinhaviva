const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs").promises;
const crypto = require("crypto");
const {
  promisePool,
  upload,
  projectRootDir,
  uploadsSubestacoesDir,
} = require("../init");
const { autenticar, verificarNivel, registrarAuditoria } = require("../auth");

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

async function moverAnexo(
  anexo,
  inspecaoId,
  destinoSubpasta,
  connection,
  options = {}
) {
  const tempFilePath = path.join(
    uploadsSubestacoesDir,
    "temp",
    anexo.tempFileName
  );
  const inspecaoRootDir = path.join(
    uploadsSubestacoesDir,
    "checklist",
    `checklist_${String(inspecaoId)}`
  );
  const destinoDir = path.join(inspecaoRootDir, destinoSubpasta);
  await fs.mkdir(destinoDir, { recursive: true });

  const nomeUnico = `${Date.now()}_${
    options.prefixo || ""
  }_${anexo.originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const caminhoDestinoFinal = path.join(destinoDir, nomeUnico);

  await fs.rename(tempFilePath, caminhoDestinoFinal);

  const caminhoRelativo = `checklist/checklist_${inspecaoId}/${destinoSubpasta}/${nomeUnico}`;

  const [result] = await connection.query(
    `INSERT INTO inspecoes_anexos (inspecao_id, item_resposta_id, item_especificacao_id, registro_id, item_avulso_id, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      inspecaoId,
      options.item_resposta_id || null,
      options.item_especificacao_id || null,
      options.registro_id || null,
      options.item_avulso_id || null,
      anexo.originalName,
      `/upload_arquivos_subestacoes/${caminhoRelativo}`,
      null,
      null,
      options.categoria_anexo,
    ]
  );
  return caminhoDestinoFinal;
}

router.get(
  "/pagina-checklist-inspecao-subestacao",
  autenticar,
  verificarNivel(3),
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
  verificarNivel(3),
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
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/detalhes-inspecao-checklist.html"
      )
    );
  }
);

router.post(
  "/api/inspecoes/upload-temporario",
  autenticar,
  verificarNivel(3),
  upload.single("anexo"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo enviado." });
    }

    const tempDir = path.join(uploadsSubestacoesDir, "temp");
    try {
      await fs.mkdir(tempDir, { recursive: true });

      const fileExtension = path.extname(req.file.originalname);
      const tempFileName = `${crypto.randomUUID()}${fileExtension}`;
      const tempFilePath = path.join(tempDir, tempFileName);

      await fs.rename(req.file.path, tempFilePath);

      res.status(201).json({
        tempFileName: tempFileName,
        originalName: req.file.originalname,
      });
    } catch (error) {
      await limparArquivosTemporariosUpload([req.file]);
      res.status(500).json({ message: "Erro ao processar upload temporário." });
    }
  }
);

router.get(
  "/api/checklist/modelo/padrao",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
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
      res.status(500).json({
        message: "Erro interno ao buscar modelo de checklist.",
        detalhes: error.message,
      });
    }
  }
);

router.post(
  "/inspecoes-subestacoes",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const {
      subestacao_id,
      responsavel_levantamento_id,
      tipo_inspecao,
      data_avaliacao,
      hora_inicial,
      inspection_mode,
      anexosGerais,
      avulsa_items,
      checklist_items,
      registros_dinamicos,
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
        !hora_inicial ||
        !inspection_mode
      ) {
        return res.status(400).json({
          message:
            "Campos obrigatórios do cabeçalho ou modo de inspeção não foram preenchidos.",
        });
      }

      await connection.beginTransaction();

      const [rI] = await connection.query(
        `INSERT INTO inspecoes_subestacoes (processo, subestacao_id, responsavel_levantamento_id, tipo_inspecao, modo_inspecao, data_avaliacao, hora_inicial, hora_final, status_inspecao, observacoes_gerais, formulario_inspecao_num) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.body.processo || null,
          subestacao_id,
          responsavel_levantamento_id,
          tipo_inspecao,
          inspection_mode.toUpperCase(),
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

      if (inspection_mode === "checklist") {
        if (checklist_items && Array.isArray(checklist_items)) {
          for (const item of checklist_items) {
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
            const mapaEspecificacoes = {};

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

            if (item.anexos && item.anexos.length > 0) {
              for (const anexo of item.anexos) {
                const especificacaoDbId =
                  anexo.associado_a === "geral"
                    ? null
                    : mapaEspecificacoes[anexo.associado_a];
                const caminhoMovido = await moverAnexo(
                  anexo,
                  novaInspecaoId,
                  `respostas_itens/resposta_${novaRespostaId}/anexos`,
                  connection,
                  {
                    prefixo: "ITEM",
                    categoria_anexo: "ITEM_ANEXO",
                    item_resposta_id: novaRespostaId,
                    item_especificacao_id: especificacaoDbId,
                  }
                );
                arquivosMovidosComSucessoParaRollback.push(caminhoMovido);
              }
            }
          }
        }
        if (registros_dinamicos && Array.isArray(registros_dinamicos)) {
          for (const registro of registros_dinamicos) {
            const [resultRegistro] = await connection.query(
              `INSERT INTO inspecoes_registros (inspecao_id, categoria_registro, tipo_especifico, tag_equipamento, descricao_item, valor_numerico, valor_texto, unidade_medida, estado_item, referencia_externa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                novaInspecaoId,
                registro.categoria,
                registro.tipo,
                registro.tag,
                registro.obs,
                null,
                registro.valor,
                registro.unidade,
                registro.estado,
                registro.ref_anterior,
              ]
            );
            const novoRegistroId = resultRegistro.insertId;
            if (registro.anexos && registro.anexos.length > 0) {
              for (const anexo of registro.anexos) {
                const caminhoMovido = await moverAnexo(
                  anexo,
                  novaInspecaoId,
                  `registros/registro_${novoRegistroId}`,
                  connection,
                  {
                    prefixo: "REG",
                    categoria_anexo: "REGISTRO_FOTO",
                    registro_id: novoRegistroId,
                  }
                );
                arquivosMovidosComSucessoParaRollback.push(caminhoMovido);
              }
            }
          }
        }
      } else if (inspection_mode === "avulsa") {
        if (avulsa_items && Array.isArray(avulsa_items)) {
          for (const item of avulsa_items) {
            const [resultItemAvulso] = await connection.query(
              `INSERT INTO inspecoes_avulsas_itens (inspecao_id, equipamento, tag, condicao, descricao) VALUES (?, ?, ?, ?, ?)`,
              [
                novaInspecaoId,
                item.equipamento,
                item.tag,
                item.condicao,
                item.descricao,
              ]
            );
            const novoItemAvulsoId = resultItemAvulso.insertId;
            if (item.anexos && Array.isArray(item.anexos)) {
              for (const anexo of item.anexos) {
                const caminhoMovido = await moverAnexo(
                  anexo,
                  novaInspecaoId,
                  `avulso_itens/item_${novoItemAvulsoId}`,
                  connection,
                  {
                    prefixo: "AVULSO",
                    categoria_anexo: "ITEM_AVULSO",
                    item_avulso_id: novoItemAvulsoId,
                  }
                );
                arquivosMovidosComSucessoParaRollback.push(caminhoMovido);
              }
            }
          }
        }
      }

      if (anexosGerais && Array.isArray(anexosGerais)) {
        for (const anexo of anexosGerais) {
          const caminhoMovido = await moverAnexo(
            anexo,
            novaInspecaoId,
            "anexos_gerais_inspecao",
            connection,
            {
              prefixo: "GERAL",
              categoria_anexo: "INSPECAO_GERAL",
            }
          );
          arquivosMovidosComSucessoParaRollback.push(caminhoMovido);
        }
      }

      await connection.commit();
      await registrarAuditoria(
        req.user.matricula,
        "CREATE_INSPECAO_SUBESTACAO",
        `Inspeção ID ${novaInspecaoId} (Modo: ${inspection_mode}) criada.`,
        connection
      );
      res.status(201).json({
        id: novaInspecaoId,
        message: "Inspeção registrada com sucesso!",
      });
    } catch (error) {
      if (connection) await connection.rollback();
      for (const caminho of arquivosMovidosComSucessoParaRollback) {
        try {
          await fs.unlink(caminho);
        } catch (e) {}
      }
      res.status(500).json({
        message: "Erro interno ao registrar a inspeção.",
        detalhes: error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.put(
  "/inspecoes-subestacoes/:id",
  autenticar,
  verificarNivel(3),
  verificarInspecaoExiste,
  async (req, res) => {
    const { id: inspecaoId } = req.params;
    const {
      subestacao_id,
      responsavel_levantamento_id,
      tipo_inspecao,
      data_avaliacao,
      hora_inicial,
      inspection_mode,
      anexosGerais,
      avulsa_items,
      checklist_items,
      registros_dinamicos,
      anexos_para_deletar,
    } = req.body;

    const connection = await promisePool.getConnection();
    let arquivosMovidosComSucessoParaRollback = [];

    try {
      await connection.beginTransaction();

      if (
        anexos_para_deletar &&
        Array.isArray(anexos_para_deletar) &&
        anexos_para_deletar.length > 0
      ) {
        const [anexosDb] = await connection.query(
          "SELECT id, caminho_servidor FROM inspecoes_anexos WHERE id IN (?)",
          [anexos_para_deletar]
        );
        for (const anexo of anexosDb) {
          const fullPath = path.join(
            projectRootDir,
            "public",
            anexo.caminho_servidor
          );
          try {
            await fs.unlink(fullPath);
          } catch (err) {
            if (err.code !== "ENOENT") {
              console.warn(
                `Falha ao deletar arquivo do anexo ${anexo.id}: ${fullPath}`
              );
            }
          }
        }
        await connection.query("DELETE FROM inspecoes_anexos WHERE id IN (?)", [
          anexos_para_deletar,
        ]);
      }

      const [respostasAntigas] = await connection.query(
        "SELECT id FROM inspecoes_itens_respostas WHERE inspecao_id = ?",
        [inspecaoId]
      );
      if (respostasAntigas.length > 0) {
        const idsRespostasAntigas = respostasAntigas.map((r) => r.id);
        await connection.query(
          "DELETE FROM inspecoes_item_especificacoes WHERE item_resposta_id IN (?)",
          [idsRespostasAntigas]
        );
      }
      await connection.query(
        "DELETE FROM inspecoes_itens_respostas WHERE inspecao_id = ?",
        [inspecaoId]
      );
      await connection.query(
        "DELETE FROM inspecoes_registros WHERE inspecao_id = ?",
        [inspecaoId]
      );
      await connection.query(
        "DELETE FROM inspecoes_avulsas_itens WHERE inspecao_id = ?",
        [inspecaoId]
      );

      await connection.query(
        `UPDATE inspecoes_subestacoes SET
            processo = ?, subestacao_id = ?, responsavel_levantamento_id = ?,
            tipo_inspecao = ?, modo_inspecao = ?, data_avaliacao = ?,
            hora_inicial = ?, hora_final = ?, observacoes_gerais = ?
         WHERE id = ?`,
        [
          req.body.processo || null,
          subestacao_id,
          responsavel_levantamento_id,
          tipo_inspecao,
          inspection_mode.toUpperCase(),
          data_avaliacao,
          hora_inicial,
          req.body.hora_final || null,
          req.body.observacoes_gerais || null,
          inspecaoId,
        ]
      );

      if (inspection_mode === "checklist") {
        if (checklist_items && Array.isArray(checklist_items)) {
          for (const item of checklist_items) {
            const [resultResposta] = await connection.query(
              `INSERT INTO inspecoes_itens_respostas (inspecao_id, item_checklist_id, avaliacao, observacao_item) VALUES (?, ?, ?, ?)`,
              [
                inspecaoId,
                item.item_checklist_id,
                item.avaliacao,
                item.observacao_item || null,
              ]
            );
            const novaRespostaId = resultResposta.insertId;
            const mapaEspecificacoes = {};

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

            if (item.anexos && item.anexos.length > 0) {
              for (const anexo of item.anexos) {
                const especificacaoDbId =
                  anexo.associado_a === "geral"
                    ? null
                    : mapaEspecificacoes[anexo.associado_a];
                const caminhoMovido = await moverAnexo(
                  anexo,
                  inspecaoId,
                  `respostas_itens/resposta_${novaRespostaId}/anexos`,
                  connection,
                  {
                    prefixo: "ITEM",
                    categoria_anexo: "ITEM_ANEXO",
                    item_resposta_id: novaRespostaId,
                    item_especificacao_id: especificacaoDbId,
                  }
                );
                arquivosMovidosComSucessoParaRollback.push(caminhoMovido);
              }
            }
          }
        }
        if (registros_dinamicos && Array.isArray(registros_dinamicos)) {
          for (const registro of registros_dinamicos) {
            const [resultRegistro] = await connection.query(
              `INSERT INTO inspecoes_registros (inspecao_id, categoria_registro, tipo_especifico, tag_equipamento, descricao_item, valor_numerico, valor_texto, unidade_medida, estado_item, referencia_externa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                inspecaoId,
                registro.categoria,
                registro.tipo,
                registro.tag,
                registro.obs,
                null,
                registro.valor,
                registro.unidade,
                registro.estado,
                registro.ref_anterior,
              ]
            );
            const novoRegistroId = resultRegistro.insertId;

            if (
              registro.anexos_existentes &&
              registro.anexos_existentes.length > 0
            ) {
              await connection.query(
                "UPDATE inspecoes_anexos SET registro_id = ? WHERE id IN (?)",
                [novoRegistroId, registro.anexos_existentes]
              );
            }

            if (registro.anexos && registro.anexos.length > 0) {
              for (const anexo of registro.anexos) {
                const caminhoMovido = await moverAnexo(
                  anexo,
                  inspecaoId,
                  `registros/registro_${novoRegistroId}`,
                  connection,
                  {
                    prefixo: "REG",
                    categoria_anexo: "REGISTRO_FOTO",
                    registro_id: novoRegistroId,
                  }
                );
                arquivosMovidosComSucessoParaRollback.push(caminhoMovido);
              }
            }
          }
        }
      } else if (inspection_mode === "avulsa") {
        if (avulsa_items && Array.isArray(avulsa_items)) {
          for (const item of avulsa_items) {
            const [resultItemAvulso] = await connection.query(
              `INSERT INTO inspecoes_avulsas_itens (inspecao_id, equipamento, tag, condicao, descricao) VALUES (?, ?, ?, ?, ?)`,
              [
                inspecaoId,
                item.equipamento,
                item.tag,
                item.condicao,
                item.descricao,
              ]
            );
            const novoItemAvulsoId = resultItemAvulso.insertId;
            if (item.anexos && Array.isArray(item.anexos)) {
              for (const anexo of item.anexos) {
                const caminhoMovido = await moverAnexo(
                  anexo,
                  inspecaoId,
                  `avulso_itens/item_${novoItemAvulsoId}`,
                  connection,
                  {
                    prefixo: "AVULSO",
                    categoria_anexo: "ITEM_AVULSO",
                    item_avulso_id: novoItemAvulsoId,
                  }
                );
                arquivosMovidosComSucessoParaRollback.push(caminhoMovido);
              }
            }
          }
        }
      }

      if (anexosGerais && Array.isArray(anexosGerais)) {
        for (const anexo of anexosGerais) {
          const caminhoMovido = await moverAnexo(
            anexo,
            inspecaoId,
            "anexos_gerais_inspecao",
            connection,
            {
              prefixo: "GERAL",
              categoria_anexo: "INSPECAO_GERAL",
            }
          );
          arquivosMovidosComSucessoParaRollback.push(caminhoMovido);
        }
      }

      await connection.commit();
      await registrarAuditoria(
        req.user.matricula,
        "UPDATE_INSPECAO_SUBESTACAO",
        `Inspeção ID ${inspecaoId} (Modo: ${inspection_mode}) atualizada.`,
        connection
      );
      res.status(200).json({
        id: inspecaoId,
        message: "Inspeção atualizada com sucesso!",
      });
    } catch (error) {
      if (connection) await connection.rollback();
      for (const caminho of arquivosMovidosComSucessoParaRollback) {
        try {
          await fs.unlink(caminho);
        } catch (e) {}
      }
      res.status(500).json({
        message: "Erro interno ao atualizar a inspeção.",
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
  verificarNivel(3),
  async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id, 10)))
      return res
        .status(400)
        .json({ message: `ID da inspeção inválido: ${id}` });

    try {
      const [inspecaoRows] = await promisePool.query(
        `SELECT i.id, i.processo, i.subestacao_id, i.formulario_inspecao_num, i.responsavel_levantamento_id,
                    i.tipo_inspecao, i.modo_inspecao,
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
      const respostaFinal = {
        ...inspecao,
        itens: [],
        registros: [],
        itens_avulsos: [],
        anexos: [],
      };

      const [anexosRows] = await promisePool.query(
        `SELECT id, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo, descricao_anexo,
                    item_resposta_id, item_especificacao_id, registro_id, item_avulso_id
             FROM inspecoes_anexos WHERE inspecao_id = ?`,
        [id]
      );
      respostaFinal.anexos = anexosRows;

      if (inspecao.modo_inspecao === "CHECKLIST") {
        const [respostasRows] = await promisePool.query(
          `SELECT r.id as resposta_id, r.avaliacao, r.observacao_item,
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

        respostaFinal.itens = respostasRows.map((r) => ({
          ...r,
          especificacoes: especificacoesRows.filter(
            (e) => e.item_resposta_id === r.resposta_id
          ),
        }));

        const [registrosRows] = await promisePool.query(
          `SELECT id, categoria_registro, tipo_especifico, tag_equipamento, descricao_item, valor_numerico, valor_texto, unidade_medida, estado_item, referencia_externa
                 FROM inspecoes_registros WHERE inspecao_id = ? ORDER BY id ASC`,
          [id]
        );
        respostaFinal.registros = registrosRows;
      } else if (inspecao.modo_inspecao === "AVULSA") {
        const [avulsoItemsRows] = await promisePool.query(
          `SELECT id, equipamento, tag, condicao, descricao FROM inspecoes_avulsas_itens WHERE inspecao_id = ? ORDER BY id ASC`,
          [id]
        );
        const anexosAvulsos = anexosRows.filter(
          (a) => a.item_avulso_id !== null
        );
        respostaFinal.itens_avulsos = avulsoItemsRows.map((item) => ({
          ...item,
          anexos: anexosAvulsos.filter(
            (anexo) => anexo.item_avulso_id === item.id
          ),
        }));
      }

      res.json(respostaFinal);
    } catch (error) {
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
  verificarNivel(3),
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
  verificarNivel(3),
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
  verificarNivel(3),
  verificarInspecaoExiste,
  async (req, res) => {
    const { inspecaoId } = req;
    const { anexos, descricao_anexo_escritorio } = req.body;

    if (!anexos || !Array.isArray(anexos) || anexos.length === 0) {
      return res.status(400).json({ message: "Nenhum anexo informado." });
    }

    const connection = await promisePool.getConnection();
    let arquivosMovidosComSucesso = [];
    try {
      await connection.beginTransaction();

      let aSI = [];
      for (const anexo of anexos) {
        const caminhoMovido = await moverAnexo(
          anexo,
          inspecaoId,
          "anexos_escritorio",
          connection,
          {
            prefixo: "ESCRITORIO",
            categoria_anexo: "ESCRITORIO",
          }
        );
        arquivosMovidosComSucesso.push(caminhoMovido);
        aSI.push({
          nome_original: anexo.originalName,
          caminho_servidor: caminhoMovido,
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
  verificarNivel(3),
  async (req, res) => {
    try {
      const { paginated = "true" } = req.query;

      let baseQuery = `
        FROM inspecoes_subestacoes i
        JOIN subestacoes s ON i.subestacao_id = s.Id
        JOIN users u ON i.responsavel_levantamento_id = u.id
      `;

      let whereClauses = "WHERE 1=1";
      const params = [];

      if (req.query.subestacao_id) {
        whereClauses += " AND i.subestacao_id = ?";
        params.push(req.query.subestacao_id);
      }
      if (req.query.status_inspecao) {
        whereClauses += " AND i.status_inspecao = ?";
        params.push(req.query.status_inspecao);
      }
      if (req.query.tipo_inspecao) {
        whereClauses += " AND i.tipo_inspecao = ?";
        params.push(req.query.tipo_inspecao);
      }
      if (req.query.modo_inspecao) {
        whereClauses += " AND i.modo_inspecao = ?";
        params.push(req.query.modo_inspecao);
      }
      if (req.query.processo) {
        whereClauses += " AND i.processo LIKE ?";
        params.push(`%${req.query.processo}%`);
      }
      if (req.query.responsavel_id) {
        whereClauses += " AND i.responsavel_levantamento_id = ?";
        params.push(req.query.responsavel_id);
      }
      if (req.query.data_avaliacao_de) {
        whereClauses += " AND i.data_avaliacao >= ?";
        params.push(req.query.data_avaliacao_de);
      }
      if (req.query.data_avaliacao_ate) {
        whereClauses += " AND i.data_avaliacao <= ?";
        params.push(req.query.data_avaliacao_ate);
      }

      const selectFields = `
        SELECT
          i.id,
          i.processo,
          i.formulario_inspecao_num,
          i.tipo_inspecao,
          i.modo_inspecao,
          DATE_FORMAT(i.data_avaliacao, '%Y-%m-%d') as data_avaliacao,
          i.status_inspecao,
          s.sigla as subestacao_sigla,
          u.nome as responsavel_nome
      `;

      if (paginated === "false") {
        const query = `${selectFields} ${baseQuery} ${whereClauses} ORDER BY i.data_avaliacao DESC, i.id DESC`;
        const [rows] = await promisePool.query(query, params);
        res.json(rows);
      } else {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const countQuery = `SELECT COUNT(i.id) as total ${baseQuery} ${whereClauses}`;
        const [countRows] = await promisePool.query(countQuery, params);
        const totalItems = countRows[0].total;

        const dataQuery = `${selectFields} ${baseQuery} ${whereClauses} ORDER BY i.data_avaliacao DESC, i.id DESC LIMIT ? OFFSET ?`;
        const [rows] = await promisePool.query(dataQuery, [
          ...params,
          limit,
          offset,
        ]);

        res.json({
          data: rows,
          total: totalItems,
          page: page,
          limit: limit,
          totalPages: Math.ceil(totalItems / limit),
        });
      }
    } catch (error) {
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
  verificarNivel(3),
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
  verificarNivel(3),
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
          `SELECT
              r.id as resposta_id,
              ci.descricao_item,
              r.observacao_item,
              (SELECT JSON_ARRAYAGG(JSON_OBJECT('caminho_servidor', a.caminho_servidor, 'nome_original', a.nome_original))
               FROM inspecoes_anexos a
               WHERE a.item_resposta_id = r.id AND a.item_especificacao_id IS NULL) as anexos_gerais,
              (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', esp.id, 'descricao_equipamento', esp.descricao_equipamento, 'observacao', esp.observacao, 'anexos',
                  (SELECT JSON_ARRAYAGG(JSON_OBJECT('caminho_servidor', an.caminho_servidor, 'nome_original', an.nome_original))
                   FROM inspecoes_anexos an WHERE an.item_especificacao_id = esp.id)
              ))
               FROM inspecoes_item_especificacoes esp WHERE esp.item_resposta_id = r.id) as especificacoes
           FROM inspecoes_itens_respostas r
           JOIN checklist_itens ci ON r.item_checklist_id = ci.id
           WHERE r.inspecao_id = ? AND r.avaliacao = 'A'`,
          [inspecao.id]
        );

        inspecao.itens_anormais = itensAnormais.map((item) => {
          const parseJsonArray = (jsonStringOrObject) => {
            if (!jsonStringOrObject) return [];
            if (Array.isArray(jsonStringOrObject)) return jsonStringOrObject;
            try {
              return JSON.parse(jsonStringOrObject);
            } catch (e) {
              return [];
            }
          };

          item.anexos_gerais = parseJsonArray(item.anexos_gerais);
          item.especificacoes = parseJsonArray(item.especificacoes);

          item.especificacoes.forEach((esp) => {
            esp.anexos = parseJsonArray(esp.anexos);
          });

          return item;
        });
      }

      res.json(inspecoes);
    } catch (error) {
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
  verificarNivel(3),
  verificarInspecaoExiste,
  async (req, res) => {
    const { inspecaoId } = req;
    const itemChecklistId = parseInt(req.params.itemChecklistId, 10);
    const { anexos, item_especificacao_id } = req.body;

    if (isNaN(itemChecklistId) || itemChecklistId <= 0) {
      return res.status(400).json({ message: "ID do item inválido." });
    }
    if (!anexos || anexos.length === 0) {
      return res.status(400).json({ message: "Nenhum anexo enviado." });
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
        await connection.rollback();
        return res.status(404).json({
          message: `Resposta para o item ${itemChecklistId} não encontrada na inspeção ${inspecaoId}.`,
        });
      }
      const itemRespostaId = respostaCheck[0].id;
      const especificacaoIdFinal = item_especificacao_id
        ? parseInt(item_especificacao_id, 10)
        : null;

      let anexosSalvosInfo = [];
      for (const anexo of anexos) {
        const caminhoMovido = await moverAnexo(
          anexo,
          inspecaoId,
          `respostas_itens/resposta_${itemRespostaId}/termografia`,
          connection,
          {
            prefixo: "TERMO",
            categoria_anexo: "ITEM_TERMOGRAFIA",
            item_resposta_id: itemRespostaId,
            item_especificacao_id: especificacaoIdFinal,
          }
        );
        arquivosMovidosComSucesso.push(caminhoMovido);
        anexosSalvosInfo.push({
          nome_original: anexo.originalName,
          caminho_servidor: caminhoMovido,
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
