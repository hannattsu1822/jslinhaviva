const { promisePool } = require("../../../init");

async function listarMembros() {
  const [rows] = await promisePool.query(
    "SELECT id, matricula, nome, cargo, turma_encarregado FROM turmas ORDER BY turma_encarregado, nome"
  );
  return rows;
}

async function adicionarMembro(dadosMembro) {
  const { matricula, nome, cargo, turma_encarregado } = dadosMembro;
  if (!matricula || !nome || !cargo || !turma_encarregado) {
    throw new Error(
      "Todos os campos são obrigatórios: matrícula, nome, cargo e turma do encarregado."
    );
  }

  const [existingUserInTurmas] = await promisePool.query(
    "SELECT * FROM turmas WHERE matricula = ?",
    [matricula]
  );
  if (existingUserInTurmas.length > 0) {
    throw new Error("Este usuário já está cadastrado em uma turma.");
  }

  await promisePool.query(
    "INSERT INTO turmas (matricula, nome, cargo, turma_encarregado) VALUES (?, ?, ?, ?)",
    [matricula, nome, cargo, turma_encarregado]
  );
}

async function atualizarMembro(id, dadosMembro) {
  const { turma_encarregado, nome, cargo, matricula } = dadosMembro;

  if (
    turma_encarregado === undefined &&
    nome === undefined &&
    cargo === undefined &&
    matricula === undefined
  ) {
    throw new Error("Nenhum dado fornecido para atualização.");
  }

  let query = "UPDATE turmas SET ";
  const params = [];
  const fieldsToUpdate = [];

  if (dadosMembro.hasOwnProperty("turma_encarregado")) {
    fieldsToUpdate.push("turma_encarregado = ?");
    params.push(turma_encarregado);
  }
  if (dadosMembro.hasOwnProperty("nome")) {
    fieldsToUpdate.push("nome = ?");
    params.push(nome);
  }
  if (dadosMembro.hasOwnProperty("cargo")) {
    fieldsToUpdate.push("cargo = ?");
    params.push(cargo);
  }
  if (dadosMembro.hasOwnProperty("matricula")) {
    fieldsToUpdate.push("matricula = ?");
    params.push(matricula);
  }

  if (fieldsToUpdate.length === 0) {
    throw new Error("Nenhum campo válido para atualização especificado.");
  }

  query += fieldsToUpdate.join(", ") + " WHERE id = ?";
  params.push(id);

  const [result] = await promisePool.query(query, params);

  if (result.affectedRows === 0) {
    throw new Error("Membro não encontrado na tabela de turmas.");
  }
}

async function removerMembro(id) {
  const [result] = await promisePool.query("DELETE FROM turmas WHERE id = ?", [
    id,
  ]);
  if (result.affectedRows === 0) {
    throw new Error("Membro não encontrado na tabela de turmas.");
  }
}

async function listarFuncionariosPorTurma(turmaEncarregadoId, usuarioLogado) {
  const privilegedRoles = [
    "Tecnico",
    "Engenheiro",
    "ADMIN",
    "Admin",
    "Inspetor",
  ];
  let userTurmaEncarregado = null;

  if (usuarioLogado && usuarioLogado.matricula) {
    const [userTurmaDetails] = await promisePool.query(
      "SELECT turma_encarregado FROM turmas WHERE matricula = ? LIMIT 1",
      [usuarioLogado.matricula]
    );
    if (userTurmaDetails.length > 0) {
      userTurmaEncarregado = userTurmaDetails[0].turma_encarregado;
    }
  }

  const isUserPrivileged =
    privilegedRoles.includes(usuarioLogado.cargo) ||
    (userTurmaEncarregado && userTurmaEncarregado.toString() === "2193");

  if (
    usuarioLogado.cargo === "Encarregado" &&
    !isUserPrivileged &&
    (userTurmaEncarregado
      ? userTurmaEncarregado.toString()
      : usuarioLogado.matricula.toString()) !== turmaEncarregadoId.toString()
  ) {
    throw new Error(
      "Acesso negado: Supervisores não privilegiados só podem visualizar funcionários de sua própria turma."
    );
  }

  const [rows] = await promisePool.query(
    "SELECT matricula, nome, cargo FROM turmas WHERE turma_encarregado = ? ORDER BY nome",
    [turmaEncarregadoId]
  );
  return rows;
}

async function obterDetalhesTurmaUsuario(matricula) {
  if (!matricula) {
    throw new Error("Matrícula do usuário não encontrada na requisição.");
  }
  const [results] = await promisePool.query(
    "SELECT turma_encarregado FROM turmas WHERE matricula = ? LIMIT 1",
    [matricula]
  );
  return {
    turma_encarregado: results.length > 0 ? results[0].turma_encarregado : null,
  };
}

module.exports = {
  listarMembros,
  adicionarMembro,
  atualizarMembro,
  removerMembro,
  listarFuncionariosPorTurma,
  obterDetalhesTurmaUsuario,
};
