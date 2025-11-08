const service = require("./checklist.service");
const { registrarAuditoria } = require("../../../auth");

async function obterChecklistPorRegistroId(req, res) {
  try {
    const checklist = await service.obterChecklistPorRegistroId(
      req.params.registroId
    );
    res.json({ success: true, data: checklist });
  } catch (error) {
    console.error("Erro ao buscar checklist por registro:", error);
    const statusCode = error.message.includes("Nenhum checklist encontrado")
      ? 404
      : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
}

async function obterHistoricoPorSerie(req, res) {
  try {
    const checklists = await service.obterHistoricoPorSerie(
      req.params.numero_serie
    );
    res.json({ success: true, data: checklists });
  } catch (err) {
    console.error("Erro ao buscar checklists por série:", err);
    res
      .status(500)
      .json({ success: false, message: "Erro ao buscar checklists por série" });
  }
}

async function avaliarCompleto(req, res) {
  try {
    const dadosAvaliacao = { ...req.body };
    if (req.file) {
      dadosAvaliacao.anexo_imagem = req.file;
    }

    await service.avaliarCompleto(req.params.id, dadosAvaliacao);

    res.json({
      success: true,
      message: "Avaliação completa salva com sucesso.",
    });
  } catch (err) {
    console.error("Erro ao salvar avaliação completa:", err);
    const statusCode =
      err.message.includes("obrigatórios") ||
      err.message.includes("inválido") ||
      err.message.includes("não encontrado ou não autorizado")
        ? 400
        : 500;
    res.status(statusCode).json({
      success: false,
      message: "Erro ao salvar avaliação completa: " + err.message,
    });
  }
}

async function gerarPdfChecklist(req, res) {
  try {
    const { checklist, transformador } = req.body;
    if (!checklist || !transformador) {
      return res.status(400).json({
        success: false,
        message: "Dados do checklist ou do transformador ausentes.",
      });
    }
    const pdfBuffer = await service.gerarPdfChecklist(
      checklist,
      transformador,
      req.user
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Checklist_Trafo_${transformador.numero_serie}_ID${checklist.id}.pdf`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Erro ao gerar PDF do checklist específico:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao gerar PDF do checklist.",
      error: error.message,
    });
  }
}

async function gerarPdfTabelaHistorico(req, res) {
  try {
    const { dados, filtros } = req.body;
    const pdfBuffer = await service.gerarPdfTabelaHistorico(dados, filtros);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Relatorio_Checklists_Avaliados.pdf`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Erro ao gerar PDF da tabela de históricos:", error);
    const statusCode = error.message.includes("Não há dados") ? 400 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
}

module.exports = {
  obterChecklistPorRegistroId,
  obterHistoricoPorSerie,
  avaliarCompleto,
  gerarPdfChecklist,
  gerarPdfTabelaHistorico,
};
