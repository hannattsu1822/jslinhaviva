const { promisePool, logger } = require("../../../init");

function extrairCampos(body) {
  return {
    data_conclusao: body.data_conclusao || body.dataConclusao,
    hora_conclusao: body.hora_conclusao || body.horaConclusao,
    observacoes_conclusao: body.observacoes_conclusao || body.observacoes,
    motivo_nao_conclusao: body.motivo_nao_conclusao,
  };
}

async function concluirParteServico(servicoId, body, matricula) {
  const { data_conclusao, hora_conclusao, observacoes_conclusao } =
    extrairCampos(body);
  if (!data_conclusao || !hora_conclusao) {
    throw new Error("Data e hora de conclusão são obrigatórias.");
  }
  const dataHora = `${data_conclusao} ${hora_conclusao}:00`;
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `UPDATE servicos_responsaveis
             SET status_individual = 'concluido',
                 data_conclusao_individual = ?
             WHERE servico_id = ? AND responsavel_matricula = ?`,
      [dataHora, servicoId, matricula],
    );
    if (result.affectedRows === 0) {
      throw new Error(
        "Você não está atribuído como encarregado deste serviço.",
      );
    }
    const [[{ pendentes }]] = await connection.query(
      `SELECT COUNT(*) AS pendentes
             FROM servicos_responsaveis
             WHERE servico_id = ? AND status_individual = 'pendente'`,
      [servicoId],
    );
    if (pendentes === 0) {
      await connection.query(
        `UPDATE processos
                 SET status = 'concluido',
                     status_geral = 'concluido',
                     data_conclusao = ?,
                     observacoes_conclusao = ?
                 WHERE id = ?`,
        [dataHora, observacoes_conclusao || null, servicoId],
      );
    } else {
      await connection.query(
        `UPDATE processos
                 SET status = 'em_progresso',
                     status_geral = 'em_progresso'
                 WHERE id = ? AND status = 'ativo'`,
        [servicoId],
      );
    }
    await connection.commit();
    return {
      auditMessage: `Serviço ID ${servicoId} — parte concluída pelo encarregado ${matricula}`,
    };
  } catch (err) {
    await connection.rollback();
    logger.error(
      `[Lifecycle] Erro em concluirParteServico (ID ${servicoId}): ${err.message}`,
    );
    throw err;
  } finally {
    connection.release();
  }
}

async function naoConcluirParteServico(servicoId, body, matricula) {
  const {
    data_conclusao,
    hora_conclusao,
    observacoes_conclusao,
    motivo_nao_conclusao,
  } = extrairCampos(body);
  if (!data_conclusao || !hora_conclusao) {
    throw new Error("Data e hora de conclusão são obrigatórias.");
  }
  const dataHora = `${data_conclusao} ${hora_conclusao}:00`;
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `UPDATE servicos_responsaveis
             SET status_individual = 'nao_concluido',
                 data_conclusao_individual = ?
             WHERE servico_id = ? AND responsavel_matricula = ?`,
      [dataHora, servicoId, matricula],
    );
    if (result.affectedRows === 0) {
      throw new Error(
        "Você não está atribuído como encarregado deste serviço.",
      );
    }
    await connection.query(
      `UPDATE processos
             SET status = 'nao_concluido',
                 status_geral = 'nao_concluido',
                 data_conclusao = ?,
                 motivo_nao_conclusao = ?,
                 observacoes_conclusao = ?
             WHERE id = ?`,
      [
        dataHora,
        motivo_nao_conclusao || null,
        observacoes_conclusao || null,
        servicoId,
      ],
    );
    await connection.commit();
    return {
      auditMessage: `Serviço ID ${servicoId} — não concluído pelo encarregado ${matricula}`,
    };
  } catch (err) {
    await connection.rollback();
    logger.error(
      `[Lifecycle] Erro em naoConcluirParteServico (ID ${servicoId}): ${err.message}`,
    );
    throw err;
  } finally {
    connection.release();
  }
}

