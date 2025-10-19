const { promisePool } = require("../../../init");

async function listarVeiculos(filtros) {
  const { termo, status, pagina } = filtros;
  const limit = 15;
  const offset = (pagina - 1) * limit;

  let whereClauses = [];
  let params = [];
  if (termo) {
    whereClauses.push("(placa LIKE ? OR modelo LIKE ?)");
    params.push(`%${termo}%`, `%${termo}%`);
  }
  if (status) {
    whereClauses.push("status = ?");
    params.push(status);
  }
  const whereString =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const countSql = `SELECT COUNT(*) as total FROM veiculos_frota ${whereString}`;
  const [countRows] = await promisePool.query(countSql, params);
  const totalVeiculos = countRows[0].total;
  const totalPages = Math.ceil(totalVeiculos / limit);

  const veiculosSql = `SELECT * FROM veiculos_frota ${whereString} ORDER BY modelo ASC LIMIT ? OFFSET ?`;
  const [veiculos] = await promisePool.query(veiculosSql, [
    ...params,
    limit,
    offset,
  ]);

  return { veiculos, totalPages };
}

async function obterVeiculoPorId(id) {
  const [rows] = await promisePool.query(
    "SELECT * FROM veiculos_frota WHERE id = ?",
    [id]
  );
  if (rows.length === 0) {
    throw new Error("Veículo não encontrado.");
  }
  return rows[0];
}

async function criarVeiculo(dadosVeiculo) {
  const { placa, modelo, tipo, ano, status } = dadosVeiculo;
  if (!placa || !modelo) {
    throw new Error("Placa e Modelo são obrigatórios.");
  }
  const [result] = await promisePool.query(
    "INSERT INTO veiculos_frota (placa, modelo, tipo, ano, status) VALUES (?, ?, ?, ?, ?)",
    [placa, modelo, tipo || null, ano || null, status || "ATIVO"]
  );
  return { id: result.insertId };
}

async function atualizarVeiculo(id, dadosVeiculo) {
  const { placa, modelo, tipo, ano, status } = dadosVeiculo;
  if (!placa || !modelo) {
    throw new Error("Placa e Modelo são obrigatórios.");
  }
  const [result] = await promisePool.query(
    "UPDATE veiculos_frota SET placa = ?, modelo = ?, tipo = ?, ano = ?, status = ? WHERE id = ?",
    [placa, modelo, tipo, ano, status, id]
  );
  if (result.affectedRows === 0) {
    throw new Error("Veículo não encontrado.");
  }
}

async function deletarVeiculo(id) {
  const [result] = await promisePool.query(
    "DELETE FROM veiculos_frota WHERE id = ?",
    [id]
  );
  if (result.affectedRows === 0) {
    throw new Error("Veículo não encontrado.");
  }
}

module.exports = {
  listarVeiculos,
  obterVeiculoPorId,
  criarVeiculo,
  atualizarVeiculo,
  deletarVeiculo,
};
