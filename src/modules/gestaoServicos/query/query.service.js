const { promisePool } = require("../../../init");

async function contarServicos(status) {
  let query = "SELECT COUNT(*) as total FROM processos";
  const params = [];
  if (status) {
    if (status === "concluido") {
      query += " WHERE status IN ('concluido', 'nao_concluido')";
    } else {
      query += " WHERE status = ?";
      params.push(status);
    }
  }
  const [result] = await promisePool.query(query, params);
  return result[0];
}

async function listarEncarregados() {
  const [rows] = await promisePool.query(
    "SELECT DISTINCT matricula, nome FROM users WHERE cargo IN ('Encarregado', 'Engenheiro', 'Técnico', 'ADM', 'ADMIN', 'Inspetor') ORDER BY nome"
  );
  return rows;
}

async function listarSubestacoes() {
  const [rows] = await promisePool.query(
    'SELECT DISTINCT subestacao as nome FROM processos WHERE subestacao IS NOT NULL AND subestacao != "" ORDER BY subestacao'
  );
  return rows;
}

module.exports = {
  contarServicos,
  listarEncarregados,
  listarSubestacoes,
};
