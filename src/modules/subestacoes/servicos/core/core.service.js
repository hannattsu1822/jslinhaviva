const { promisePool, uploadsSubestacoesDir } = require("../../../../init");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;

async function listarUsuariosPorCargo(cargos) {
  const placeholders = cargos.map(() => "?").join(",");
  const query = `SELECT DISTINCT id, nome FROM users WHERE cargo IN (${placeholders}) ORDER BY nome ASC`;
  const [rows] = await promisePool.query(query, cargos);
  return rows;
}

async function listarCatalogoDefeitos() {
  const [rows] = await promisePool.query(
    "SELECT id, codigo, ponto_defeito, descricao, categoria_principal FROM catalogo_defeitos_servicos ORDER BY codigo ASC"
  );
  return rows;
}

async function criarServico(dados, arquivos) {
  const {
    subestacao_id,
    processo,
    motivo,
    data_prevista,
    horario_inicio,
    horario_fim,
    responsavel_id,
    status,
    prioridade,
    data_conclusao,
    observacoes_conclusao,
    inspecao_ids_vinculadas,
    itens_escopo,
    tipo_ordem,
  } = dados;

  if (
    !subestacao_id ||
    !processo ||
    !motivo ||
    !data_prevista ||
    !horario_inicio ||
    !horario_fim ||
    !responsavel_id
  ) {
    throw new Error("Campos obrigatórios faltando.");
  }

  if (status === "CONCLUIDO" && !data_conclusao) {
    throw new Error(
      "Data de conclusão obrigatória para serviços com status CONCLUÍDO."
    );
  }

  let parsedInspecaoIds = [];
  if (inspecao_ids_vinculadas) {
    parsedInspecaoIds = JSON.parse(inspecao_ids_vinculadas);
    if (
      !Array.isArray(parsedInspecaoIds) ||
      !parsedInspecaoIds.every((id) => Number.isInteger(Number(id)))
    ) {
      throw new Error("Formato inválido para IDs de inspeção vinculadas.");
    }
  }

  let parsedItensEscopo = [];
  if (itens_escopo) {
    parsedItensEscopo = JSON.parse(itens_escopo);
    if (!Array.isArray(parsedItensEscopo))
      throw new Error("Formato inválido para itens_escopo.");
    for (const item of parsedItensEscopo) {
      if (!item.descricao_item_servico && !item.catalogo_defeito_id) {
        throw new Error(
          "Cada item de escopo deve ter uma descrição ou um código de defeito do catálogo."
        );
      }
    }
  }

  const connection = await promisePool.getConnection();
  let novoServicoId;

  try {
    await connection.beginTransaction();
    const dataConclusaoFinal = status === "CONCLUIDO" ? data_conclusao : null;
    const observacoesConclusaoFinal =
      status === "CONCLUIDO" ? observacoes_conclusao : null;

    const [resultServico] = await connection.query(
      `INSERT INTO servicos_subestacoes (subestacao_id, processo, motivo, data_prevista, horario_inicio, horario_fim, responsavel_id, status, prioridade, data_conclusao, observacoes_conclusao, tipo_ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parseInt(subestacao_id),
        processo,
        motivo,
        data_prevista,
        horario_inicio,
        horario_fim,
        parseInt(responsavel_id),
        status || "PROGRAMADO",
        prioridade || "MEDIA",
        dataConclusaoFinal,
        observacoesConclusaoFinal,
        tipo_ordem || null,
      ]
    );
    novoServicoId = resultServico.insertId;

    if (parsedInspecaoIds.length > 0) {
      const vinculosValues = parsedInspecaoIds.map((inspecaoId) => [
        novoServicoId,
        parseInt(inspecaoId),
      ]);
      await connection.query(
        "INSERT INTO servicos_inspecoes_vinculadas (servico_id, inspecao_id) VALUES ?",
        [vinculosValues]
      );
    }

    const itemDbIdMap = new Map();
    for (const itemEscopo of parsedItensEscopo) {
      const [resultItem] = await connection.query(
        `INSERT INTO servico_itens_escopo (servico_id, catalogo_defeito_id, inspecao_item_id, descricao_item_servico, observacao_especifica_servico, encarregado_item_id, status_item_escopo, tag_equipamento_alvo, catalogo_equipamento_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          novoServicoId,
          itemEscopo.catalogo_defeito_id || null,
          itemEscopo.inspecao_item_id || null,
          itemEscopo.descricao_item_servico,
          itemEscopo.observacao_especifica_servico || null,
          itemEscopo.encarregado_item_id || null,
          itemEscopo.status_item_escopo || "PENDENTE",
          itemEscopo.tag_equipamento_alvo || null,
          itemEscopo.catalogo_equipamento_id || null,
        ]
      );
      const novoItemEscopoId = resultItem.insertId;
      if (itemEscopo.temp_id)
        itemDbIdMap.set(itemEscopo.temp_id, novoItemEscopoId);

      // TENTATIVA DE COPIAR ANEXOS DA INSPEÇÃO (COM PROTEÇÃO CONTRA ERRO)
      if (itemEscopo.inspecao_item_id) {
        try {
          if (itemEscopo.inspecao_especificacao_id) {
            await connection.query(
              `INSERT INTO servico_item_escopo_anexos (item_escopo_id, nome_original, caminho_servidor, tipo_mime, tamanho)
               SELECT ?, nome_original, caminho_servidor, tipo_mime, tamanho
               FROM inspecoes_subestacoes_anexos
               WHERE item_especificacao_id = ?`,
              [novoItemEscopoId, itemEscopo.inspecao_especificacao_id]
            );
          } else {
            await connection.query(
              `INSERT INTO servico_item_escopo_anexos (item_escopo_id, nome_original, caminho_servidor, tipo_mime, tamanho)
               SELECT ?, nome_original, caminho_servidor, tipo_mime, tamanho
               FROM inspecoes_subestacoes_anexos
               WHERE item_resposta_id = ? AND item_especificacao_id IS NULL`,
              [novoItemEscopoId, itemEscopo.inspecao_item_id]
            );
          }
        } catch (errAnexo) {
          // Loga o erro no console do servidor mas NÃO para a criação do serviço
          console.error(
            `AVISO: Falha ao copiar anexos da inspeção para o item ${novoItemEscopoId}. O serviço continuará sendo criado. Erro:`,
            errAnexo.message
          );
        }
      }
    }

    const servicoUploadDir = path.join(
      uploadsSubestacoesDir,
      "servicos",
      `servico_${String(novoServicoId)}`
    );
    await fsPromises.mkdir(servicoUploadDir, { recursive: true });

    for (const file of arquivos) {
      const nomeUnicoArquivo = `${Date.now()}_${file.originalname.replace(
        /[^a-zA-Z0-9.\-_]/g,
        "_"
      )}`;
      const caminhoDestino = path.join(servicoUploadDir, nomeUnicoArquivo);

      await fsPromises.copyFile(file.path, caminhoDestino);
      await fsPromises.unlink(file.path);

      const caminhoRelativoServidor = `servicos/servico_${novoServicoId}/${nomeUnicoArquivo}`;

      if (file.fieldname.startsWith("item_anexo__")) {
        const tempId = file.fieldname.split("__")[1];
        const itemEscopoId = itemDbIdMap.get(tempId);
        if (itemEscopoId) {
          await connection.query(
            `INSERT INTO servico_item_escopo_anexos (item_escopo_id, nome_original, caminho_servidor, tipo_mime, tamanho) VALUES (?, ?, ?, ?, ?)`,
            [
              itemEscopoId,
              file.originalname,
              `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
              file.mimetype,
              file.size,
            ]
          );
        }
      } else {
        await connection.query(
          `INSERT INTO servicos_subestacoes_anexos (id_servico, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            novoServicoId,
            file.originalname,
            `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
            file.mimetype,
            file.size,
            "DOCUMENTO_REGISTRO",
          ]
        );
      }
    }

    await connection.commit();
    return { novoServicoId, connection };
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Erro fatal ao criar serviço:", error); // Log para debug
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function listarServicos(filtros, usuario) {
  const page = parseInt(filtros.page || 1, 10);
  const limit = parseInt(filtros.limit || 10, 10);
  const offset = (page - 1) * limit;

  let whereClauses = "WHERE 1=1";
  const params = [];
  const countParams = [];

  if (filtros.status) {
    if (filtros.status === "CONCLUIDO") {
      whereClauses +=
        " AND ss.status IN ('CONCLUIDO', 'CONCLUIDO_COM_RESSALVAS', 'CONCLUIDO_COM_PENDENCIA')";
    } else {
      whereClauses += " AND ss.status = ?";
      params.push(filtros.status);
    }
  } else {
    whereClauses +=
      " AND ss.status NOT IN ('CONCLUIDO', 'CANCELADO', 'CONCLUIDO_COM_RESSALVAS', 'CONCLUIDO_COM_PENDENCIA')";
  }

  if (filtros.subestacao_id) {
    whereClauses += " AND ss.subestacao_id = ?";
    params.push(filtros.subestacao_id);
  }
  if (filtros.processo) {
    whereClauses += " AND ss.processo LIKE ?";
    params.push(`%${filtros.processo}%`);
  }
  if (filtros.data_prevista_de) {
    whereClauses += " AND ss.data_prevista >= ?";
    params.push(filtros.data_prevista_de);
  }
  if (filtros.data_prevista_ate) {
    whereClauses += " AND ss.data_prevista <= ?";
    params.push(filtros.data_prevista_ate);
  }
  if (filtros.data_conclusao_de) {
    whereClauses += " AND ss.data_conclusao >= ?";
    params.push(filtros.data_conclusao_de);
  }
  if (filtros.data_conclusao_ate) {
    whereClauses += " AND ss.data_conclusao <= ?";
    params.push(filtros.data_conclusao_ate);
  }

  const cargosComVisaoTotal = ["ADMIN", "Gerente", "Engenheiro", "ADM"];
  if (
    usuario &&
    (usuario.cargo === "Encarregado" || usuario.cargo === "Inspetor") &&
    !cargosComVisaoTotal.includes(usuario.cargo)
  ) {
    whereClauses +=
      " AND EXISTS (SELECT 1 FROM servico_itens_escopo sie_filter WHERE sie_filter.servico_id = ss.id AND sie_filter.encarregado_item_id = ?)";
    params.push(usuario.id);
  }

  countParams.push(...params);
  params.push(limit, offset);

  const dataQuery = `
        SELECT
            ss.id, ss.processo, ss.motivo, ss.tipo_ordem, ss.prioridade,
            DATE_FORMAT(ss.data_prevista, '%Y-%m-%d') as data_prevista,
            ss.horario_inicio, ss.horario_fim, ss.status,
            DATE_FORMAT(ss.data_conclusao, '%Y-%m-%d') as data_conclusao,
            s.sigla as subestacao_sigla, s.nome as subestacao_nome,
            u.nome as responsavel_nome,
            (SELECT GROUP_CONCAT(DISTINCT u2.nome ORDER BY u2.nome SEPARATOR ', ') FROM servico_itens_escopo sie_enc LEFT JOIN users u2 ON sie_enc.encarregado_item_id = u2.id WHERE sie_enc.servico_id = ss.id AND sie_enc.encarregado_item_id IS NOT NULL) as encarregados_itens_nomes,
            (SELECT COUNT(*) FROM servico_itens_escopo sie_total WHERE sie_total.servico_id = ss.id) as total_itens,
            (SELECT COUNT(*) FROM servico_itens_escopo sie_conc WHERE sie_conc.servico_id = ss.id AND (sie_conc.status_item_escopo LIKE 'CONCLUIDO%' OR sie_conc.status_item_escopo = 'NAO_CONCLUIDO')) as itens_concluidos,
            (SELECT COUNT(*) FROM servicos_subestacoes_anexos WHERE id_servico = ss.id AND categoria_anexo = 'APR') as apr_count,
            (SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                    'id', ssa_apr.id, 
                    'caminho_servidor', ssa_apr.caminho_servidor, 
                    'nome_original', ssa_apr.nome_original
                )
            ) 
            FROM servicos_subestacoes_anexos ssa_apr 
            WHERE ssa_apr.id_servico = ss.id AND ssa_apr.categoria_anexo = 'APR'
            ) as apr_anexos
        FROM servicos_subestacoes ss
        JOIN subestacoes s ON ss.subestacao_id = s.Id
        JOIN users u ON ss.responsavel_id = u.id
        ${whereClauses}
        ORDER BY FIELD(ss.prioridade, 'GRAVE', 'ALTA', 'MEDIA', 'BAIXA'), ss.data_prevista ASC, ss.id DESC
        LIMIT ? OFFSET ?`;

  const countQuery = `SELECT COUNT(ss.id) as total FROM servicos_subestacoes ss JOIN subestacoes s ON ss.subestacao_id = s.Id JOIN users u ON ss.responsavel_id = u.id ${whereClauses}`;

  const [rows] = await promisePool.query(dataQuery, params);
  const [countRows] = await promisePool.query(countQuery, countParams);
  const totalItems = countRows[0].total;

  return {
    data: rows,
    total: totalItems,
    page,
    limit,
    totalPages: Math.ceil(totalItems / limit),
  };
}

async function obterServicoPorId(servicoId) {
  if (isNaN(parseInt(servicoId))) throw new Error(`ID inválido: ${servicoId}`);
  const [servicoRows] = await promisePool.query(
    `SELECT ss.id,ss.processo,ss.motivo,ss.tipo_ordem,ss.prioridade, DATE_FORMAT(ss.data_prevista,'%Y-%m-%d') as data_prevista,ss.horario_inicio,ss.horario_fim,ss.status,DATE_FORMAT(ss.data_conclusao,'%Y-%m-%d') as data_conclusao,ss.observacoes_conclusao,s.Id as subestacao_id,s.sigla as subestacao_sigla,s.nome as subestacao_nome,u.id as responsavel_id,u.nome as responsavel_nome FROM servicos_subestacoes ss JOIN subestacoes s ON ss.subestacao_id = s.Id JOIN users u ON ss.responsavel_id = u.id WHERE ss.id = ?`,
    [servicoId]
  );
  if (servicoRows.length === 0)
    throw new Error(`Serviço ${servicoId} não encontrado.`);

  const servico = servicoRows[0];
  const [anexosRows] = await promisePool.query(
    `SELECT id,nome_original,caminho_servidor,tipo_mime,tamanho,categoria_anexo FROM servicos_subestacoes_anexos WHERE id_servico = ? ORDER BY id DESC`,
    [servicoId]
  );
  servico.anexos = anexosRows;

  const [itensEscopoRows] = await promisePool.query(
    `
        SELECT
            sie.id as item_escopo_id, sie.catalogo_defeito_id, sie.inspecao_item_id, sie.descricao_item_servico,
            sie.observacao_especifica_servico, sie.encarregado_item_id, usr_enc.nome as encarregado_item_nome,
            sie.status_item_escopo, sie.data_conclusao_item, sie.observacoes_conclusao_item, sie.tag_equipamento_alvo,
            sie.catalogo_equipamento_id, cat_equip.nome as catalogo_equipamento_nome, cat_equip.codigo as catalogo_equipamento_codigo,
            cd.codigo as defeito_codigo, cd.descricao as defeito_descricao, iir.inspecao_id as origem_inspecao_id,
            ins.formulario_inspecao_num as origem_inspecao_formulario_num,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', anexo.id, 'nome_original', anexo.nome_original, 'caminho_servidor', anexo.caminho_servidor, 'tipo_mime', anexo.tipo_mime)) FROM servico_item_escopo_anexos anexo WHERE anexo.item_escopo_id = sie.id) as anexos
        FROM servico_itens_escopo sie
        LEFT JOIN catalogo_defeitos_servicos cd ON sie.catalogo_defeito_id = cd.id
        LEFT JOIN users usr_enc ON sie.encarregado_item_id = usr_enc.id
        LEFT JOIN catalogo_equipamentos cat_equip ON sie.catalogo_equipamento_id = cat_equip.id
        LEFT JOIN inspecoes_itens_respostas iir ON sie.inspecao_item_id = iir.id
        LEFT JOIN inspecoes_subestacoes ins ON iir.inspecao_id = ins.id
        WHERE sie.servico_id = ? GROUP BY sie.id ORDER BY sie.id ASC`,
    [servicoId]
  );

  servico.itens_escopo = itensEscopoRows.map((item) => ({
    ...item,
    anexos: item.anexos ? JSON.parse(item.anexos) : [],
  }));
  return servico;
}

async function atualizarServico(servicoId, dados, arquivos) {
  const connection = await promisePool.getConnection();
  const arquivosMovidos = [];

  try {
    await connection.beginTransaction();

    const {
      processo,
      subestacao_id,
      motivo,
      responsavel_id,
      data_prevista,
      horario_inicio,
      horario_fim,
      status,
      prioridade,
      tipo_ordem,
    } = dados;
    await connection.query(
      `UPDATE servicos_subestacoes SET processo = ?, subestacao_id = ?, motivo = ?, responsavel_id = ?, data_prevista = ?, horario_inicio = ?, horario_fim = ?, status = ?, prioridade = ?, tipo_ordem = ? WHERE id = ?`,
      [
        processo,
        subestacao_id,
        motivo,
        responsavel_id,
        data_prevista,
        horario_inicio,
        horario_fim,
        status,
        prioridade,
        tipo_ordem,
        servicoId,
      ]
    );

    const anexosParaDeletar = dados.anexosParaDeletar
      ? JSON.parse(dados.anexosParaDeletar)
      : [];
    for (const anexoId of anexosParaDeletar) {
      const [anexoRows] = await connection.query(
        "SELECT caminho_servidor FROM servicos_subestacoes_anexos WHERE id = ? UNION SELECT caminho_servidor FROM servico_item_escopo_anexos WHERE id = ?",
        [anexoId, anexoId]
      );
      if (anexoRows.length > 0 && anexoRows[0].caminho_servidor) {
        const caminhoCompleto = path.join(
          __dirname,
          "../../../../public",
          anexoRows[0].caminho_servidor
        );
        try {
          await fsPromises.unlink(caminhoCompleto);
        } catch (err) {
          if (err.code !== "ENOENT")
            console.warn(
              `Arquivo de anexo ${anexoId} não encontrado para exclusão.`
            );
        }
      }
      await connection.query(
        "DELETE FROM servicos_subestacoes_anexos WHERE id = ?",
        [anexoId]
      );
      await connection.query(
        "DELETE FROM servico_item_escopo_anexos WHERE id = ?",
        [anexoId]
      );
    }

    const itensParaDeletar = dados.itensParaDeletar
      ? JSON.parse(dados.itensParaDeletar)
      : [];
    for (const itemId of itensParaDeletar) {
      await connection.query("DELETE FROM servico_itens_escopo WHERE id = ?", [
        itemId,
      ]);
    }

    const novosItens = dados.novosItens ? JSON.parse(dados.novosItens) : [];
    const itemTempIdMap = new Map();
    for (const item of novosItens) {
      const [result] = await connection.query(
        `INSERT INTO servico_itens_escopo (servico_id, descricao_item_servico, tag_equipamento_alvo, catalogo_defeito_id, catalogo_equipamento_id, status_item_escopo) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          servicoId,
          item.descricao_item_servico,
          item.tag_equipamento_alvo,
          item.catalogo_defeito_id || null,
          item.catalogo_equipamento_id || null,
          "PENDENTE",
        ]
      );
      if (item.temp_id) {
        itemTempIdMap.set(item.temp_id, result.insertId);
      }
    }

    const servicoUploadDir = path.join(
      uploadsSubestacoesDir,
      "servicos",
      `servico_${String(servicoId)}`
    );
    await fsPromises.mkdir(servicoUploadDir, { recursive: true });

    for (const file of arquivos) {
      const nomeUnicoArquivo = `${Date.now()}_${file.originalname.replace(
        /[^a-zA-Z0-9.\-_]/g,
        "_"
      )}`;
      const caminhoDestino = path.join(servicoUploadDir, nomeUnicoArquivo);

      await fsPromises.copyFile(file.path, caminhoDestino);
      await fsPromises.unlink(file.path);

      arquivosMovidos.push(caminhoDestino);
      const caminhoRelativoServidor = `servicos/servico_${servicoId}/${nomeUnicoArquivo}`;
      const caminhoFinal = `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`;

      const fieldnameParts = file.fieldname.split("_");
      const parentId = fieldnameParts.pop();
      const parentType = fieldnameParts.join("_");

      if (parentType === "anexo" && parentId === "geral") {
        await connection.query(
          `INSERT INTO servicos_subestacoes_anexos (id_servico, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            servicoId,
            file.originalname,
            caminhoFinal,
            file.mimetype,
            file.size,
            "DOCUMENTO_REGISTRO",
          ]
        );
      } else if (parentType === "anexo") {
        let itemEscopoId = parseInt(parentId, 10);
        if (isNaN(itemEscopoId)) {
          itemEscopoId = itemTempIdMap.get(parentId);
        }
        if (itemEscopoId) {
          await connection.query(
            `INSERT INTO servico_item_escopo_anexos (item_escopo_id, nome_original, caminho_servidor, tipo_mime, tamanho) VALUES (?, ?, ?, ?, ?)`,
            [
              itemEscopoId,
              file.originalname,
              caminhoFinal,
              file.mimetype,
              file.size,
            ]
          );
        }
      }
    }

    await connection.commit();
    return { connection };
  } catch (error) {
    if (connection) await connection.rollback();
    for (const filePath of arquivosMovidos) {
      try {
        await fsPromises.unlink(filePath);
      } catch (cleanupError) {
        console.error(
          `Falha ao limpar arquivo após erro na transação: ${filePath}`,
          cleanupError
        );
      }
    }
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function reabrirServico(servicoId, servico) {
  const statusPermitidosParaReabertura = [
    "CONCLUIDO",
    "CANCELADO",
    "CONCLUIDO_COM_PENDENCIA",
    "CONCLUIDO_COM_RESSALVAS",
  ];
  if (!statusPermitidosParaReabertura.includes(servico.status)) {
    throw new Error(
      `Serviço (Processo: ${servico.processo}) com status ${servico.status} não pode ser reaberto.`
    );
  }
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      "UPDATE servicos_subestacoes SET status = 'EM_ANDAMENTO', data_conclusao = NULL, observacoes_conclusao = NULL WHERE id = ?",
      [servicoId]
    );
    await connection.query(
      `UPDATE servico_itens_escopo SET status_item_escopo = 'PENDENTE', data_conclusao_item = NULL, observacoes_conclusao_item = NULL WHERE servico_id = ? AND status_item_escopo IN ('CONCLUIDO_COM_PENDENCIA', 'NAO_CONCLUIDO', 'CONCLUIDO_COM_RESSALVAS')`,
      [servicoId]
    );
    await connection.commit();
    return { connection };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function excluirServico(servicoId) {
  if (isNaN(parseInt(servicoId, 10))) {
    throw new Error("ID do serviço inválido.");
  }

  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();

    const [servicoRows] = await connection.query(
      "SELECT processo FROM servicos_subestacoes WHERE id = ?",
      [servicoId]
    );
    if (servicoRows.length === 0) {
      throw new Error(`Serviço com ID ${servicoId} não encontrado.`);
    }
    const { processo } = servicoRows[0];

    await connection.query("DELETE FROM servicos_subestacoes WHERE id = ?", [
      servicoId,
    ]);

    const servicoUploadDir = path.join(
      uploadsSubestacoesDir,
      "servicos",
      `servico_${String(servicoId)}`
    );
    try {
      await fsPromises.rm(servicoUploadDir, { recursive: true, force: true });
    } catch (fsError) {
      console.error(
        `Falha ao remover a pasta de arquivos do serviço ${servicoId}:`,
        fsError
      );
    }

    await connection.commit();
    return { processo, connection };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  listarUsuariosPorCargo,
  listarCatalogoDefeitos,
  criarServico,
  listarServicos,
  obterServicoPorId,
  atualizarServico,
  reabrirServico,
  excluirServico,
};
