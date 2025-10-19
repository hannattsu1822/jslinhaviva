const service = require("./transformadores.service");

async function uploadPlanilha(req, res) {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "Nenhum arquivo enviado!" });
  }
  try {
    const results = await service.processarUploadPlanilha(req.file.path);

    let feedbackMessage = `Importação concluída. Processadas ${results.total_rows} linhas.`;
    if (results.new_trafos_imported > 0)
      feedbackMessage += ` ${results.new_trafos_imported} novos transformadores cadastrados.`;
    if (results.trafos_updated > 0)
      feedbackMessage += ` ${results.trafos_updated} transformadores existentes atualizados.`;
    if (results.checklists_imported > 0)
      feedbackMessage += ` ${results.checklists_imported} checklists importados.`;
    if (results.failed_rows > 0)
      feedbackMessage += ` ${results.failed_rows} linhas falharam.`;

    res.json({
      success:
        results.failed_rows < results.total_rows ||
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

module.exports = {
  uploadPlanilha,
  listarResponsaveis,
  listarSupervisores,
};
