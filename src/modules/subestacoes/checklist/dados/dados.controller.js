const service = require("./dados.service");

async function obterDetalhesParaServico(req, res) {
  try {
    const detalhes = await service.obterDetalhesParaServico(
      req.body.inspecao_ids
    );
    res.json(detalhes);
  } catch (error) {
    const statusCode = error.message.includes("obrigatória") ? 400 : 500;
    res
      .status(statusCode)
      .json({
        message: "Erro interno ao buscar detalhes das inspeções.",
        detalhes: error.message,
      });
  }
}

module.exports = {
  obterDetalhesParaServico,
};
