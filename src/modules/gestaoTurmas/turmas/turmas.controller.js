const service = require("./turmas.service");
const { registrarAuditoria } = require("../../../auth");

async function listarMembros(req, res) {
  try {
    const membros = await service.listarMembros();
    res.status(200).json(membros);
  } catch (err) {
    console.error("Erro ao buscar usuários das turmas:", err);
    res.status(500).json({ message: "Erro ao buscar usuários das turmas!" });
  }
}

async function adicionarMembro(req, res) {
  try {
    await service.adicionarMembro(req.body);
    await registrarAuditoria(
      req.user.matricula,
      "Adicionar Membro Turma",
      `Matrícula: ${req.body.matricula}, Nome: ${req.body.nome}, Turma: ${req.body.turma_encarregado}`
    );
    res.status(201).json({ message: "Membro adicionado com sucesso!" });
  } catch (err) {
    console.error("Erro ao adicionar membro:", err);
    if (
      err.code === "ER_DUP_ENTRY" ||
      err.message.includes("já está cadastrado")
    ) {
      return res.status(409).json({ message: err.message });
    }
    const statusCode = err.message.includes("obrigatórios") ? 400 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function atualizarMembro(req, res) {
  try {
    await service.atualizarMembro(req.params.id, req.body);
    await registrarAuditoria(
      req.user.matricula,
      "Atualizar Membro Turma",
      `ID Turma: ${req.params.id}, Novos Dados: ${JSON.stringify(req.body)}`
    );
    res.status(200).json({ message: "Membro atualizado com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar membro:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ message: "A matrícula informada já está em uso." });
    }
    const statusCode =
      err.message.includes("Nenhum dado") ||
      err.message.includes("Nenhum campo válido")
        ? 400
        : err.message.includes("não encontrado")
        ? 404
        : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function removerMembro(req, res) {
  try {
    await service.removerMembro(req.params.id);
    await registrarAuditoria(
      req.user.matricula,
      "Remover Membro Turma",
      `ID Turma: ${req.params.id}`
    );
    res.status(200).json({ message: "Membro removido com sucesso!" });
  } catch (err) {
    console.error("Erro ao remover membro:", err);
    const statusCode = err.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function listarFuncionariosPorTurma(req, res) {
  try {
    const funcionarios = await service.listarFuncionariosPorTurma(
      req.params.turma_encarregado_id,
      req.user
    );
    res.status(200).json(funcionarios);
  } catch (err) {
    console.error("Erro ao buscar funcionários por turma:", err);
    const statusCode = err.message.includes("Acesso negado") ? 403 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function obterDetalhesTurmaUsuario(req, res) {
  try {
    const detalhes = await service.obterDetalhesTurmaUsuario(
      req.user.matricula
    );
    res.json(detalhes);
  } catch (error) {
    console.error("Erro ao buscar detalhes da turma do usuário:", error);
    const statusCode = error.message.includes("não encontrada") ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

module.exports = {
  listarMembros,
  adicionarMembro,
  atualizarMembro,
  removerMembro,
  listarFuncionariosPorTurma,
  obterDetalhesTurmaUsuario,
};
