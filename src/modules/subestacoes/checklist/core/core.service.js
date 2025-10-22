const { promisePool, uploadsSubestacoesDir } = require("../../../../init");
const path = require("path");
const fs = require("fs").promises;

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
  await connection.query(
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

async function obterModeloPadrao() {
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
  return grupos;
}

async function criarInspecao(dados) {
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
    processo,
    hora_final,
    observacoes_gerais,
  } = dados;
  if (
    !subestacao_id ||
    !responsavel_levantamento_id ||
    !tipo_inspecao ||
    !hora_inicial ||
    !inspection_mode
  ) {
    throw new Error(
      "Campos obrigatórios do cabeçalho ou modo de inspeção não foram preenchidos."
    );
  }

  const connection = await promisePool.getConnection();
  let novaInspecaoId;
  let arquivosMovidosComSucessoParaRollback = [];
  try {
    await connection.beginTransaction();
    const [rI] = await connection.query(
      `INSERT INTO inspecoes_subestacoes (processo, subestacao_id, responsavel_levantamento_id, tipo_inspecao, modo_inspecao, data_avaliacao, hora_inicial, hora_final, status_inspecao, observacoes_gerais, formulario_inspecao_num) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        processo || null,
        subestacao_id,
        responsavel_levantamento_id,
        tipo_inspecao,
        inspection_mode.toUpperCase(),
        data_avaliacao || null,
        hora_inicial,
        hora_final || null,
        "EM_ANDAMENTO",
        observacoes_gerais || null,
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
          { prefixo: "GERAL", categoria_anexo: "INSPECAO_GERAL" }
        );
        arquivosMovidosComSucessoParaRollback.push(caminhoMovido);
      }
    }
    await connection.commit();
    return {
      novaInspecaoId,
      connection,
      arquivosMovidos: arquivosMovidosComSucessoParaRollback,
    };
  } catch (error) {
    if (connection) await connection.rollback();
    for (const caminho of arquivosMovidosComSucessoParaRollback) {
      try {
        await fs.unlink(caminho);
      } catch (e) {}
    }
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function atualizarInspecao(inspecaoId, dados) {
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
    deleted_ids,
    processo,
    hora_final,
    observacoes_gerais,
  } = dados;
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
        "SELECT id, caminho_servidor FROM inspecoes_anexos WHERE id IN (?) AND inspecao_id = ?",
        [anexos_para_deletar, inspecaoId]
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
          if (err.code !== "ENOENT")
            console.warn(
              `Falha ao deletar arquivo do anexo ${anexo.id}: ${fullPath}`
            );
        }
      }
      await connection.query("DELETE FROM inspecoes_anexos WHERE id IN (?)", [
        anexos_para_deletar,
      ]);
    }

    if (deleted_ids) {
      if (deleted_ids.especificacoes && deleted_ids.especificacoes.length > 0)
        await connection.query(
          "DELETE FROM inspecoes_item_especificacoes WHERE id IN (?)",
          [deleted_ids.especificacoes]
        );
      if (deleted_ids.respostas && deleted_ids.respostas.length > 0)
        await connection.query(
          "DELETE FROM inspecoes_itens_respostas WHERE id IN (?) AND inspecao_id = ?",
          [deleted_ids.respostas, inspecaoId]
        );
      if (deleted_ids.registros && deleted_ids.registros.length > 0)
        await connection.query(
          "DELETE FROM inspecoes_registros WHERE id IN (?) AND inspecao_id = ?",
          [deleted_ids.registros, inspecaoId]
        );
      if (deleted_ids.avulsos && deleted_ids.avulsos.length > 0)
        await connection.query(
          "DELETE FROM inspecoes_avulsas_itens WHERE id IN (?) AND inspecao_id = ?",
          [deleted_ids.avulsos, inspecaoId]
        );
    }

    await connection.query(
      `UPDATE inspecoes_subestacoes SET processo = ?, subestacao_id = ?, responsavel_levantamento_id = ?, tipo_inspecao = ?, modo_inspecao = ?, data_avaliacao = ?, hora_inicial = ?, hora_final = ?, observacoes_gerais = ? WHERE id = ?`,
      [
        processo || null,
        subestacao_id,
        responsavel_levantamento_id,
        tipo_inspecao,
        inspection_mode.toUpperCase(),
        data_avaliacao || null,
        hora_inicial,
        hora_final || null,
        observacoes_gerais || null,
        inspecaoId,
      ]
    );

    if (inspection_mode === "checklist") {
      if (checklist_items && Array.isArray(checklist_items)) {
        for (const item of checklist_items) {
          let respostaId = item.id;
          if (respostaId) {
            await connection.query(
              `UPDATE inspecoes_itens_respostas SET avaliacao = ?, observacao_item = ? WHERE id = ? AND inspecao_id = ?`,
              [
                item.avaliacao,
                item.observacao_item || null,
                respostaId,
                inspecaoId,
              ]
            );
          } else {
            const [resultResposta] = await connection.query(
              `INSERT INTO inspecoes_itens_respostas (inspecao_id, item_checklist_id, avaliacao, observacao_item) VALUES (?, ?, ?, ?)`,
              [
                inspecaoId,
                item.item_checklist_id,
                item.avaliacao,
                item.observacao_item || null,
              ]
            );
            respostaId = resultResposta.insertId;
          }
          const mapaEspecificacoes = {};
          if (item.especificacoes && item.especificacoes.length > 0) {
            for (const especificacao of item.especificacoes) {
              let especificacaoId = especificacao.id;
              if (especificacaoId) {
                await connection.query(
                  `UPDATE inspecoes_item_especificacoes SET descricao_equipamento = ?, observacao = ? WHERE id = ? AND item_resposta_id = ?`,
                  [
                    especificacao.descricao_equipamento,
                    especificacao.observacao || null,
                    especificacaoId,
                    respostaId,
                  ]
                );
              } else {
                const [resultEsp] = await connection.query(
                  `INSERT INTO inspecoes_item_especificacoes (item_resposta_id, descricao_equipamento, observacao) VALUES (?, ?, ?)`,
                  [
                    respostaId,
                    especificacao.descricao_equipamento,
                    especificacao.observacao || null,
                  ]
                );
                especificacaoId = resultEsp.insertId;
              }
              mapaEspecificacoes[especificacao.temp_id] = especificacaoId;
            }
          }
          if (item.anexos && item.anexos.length > 0) {
            for (const anexo of item.anexos) {
              const especificacaoDbId =
                anexo.associado_a === "geral"
                  ? null
                  : mapaEspecificacoes[anexo.associado_a] || anexo.associado_a;
              const caminhoMovido = await moverAnexo(
                anexo,
                inspecaoId,
                `respostas_itens/resposta_${respostaId}/anexos`,
                connection,
                {
                  prefixo: "ITEM",
                  categoria_anexo: "ITEM_ANEXO",
                  item_resposta_id: respostaId,
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
          let registroId = registro.id;
          if (registroId) {
            await connection.query(
              `UPDATE inspecoes_registros SET categoria_registro = ?, tipo_especifico = ?, tag_equipamento = ?, descricao_item = ?, valor_numerico = ?, valor_texto = ?, unidade_medida = ?, estado_item = ?, referencia_externa = ? WHERE id = ? AND inspecao_id = ?`,
              [
                registro.categoria,
                registro.tipo,
                registro.tag,
                registro.obs,
                null,
                registro.valor,
                registro.unidade,
                registro.estado,
                registro.ref_anterior,
                registroId,
                inspecaoId,
              ]
            );
          } else {
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
            registroId = resultRegistro.insertId;
          }
          if (registro.anexos && registro.anexos.length > 0) {
            for (const anexo of registro.anexos) {
              const caminhoMovido = await moverAnexo(
                anexo,
                inspecaoId,
                `registros/registro_${registroId}`,
                connection,
                {
                  prefixo: "REG",
                  categoria_anexo: "REGISTRO_FOTO",
                  registro_id: registroId,
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
          let itemAvulsoId = item.id;
          if (itemAvulsoId) {
            await connection.query(
              `UPDATE inspecoes_avulsas_itens SET equipamento = ?, tag = ?, condicao = ?, descricao = ? WHERE id = ? AND inspecao_id = ?`,
              [
                item.equipamento,
                item.tag,
                item.condicao,
                item.descricao,
                itemAvulsoId,
                inspecaoId,
              ]
            );
          } else {
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
            itemAvulsoId = resultItemAvulso.insertId;
          }
          if (item.anexos && Array.isArray(item.anexos)) {
            for (const anexo of item.anexos) {
              const caminhoMovido = await moverAnexo(
                anexo,
                inspecaoId,
                `avulso_itens/item_${itemAvulsoId}`,
                connection,
                {
                  prefixo: "AVULSO",
                  categoria_anexo: "ITEM_AVULSO",
                  item_avulso_id: itemAvulsoId,
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
          { prefixo: "GERAL", categoria_anexo: "INSPECAO_GERAL" }
        );
        arquivosMovidosComSucessoParaRollback.push(caminhoMovido);
      }
    }

    await connection.commit();
    return {
      connection,
      arquivosMovidos: arquivosMovidosComSucessoParaRollback,
    };
  } catch (error) {
    if (connection) await connection.rollback();
    for (const caminho of arquivosMovidosComSucessoParaRollback) {
      try {
        await fs.unlink(caminho);
      } catch (e) {}
    }
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function listarInspecoes(filtros, paginacao) {
  const { paginated = "true" } = filtros;
  let baseQuery = `FROM inspecoes_subestacoes i JOIN subestacoes s ON i.subestacao_id = s.Id JOIN users u ON i.responsavel_levantamento_id = u.id`;
  let whereClauses = "WHERE 1=1";
  const params = [];

  if (filtros.subestacao_id) {
    whereClauses += " AND i.subestacao_id = ?";
    params.push(filtros.subestacao_id);
  }
  if (filtros.status_inspecao) {
    whereClauses += " AND i.status_inspecao = ?";
    params.push(filtros.status_inspecao);
  }
  if (filtros.tipo_inspecao) {
    whereClauses += " AND i.tipo_inspecao = ?";
    params.push(filtros.tipo_inspecao);
  }
  if (filtros.modo_inspecao) {
    whereClauses += " AND i.modo_inspecao = ?";
    params.push(filtros.modo_inspecao);
  }
  if (filtros.processo) {
    whereClauses += " AND i.processo LIKE ?";
    params.push(`%${filtros.processo}%`);
  }
  if (filtros.responsavel_id) {
    whereClauses += " AND i.responsavel_levantamento_id = ?";
    params.push(filtros.responsavel_id);
  }
  if (filtros.data_avaliacao_de) {
    whereClauses += " AND i.data_avaliacao >= ?";
    params.push(filtros.data_avaliacao_de);
  }
  if (filtros.data_avaliacao_ate) {
    whereClauses += " AND i.data_avaliacao <= ?";
    params.push(filtros.data_avaliacao_ate);
  }

  const selectFields = `SELECT i.id, i.processo, i.formulario_inspecao_num, i.tipo_inspecao, i.modo_inspecao, DATE_FORMAT(i.data_avaliacao, '%Y-%m-%d') as data_avaliacao, i.status_inspecao, s.sigla as subestacao_sigla, u.nome as responsavel_nome, (SELECT COUNT(*) FROM inspecoes_anexos WHERE inspecao_id = i.id AND categoria_anexo = 'INSPECAO_APR') as apr_count, (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', id, 'caminho_servidor', caminho_servidor, 'nome_original', nome_original)) FROM inspecoes_anexos WHERE inspecao_id = i.id AND categoria_anexo = 'INSPECAO_APR') as apr_anexos`;

  if (paginated === "false") {
    const query = `${selectFields} ${baseQuery} ${whereClauses} ORDER BY i.data_avaliacao DESC, i.id DESC`;
    const [rows] = await promisePool.query(query, params);
    return rows;
  } else {
    const page = paginacao.page;
    const limit = paginacao.limit;
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
    return {
      data: rows,
      total: totalItems,
      page,
      limit,
      totalPages: Math.ceil(totalItems / limit),
    };
  }
}

async function obterInspecaoCompleta(id) {
  if (isNaN(parseInt(id, 10)))
    throw new Error(`ID da inspeção inválido: ${id}`);
  const [inspecaoRows] = await promisePool.query(
    `SELECT i.id, i.processo, i.subestacao_id, i.formulario_inspecao_num, i.responsavel_levantamento_id, i.tipo_inspecao, i.modo_inspecao, DATE_FORMAT(i.data_avaliacao, '%d/%m/%Y') as data_avaliacao_fmt, i.data_avaliacao, i.hora_inicial, i.hora_final, i.status_inspecao, i.observacoes_gerais, s.sigla as subestacao_sigla, s.nome as subestacao_nome, u.nome as responsavel_nome FROM inspecoes_subestacoes i JOIN subestacoes s ON i.subestacao_id = s.Id JOIN users u ON i.responsavel_levantamento_id = u.id WHERE i.id = ?`,
    [id]
  );
  if (inspecaoRows.length === 0)
    throw new Error(`Inspeção ID ${id} não encontrada.`);

  const inspecao = inspecaoRows[0];
  const respostaFinal = {
    ...inspecao,
    itens: [],
    registros: [],
    itens_avulsos: [],
    anexos: [],
  };

  const [anexosRows] = await promisePool.query(
    `SELECT id, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo, descricao_anexo, item_resposta_id, item_especificacao_id, registro_id, item_avulso_id FROM inspecoes_anexos WHERE inspecao_id = ?`,
    [id]
  );
  respostaFinal.anexos = anexosRows;

  if (inspecao.modo_inspecao === "CHECKLIST") {
    const [respostasRows] = await promisePool.query(
      `SELECT r.id as resposta_id, r.avaliacao, r.observacao_item, ci.id as item_checklist_id, ci.descricao_item, cg.nome_grupo, cg.ordem as grupo_ordem, ci.ordem as item_ordem FROM inspecoes_itens_respostas r JOIN checklist_itens ci ON r.item_checklist_id = ci.id JOIN checklist_grupos cg ON ci.grupo_id = cg.id WHERE r.inspecao_id = ? ORDER BY cg.ordem, ci.ordem ASC`,
      [id]
    );
    const idRespostas = respostasRows.map((r) => r.resposta_id);
    let especificacoesRows = [];
    if (idRespostas.length > 0) {
      [especificacoesRows] = await promisePool.query(
        `SELECT id, item_resposta_id, descricao_equipamento, observacao FROM inspecoes_item_especificacoes WHERE item_resposta_id IN (?)`,
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
      `SELECT id, categoria_registro, tipo_especifico, tag_equipamento, descricao_item, valor_numerico, valor_texto, unidade_medida, estado_item, referencia_externa FROM inspecoes_registros WHERE inspecao_id = ? ORDER BY id ASC`,
      [id]
    );
    respostaFinal.registros = registrosRows;
  } else if (inspecao.modo_inspecao === "AVULSA") {
    const [avulsoItemsRows] = await promisePool.query(
      `SELECT id, equipamento, tag, condicao, descricao FROM inspecoes_avulsas_itens WHERE inspecao_id = ? ORDER BY id ASC`,
      [id]
    );
    const anexosAvulsos = anexosRows.filter((a) => a.item_avulso_id !== null);
    respostaFinal.itens_avulsos = avulsoItemsRows.map((item) => ({
      ...item,
      anexos: anexosAvulsos.filter((anexo) => anexo.item_avulso_id === item.id),
    }));
  }
  return respostaFinal;
}

async function concluirInspecao(inspecaoId) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const [cIR] = await connection.query(
      "SELECT status_inspecao, hora_final FROM inspecoes_subestacoes WHERE id = ?",
      [inspecaoId]
    );
    if (cIR.length === 0)
      throw new Error(`Inspeção ${inspecaoId} não encontrada.`);

    const cS = cIR[0].status_inspecao;
    let hFA = cIR[0].hora_final;
    if (cS === "CONCLUIDA" || cS === "CANCELADA")
      throw new Error(`Inspeção ${inspecaoId} já está ${cS}.`);

    let sUQ = "UPDATE inspecoes_subestacoes SET status_inspecao = 'CONCLUIDA'";
    const pU = [];
    if (!hFA) {
      hFA = new Date().toLocaleTimeString("pt-BR", {
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
    if (result.affectedRows === 0)
      throw new Error("Falha ao atualizar. Nenhuma linha afetada.");

    await connection.commit();
    return { connection };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function reabrirInspecao(inspecaoId) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const [cIR] = await connection.query(
      "SELECT status_inspecao FROM inspecoes_subestacoes WHERE id = ?",
      [inspecaoId]
    );
    if (cIR.length === 0)
      throw new Error(`Inspeção ${inspecaoId} não encontrada.`);

    const cS = cIR[0].status_inspecao;
    const sR = ["CONCLUIDA", "CANCELADA"];
    if (!sR.includes(cS))
      throw new Error(`Inspeção ${inspecaoId} (${cS}) não pode ser reaberta.`);

    const [result] = await connection.query(
      "UPDATE inspecoes_subestacoes SET status_inspecao = 'EM_ANDAMENTO', hora_final = NULL WHERE id = ?",
      [inspecaoId]
    );
    if (result.affectedRows === 0)
      throw new Error("Falha ao reabrir. Nenhuma linha afetada.");

    await connection.commit();
    return { connection };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function deletarInspecao(inspecaoId, inspecaoInfo) {
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
    await fs.rm(inspecaoDir, { recursive: true, force: true }).catch((err) => {
      if (err.code !== "ENOENT")
        console.warn(
          `Falha ao excluir diretório ${inspecaoDir}: ${err.message}`
        );
    });
    await connection.commit();
    return { connection };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  obterModeloPadrao,
  criarInspecao,
  atualizarInspecao,
  listarInspecoes,
  obterInspecaoCompleta,
  concluirInspecao,
  reabrirInspecao,
  deletarInspecao,
};
