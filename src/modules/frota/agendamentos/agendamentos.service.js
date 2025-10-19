const { promisePool } = require("../../../init");

async function agendarChecklist(dadosAgendamento, agendadoPorMatricula) {
  const { veiculo_id, data_agendamento, encarregado_matricula, observacoes } =
    dadosAgendamento;
  if (!veiculo_id || !data_agendamento || !encarregado_matricula) {
    throw new Error("Campos obrigatórios faltando!");
  }

  const query = `
    INSERT INTO agendamentos_checklist
    (veiculo_id, data_agendamento, encarregado_matricula, agendado_por_matricula, observacoes)
    VALUES (?, ?, ?, ?, ?)
  `;
  const [result] = await promisePool.query(query, [
    veiculo_id,
    data_agendamento,
    encarregado_matricula,
    agendadoPorMatricula,
    observacoes || null,
  ]);
  return { id: result.insertId };
}

async function obterAgendamentoPorId(id) {
  const query = `
    SELECT
        ac.id, ac.veiculo_id, ac.data_agendamento, ac.encarregado_matricula,
        ac.agendado_por_matricula, ac.status, ac.data_conclusao, ac.inspecao_id,
        ac.observacoes, v.placa, v.modelo, u_enc.nome AS encarregado_nome,
        u_agend.nome AS agendado_por_nome
    FROM agendamentos_checklist ac
    JOIN veiculos v ON ac.veiculo_id = v.id
    JOIN users u_enc ON ac.encarregado_matricula = u_enc.matricula
    JOIN users u_agend ON ac.agendado_por_matricula = u_agend.matricula
    WHERE ac.id = ?
  `;
  const [rows] = await promisePool.query(query, [id]);

  if (rows.length === 0) {
    throw new Error("Agendamento não encontrado!");
  }

  const agendamento = rows[0];
  let statusDisplay = agendamento.status;
  if (
    agendamento.status === "Agendado" &&
    new Date(agendamento.data_agendamento) < new Date() &&
    !agendamento.data_conclusao
  ) {
    statusDisplay = "Atrasado";
  }
  return { ...agendamento, status_display: statusDisplay };
}

async function deletarAgendamento(id) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const [agendamentoInfo] = await connection.query(
      `SELECT ac.id, v.placa, ac.data_agendamento, u_enc.nome AS encarregado_nome
       FROM agendamentos_checklist ac
       JOIN veiculos v ON ac.veiculo_id = v.id
       JOIN users u_enc ON ac.encarregado_matricula = u_enc.matricula
       WHERE ac.id = ?`,
      [id]
    );

    const [result] = await connection.query(
      "DELETE FROM agendamentos_checklist WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      throw new Error("Agendamento não encontrado.");
    }

    const logMessage =
      agendamentoInfo.length > 0
        ? `Agendamento ID ${id} (Veículo: ${agendamentoInfo[0].placa}, Data: ${
            agendamentoInfo[0].data_agendamento.toISOString().split("T")[0]
          }, Encarregado: ${agendamentoInfo[0].encarregado_nome}) excluído.`
        : `Agendamento ID ${id} excluído (detalhes não recuperados para auditoria).`;

    await connection.commit();
    return { logMessage, connection };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function listarAgendamentos(filtros) {
  const { status, dataInicial, dataFinal, limit } = filtros;
  let query = `
    SELECT
        ac.id, ac.veiculo_id, ac.data_agendamento, ac.encarregado_matricula,
        ac.agendado_por_matricula, ac.status, ac.data_conclusao, ac.inspecao_id,
        ac.observacoes, v.placa, v.modelo, u_enc.nome AS encarregado_nome,
        u_agend.nome AS agendado_por_nome
    FROM agendamentos_checklist ac
    JOIN veiculos v ON ac.veiculo_id = v.id
    JOIN users u_enc ON ac.encarregado_matricula = u_enc.matricula
    JOIN users u_agend ON ac.agendado_por_matricula = u_agend.matricula
    WHERE 1=1
  `;
  const params = [];

  if (status === "Concluído") {
    query += ` AND ac.status = ?`;
    params.push("Concluído");
  } else if (status === "NaoConcluido") {
    query += ` AND ac.status = ?`;
    params.push("Agendado");
  } else if (status === "Atrasado") {
    query += ` AND ac.status = 'Agendado' AND ac.data_agendamento < CURDATE()`;
  } else if (!status) {
    query += ` AND ac.status = ?`;
    params.push("Agendado");
  }

  if (dataInicial) {
    query += ` AND ac.data_agendamento >= ?`;
    params.push(dataInicial);
  }
  if (dataFinal) {
    query += ` AND ac.data_agendamento <= ?`;
    params.push(dataFinal);
  }

  query += ` ORDER BY ac.data_agendamento DESC, ac.id DESC`;

  if (limit) {
    query += ` LIMIT ?`;
    params.push(parseInt(limit));
  }

  const [rows] = await promisePool.query(query, params);

  return rows.map((agendamento) => {
    let statusDisplay = agendamento.status;
    if (
      agendamento.status === "Agendado" &&
      new Date(agendamento.data_agendamento) < new Date() &&
      !agendamento.data_conclusao
    ) {
      statusDisplay = "Atrasado";
    }
    return { ...agendamento, status_display: statusDisplay };
  });
}

async function listarAgendamentosAbertos(placa, data) {
  if (!placa || !data) {
    throw new Error("Placa e data são obrigatórias.");
  }

  const query = `
    SELECT
        ac.id, ac.data_agendamento, ac.status, v.placa,
        u_enc.nome AS encarregado_nome
    FROM agendamentos_checklist ac
    JOIN veiculos v ON ac.veiculo_id = v.id
    JOIN users u_enc ON ac.encarregado_matricula = u_enc.matricula
    WHERE v.placa = ? AND DATE(ac.data_agendamento) = ? AND ac.status = 'Agendado'
    ORDER BY ac.id DESC
  `;
  const [rows] = await promisePool.query(query, [placa, data]);

  return rows.map((agendamento) => {
    let statusDisplay = agendamento.status;
    if (new Date(agendamento.data_agendamento) < new Date()) {
      statusDisplay = "Atrasado";
    }
    return { ...agendamento, status_display: statusDisplay };
  });
}

module.exports = {
  agendarChecklist,
  obterAgendamentoPorId,
  deletarAgendamento,
  listarAgendamentos,
  listarAgendamentosAbertos,
};
