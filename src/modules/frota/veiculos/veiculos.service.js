const { promisePool } = require("../../../init");

async function listarMotoristas() {
  const [rows] = await promisePool.query(
    "SELECT matricula, nome FROM users WHERE cargo = 'Motorista'"
  );
  return rows;
}

async function listarEncarregados() {
  const [rows] = await promisePool.query(
    "SELECT matricula, nome FROM users WHERE cargo = 'Encarregado' ORDER BY nome ASC"
  );
  return rows;
}

async function listarPlacas() {
  const [rows] = await promisePool.query(
    `SELECT
      v.id, v.placa, v.modelo, v.encarregado_matricula,
      v.ordem_checklist_semanal, u.nome AS encarregado_nome
    FROM veiculos v
    LEFT JOIN users u ON v.encarregado_matricula = u.matricula
    ORDER BY v.placa ASC`
  );
  return rows;
}

async function listarVeiculosControle(placa) {
  let query =
    "SELECT id, placa, modelo AS nome, situacao, tipo_veiculo, ano_fabricacao, DATE_FORMAT(data_aquisicao, '%Y-%m-%d') as data_aquisicao, cor FROM veiculos WHERE 1=1";
  const values = [];

  if (placa) {
    query += ` AND placa LIKE ?`;
    values.push(`%${placa}%`);
  }
  query += " ORDER BY modelo ASC";
  const [rows] = await promisePool.query(query, values);
  return rows;
}

async function listarInventario() {
  const [rows] = await promisePool.query(
    "SELECT id, codigo, placa, nome, situacao, tipo_veiculo, ano_fabricacao, DATE_FORMAT(data_aquisicao, '%d/%m/%Y') as data_aquisicao, cor, descricao FROM frota_inventario ORDER BY nome ASC"
  );
  return rows;
}

async function criarItemInventario(dadosItem) {
  const {
    codigo,
    placa,
    nome,
    situacao,
    tipo_veiculo,
    descricao,
    ano_fabricacao,
    data_aquisicao,
    cor,
  } = dadosItem;

  if (!placa || !nome || !situacao || !tipo_veiculo || !data_aquisicao) {
    throw new Error("Campos obrigatórios estão faltando!");
  }

  const query = `
    INSERT INTO frota_inventario 
    (codigo, placa, nome, situacao, tipo_veiculo, descricao, ano_fabricacao, data_aquisicao, cor) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const [result] = await promisePool.query(query, [
    codigo || null,
    placa,
    nome,
    situacao,
    tipo_veiculo,
    descricao || null,
    ano_fabricacao || null,
    data_aquisicao,
    cor || null,
  ]);
  return { id: result.insertId };
}

async function deletarItemInventario(id) {
  const [veiculo] = await promisePool.query(
    "SELECT placa FROM frota_inventario WHERE id = ?",
    [id]
  );
  if (veiculo.length === 0) {
    throw new Error("Veículo não encontrado.");
  }
  const placa = veiculo[0].placa;

  const [result] = await promisePool.query(
    "DELETE FROM frota_inventario WHERE id = ?",
    [id]
  );
  if (result.affectedRows === 0) {
    throw new Error("Veículo não encontrado.");
  }
  return { placa };
}

async function listarMotoristasCrud() {
  const [rows] = await promisePool.query(
    "SELECT id, matricula, nome FROM frota_motorista ORDER BY nome ASC"
  );
  return rows;
}

async function criarMotoristaCrud(dadosMotorista) {
  const { matricula, nome } = dadosMotorista;
  if (!matricula || !nome) {
    throw new Error("Matrícula e nome são obrigatórios.");
  }

  const [existing] = await promisePool.query(
    "SELECT id FROM frota_motorista WHERE matricula = ?",
    [matricula]
  );
  if (existing.length > 0) {
    throw new Error("Matrícula já cadastrada para outro motorista.");
  }

  const sql = "INSERT INTO frota_motorista (matricula, nome) VALUES (?, ?)";
  const [result] = await promisePool.query(sql, [matricula, nome]);
  return { id: result.insertId };
}

async function deletarMotoristaCrud(id) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const [motoristas] = await connection.query(
      "SELECT matricula, nome FROM frota_motorista WHERE id = ?",
      [id]
    );
    const motoristaParaAuditoria = motoristas[0];

    const [result] = await connection.query(
      "DELETE FROM frota_motorista WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      throw new Error("Motorista não encontrado.");
    }

    await connection.commit();
    return { motoristaParaAuditoria, connection };
  } catch (err) {
    if (connection) await connection.rollback();
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

async function listarEstoqueCrud(filtros) {
  let query = "SELECT id, cod, nome, unid FROM frota_pçs";
  const queryParams = [];
  const conditions = [];

  if (filtros.cod) {
    conditions.push("cod LIKE ?");
    queryParams.push(`${filtros.cod}%`);
  }
  if (filtros.nome) {
    conditions.push("nome LIKE ?");
    queryParams.push(`%${filtros.nome}%`);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY nome ASC";

  const [rows] = await promisePool.query(query, queryParams);
  return rows;
}

async function criarItemEstoqueCrud(dadosItem) {
  const { cod, nome, unid } = dadosItem;
  if (!cod || !nome) {
    throw new Error("Código e Nome da peça são obrigatórios.");
  }

  const [existing] = await promisePool.query(
    "SELECT id FROM frota_pçs WHERE cod = ?",
    [cod]
  );
  if (existing.length > 0) {
    throw new Error("Código da peça já cadastrado.");
  }

  const sql = "INSERT INTO frota_pçs (cod, nome, unid) VALUES (?, ?, ?)";
  const [result] = await promisePool.query(sql, [cod, nome, unid || null]);
  return { id: result.insertId };
}

async function deletarItemEstoqueCrud(id) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const [pecas] = await connection.query(
      "SELECT cod, nome FROM frota_pçs WHERE id = ?",
      [id]
    );
    const pecaParaAuditoria = pecas[0];

    const [result] = await connection.query(
      "DELETE FROM frota_pçs WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      throw new Error("Peça não encontrada no estoque.");
    }

    await connection.commit();
    return { pecaParaAuditoria, connection };
  } catch (err) {
    if (connection) await connection.rollback();
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  listarMotoristas,
  listarEncarregados,
  listarPlacas,
  listarVeiculosControle,
  listarInventario,
  criarItemInventario,
  deletarItemInventario,
  listarMotoristasCrud,
  criarMotoristaCrud,
  deletarMotoristaCrud,
  listarEstoqueCrud,
  criarItemEstoqueCrud,
  deletarItemEstoqueCrud,
};
