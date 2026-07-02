const servicosService = require("./servicos.service");
const relatorioService = require("../../gestaoServicos/relatorio/relatorio.service");
const { buildBaseUrl } = require("../../../shared/reports/publicAnexoUrl.helper");
const {
  assertAcessoModuloConstrucao,
  assertAcessoLeituraServicoConstrucao,
} = require("../construcao.access");

async function listarAtivos(req, res) {
  try {
    await assertAcessoModuloConstrucao(req.user);
    const servicos = await servicosService.listarAtivos();
    res.status(200).json({ success: true, data: servicos });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Erro ao listar serviços ativos de construção.",
    });
  }
}

async function listarConcluidos(req, res) {
  try {
    await assertAcessoModuloConstrucao(req.user);
    const servicos = await servicosService.listarConcluidos();
    res.status(200).json({ success: true, data: servicos });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Erro ao listar histórico de construção.",
    });
  }
}

async function obterDetalhes(req, res) {
  try {
    const { id } = req.params;
    await assertAcessoLeituraServicoConstrucao(req.user, id);
    const data = await servicosService.obterDetalhes(id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Erro ao buscar detalhes do serviço.",
    });
  }
}

async function gerarPdf(req, res) {
  try {
    const { id } = req.params;
    await assertAcessoLeituraServicoConstrucao(req.user, id);
    const { nomeArquivo, buffer } = await relatorioService.gerarPdfConsolidado(
      id,
      buildBaseUrl(req)
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${nomeArquivo}"`);
    res.send(buffer);
  } catch (error) {
    console.error("Erro ao gerar PDF (construção):", error);
    const statusCode =
      error.statusCode || (error.message === "Serviço não encontrado" ? 404 : 500);
    res.status(statusCode).json({
      success: false,
      message: error.message || "Erro ao gerar relatório PDF.",
    });
  }
}

module.exports = {
  listarAtivos,
  listarConcluidos,
  obterDetalhes,
  gerarPdf,
};
