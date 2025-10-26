const service = require("./lifecycle.service");
const { registrarAuditoria } = require("../../../auth");

async function atualizarStatusParteServico(req, res) {
  try {
    const { id: servicoId } = req.params;
    const matricula = req.user?.matricula;
    const { status_final } = req.body;

    let resultado;
    let acaoAuditoria;

    if (status_final === "concluido") {
      resultado = await service.concluirParteServico(
        servicoId,
        req.body,
        matricula
      );
      acaoAuditoria = "Conclusão de Parte do Serviço";
    } else if (status_final === "nao_concluido") {
      resultado = await service.naoConcluirParteServico(
        servicoId,
        req.body,
        matricula
      );
      acaoAuditoria = "Não Conclusão de Parte do Serviço";
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Status final inválido." });
    }

    await registrarAuditoria(matricula, acaoAuditoria, resultado.auditMessage);

    res.status(200).json({
      success: true,
      message: `Sua parte do serviço foi atualizada com sucesso.`,
    });
  } catch (error) {
    console.error("Erro ao processar status da parte do serviço:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno ao processar sua parte do serviço",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

async function reativarServico(req, res) {
  try {
    await service.reativarServico(req.params.id);
    await registrarAuditoria(
      req.user.matricula,
      "Reativação de Serviço",
      `Serviço ${req.params.id} retornado para ativo.`
    );
    res.json({ message: "Serviço reativado com sucesso" });
  } catch (error) {
    console.error("Erro ao reativar serviço:", error);
    const statusCode = error.message === "Serviço não encontrado" ? 404 : 500;
    res
      .status(statusCode)
      .json({ message: error.message || "Erro ao reativar serviço" });
  }
}

async function atribuirResponsavel(req, res) {
  try {
    const { id } = req.params;
    const { responsaveis } = req.body;
    if (!responsaveis || !Array.isArray(responsaveis)) {
      return res.status(400).json({
        success: false,
        message: "O corpo da requisição deve conter um array 'responsaveis'.",
      });
    }
    await service.atribuirResponsavel(id, responsaveis);
    await registrarAuditoria(
      req.user.matricula,
      "Atribuição de Responsáveis",
      `Serviço ID ${id} atribuído a: ${responsaveis.join(", ")}`
    );
    res.json({
      success: true,
      message: "Responsáveis atualizados com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao atualizar responsáveis:", error);
    const statusCode = error.message.includes("Serviço não encontrado")
      ? 404
      : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Erro ao atualizar responsáveis",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

module.exports = {
  atualizarStatusParteServico,
  reativarServico,
  atribuirResponsavel,
};
