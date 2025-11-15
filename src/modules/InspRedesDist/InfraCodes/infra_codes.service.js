const { promisePool } = require("../../../init");

// --- Funções para Tipos de Código (redes_code_types) ---

async function obterTodosTipos() {
  const sql =
    "SELECT id, ponto_defeito FROM redes_code_types ORDER BY ponto_defeito ASC";
  const [rows] = await promisePool.query(sql);
  return rows;
}

async function criarTipo(dadosTipo) {
  const { ponto_defeito } = dadosTipo;
  if (!ponto_defeito) {
    throw new Error("O nome do tipo (ponto de defeito) é obrigatório.");
  }
  const sql = "INSERT INTO redes_code_types (ponto_defeito) VALUES (?)";
  const [result] = await promisePool.query(sql, [ponto_defeito]);
  return { id: result.insertId, ponto_defeito };
}

async function atualizarTipo(id, dadosTipo) {
  const { ponto_defeito } = dadosTipo;
  if (!ponto_defeito) {
    throw new Error("O nome do tipo (ponto de defeito) é obrigatório.");
  }
  const sql = "UPDATE redes_code_types SET ponto_defeito = ? WHERE id = ?";
  const [result] = await promisePool.query(sql, [ponto_defeito, id]);
  if (result.affectedRows === 0) {
    throw new Error("Tipo de código não encontrado.");
  }
  return { id, ponto_defeito };
}

async function deletarTipo(id) {
  const checkSql =
    "SELECT COUNT(*) as count FROM redes_code_tags WHERE id_ponto_defeito = ?";
  const [checkRows] = await promisePool.query(checkSql, [id]);
  const count = checkRows[0].count;

  if (count > 0) {
    throw new Error(
      `Não é possível excluir este tipo, pois ele está sendo usado por ${count} tag(s) de código.`
    );
  }

  const deleteSql = "DELETE FROM redes_code_types WHERE id = ?";
  const [result] = await promisePool.query(deleteSql, [id]);

  if (result.affectedRows === 0) {
    throw new Error("Tipo de código não encontrado.");
  }
}

// --- Funções para Tags de Código (redes_code_tags) ---

async function obterTodasTags() {
  const sql = `
    SELECT 
      t.id, 
      t.tag_code, 
      t.descricao, 
      t.id_ponto_defeito,
      c.ponto_defeito 
    FROM redes_code_tags t
    JOIN redes_code_types c ON t.id_ponto_defeito = c.id
    ORDER BY t.tag_code ASC
  `;
  const [rows] = await promisePool.query(sql);
  return rows;
}

async function obterTagPorId(id) {
  const sql = `
    SELECT 
      t.id, 
      t.tag_code, 
      t.descricao, 
      t.id_ponto_defeito
    FROM redes_code_tags t
    WHERE t.id = ?
  `;
  const [rows] = await promisePool.query(sql, [id]);
  if (rows.length === 0) {
    throw new Error("Tag de código não encontrada.");
  }
  return rows[0];
}

async function criarTag(dadosTag) {
  const { tag_code, id_ponto_defeito, descricao } = dadosTag;
  if (!tag_code || !id_ponto_defeito || !descricao) {
    throw new Error(
      "Todos os campos (tag, tipo e descrição) são obrigatórios."
    );
  }
  const sql =
    "INSERT INTO redes_code_tags (tag_code, id_ponto_defeito, descricao) VALUES (?, ?, ?)";
  const [result] = await promisePool.query(sql, [
    tag_code,
    id_ponto_defeito,
    descricao,
  ]);
  return { id: result.insertId, ...dadosTag };
}

async function atualizarTag(id, dadosTag) {
  const { tag_code, id_ponto_defeito, descricao } = dadosTag;
  if (!tag_code || !id_ponto_defeito || !descricao) {
    throw new Error(
      "Todos os campos (tag, tipo e descrição) são obrigatórios."
    );
  }
  const sql =
    "UPDATE redes_code_tags SET tag_code = ?, id_ponto_defeito = ?, descricao = ? WHERE id = ?";
  const [result] = await promisePool.query(sql, [
    tag_code,
    id_ponto_defeito,
    descricao,
    id,
  ]);
  if (result.affectedRows === 0) {
    throw new Error("Tag de código não encontrada.");
  }
  return { id, ...dadosTag };
}

async function deletarTag(id) {
  const sql = "DELETE FROM redes_code_tags WHERE id = ?";
  const [result] = await promisePool.query(sql, [id]);
  if (result.affectedRows === 0) {
    throw new Error("Tag de código não encontrada.");
  }
}

module.exports = {
  obterTodosTipos,
  criarTipo,
  atualizarTipo,
  deletarTipo,
  obterTodasTags,
  obterTagPorId,
  criarTag,
  atualizarTag,
  deletarTag,
};
