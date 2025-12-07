const { promisePool } = require("../../../init");
const path = require("path");
const fs = require("fs");
const { projectRootDir } = require("../../../shared/path.helper");

async function salvarAnexosFibra(
  servicoId,
  files,
  etapa,
  tipoAnexo,
  connection
) {
  const anexosSalvos = [];
  const baseUploadDir = path.join(projectRootDir, "upload_arquivos_fibra");
  const servicoUploadDir = path.join(baseUploadDir, String(servicoId));

  if (!fs.existsSync(servicoUploadDir)) {
    fs.mkdirSync(servicoUploadDir, { recursive: true });
  }

  for (const file of files) {
    const novoNome = `${servicoId}_${Date.now()}${path.extname(
      file.originalname
    )}`;
    const novoPath = path.join(servicoUploadDir, novoNome);
    fs.renameSync(file.path, novoPath);

    const caminhoServidor = `/upload_arquivos_fibra/${servicoId}/${novoNome}`;
    const [result] = await connection.query(
      `INSERT INTO anexos_servicos_fibra (servico_id, etapa, tipo_anexo, nome_original, caminho_servidor, tamanho) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        servicoId,
        etapa,
        tipoAnexo,
        file.originalname,
        caminhoServidor,
        file.size,
      ]
    );
    anexosSalvos.push({ id: result.insertId, caminho: caminhoServidor });
  }
  return anexosSalvos;
}

async function obterResponsaveis() {
  const [responsaveis] = await promisePool.query(
    "SELECT matricula, nome FROM users WHERE nivel >= 3 ORDER BY nome ASC"
  );
  return responsaveis;
}

async function registrarProjeto(dadosProjeto, files) {
  const {
    tipoGeracao,
    processo,
    tipoOrdem,
    linkMaps,
    localReferencia,
    dataServico,
    responsavelMatricula,
    descricao,
    observacoes,
  } = dadosProjeto;

  if (
    !tipoGeracao ||
    !tipoOrdem ||
    !localReferencia ||
    !responsavelMatricula ||
    !descricao
  ) {
    throw new Error("Todos os campos obrigatórios devem ser preenchidos.");
  }

  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    let processoFinal = processo || null;
    if (tipoGeracao === "normal" && !processo) {
      throw new Error("Número do processo é obrigatório para geração normal.");
    }

    // Horários previstos removidos da lógica obrigatória, salvando como NULL
    const horarioInicioFinal = null;
    const horarioFimFinal = null;

    const sqlInsert = `INSERT INTO servicos_fibra_optica (tipo_geracao, processo, tipo_ordem, link_maps, local_referencia, data_servico, horario_inicio, horario_fim, responsavel_matricula, descricao, observacoes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendente')`;
    const values = [
      tipoGeracao,
      processoFinal,
      tipoOrdem,
      linkMaps,
      localReferencia,
      dataServico || null,
      horarioInicioFinal,
      horarioFimFinal,
      responsavelMatricula,
      descricao,
      observacoes,
    ];
    const [result] = await connection.query(sqlInsert, values);
    const novoServicoId = result.insertId;

    if (tipoGeracao === "emergencial" && !processo) {
      processoFinal = `emergencial-${novoServicoId}`;
      await connection.query(
        "UPDATE servicos_fibra_optica SET processo = ? WHERE id = ?",
        [processoFinal, novoServicoId]
      );
    }

    if (files && files.length > 0) {
      await salvarAnexosFibra(
        novoServicoId,
        files,
        "Registro",
        "Geral",
        connection
      );
    }

    await connection.commit();
    return { servicoId: novoServicoId, processo: processoFinal, connection };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function listarProjetos(filtros, usuario, statusPermitidos) {
  const { processo, encarregado, tipoOrdem, status, dataInicio, dataFim } =
    filtros;
  const whereClauses = [];
  const params = [];

  if (status) {
    whereClauses.push("s.status = ?");
    params.push(status);
  } else {
    whereClauses.push(
      `s.status IN (${statusPermitidos.map(() => "?").join(",")})`
    );
    params.push(...statusPermitidos);
  }

  if (processo) {
    whereClauses.push("s.processo LIKE ?");
    params.push(`%${processo}%`);
  }
  if (encarregado) {
    whereClauses.push("s.encarregado_matricula = ?");
    params.push(encarregado);
  }
  if (tipoOrdem) {
    whereClauses.push("s.tipo_ordem = ?");
    params.push(tipoOrdem);
  }
  if (dataInicio) {
    whereClauses.push("s.data_servico >= ?");
    params.push(dataInicio);
  }
  if (dataFim) {
    whereClauses.push("s.data_servico <= ?");
    params.push(dataFim);
  }

  const cargosComVisaoTotal = [
    "TÉCNICO",
    "ENGENHEIRO",
    "GERENTE",
    "ADM",
    "ADMIN",
    "INSPETOR",
  ];
  if (!cargosComVisaoTotal.includes(usuario.cargo.toUpperCase())) {
    whereClauses.push("s.encarregado_matricula = ?");
    params.push(usuario.matricula);
  }

  let sql = `
        SELECT s.id, s.processo, s.tipo_ordem, s.data_servico, s.horario_inicio, s.horario_fim, s.status, s.data_conclusao, s.horario_conclusao, u_encarregado.nome AS nome_encarregado,
        (SELECT COUNT(*) FROM anexos_servicos_fibra WHERE servico_id = s.id AND tipo_anexo = 'APR') as apr_count
        FROM servicos_fibra_optica s
        LEFT JOIN users u_encarregado ON s.encarregado_matricula = u_encarregado.matricula
    `;
  if (whereClauses.length > 0) {
    sql += " WHERE " + whereClauses.join(" AND ");
  }
  sql += " ORDER BY s.created_at DESC;";

  const [servicos] = await promisePool.query(sql, params);
  const [encarregadosParaFiltro] = await promisePool.query(
    "SELECT matricula, nome FROM users WHERE cargo IN ('Técnico', 'Engenheiro', 'Gerente', 'Encarregado', 'Inspetor', 'ADM', 'Admin') ORDER BY nome ASC"
  );

  return { servicos, encarregadosParaFiltro };
}

async function obterDetalhesServico(id) {
  const servicoSql = `
        SELECT s.*, resp.nome AS nome_responsavel, enc.nome AS nome_encarregado
        FROM servicos_fibra_optica s
        LEFT JOIN users resp ON s.responsavel_matricula = resp.matricula
        LEFT JOIN users enc ON s.encarregado_matricula = enc.matricula
        WHERE s.id = ?;
    `;
  const [servicoRows] = await promisePool.query(servicoSql, [id]);
  if (servicoRows.length === 0) {
    throw new Error("Serviço não encontrado.");
  }
  const anexosSql = `SELECT id, nome_original, caminho_servidor, tamanho, etapa FROM anexos_servicos_fibra WHERE servico_id = ?;`;
  const [anexos] = await promisePool.query(anexosSql, [id]);
  return { servico: servicoRows[0], anexos };
}

async function obterDadosParaEdicao(id) {
  const [servicoRows] = await promisePool.query(
    "SELECT * FROM servicos_fibra_optica WHERE id = ?",
    [id]
  );
  if (servicoRows.length === 0) {
    throw new Error("Serviço não encontrado.");
  }
  const [responsaveis] = await promisePool.query(
    "SELECT matricula, nome FROM users WHERE nivel >= 3 ORDER BY nome ASC"
  );
  const [anexos] = await promisePool.query(
    "SELECT id, nome_original FROM anexos_servicos_fibra WHERE servico_id = ?",
    [id]
  );
  return { servico: servicoRows[0], responsaveis, anexos };
}

async function editarServico(id, dados, files) {
  const [rows] = await promisePool.query(
    "SELECT * FROM servicos_fibra_optica WHERE id = ?",
    [id]
  );
  if (rows.length === 0) {
    throw new Error("Serviço não encontrado.");
  }
  const servicoAtual = rows[0];

  // Mapeamento de campos com fallback para o valor atual
  const processo =
    dados.processo !== undefined ? dados.processo : servicoAtual.processo;
  const tipoOrdem =
    dados.tipoOrdem !== undefined ? dados.tipoOrdem : servicoAtual.tipo_ordem;
  const linkMaps =
    dados.linkMaps !== undefined ? dados.linkMaps : servicoAtual.link_maps;
  const localReferencia =
    dados.localReferencia !== undefined
      ? dados.localReferencia
      : servicoAtual.local_referencia;
  const responsavelMatricula =
    dados.responsavelMatricula !== undefined
      ? dados.responsavelMatricula
      : servicoAtual.responsavel_matricula;
  const descricao =
    dados.descricao !== undefined ? dados.descricao : servicoAtual.descricao;
  const observacoes =
    dados.observacoes !== undefined
      ? dados.observacoes
      : servicoAtual.observacoes;
  const dataServico =
    dados.dataServico !== undefined
      ? dados.dataServico || null
      : servicoAtual.data_servico;

  // Campos de conclusão (permitir edição)
  const dataConclusao =
    dados.dataConclusao !== undefined
      ? dados.dataConclusao || null
      : servicoAtual.data_conclusao;
  const horarioConclusao =
    dados.horarioConclusao !== undefined
      ? dados.horarioConclusao || null
      : servicoAtual.horario_conclusao;

  const { anexos_a_remover } = dados;

  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();

    // Lógica de remoção de anexos
    if (anexos_a_remover) {
      const idsParaRemover = anexos_a_remover.split(",").filter(Boolean);
      if (idsParaRemover.length > 0) {
        for (const anexoId of idsParaRemover) {
          const [anexoRows] = await connection.query(
            "SELECT caminho_servidor FROM anexos_servicos_fibra WHERE id = ? AND servico_id = ?",
            [anexoId, id]
          );
          if (anexoRows.length > 0) {
            const caminhoRelativo = anexoRows[0].caminho_servidor;
            const caminhoCorrigido = caminhoRelativo.startsWith("/")
              ? caminhoRelativo.substring(1)
              : caminhoRelativo;
            const caminhoCompleto = path.join(projectRootDir, caminhoCorrigido);
            if (fs.existsSync(caminhoCompleto)) {
              fs.unlinkSync(caminhoCompleto);
            }
          }
          await connection.query(
            "DELETE FROM anexos_servicos_fibra WHERE id = ?",
            [anexoId]
          );
        }
      }
    }

    // SQL Update sem horários previstos, mas com dados de conclusão
    const sqlUpdate = `
      UPDATE servicos_fibra_optica 
      SET processo = ?, tipo_ordem = ?, link_maps = ?, local_referencia = ?, 
          data_servico = ?, responsavel_matricula = ?, descricao = ?, observacoes = ?,
          data_conclusao = ?, horario_conclusao = ?
      WHERE id = ?
    `;

    const values = [
      processo,
      tipoOrdem,
      linkMaps,
      localReferencia,
      dataServico,
      responsavelMatricula,
      descricao,
      observacoes,
      dataConclusao,
      horarioConclusao,
      id,
    ];

    await connection.query(sqlUpdate, values);

    if (files && files.length > 0) {
      await salvarAnexosFibra(id, files, "Edicao", "Geral", connection);
    }
    await connection.commit();
    return { connection };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function listarEncarregados() {
  const cargosPermitidos = [
    "Técnico",
    "Engenheiro",
    "Gerente",
    "Encarregado",
    "Inspetor",
    "ADM",
    "Admin",
  ];
  const [encarregados] = await promisePool.query(
    "SELECT matricula, nome, cargo FROM users WHERE cargo IN (?) ORDER BY nome ASC",
    [cargosPermitidos]
  );
  return encarregados;
}

async function modificarAtribuicao(servicoId, encarregadoMatricula) {
  if (!servicoId) {
    throw new Error("ID do serviço é obrigatório.");
  }
  if (encarregadoMatricula) {
    await promisePool.query(
      "UPDATE servicos_fibra_optica SET encarregado_matricula = ?, status = 'Em Andamento' WHERE id = ?",
      [encarregadoMatricula, servicoId]
    );
    return {
      message: "Encarregado atribuído com sucesso!",
      action: "ATRIBUICAO_ENCARREGADO_FIBRA",
      details: `Encarregado Matrícula ${encarregadoMatricula} atribuído ao Serviço ID ${servicoId}.`,
    };
  } else {
    await promisePool.query(
      "UPDATE servicos_fibra_optica SET encarregado_matricula = NULL, status = 'Pendente' WHERE id = ?",
      [servicoId]
    );
    return {
      message: "Atribuição removida e serviço retornado para pendente.",
      action: "REMOCAO_ENCARREGADO_FIBRA",
      details: `Atribuição removida do Serviço ID ${servicoId}. Status alterado para Pendente.`,
    };
  }
}

async function finalizarServico(dados, files, pontosMapa, matriculaUsuario) {
  const { servicoId, statusConclusao, dataConclusao, horarioConclusao } = dados;
  if (!servicoId || !statusConclusao || !dataConclusao || !horarioConclusao) {
    throw new Error("Dados de conclusão incompletos.");
  }
  if (!["Concluído", "Concluído com Pendência"].includes(statusConclusao)) {
    throw new Error("Status de conclusão inválido.");
  }
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      "UPDATE servicos_fibra_optica SET status = ?, data_conclusao = ?, horario_conclusao = ? WHERE id = ?",
      [statusConclusao, dataConclusao, horarioConclusao, servicoId]
    );
    if (pontosMapa && Array.isArray(pontosMapa) && pontosMapa.length > 0) {
    }
    if (files && files.length > 0) {
      await salvarAnexosFibra(
        servicoId,
        files,
        "Conclusao",
        "Geral",
        connection
      );
    }
    await connection.commit();
    return {
      connection,
      detalhesAuditoria: `Serviço ID ${servicoId} finalizado com status "${statusConclusao}". ${
        pontosMapa.length || 0
      } pontos de mapa e ${files ? files.length : 0} anexos registrados.`,
    };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function reabrirServico(servicoId) {
  if (!servicoId) {
    throw new Error("ID do serviço é obrigatório.");
  }
  await promisePool.query(
    "UPDATE servicos_fibra_optica SET status = 'Pendente', data_conclusao = NULL, horario_conclusao = NULL WHERE id = ?",
    [servicoId]
  );
}

async function anexarAPR(servicoId, files) {
  if (!servicoId || !files || files.length === 0) {
    throw new Error("ID do serviço e ao menos um anexo são obrigatórios.");
  }
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    await salvarAnexosFibra(servicoId, files, "Conclusao", "APR", connection);
    await connection.commit();
    return { connection, fileCount: files.length };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function excluirServico(id) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const uploadDir = path.join(
      projectRootDir,
      "upload_arquivos_fibra",
      String(id)
    );
    if (fs.existsSync(uploadDir)) {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    }
    await connection.query("DELETE FROM servicos_fibra_optica WHERE id = ?", [
      id,
    ]);
    await connection.commit();
    return { connection };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function obterAnexosAPR(servicoId) {
  const [anexos] = await promisePool.query(
    "SELECT id, nome_original, caminho_servidor FROM anexos_servicos_fibra WHERE servico_id = ? AND tipo_anexo = 'APR'",
    [servicoId]
  );
  return anexos;
}

async function excluirAnexoAPR(id) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const [anexoRows] = await connection.query(
      "SELECT caminho_servidor FROM anexos_servicos_fibra WHERE id = ?",
      [id]
    );
    if (anexoRows.length === 0) {
      throw new Error("Anexo não encontrado.");
    }
    const caminhoRelativo = anexoRows[0].caminho_servidor;
    if (caminhoRelativo) {
      const caminhoCorrigido = caminhoRelativo.startsWith("/")
        ? caminhoRelativo.substring(1)
        : caminhoRelativo;
      const caminhoCompleto = path.join(projectRootDir, caminhoCorrigido);
      if (fs.existsSync(caminhoCompleto)) {
        fs.unlinkSync(caminhoCompleto);
      }
    }
    await connection.query("DELETE FROM anexos_servicos_fibra WHERE id = ?", [
      id,
    ]);
    await connection.commit();
    return { connection };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  obterResponsaveis,
  registrarProjeto,
  listarProjetos,
  obterDetalhesServico,
  obterDadosParaEdicao,
  editarServico,
  listarEncarregados,
  modificarAtribuicao,
  finalizarServico,
  reabrirServico,
  anexarAPR,
  excluirServico,
  obterAnexosAPR,
  excluirAnexoAPR,
};
