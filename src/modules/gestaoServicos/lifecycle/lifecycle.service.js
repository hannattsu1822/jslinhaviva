const { promisePool } = require("../../../init");
const webpush = require("../../../push-config");

async function atualizarStatusGeralServico(
  servicoId,
  connection,
  dataHoraConclusao
) {
  const [statusResponsaveis] = await connection.query(
    `SELECT status_individual FROM servicos_responsaveis WHERE servico_id = ?`,
    [servicoId]
  );

  if (statusResponsaveis.length === 0) {
    await connection.query(
      "UPDATE processos SET status_geral = 'ativo', data_conclusao = NULL WHERE id = ?",
      [servicoId]
    );
    return;
  }

  const total = statusResponsaveis.length;
  let concluidos = 0;
  let naoConcluidos = 0;

  for (const resp of statusResponsaveis) {
    if (resp.status_individual === "concluido") concluidos++;
    if (resp.status_individual === "nao_concluido") naoConcluidos++;
  }

  let novoStatusGeral = "ativo";
  if (naoConcluidos > 0) {
    novoStatusGeral = "nao_concluido";
  } else if (concluidos > 0 && concluidos === total) {
    novoStatusGeral = "concluido";
  } else if (concluidos > 0 && concluidos < total) {
    novoStatusGeral = "em_progresso";
  }

  if (novoStatusGeral === "concluido") {
    await connection.query(
      "UPDATE processos SET status_geral = ?, data_conclusao = ? WHERE id = ?",
      [novoStatusGeral, dataHoraConclusao, servicoId]
    );
  } else {
    await connection.query(
      "UPDATE processos SET status_geral = ?, data_conclusao = NULL WHERE id = ?",
      [novoStatusGeral, servicoId]
    );
  }
}

