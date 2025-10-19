const service = require("./oleo.service");
const { registrarAuditoria } = require("../../../auth");

async function listarVeiculosParaOleo(req, res) {
  try {
    const veiculos = await service.listarVeiculosParaOleo();
    res.status(200).json(veiculos);
  } catch (err) {
    console.error("Erro ao buscar veículos para troca de óleo:", err);
    res.status(500).json({ message: "Erro ao buscar veículos!" });
  }
}

async function listarTecnicosParaOleo(req, res) {
  try {
    const tecnicos = await service.listarTecnicosParaOleo();
    res.status(200).json(tecnicos);
  } catch (err) {
    console.error("Erro ao buscar técnicos para troca de óleo:", err);
    res.status(500).json({ message: "Erro ao buscar técnicos!" });
  }
}

async function registrarTrocaOleo(req, res) {
  try {
    const { id, placa } = await service.registrarTrocaOleo(req.body);
    await registrarAuditoria(
      req.user.matricula,
      "Registro de Troca de Óleo",
      `Troca de óleo registrada para veículo ID: ${req.body.veiculo_id} - Placa: ${placa}`
    );
    res.status(201).json({
      message: "Troca de óleo registrada com sucesso!",
      id: id,
    });
  } catch (err) {
    console.error("Erro ao registrar troca de óleo:", err);
    const statusCode =
      err.message.includes("obrigatórios") ||
      err.message.includes("positivo") ||
      err.message.includes("maior ou igual")
        ? 400
        : err.message.includes("não encontrado")
        ? 404
        : 500;
    res.status(statusCode).json({
      message: err.message,
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}

async function listarHistoricoOleo(req, res) {
  try {
    const historico = await service.listarHistoricoOleo(req.params.veiculo_id);
    res.status(200).json(historico);
  } catch (err) {
    console.error("Erro ao buscar histórico de trocas:", err);
    res.status(500).json({ message: "Erro ao buscar histórico de trocas!" });
  }
}

async function calcularProximasTrocas(req, res) {
  try {
    const cards = await service.calcularProximasTrocas();
    res.status(200).json(cards);
  } catch (error) {
    console.error("Erro ao gerar dados para próxima troca de óleo:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao carregar dados",
      error: error.message,
    });
  }
}

async function deletarTrocaOleo(req, res) {
  try {
    const { id } = req.params;
    const { placa } = await service.deletarTrocaOleo(id);
    await registrarAuditoria(
      req.user.matricula,
      "Excluir Registro Troca Óleo",
      `Registro de troca de óleo ID: ${id} (Placa: ${placa}) excluído.`
    );
    res
      .status(200)
      .json({ message: "Registro de troca de óleo excluído com sucesso!" });
  } catch (err) {
    console.error(`Erro ao excluir registro de troca de óleo:`, err);
    const statusCode = err.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

module.exports = {
  listarVeiculosParaOleo,
  listarTecnicosParaOleo,
  registrarTrocaOleo,
  listarHistoricoOleo,
  calcularProximasTrocas,
  deletarTrocaOleo,
};
