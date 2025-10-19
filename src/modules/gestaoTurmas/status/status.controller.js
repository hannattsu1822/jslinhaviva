const service = require("./status.service");
const { registrarAuditoria } = require("../../../auth");

function obterTiposStatus(req, res) {
  const tipos = service.obterTiposStatus();
  res.json(tipos);
}

async function registrarStatus(req, res) {
  try {
    const { id, nomeFuncionario } = await service.registrarStatus(
      req.body,
      req.user
    );
    await registrarAuditoria(
      req.user.matricula,
      "Adicionar Status Funcionário",
      `Funcionário: ${nomeFuncionario} (${req.body.matricula_funcionario}), Status: ${req.body.tipo_status}, Período: ${req.body.data_inicio} a ${req.body.data_fim}, ID: ${id}`
    );
    res
      .status(201)
      .json({ message: "Status do funcionário registrado com sucesso!", id });
  } catch (err) {
    console.error("Erro ao registrar status do funcionário:", err);
    const statusCode =
      err.message.includes("obrigatórios") ||
      err.message.includes("inválido") ||
      err.message.includes("posterior")
        ? 400
        : err.message.includes("não encontrado")
        ? 404
        : err.message.includes("sobrepõe")
        ? 409
        : err.message.includes("associado") ||
          err.message.includes("só podem registrar")
        ? 403
        : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function listarStatus(req, res) {
  try {
    const statusList = await service.listarStatus(req.query, req.user);
    res.status(200).json(statusList);
  } catch (err) {
    console.error("Erro ao buscar registros de status:", err);
    res.status(500).json({ message: "Erro ao buscar registros!" });
  }
}

async function atualizarStatus(req, res) {
  try {
    const { nomeFuncionario, matriculaFuncionario } =
      await service.atualizarStatus(req.params.id, req.body, req.user);
    await registrarAuditoria(
      req.user.matricula,
      "Atualizar Status Funcionário",
      `ID Status: ${req.params.id}, Funcionário: ${
        nomeFuncionario || matriculaFuncionario
      }, Novos Dados: ${JSON.stringify(req.body)}`
    );
    res
      .status(200)
      .json({ message: "Registro de status atualizado com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar registro de status:", err);

    res.status(500).json({ message: err.message });
  }
}

async function removerStatus(req, res) {
  try {
    res
      .status(200)
      .json({ message: "Registro de status removido com sucesso!" });
  } catch (err) {
    console.error("Erro ao remover registro de status:", err);
    // Lógica de status code similar
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  obterTiposStatus,
  registrarStatus,
  listarStatus,
  atualizarStatus,
  removerStatus,
};
