const { promisePool } = require("../../../infrastructure/database");
const { criarHashSenha } = require("../../../auth");

const NIVEL_ADMIN_TOTAL = 7;

function validarNivelAtribuivel(nivelSolicitado, nivelOperador) {
  const nivel = parseInt(nivelSolicitado, 10);
  const operador = parseInt(nivelOperador, 10);

  if (!Number.isFinite(nivel) || nivel < 0 || nivel > NIVEL_ADMIN_TOTAL) {
    throw new Error("Nível de permissão inválido.");
  }
  if (nivel > operador) {
    throw new Error("Você não pode atribuir um nível superior ao seu.");
  }
  if (nivel === NIVEL_ADMIN_TOTAL && operador !== NIVEL_ADMIN_TOTAL) {
    throw new Error("Apenas administradores totais podem conceder nível 7.");
  }
  return nivel;
}

async function assertPodeGerenciarUsuario(idAlvo, nivelOperador) {
  const alvo = await obterUsuarioPorId(idAlvo);
  const nivelAlvo = parseInt(alvo.nivel, 10);
  const operador = parseInt(nivelOperador, 10);

  if (nivelAlvo > operador) {
    throw new Error("Você não pode gerenciar um usuário com nível superior ao seu.");
  }
  return alvo;
}

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

async function criarUsuario(dadosUsuario, nivelOperador) {
  const { nome, matricula, cargo, nivel, senha } = dadosUsuario;
  if (!nome || !matricula || !cargo || nivel == null || !senha) {
    throw new Error("Todos os campos são obrigatórios.");
  }
  const nivelValidado = validarNivelAtribuivel(nivel, nivelOperador);
  const hashSenha = await criarHashSenha(senha);
  const [result] = await promisePool.query(
    "INSERT INTO users (nome, matricula, cargo, nivel, senha) VALUES (?, ?, ?, ?, ?)",
    [nome, matricula, cargo, nivelValidado, hashSenha]
  );
  return { id: result.insertId };
}

async function atualizarUsuario(id, dadosUsuario, nivelOperador, operadorId) {
  const isSelf = parseInt(id, 10) === parseInt(operadorId, 10);
  const alvo = isSelf
    ? await obterUsuarioPorId(id)
    : await assertPodeGerenciarUsuario(id, nivelOperador);

  const { nome, matricula, cargo, nivel, senha } = dadosUsuario;
  const nivelValidado = isSelf
    ? parseInt(alvo.nivel, 10)
    : validarNivelAtribuivel(nivel, nivelOperador);

  let sql, params;
  if (senha) {
    const hashSenha = await criarHashSenha(senha);
    sql =
      "UPDATE users SET nome = ?, matricula = ?, cargo = ?, nivel = ?, senha = ? WHERE id = ?";
    params = [nome, matricula, cargo, nivelValidado, hashSenha, id];
  } else {
    sql =
      "UPDATE users SET nome = ?, matricula = ?, cargo = ?, nivel = ? WHERE id = ?";
    params = [nome, matricula, cargo, nivelValidado, id];
  }
  const [result] = await promisePool.query(sql, params);
  if (result.affectedRows === 0) {
    throw new Error("Usuário não encontrado.");
  }
}

async function atualizarStatusUsuario(id, nivelAtual, nivelOperador, operadorId) {
  if (parseInt(id, 10) === parseInt(operadorId, 10)) {
    throw new Error("Você não pode alterar seu próprio status.");
  }
  await assertPodeGerenciarUsuario(id, nivelOperador);

  const novoNivel = nivelAtual > 0 ? 0 : 1;
  if (novoNivel > parseInt(nivelOperador, 10)) {
    throw new Error("Você não pode ativar um usuário com nível superior ao seu.");
  }

  await promisePool.query("UPDATE users SET nivel = ? WHERE id = ?", [
    novoNivel,
    id,
  ]);
  return novoNivel;
}

async function deletarUsuario(id, nivelOperador, operadorId) {
  if (parseInt(id, 10) === parseInt(operadorId, 10)) {
    throw new Error("Você não pode excluir sua própria conta.");
  }
  await assertPodeGerenciarUsuario(id, nivelOperador);

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
