const { promisePool } = require("../../../init");

async function listarSubestacoes() {
  const [rows] = await promisePool.query(
    "SELECT Id, sigla, nome, Ano_Inicio_Op FROM subestacoes ORDER BY nome ASC"
  );
  return rows;
}

async function obterSubestacaoPorId(id) {
  if (isNaN(parseInt(id, 10))) {
    throw new Error(`ID da subestação inválido: ${id}`);
  }
  const [rows] = await promisePool.query(
    "SELECT Id, sigla, nome, Ano_Inicio_Op FROM subestacoes WHERE Id = ?",
    [id]
  );
  if (rows.length === 0) {
    throw new Error("Subestação não encontrada.");
  }
  return rows[0];
}

async function criarSubestacao(dados) {
  const { sigla, nome, Ano_Inicio_Op } = dados;
  if (!sigla || !nome) {
    throw new Error("Sigla e Nome são obrigatórios.");
  }
  let anoOperacao = null;
  if (Ano_Inicio_Op) {
    const anoNum = parseInt(Ano_Inicio_Op, 10);
    if (isNaN(anoNum) || anoNum < 1900 || anoNum > 2200) {
      throw new Error("Ano de Início de Operação inválido.");
    }
    anoOperacao = anoNum;
  }
  const [result] = await promisePool.query(
    "INSERT INTO subestacoes (sigla, nome, Ano_Inicio_Op) VALUES (?, ?, ?)",
    [sigla.toUpperCase(), nome, anoOperacao]
  );
  return {
    id: result.insertId,
    sigla: sigla.toUpperCase(),
    nome,
    Ano_Inicio_Op: anoOperacao,
  };
}

async function atualizarSubestacao(id, dados) {
  if (isNaN(parseInt(id, 10))) {
    throw new Error(`ID da subestação inválido: ${id}`);
  }
  const { sigla, nome, Ano_Inicio_Op } = dados;
  if (!sigla || !nome) {
    throw new Error("Sigla e Nome são obrigatórios.");
  }
  let anoOperacao = undefined;
  if (Ano_Inicio_Op !== undefined) {
    if (Ano_Inicio_Op === null || String(Ano_Inicio_Op).trim() === "") {
      anoOperacao = null;
    } else {
      const anoNum = parseInt(Ano_Inicio_Op, 10);
      if (isNaN(anoNum) || anoNum < 1900 || anoNum > 2200) {
        throw new Error("Ano de Início de Operação inválido.");
      }
      anoOperacao = anoNum;
    }
  }
  const [currentSubestacao] = await promisePool.query(
    "SELECT sigla, nome, Ano_Inicio_Op FROM subestacoes WHERE Id = ?",
    [id]
  );
  if (currentSubestacao.length === 0) {
    throw new Error("Subestação não encontrada para atualização.");
  }
  const updateFields = {
    sigla: sigla.toUpperCase(),
    nome: nome,
    Ano_Inicio_Op:
      anoOperacao !== undefined
        ? anoOperacao
        : currentSubestacao[0].Ano_Inicio_Op,
  };
  await promisePool.query(
    "UPDATE subestacoes SET sigla = ?, nome = ?, Ano_Inicio_Op = ? WHERE Id = ?",
    [updateFields.sigla, updateFields.nome, updateFields.Ano_Inicio_Op, id]
  );
  return updateFields;
}

async function deletarSubestacao(id) {
  if (isNaN(parseInt(id, 10))) {
    throw new Error(`ID da subestação inválido: ${id}`);
  }
  const [servicos] = await promisePool.query(
    "SELECT COUNT(*) as count FROM servicos_subestacoes WHERE subestacao_id = ?",
    [id]
  );
  if (servicos[0].count > 0) {
    throw new Error(
      `Não é possível excluir subestação: Existem ${servicos[0].count} serviços associados.`
    );
  }
  const [inspecoes] = await promisePool.query(
    "SELECT COUNT(*) as count FROM inspecoes_subestacoes WHERE subestacao_id = ?",
    [id]
  );
  if (inspecoes[0].count > 0) {
    throw new Error(
      `Não é possível excluir subestação: Existem ${inspecoes[0].count} inspeções associadas.`
    );
  }
  const [result] = await promisePool.query(
    "DELETE FROM subestacoes WHERE Id = ?",
    [id]
  );
  if (result.affectedRows === 0) {
    throw new Error("Subestação não encontrada para exclusão.");
  }
}

async function listarCatalogo() {
  const [rows] = await promisePool.query(
    "SELECT id, codigo, nome, descricao, categoria FROM catalogo_equipamentos ORDER BY categoria, nome ASC"
  );
  return rows;
}

async function criarItemCatalogo(dados) {
  const { codigo, nome, descricao, categoria } = dados;
  if (!codigo || !nome) {
    throw new Error("Código e Nome são obrigatórios para o item do catálogo.");
  }
  const [result] = await promisePool.query(
    "INSERT INTO catalogo_equipamentos (codigo, nome, descricao, categoria) VALUES (?, ?, ?, ?)",
    [codigo.toUpperCase(), nome, descricao, categoria]
  );
  return { id: result.insertId };
}

async function atualizarItemCatalogo(id, dados) {
  if (isNaN(parseInt(id, 10))) {
    throw new Error(`ID do item de catálogo inválido: ${id}`);
  }
  const { codigo, nome, descricao, categoria } = dados;
  if (!codigo || !nome) {
    throw new Error("Código e Nome são obrigatórios.");
  }
  const [result] = await promisePool.query(
    "UPDATE catalogo_equipamentos SET codigo = ?, nome = ?, descricao = ?, categoria = ? WHERE id = ?",
    [codigo.toUpperCase(), nome, descricao, categoria, id]
  );
  if (result.affectedRows === 0) {
    throw new Error("Item de catálogo não encontrado.");
  }
}

async function deletarItemCatalogo(id) {
  if (isNaN(parseInt(id, 10))) {
    throw new Error(`ID do item de catálogo inválido: ${id}`);
  }
  const [usage] = await promisePool.query(
    "SELECT COUNT(*) as count FROM servico_itens_escopo WHERE catalogo_equipamento_id = ?",
    [id]
  );
  if (usage[0].count > 0) {
    throw new Error(
      `Não é possível excluir: este tipo de equipamento está sendo usado em ${usage[0].count} serviço(s).`
    );
  }
  const [result] = await promisePool.query(
    "DELETE FROM catalogo_equipamentos WHERE id = ?",
    [id]
  );
  if (result.affectedRows === 0) {
    throw new Error("Item de catálogo não encontrado.");
  }
}

module.exports = {
  listarSubestacoes,
  obterSubestacaoPorId,
  criarSubestacao,
  atualizarSubestacao,
  deletarSubestacao,
  listarCatalogo,
  criarItemCatalogo,
  atualizarItemCatalogo,
  deletarItemCatalogo,
};
