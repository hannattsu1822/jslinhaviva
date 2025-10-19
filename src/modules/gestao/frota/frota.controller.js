const service = require("./frota.service");

async function listarVeiculos(req, res) {
  try {
    const page = parseInt(req.query.pagina) || 1;
    const { veiculos, totalPages } = await service.listarVeiculos({
      ...req.query,
      pagina: page,
    });
    res.json({ veiculos, currentPage: page, totalPages });
  } catch (error) {
    console.error("Erro ao buscar veículos:", error);
    res.status(500).json({ message: "Erro interno ao buscar veículos." });
  }
}

async function obterVeiculoPorId(req, res) {
  try {
    const veiculo = await service.obterVeiculoPorId(req.params.id);
    res.json(veiculo);
  } catch (error) {
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function criarVeiculo(req, res) {
  try {
    const { id } = await service.criarVeiculo(req.body);
    res.status(201).json({ id, message: "Veículo criado com sucesso!" });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ message: "A placa informada já está em uso." });
    }
    const statusCode = error.message.includes("obrigatórios") ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function atualizarVeiculo(req, res) {
  try {
    await service.atualizarVeiculo(req.params.id, req.body);
    res.json({ message: "Veículo atualizado com sucesso!" });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "A placa informada já está em uso por outro veículo.",
      });
    }
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function deletarVeiculo(req, res) {
  try {
    await service.deletarVeiculo(req.params.id);
    res.json({ message: "Veículo excluído permanentemente com sucesso!" });
  } catch (error) {
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

module.exports = {
  listarVeiculos,
  obterVeiculoPorId,
  criarVeiculo,
  atualizarVeiculo,
  deletarVeiculo,
};
