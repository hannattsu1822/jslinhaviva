const service = require("./relatorios.service");

async function gerarPdfRelatorio(req, res) {
  try {
    const { nomeArquivo, pdfBytes } = await service.gerarPdfRelatorio(
      req.params.id
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nomeArquivo}"`
    );
    res.send(pdfBytes);
  } catch (error) {
    console.error(
      "Erro ao gerar relatório de serviço de subestação PDF:",
      error
    );
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res
      .status(statusCode)
      .json({
        success: false,
        message: "Erro interno ao gerar o relatório PDF.",
        error: error.message,
      });
  }
}

module.exports = {
  gerarPdfRelatorio,
};
