const { promisePool } = require("../../init");

async function buscarChecklistDoDia(matricula) {
  const query = `
    SELECT id, veiculo_id, placa_veiculo, data_registro, hora_registro
    FROM checklist_diario_frota
    WHERE matricula_usuario = ? AND data_registro = CURDATE()
    LIMIT 1
  `;

  const [rows] = await promisePool.query(query, [matricula]);
  return rows[0];
}

async function buscarChecklistDoDiaPorPlaca(placa) {
  const query = `
    SELECT id, veiculo_id, placa_veiculo, data_registro, hora_registro, matricula_usuario
    FROM checklist_diario_frota
    WHERE placa_veiculo = ? AND data_registro = CURDATE()
    LIMIT 1
  `;

  const [rows] = await promisePool.query(query, [placa]);
  return rows[0];
}

async function buscarChecklistDoDiaPorVeiculoId(veiculoId) {
  const query = `
    SELECT id, veiculo_id, placa_veiculo, data_registro, hora_registro, matricula_usuario
    FROM checklist_diario_frota
    WHERE veiculo_id = ? AND data_registro = CURDATE()
    LIMIT 1
  `;

  const [rows] = await promisePool.query(query, [veiculoId]);
  return rows[0];
}

async function inserirChecklist(dados) {
  const columns = ["matricula_usuario"];
  const values = ["?"];
  const params = [dados.matricula];

  if (dados.veiculo_id !== undefined && dados.veiculo_id !== null) {
    columns.push("veiculo_id");
    values.push("?");
    params.push(dados.veiculo_id);
  }

  columns.push(
    "placa_veiculo",
    "quilometragem",
    "nivel_oleo",
    "nivel_agua",
    "calibragem_pneus",
    "luzes_sinalizacao",
    "freios",
    "avarias_lataria",
    "observacoes"
  );

  values.push("?", "?", "?", "?", "?", "?", "?", "?", "?");

  params.push(
    dados.placa,
    dados.km,
    dados.oleo,
    dados.agua,
    dados.pneus,
    dados.luzes,
    dados.freios,
    dados.lataria,
    dados.observacoes
  );

  const query = `
    INSERT INTO checklist_diario_frota
    (${columns.join(", ")}, data_registro, hora_registro)
    VALUES
    (${values.join(", ")}, CURDATE(), CURTIME())
  `;

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
    SELECT
      c.*,
      u.nome AS nome_motorista,
      v.modelo AS veiculo_modelo,
      v.placa AS veiculo_placa
    FROM checklist_diario_frota c
    LEFT JOIN users u ON c.matricula_usuario = u.matricula
    LEFT JOIN veiculos_frota v ON c.veiculo_id = v.id
    WHERE 1=1
  `;

  const params = [];

  if (filtros.dataInicio) {
    query += " AND c.data_registro >= ?";
    params.push(filtros.dataInicio);
  }

  if (filtros.dataFim) {
    query += " AND c.data_registro <= ?";
    params.push(filtros.dataFim);
  }

  if (filtros.veiculoId) {
    query += " AND c.veiculo_id = ?";
    params.push(filtros.veiculoId);
  }

  if (filtros.placa) {
    query += " AND (c.placa_veiculo LIKE ? OR v.placa LIKE ?)";
    params.push(`%${filtros.placa}%`, `%${filtros.placa}%`);
  }

  query += " ORDER BY c.data_registro DESC, c.hora_registro DESC LIMIT 100";

  const [rows] = await promisePool.query(query, params);
  return rows;
}

async function buscarFotosPorChecklistId(id) {
  const query = "SELECT * FROM checklist_diario_fotos WHERE checklist_id = ?";
  const [rows] = await promisePool.query(query, [id]);
  return rows;
}

async function excluirChecklist(id) {
  const query = "DELETE FROM checklist_diario_frota WHERE id = ?";
  await promisePool.query(query, [id]);
}

module.exports = {
  buscarChecklistDoDia,
  buscarChecklistDoDiaPorPlaca,
  buscarChecklistDoDiaPorVeiculoId,
  inserirChecklist,
  salvarFoto,
  listarChecklistsFiltrados,
  buscarFotosPorChecklistId,
  excluirChecklist,
};
