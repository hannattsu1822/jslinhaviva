const { promisePool } = require("../../init");

async function buscarChecklistDoDia(matricula) {
  const query = `
    SELECT id, placa_veiculo, data_registro, hora_registro
    FROM checklist_diario_frota
    WHERE matricula_usuario = ? AND data_registro = CURDATE()
    LIMIT 1
  `;

  const [rows] = await promisePool.query(query, [matricula]);
  return rows[0];
}

async function buscarChecklistDoDiaPorPlaca(placa) {
  const query = `
    SELECT id, placa_veiculo, data_registro, hora_registro, matricula_usuario
    FROM checklist_diario_frota
    WHERE placa_veiculo = ? AND data_registro = CURDATE()
    LIMIT 1
  `;

  const [rows] = await promisePool.query(query, [placa]);
  return rows[0];
}

async function inserirChecklist(dados) {
  const query = `
    INSERT INTO checklist_diario_frota
      (matricula_usuario, placa_veiculo, quilometragem, nivel_oleo, nivel_agua, calibragem_pneus, luzes_sinalizacao, freios, avarias_lataria, observacoes, data_registro, hora_registro)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), CURTIME())
  `;

  const params = [
    dados.matricula,
    dados.placa,
    dados.km,
    dados.oleo,
    dados.agua,
    dados.pneus,
    dados.luzes,
    dados.freios,
    dados.lataria,
    dados.observacoes,
  ];

  const [result] = await promisePool.query(query, params);
  return result.insertId;
}

async function salvarFoto(checklistId, caminho, nomeOriginal, tamanho) {
  const query = `
    INSERT INTO checklist_diario_fotos (checklist_id, caminho_arquivo, nome_original, tamanho)
    VALUES (?, ?, ?, ?)
  `;

  await promisePool.query(query, [checklistId, caminho, nomeOriginal, tamanho]);
}

async function listarChecklistsFiltrados(filtros) {
  let query = `
    SELECT c.*, u.nome as nome_motorista
    FROM checklist_diario_frota c
    LEFT JOIN users u ON c.matricula_usuario = u.matricula
    WHERE 1=1
  `;

  const params = [];

  if (filtros.dataInicio) {
    query += ` AND c.data_registro >= ?`;
    params.push(filtros.dataInicio);
  }

  if (filtros.dataFim) {
    query += ` AND c.data_registro <= ?`;
    params.push(filtros.dataFim);
  }

  if (filtros.placa) {
    query += ` AND c.placa_veiculo LIKE ?`;
    params.push(`%${filtros.placa}%`);
  }

  query += ` ORDER BY c.data_registro DESC, c.hora_registro DESC LIMIT 100`;

  const [rows] = await promisePool.query(query, params);
  return rows;
}

async function buscarFotosPorChecklistId(id) {
  const query = `SELECT * FROM checklist_diario_fotos WHERE checklist_id = ?`;
  const [rows] = await promisePool.query(query, [id]);
  return rows;
}

async function excluirChecklist(id) {
  const query = `DELETE FROM checklist_diario_frota WHERE id = ?`;
  await promisePool.query(query, [id]);
}

module.exports = {
  buscarChecklistDoDia,
  buscarChecklistDoDiaPorPlaca,
  inserirChecklist,
  salvarFoto,
  listarChecklistsFiltrados,
  buscarFotosPorChecklistId,
  excluirChecklist,
};
