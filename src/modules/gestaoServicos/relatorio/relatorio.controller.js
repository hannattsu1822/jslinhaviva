const service = require("./relatorio.service");

async function gerarPdfConsolidado(req, res) {
  try {
    const { id: servicoId } = req.params;
    const { nomeArquivo, buffer } = await service.gerarPdfConsolidado(
      servicoId
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nomeArquivo}"`
    );
    res.send(buffer);
  } catch (error) {
    console.error("Erro ao gerar relatório PDF:", error);
    const statusCode = error.message === "Serviço não encontrado" ? 404 : 500;
    let message = "Erro interno ao gerar o relatório PDF.";
    if (error.message && error.message.includes("Executable doesn't exist")) {
      message =
        "Navegador PDF (Playwright) não instalado no servidor. Execute: npx playwright install chromium";
    }
    res.status(statusCode).json({
      success: false,
      message,
    });
  }
}

module.exports = {
  gerarPdfConsolidado,
};