async function forcarConclusaoServico(
  servicoId,
  { dataConclusao, horaConclusao, observacoes, matriculaGestor, status_final },
) {
  if (!dataConclusao || !horaConclusao) {
    throw new Error("Data e hora de conclusão são obrigatórias.");
  }
  const dataHora = `${dataConclusao} ${horaConclusao}:00`;
  const statusFinal =
    status_final === "nao_concluido" ? "nao_concluido" : "concluido";
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const [[servico]] = await connection.query(
      "SELECT id, status FROM processos WHERE id = ?",
      [servicoId],
    );
    if (!servico) {
      throw new Error("Serviço não encontrado.");
    }
    if (servico.status === "concluido" || servico.status === "nao_concluido") {
      throw new Error("Este serviço já está finalizado.");
    }
    await connection.query(
      `UPDATE processos
             SET status = ?,
                 status_geral = ?,
                 data_conclusao = ?,
                 observacoes_conclusao = ?,
                 motivo_nao_conclusao = ?
             WHERE id = ?`,
      [
        statusFinal,
        statusFinal,
        dataHora,
        observacoes || `Finalizado administrativamente por ${matriculaGestor}`,
        statusFinal === "nao_concluido" ? observacoes || null : null,
        servicoId,
      ],
    );
    await connection.query(
      `UPDATE servicos_responsaveis
             SET status_individual = ?,
                 data_conclusao_individual = ?
             WHERE servico_id = ?`,
      [statusFinal, dataHora, servicoId],
    );
    await connection.commit();
    return { success: true };
  } catch (err) {
    await connection.rollback();
    logger.error(
      `[Lifecycle] Erro em forcarConclusaoServico (ID ${servicoId}): ${err.message}`,
    );
    throw err;
  } finally {
    connection.release();
  }
}

async function reativarServico(servicoId) {
  const [result] = await promisePool.query(
    `UPDATE processos SET status = 'ativo', status_geral = 'ativo', data_conclusao = NULL, observacoes_conclusao = NULL, motivo_nao_conclusao = NULL WHERE id = ?`,
    [servicoId],
  );
  if (result.affectedRows === 0) {
    throw new Error("Serviço não encontrado");
  }
  await promisePool.query(
    `UPDATE servicos_responsaveis SET status_individual = 'pendente', data_conclusao_individual = NULL WHERE servico_id = ?`,
    [servicoId],
  );
  return { success: true };
}

async function atribuirResponsavel(servicoId, responsaveis) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const [[servico]] = await connection.query(
      "SELECT id FROM processos WHERE id = ?",
      [servicoId],
    );
    if (!servico) {
      throw new Error("Serviço não encontrado");
    }
    await connection.query(
      "DELETE FROM servicos_responsaveis WHERE servico_id = ?",
      [servicoId],
    );
    if (Array.isArray(responsaveis) && responsaveis.length > 0) {
      const valores = responsaveis.map((matricula) => [
        servicoId,
        matricula,
        "pendente",
      ]);
      await connection.query(
        "INSERT INTO servicos_responsaveis (servico_id, responsavel_matricula, status_individual) VALUES ?",
        [valores],
      );
    }
    await connection.commit();
    return { success: true };
  } catch (err) {
    await connection.rollback();
    logger.error(
      `[Lifecycle] Erro em atribuirResponsavel (ID ${servicoId}): ${err.message}`,
    );
    throw err;
  } finally {
    connection.release();
  }
}

async function removerResponsavelUnico(servicoId, matriculaRemover) {
  const [result] = await promisePool.query(
    `DELETE FROM servicos_responsaveis WHERE servico_id = ? AND responsavel_matricula = ?`,
    [servicoId, matriculaRemover],
  );
  if (result.affectedRows === 0) {
    throw new Error("Encarregado não encontrado neste serviço.");
  }
  return { success: true };
}

