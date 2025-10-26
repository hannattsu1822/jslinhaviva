const service = require("./core.service");
const { registrarAuditoria } = require("../../../auth");
const { limparArquivosTemporarios } = require("../utils/file.helpers");

async function criarServico(req, res) {
  try {
    const resultado = await service.criarServico(req.body, req.files);
    if (req.user?.matricula) {
      await registrarAuditoria(
        req.user.matricula,
        "Registro de Serviço",
        `Serviço ${resultado.tipo} registrado: ${
          resultado.processo || `ID ${resultado.id}`
        }`
      );
    }
    res.status(201).json({
      success: true,
      processo: resultado.processo,
      id: resultado.id,
      tipo: resultado.tipo,
      anexos: resultado.anexos,
    });
  } catch (error) {
    console.error("Erro ao registrar serviço:", error);
    limparArquivosTemporarios(req.files);
    res.status(500).json({
      success: false,
      message: "Erro interno ao registrar serviço",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

async function listarServicos(req, res) {
  try {
    const { status } = req.query;
    const user = req.user;
    const servicos = await service.listarServicos(status, user);
    res.status(200).json(servicos);
  } catch (error) {
    console.error("Erro ao buscar serviços:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao buscar serviços",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

async function obterDetalhesServico(req, res) {
  try {
    const { id } = req.params;
    const resultado = await service.obterDetalhesServico(id);
    res.status(200).json({ success: true, data: resultado });
  } catch (error) {
    console.error("Erro ao buscar detalhes do serviço:", error);
    const statusCode = error.message === "Serviço não encontrado" ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Erro ao buscar detalhes do serviço",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

async function atualizarServico(req, res) {
  try {
    const { id: servicoId } = req.params;
    const resultado = await service.atualizarServico(
      servicoId,
      req.body,
      req.files
    );
    await registrarAuditoria(
      req.user.matricula,
      "Edição de Serviço",
      `Serviço ${servicoId} editado. Processo alterado para: ${resultado.processo}`
    );
    res.json({
      success: true,
      message: "Serviço atualizado com sucesso!",
      redirect: `/detalhes_servico?id=${servicoId}`,
    });
  } catch (error) {
    console.error("Erro ao atualizar serviço:", error);
    limparArquivosTemporarios(req.files);
    res.status(500).json({
      success: false,
      message: "Erro ao atualizar serviço",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

async function deletarServico(req, res) {
  try {
    const { id } = req.params;
    const resultado = await service.deletarServico(id);
    await registrarAuditoria(
      req.user.matricula,
      "Exclusão de Serviço",
      `Serviço excluído - ID: ${id}, Processo: ${resultado.nomeProcessoOriginal}`
    );
    res.json({
      success: true,
      message: "Serviço e seus anexos/pasta foram excluídos com sucesso",
    });
  } catch (error) {
    console.error("Erro ao excluir serviço:", error);
    const statusCode = error.message === "Serviço não encontrado" ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Erro ao excluir serviço",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

module.exports = {
  criarServico,
  listarServicos,
  obterDetalhesServico,
  atualizarServico,
  deletarServico,
};
