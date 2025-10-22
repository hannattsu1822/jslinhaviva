const { promisePool } = require("../../init");

async function listarReles() {
  const [rows] = await promisePool.query(
    "SELECT id, nome_rele, local_tag, ip_address, port, ativo, ultima_leitura, status_json FROM dispositivos_reles ORDER BY nome_rele"
  );
  return rows;
}

async function obterRelePorId(id) {
  const [rows] = await promisePool.query(
    "SELECT * FROM dispositivos_reles WHERE id = ?",
    [id]
  );
  if (rows.length === 0) {
    throw new Error("Relé não encontrado");
  }
  return rows[0];
}

async function criarRele(dadosRele) {
  const { nome_rele, local_tag, ip_address, port, ativo } = dadosRele;
  if (!nome_rele || !ip_address || !port) {
    throw new Error("Campos obrigatórios: nome_rele, ip_address, port");
  }
  const [result] = await promisePool.query(
    "INSERT INTO dispositivos_reles (nome_rele, local_tag, ip_address, port, ativo) VALUES (?, ?, ?, ?, ?)",
    [nome_rele, local_tag, ip_address, port, ativo !== undefined ? ativo : 1]
  );
  return { id: result.insertId };
}

async function atualizarRele(id, dadosRele) {
  const { nome_rele, local_tag, ip_address, port, ativo } = dadosRele;
  if (!nome_rele || !ip_address || !port) {
    throw new Error("Campos obrigatórios: nome_rele, ip_address, port");
  }
  const [result] = await promisePool.query(
    "UPDATE dispositivos_reles SET nome_rele = ?, local_tag = ?, ip_address = ?, port = ?, ativo = ? WHERE id = ?",
    [nome_rele, local_tag, ip_address, port, ativo, id]
  );
  if (result.affectedRows === 0) {
    throw new Error("Relé não encontrado");
  }
}

async function deletarRele(id) {
  const [rele] = await promisePool.query(
    "SELECT nome_rele FROM dispositivos_reles WHERE id = ?",
    [id]
  );
  if (rele.length === 0) {
    throw new Error("Relé não encontrado para deletar.");
  }
  const [result] = await promisePool.query(
    "DELETE FROM dispositivos_reles WHERE id = ?",
    [id]
  );
  if (result.affectedRows === 0) {
    throw new Error("Relé não encontrado");
  }
  return { nomeRele: rele[0].nome_rele };
}

async function obterLeituras(releId, limit) {
  const [leituras] = await promisePool.query(
    `SELECT * FROM leituras_reles WHERE rele_id = ? ORDER BY timestamp_leitura DESC LIMIT ?`,
    [releId, parseInt(limit)]
  );
  return leituras.reverse();
}

async function obterDadosPaginaDetalhe(id) {
  const [rele] = await promisePool.query(
    "SELECT nome_rele, local_tag FROM dispositivos_reles WHERE id = ?",
    [id]
  );
  if (rele.length === 0) {
    throw new Error("Relé não encontrado");
  }
  const [ultimaLeituraRows] = await promisePool.query(
    `SELECT * FROM leituras_reles WHERE rele_id = ? ORDER BY timestamp_leitura DESC LIMIT 1`,
    [id]
  );
  return {
    rele: rele[0],
    ultimaLeitura: ultimaLeituraRows.length > 0 ? ultimaLeituraRows[0] : null,
  };
}

module.exports = {
  listarReles,
  obterRelePorId,
  criarRele,
  atualizarRele,
  deletarRele,
  obterLeituras,
  obterDadosPaginaDetalhe,
};