async function concluirServicoAdministrativo(
  servicoId,
  { dataConclusao, horaConclusao, observacoes, status_final, motivo },
  matriculaGestor,
) {
  if (!dataConclusao || !horaConclusao) {
    throw new Error("Data e hora de conclusão são obrigatórias.");
  }
  if (!motivo || typeof motivo !== "string" || motivo.trim().length < 5) {
    throw new Error(
      "O motivo da conclusão administrativa é obrigatório (mínimo 5 caracteres).",
    );
  }
  const dataHora = `${dataConclusao} ${horaConclusao}:00`;
  const statusFinal =
    status_final === "nao_concluido" ? "nao_concluido" : "concluido";
  const motivoLimpo = motivo.trim();
  const observacoesFormatadas =
    observacoes && observacoes.trim() ? ` | Obs: ${observacoes.trim()}` : "";
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const [[servico]] = await connection.query(
      "SELECT id, status, status_geral FROM processos WHERE id = ?",
      [servicoId],
    );
    if (!servico) {
      throw new Error("Serviço não encontrado.");
    }
    if (
      servico.status_geral === "concluido" ||
      servico.status_geral === "nao_concluido"
    ) {
      throw new Error("Este serviço já está finalizado.");
    }
    const observacaoFinal = `CONCLUSÃO ADMINISTRATIVA - Motivo: ${motivoLimpo}${observacoesFormatadas}`;
    await connection.query(
      `UPDATE processos
             SET status = ?,
                 status_geral = ?,
                 data_conclusao = ?,
                 observacoes_conclusao = ?,
                 motivo_nao_conclusao = ?
             WHERE id = ?`,
      [
        statusFinal,
        statusFinal,
        dataHora,
        observacaoFinal,
        statusFinal === "nao_concluido" ? motivoLimpo : null,
        servicoId,
      ],
    );
    const [[jaParticipa]] = await connection.query(
      `SELECT id FROM servicos_responsaveis 
             WHERE servico_id = ? AND responsavel_matricula = ?`,
      [servicoId, matriculaGestor],
    );
    if (jaParticipa) {
      await connection.query(
        `UPDATE servicos_responsaveis 
                 SET status_individual = ?, 
                     data_conclusao_individual = ?, 
                     observacoes_individuais = ?
                 WHERE id = ?`,
        [
          statusFinal,
          dataHora,
          `Concluído administrativamente. Motivo: ${motivoLimpo}`,
          jaParticipa.id,
        ],
      );
    } else {
      await connection.query(
        `INSERT INTO servicos_responsaveis 
                 (servico_id, responsavel_matricula, status_individual, data_conclusao_individual, observacoes_individuais)
                 VALUES (?, ?, ?, ?, ?)`,
        [
          servicoId,
          matriculaGestor,
          statusFinal,
          dataHora,
          `Concluído administrativamente. Motivo: ${motivoLimpo}`,
        ],
      );
    }
    await connection.query(
      `UPDATE servicos_responsaveis 
             SET status_individual = ?, 
                 data_conclusao_individual = ?,
                 observacoes_individuais = ?
             WHERE servico_id = ? AND status_individual = 'pendente'`,
      [
        statusFinal,
        dataHora,
        `Concluído administrativamente por gestor ${matriculaGestor}`,
        servicoId,
      ],
    );
    await connection.commit();
    return {
      success: true,
      auditMessage: `Serviço ID ${servicoId} concluído administrativamente por ${matriculaGestor} (Nível Gestor). Motivo: ${motivoLimpo}`,
    };
  } catch (err) {
    await connection.rollback();
    logger.error(
      `[Lifecycle] Erro em concluirServicoAdministrativo (ID ${servicoId}): ${err.message}`,
    );
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  concluirParteServico,
  naoConcluirParteServico,
  forcarConclusaoServico,
  reativarServico,
  atribuirResponsavel,
  removerResponsavelUnico,
  concluirServicoAdministrativo,
};
