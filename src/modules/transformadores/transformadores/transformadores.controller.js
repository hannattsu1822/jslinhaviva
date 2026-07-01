const service = require("./transformadores.service");

async function uploadPlanilha(req, res) {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "Nenhum arquivo enviado!" });
  }
  try {
    const dryRun = String(req.query.dryRun || "").toLowerCase() === "true";
    const results = await service.processarUploadPlanilha(req.file.path, {
      dryRun,
    });

    let feedbackMessage = dryRun
      ? `Simulação concluída. Processadas ${results.total_rows} linhas (nenhuma alteração foi gravada).`
      : `Importação concluída. Processadas ${results.total_rows} linhas.`;
    if (results.new_trafos_imported > 0)
      feedbackMessage += ` ${results.new_trafos_imported} novos transformadores cadastrados.`;
    if (results.trafos_updated > 0)
      feedbackMessage += ` ${results.trafos_updated} transformadores existentes atualizados.`;
    if (results.checklists_imported > 0)
      feedbackMessage += ` ${results.checklists_imported} checklists importados.`;
    if (results.failed_rows > 0)
      feedbackMessage += ` ${results.failed_rows} linhas falharam.`;

    res.json({
      success: dryRun
        ? true
        : results.failed_rows < results.total_rows ||
          results.new_trafos_imported > 0 ||
          results.checklists_imported > 0,
      message: feedbackMessage,
      data: results,
    });
  } catch (error) {
    console.error("Erro crítico no upload:", error);
    res.status(500).json({
      success: false,
      message: "Erro crítico no servidor: " + error.message,
    });
  }
}

async function listarResponsaveis(req, res) {
  try {
    const responsaveis = await service.listarResponsaveis();
    res.status(200).json(responsaveis);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar responsáveis!" });
  }
}

async function listarSupervisores(req, res) {
  try {
    const supervisores = await service.listarSupervisores();
    res.status(200).json(supervisores);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar supervisores!" });
  }
}

async function obterHistoricoUnificadoPorSerie(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const data = await service.obterHistoricoUnificadoPorSerie(req.params.numero_serie, {
      page,
      limit,
    });
    res.json({ success: true, data });
  } catch (error) {
    const statusCode = error.message.includes("obrigatório") ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Erro ao buscar histórico unificado.",
    });
  }
}

module.exports = {
  uploadPlanilha,
  listarResponsaveis,
  listarSupervisores,
  obterHistoricoUnificadoPorSerie,
};
