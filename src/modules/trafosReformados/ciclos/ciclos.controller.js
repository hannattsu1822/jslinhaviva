const service = require("./ciclos.service");
const { registrarAuditoria } = require("../../../auth");

async function listarCiclos(req, res) {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 15;
    if (page < 1) page = 1;
    if (limit < 1 && req.query.getAll !== "true") limit = 15;

    const { trafos, totalItems, totalPages } = await service.listarCiclos({
      ...req.query,
      page,
      limit,
    });

    res.json({
      success: true,
      data: trafos,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalItems,
        itemsPerPage: req.query.getAll === "true" ? totalItems : limit,
      },
    });
  } catch (err) {
    console.error("Erro ao buscar transformadores reformados:", err);
    res.status(500).json({
      success: false,
      message: "Erro ao buscar transformadores reformados",
    });
  }
}

async function obterCicloPorId(req, res) {
  try {
    const ciclo = await service.obterCicloPorId(req.params.id);
    res.json({ success: true, data: ciclo });
  } catch (err) {
    console.error("Erro ao buscar transformador por ID:", err);
    const statusCode = err.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
}

async function reverterStatusCiclo(req, res) {
  try {
    await service.reverterStatusCiclo(req.params.id);
    await registrarAuditoria(
      req.user.matricula,
      "Reverter Status Trafo Reformado",
      `Status do registro de avaliação ID ${req.params.id} revertido para 'pendente'.`
    );
    res.json({ success: true, message: "Status revertido com sucesso." });
  } catch (error) {
    console.error("Erro ao reverter status do transformador:", error);
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
}

async function importarCiclos(req, res) {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "Nenhum arquivo enviado" });
  }
  try {
    const results = await service.importarCiclos(req.file.path);
    res.json({
      success: results.imported > 0,
      message: `Importação concluída: ${results.imported} novos registros criados, ${results.failed} falhas.`,
      ...results,
    });
  } catch (error) {
    console.error("Erro no processamento da importação:", error);
    const statusCode = error.message.includes("Colunas obrigatórias")
      ? 400
      : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
}

async function limparPendentes(req, res) {
  try {
    const deletedCount = await service.limparPendentes();
    await registrarAuditoria(
      req.user.matricula,
      "Limpeza de Pendentes",
      `${deletedCount} registros de avaliação pendentes foram apagados.`
    );
    res.json({ success: true, deletedCount });
  } catch (error) {
    console.error("Erro ao apagar registros pendentes:", error);
    res
      .status(500)
      .json({ success: false, message: "Erro interno no servidor." });
  }
}

async function excluirCiclo(req, res) {
  try {
    const { numero_serie } = await service.excluirCiclo(req.params.id);
    await registrarAuditoria(
      req.user.matricula,
      "Excluir Ciclo de Avaliação",
      `Ciclo de avaliação (ID: ${req.params.id}) para o trafo série ${numero_serie} excluído.`
    );
    res.status(200).json({
      success: true,
      message:
        "Ciclo de avaliação e seu checklist associado foram excluídos com sucesso!",
    });
  } catch (err) {
    console.error("Erro ao excluir ciclo de avaliação:", err);
    const statusCode = err.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
}

async function listarTecnicosResponsaveis(req, res) {
  try {
    const tecnicos = await service.listarTecnicosResponsaveis();
    res.status(200).json(tecnicos);
  } catch (err) {
    console.error("Erro ao buscar técnicos responsáveis:", err);
    res.status(500).json({
      success: false,
      message: "Erro ao buscar técnicos responsáveis",
    });
  }
}

async function listarFabricantes(req, res) {
  try {
    const fabricantes = await service.listarFabricantes();
    res.status(200).json(fabricantes);
  } catch (err) {
    console.error("Erro ao buscar fabricantes:", err);
    res
      .status(500)
      .json({ success: false, message: "Erro ao buscar fabricantes!" });
  }
}

async function listarPotencias(req, res) {
  try {
    const potencias = await service.listarPotencias();
    res.status(200).json(potencias);
  } catch (err) {
    console.error("Erro ao buscar potências:", err);
    res.status(500).json({ message: "Erro ao buscar potências!" });
  }
}

module.exports = {
  listarCiclos,
  obterCicloPorId,
  reverterStatusCiclo,
  importarCiclos,
  limparPendentes,
  excluirCiclo,
  listarTecnicosResponsaveis,
  listarFabricantes,
  listarPotencias,
};