async function concluirParteServico(servicoId, conclusaoData, matricula) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const { observacoes, dataConclusao, horaConclusao } = conclusaoData;

    if (!dataConclusao || !horaConclusao) {
      throw new Error("Data e Hora de Conclusão são obrigatórias.");
    }
    const dataHoraConclusaoParaSalvar = `${dataConclusao} ${horaConclusao}:00`;

    const [updateResult] = await connection.query(
      `UPDATE servicos_responsaveis SET 
        status_individual = 'concluido', 
        data_conclusao_individual = ?, 
        observacoes_individuais = ?,
        motivo_nao_conclusao_individual = NULL
       WHERE servico_id = ? AND responsavel_matricula = ?`,
      [dataHoraConclusaoParaSalvar, observacoes || null, servicoId, matricula]
    );

    if (updateResult.affectedRows === 0) {
      throw new Error("Atribuição para este serviço e usuário não encontrada.");
    }

    await atualizarStatusGeralServico(
      servicoId,
      connection,
      dataHoraConclusaoParaSalvar
    );

    await connection.commit();

    const [servicoInfo] = await connection.query(
      "SELECT processo FROM processos WHERE id = ?",
      [servicoId]
    );
    const auditMessage = `Parte do serviço ${servicoId} (${servicoInfo[0].processo}) concluída por ${matricula}.`;

    return { auditMessage };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function naoConcluirParteServico(servicoId, conclusaoData, matricula) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const { motivo_nao_conclusao, observacoes, dataConclusao, horaConclusao } =
      conclusaoData;

    if (!motivo_nao_conclusao || motivo_nao_conclusao.trim() === "") {
      throw new Error("Motivo da não conclusão é obrigatório.");
    }
    const dataHoraConclusaoParaSalvar = `${dataConclusao} ${horaConclusao}:00`;

    const [updateResult] = await connection.query(
      `UPDATE servicos_responsaveis SET 
                status_individual = 'nao_concluido', 
                data_conclusao_individual = ?, 
                observacoes_individuais = ?,
                motivo_nao_conclusao_individual = ?
            WHERE servico_id = ? AND responsavel_matricula = ?`,
      [
        dataHoraConclusaoParaSalvar,
        observacoes || null,
        motivo_nao_conclusao.trim(),
        servicoId,
        matricula,
      ]
    );

    if (updateResult.affectedRows === 0) {
      throw new Error("Atribuição para este serviço e usuário não encontrada.");
    }

    await connection.query(
      `UPDATE processos SET status_geral = 'nao_concluido', motivo_nao_conclusao = ?, data_conclusao = ? WHERE id = ?`,
      [
        `[${matricula}] ${motivo_nao_conclusao.trim()}`,
        dataHoraConclusaoParaSalvar,
        servicoId,
      ]
    );

    await connection.commit();

    const [servicoInfo] = await connection.query(
      "SELECT processo FROM processos WHERE id = ?",
      [servicoId]
    );
    const auditMessage = `Parte do serviço ${servicoId} (${
      servicoInfo[0].processo
    }) marcada como NÃO CONCLUÍDA por ${matricula}. Motivo: ${motivo_nao_conclusao.trim()}`;

    return { auditMessage };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function reativarServico(servicoId) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `UPDATE processos SET 
                status_geral = "ativo", 
                data_conclusao = NULL, 
                observacoes_conclusao = NULL, 
                motivo_nao_conclusao = NULL 
            WHERE id = ?`,
      [servicoId]
    );

    if (result.affectedRows === 0) {
      throw new Error("Serviço não encontrado");
    }

    await connection.query(
      `UPDATE servicos_responsaveis SET 
                status_individual = 'pendente', 
                data_conclusao_individual = NULL, 
                observacoes_individuais = NULL, 
                motivo_nao_conclusao_individual = NULL 
            WHERE servico_id = ?`,
      [servicoId]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function atribuirResponsavel(servicoId, responsaveisMatriculas) {
  if (!Array.isArray(responsaveisMatriculas)) {
    throw new Error("A lista de responsáveis deve ser um array.");
  }
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();

    const [updateResult] = await connection.query(
      "SELECT id FROM processos WHERE id = ?",
      [servicoId]
    );
    if (updateResult.length === 0) {
      throw new Error("Serviço não encontrado.");
    }

    await connection.query(
      "DELETE FROM servicos_responsaveis WHERE servico_id = ?",
      [servicoId]
    );

    if (responsaveisMatriculas.length > 0) {
      const insertValues = responsaveisMatriculas.map((matricula) => [
        servicoId,
        matricula,
      ]);
      await connection.query(
        "INSERT INTO servicos_responsaveis (servico_id, responsavel_matricula) VALUES ?",
        [insertValues]
      );
    }

    await atualizarStatusGeralServico(servicoId, connection, null);

    for (const matricula of responsaveisMatriculas) {
      const [userInfo] = await connection.query(
        "SELECT push_subscription FROM users WHERE matricula = ?",
        [matricula]
      );
      const subscriptionString = userInfo[0]?.push_subscription;
      if (subscriptionString) {
        const subscription = JSON.parse(subscriptionString);
        const [servicoInfo] = await connection.query(
          "SELECT processo FROM processos WHERE id = ?",
          [servicoId]
        );
        const nomeProcesso = servicoInfo[0]?.processo || `ID ${servicoId}`;
        const payload = JSON.stringify({
          title: "Novo Serviço Atribuído!",
          body: `O serviço '${nomeProcesso}' foi atribuído a você.`,
        });
        try {
          await webpush.sendNotification(subscription, payload);
        } catch (error) {
          if (
            error.statusCode === 403 ||
            error.statusCode === 410 ||
            error.statusCode === 404
          ) {
            await connection.query(
              "UPDATE users SET push_subscription = NULL WHERE matricula = ?",
              [matricula]
            );
          }
        }
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  concluirParteServico,
  naoConcluirParteServico,
  reativarServico,
  atribuirResponsavel,
};
