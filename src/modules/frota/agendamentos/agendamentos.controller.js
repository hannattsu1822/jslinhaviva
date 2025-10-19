const service = require("./agendamentos.service");
const { registrarAuditoria } = require("../../../auth");

async function agendarChecklist(req, res) {
  try {
    const { id } = await service.agendarChecklist(req.body, req.user.matricula);
    await registrarAuditoria(
      req.user.matricula,
      "Agendamento de Checklist",
      `Agendamento criado para veículo ID: ${req.body.veiculo_id}, Data: ${req.body.data_agendamento}, Encarregado: ${req.body.encarregado_matricula}`
    );
    res
      .status(201)
      .json({ message: "Agendamento de checklist criado com sucesso!", id });
  } catch (error) {
    console.error("Erro ao agendar checklist:", error);
    const statusCode = error.message.includes("obrigatórios") ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function obterAgendamentoPorId(req, res) {
  try {
    const agendamento = await service.obterAgendamentoPorId(req.params.id);
    res.status(200).json(agendamento);
  } catch (error) {
    console.error("Erro ao buscar agendamento específico:", error);
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function deletarAgendamento(req, res) {
  try {
    const { logMessage, connection } = await service.deletarAgendamento(
      req.params.id
    );
    await registrarAuditoria(
      req.user.matricula,
      "Excluir Agendamento Checklist",
      logMessage,
      connection
    );
    res.status(200).json({ message: "Agendamento excluído com sucesso!" });
  } catch (error) {
    console.error("Erro ao excluir agendamento de checklist:", error);
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function listarAgendamentos(req, res) {
  try {
    const agendamentos = await service.listarAgendamentos(req.query);
    res.status(200).json(agendamentos);
  } catch (error) {
    console.error("Erro ao buscar agendamentos de checklist:", error);
    res
      .status(500)
      .json({ message: "Erro ao buscar agendamentos de checklist!" });
  }
}

async function listarAgendamentosAbertos(req, res) {
  try {
    const agendamentos = await service.listarAgendamentosAbertos(
      req.query.placa,
      req.query.data
    );
    res.status(200).json(agendamentos);
  } catch (error) {
    console.error("Erro ao buscar agendamentos em aberto:", error);
    const statusCode = error.message.includes("obrigatórias") ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

module.exports = {
  agendarChecklist,
  obterAgendamentoPorId,
  deletarAgendamento,
  listarAgendamentos,
  listarAgendamentosAbertos,
};
