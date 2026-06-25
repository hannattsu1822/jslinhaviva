const service = require("./lifecycle.service");
const { registrarAuditoria } = require("../../../auth");

async function atualizarStatusParteServico(req, res) {
  try {
    const { id: servicoId } = req.params;
    const matricula = req.session?.user?.matricula;
    const { status_final } = req.body;
    if (!matricula) {
      return res
        .status(401)
        .json({ success: false, message: "Sessão inválida ou expirada." });
    }
    let resultado;
    let acaoAuditoria;
    if (status_final === "concluido") {
      resultado = await service.concluirParteServico(
        servicoId,
        req.body,
        matricula,
      );
      acaoAuditoria = "Conclusão de Parte do Serviço";
    } else if (status_final === "nao_concluido") {
      resultado = await service.naoConcluirParteServico(
        servicoId,
        req.body,
        matricula,
      );
      acaoAuditoria = "Não Conclusão de Parte do Serviço";
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Status final inválido." });
    }
    await registrarAuditoria(matricula, acaoAuditoria, resultado.auditMessage);
    return res.status(200).json({
      success: true,
      message: "Sua parte do serviço foi atualizada com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao processar status da parte do serviço:", error);
    return res.status(500).json({
      success: false,
      message:
        error.message || "Erro interno ao processar sua parte do serviço",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

async function forcarConclusaoServico(req, res) {
  try {
    const { id: servicoId } = req.params;
    const matriculaGestor = req.session?.user?.matricula;
    const nivel = req.session?.user?.nivel ?? 0;
    const cargo = req.session?.user?.cargo?.toUpperCase() || "";
    if (!matriculaGestor) {
      return res
        .status(401)
        .json({ success: false, message: "Sessão inválida ou expirada." });
    }
    const cargosPermitidos = [
      "ADMIN",
      "TÉCNICO",
      "ADM",
      "ENGENHEIRO",
      "GERENTE",
    ];
    const podeForcar = nivel >= 8 || cargosPermitidos.includes(cargo);
    if (!podeForcar) {
      return res.status(403).json({
        success: false,
        message:
          "Apenas usuários com nível 8 ou superior, ou cargos autorizados, podem forçar a conclusão.",
      });
    }
    await service.forcarConclusaoServico(servicoId, {
      ...req.body,
      matriculaGestor,
    });
    await registrarAuditoria(
      matriculaGestor,
      "Forçar Conclusão de Serviço",
      `Serviço ID ${servicoId} finalizado administrativamente por ${matriculaGestor}`,
    );
    return res.status(200).json({
      success: true,
      message: "Serviço finalizado com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao forçar conclusão do serviço:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Erro ao forçar conclusão do serviço",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

async function reativarServico(req, res) {
  try {
    await service.reativarServico(req.params.id);
    await registrarAuditoria(
      req.session?.user?.matricula,
      "Reativação de Serviço",
      `Serviço ${req.params.id} retornado para ativo.`,
    );
    return res.json({ message: "Serviço reativado com sucesso" });
  } catch (error) {
    console.error("Erro ao reativar serviço:", error);
    const statusCode = error.message === "Serviço não encontrado" ? 404 : 500;
    return res
      .status(statusCode)
      .json({ message: error.message || "Erro ao reativar serviço" });
  }
}

async function atribuirResponsavel(req, res) {
  try {
    const { id } = req.params;
    const { responsaveis } = req.body;
    const nivel = req.session?.user?.nivel ?? 0;
    const cargo = req.session?.user?.cargo?.toUpperCase() || "";
    const cargosPermitidos = [
      "ADMIN",
      "TÉCNICO",
      "ADM",
      "ENGENHEIRO",
      "GERENTE",
    ];
    const podeAtribuir = nivel >= 6 || cargosPermitidos.includes(cargo);
    if (!podeAtribuir) {
      return res.status(403).json({
        success: false,
        message:
          "Apenas usuários com nível 6 ou superior, ou cargos autorizados, podem atribuir responsáveis.",
      });
    }
    if (!responsaveis || !Array.isArray(responsaveis)) {
      return res.status(400).json({
        success: false,
        message: "O corpo da requisição deve conter um array 'responsaveis'.",
      });
    }
    await service.atribuirResponsavel(id, responsaveis);
    await registrarAuditoria(
      req.session?.user?.matricula,
      "Atribuição de Responsáveis",
      `Serviço ID ${id} atribuído a: ${responsaveis.join(", ")}`,
    );
    return res.json({
      success: true,
      message: "Responsáveis atualizados com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao atualizar responsáveis:", error);
    const statusCode = error.message.includes("Serviço não encontrado")
      ? 404
      : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Erro ao atualizar responsáveis",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

async function removerResponsavelUnico(req, res) {
  try {
    const { id: servicoId, matricula } = req.params;
    const nivel = req.session?.user?.nivel ?? 0;
    const cargo = req.session?.user?.cargo?.toUpperCase() || "";
    const cargosPermitidos = [
      "ADMIN",
      "TÉCNICO",
      "ADM",
      "ENGENHEIRO",
      "GERENTE",
    ];
    const podeRemover = nivel >= 6 || cargosPermitidos.includes(cargo);
    if (!podeRemover) {
      return res.status(403).json({
        success: false,
        message:
          "Apenas usuários com nível 6 ou superior, ou cargos autorizados, podem remover responsáveis.",
      });
    }
    await service.removerResponsavelUnico(servicoId, matricula);
    await registrarAuditoria(
      req.session?.user?.matricula,
      "Remoção de Responsável",
      `Responsável ${matricula} removido do serviço ID ${servicoId}`,
    );
    return res.status(200).json({
      success: true,
      message: "Responsável removido com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao remover responsável do serviço:", error);
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Erro ao remover responsável do serviço",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

async function concluirServicoAdministrativo(req, res) {
  try {
    const { id: servicoId } = req.params;
    const matriculaGestor = req.session?.user?.matricula;
    const nivel = req.session?.user?.nivel ?? 0;
    const cargo = req.session?.user?.cargo?.toUpperCase() || "";
    if (!matriculaGestor) {
      return res.status(401).json({
        success: false,
        message: "Sessão inválida ou expirada.",
      });
    }
    const cargosPermitidos = [
      "ADMIN",
      "TÉCNICO",
      "ADM",
      "ENGENHEIRO",
      "GERENTE",
    ];
    const podeConcluirAdmin = nivel >= 7 || cargosPermitidos.includes(cargo);
    if (!podeConcluirAdmin) {
      return res.status(403).json({
        success: false,
        message:
          "Apenas usuários com nível 7 ou superior podem concluir serviços administrativamente.",
      });
    }
    const { motivo, dataConclusao, horaConclusao, observacoes, status_final } =
      req.body;
    if (!motivo || typeof motivo !== "string" || motivo.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message:
          "O motivo da conclusão administrativa é obrigatório (mínimo 5 caracteres).",
      });
    }
    if (!dataConclusao || !horaConclusao || !status_final) {
      return res.status(400).json({
        success: false,
        message: "Data, hora e status final são obrigatórios.",
      });
    }
    const resultado = await service.concluirServicoAdministrativo(
      servicoId,
      { dataConclusao, horaConclusao, observacoes, status_final, motivo },
      matriculaGestor,
    );
    await registrarAuditoria(
      matriculaGestor,
      "Conclusão Administrativa (Sem Equipe)",
      resultado.auditMessage,
    );
    return res.status(200).json({
      success: true,
      message: "Serviço concluído administrativamente com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao concluir serviço administrativamente:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Erro ao concluir serviço administrativamente",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

module.exports = {
  atualizarStatusParteServico,
  forcarConclusaoServico,
  reativarServico,
  atribuirResponsavel,
  removerResponsavelUnico,
  concluirServicoAdministrativo,
};
