const { promisePool } = require("../../../init");
const { criarHashSenha } = require("../../../auth");

async function listarUsuarios(filtros) {
  const { termo, cargo, nivel, pagina } = filtros;
  const limit = 15;
  const offset = (pagina - 1) * limit;

  let whereClauses = [];
  let params = [];
  if (termo) {
    whereClauses.push("(nome LIKE ? OR matricula LIKE ?)");
    params.push(`%${termo}%`, `%${termo}%`);
  }
  if (cargo) {
    whereClauses.push("cargo LIKE ?");
    params.push(`%${cargo}%`);
  }
  if (nivel && nivel !== "") {
    whereClauses.push("nivel = ?");
    params.push(nivel);
  }
  const whereString =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const countSql = `SELECT COUNT(*) as total FROM users ${whereString}`;
  const [countRows] = await promisePool.query(countSql, params);
  const totalUsers = countRows[0].total;
  const totalPages = Math.ceil(totalUsers / limit);

  const usersSql = `SELECT id, nome, matricula, cargo, nivel FROM users ${whereString} ORDER BY nome ASC LIMIT ? OFFSET ?`;
  const [users] = await promisePool.query(usersSql, [...params, limit, offset]);

  return { users, totalPages };
}

async function obterUsuarioPorId(id) {
  const [rows] = await promisePool.query(
    "SELECT id, nome, matricula, cargo, nivel FROM users WHERE id = ?",
    [id]
  );
  if (rows.length === 0) {
    throw new Error("Usuário não encontrado.");
  }
  return rows[0];
}

async function criarUsuario(dadosUsuario) {
  const { nome, matricula, cargo, nivel, senha } = dadosUsuario;
  if (!nome || !matricula || !cargo || !nivel || !senha) {
    throw new Error("Todos os campos são obrigatórios.");
  }
  const hashSenha = await criarHashSenha(senha);
  const [result] = await promisePool.query(
    "INSERT INTO users (nome, matricula, cargo, nivel, senha) VALUES (?, ?, ?, ?, ?)",
    [nome, matricula, cargo, nivel, hashSenha]
  );
  return { id: result.insertId };
}

async function atualizarUsuario(id, dadosUsuario) {
  const { nome, matricula, cargo, nivel, senha } = dadosUsuario;
  let sql, params;
  if (senha) {
    const hashSenha = await criarHashSenha(senha);
    sql =
      "UPDATE users SET nome = ?, matricula = ?, cargo = ?, nivel = ?, senha = ? WHERE id = ?";
    params = [nome, matricula, cargo, nivel, hashSenha, id];
  } else {
    sql =
      "UPDATE users SET nome = ?, matricula = ?, cargo = ?, nivel = ? WHERE id = ?";
    params = [nome, matricula, cargo, nivel, id];
  }
  const [result] = await promisePool.query(sql, params);
  if (result.affectedRows === 0) {
    throw new Error("Usuário não encontrado.");
  }
}

async function atualizarStatusUsuario(id, nivelAtual) {
  const novoNivel = nivelAtual > 0 ? 0 : 1;
  await promisePool.query("UPDATE users SET nivel = ? WHERE id = ?", [
    novoNivel,
    id,
  ]);
  return novoNivel;
}

async function deletarUsuario(id) {
  const [result] = await promisePool.query("DELETE FROM users WHERE id = ?", [
    id,
  ]);
  if (result.affectedRows === 0) {
    throw new Error("Usuário não encontrado.");
  }
}

module.exports = {
  listarUsuarios,
  obterUsuarioPorId,
  criarUsuario,
  atualizarUsuario,
  atualizarStatusUsuario,
  deletarUsuario,
};
