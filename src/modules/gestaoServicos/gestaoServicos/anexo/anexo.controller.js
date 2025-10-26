const service = require("./anexo.service");
const { limparArquivosTemporarios } = require("../utils/file.helpers");
const { registrarAuditoria } = require("../../../auth");

async function anexarAPR(req, res) {
  try {
    const { servicoId } = req.params;
    const resultado = await service.anexarAPR(servicoId, req.file);
    await registrarAuditoria(
      req.user.matricula,
      "Upload de APR",
      `APR anexada ao Serviço ID: ${servicoId}`
    );
    res.json({
      success: true,
      message: "APR anexada com sucesso!",
      caminho_apr_anexo: resultado.caminho_apr_anexo,
      nome_original_apr_anexo: resultado.nome_original_apr_anexo,
    });
  } catch (error) {
    console.error("Erro detalhado ao fazer upload da APR:", error);
    limparArquivosTemporarios(req.file);
    res.status(500).json({
      success: false,
      message: `Erro interno ao fazer upload da APR: ${error.message}`,
    });
  }
}

async function uploadFotoConclusao(req, res) {
  try {
    const { servicoId } = req.params;
    const { status_final } = req.body;
    await service.uploadFotoConclusao(servicoId, status_final, req.file);
    res.status(201).json({
      success: true,
      message: `Arquivo ${req.file.originalname} enviado com sucesso.`,
    });
  } catch (error) {
    limparArquivosTemporarios(req.file);
    console.error("Erro ao fazer upload de foto de conclusão:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno ao processar o upload do arquivo.",
    });
  }
}

async function deletarAnexo(req, res) {
  try {
    const { servicoId, anexoId } = req.params;
    const resultado = await service.deletarAnexo(servicoId, anexoId);
    await registrarAuditoria(
      req.user.matricula,
      "Remoção de Anexo",
      `Anexo ${resultado.nomeOriginal} removido do Serviço ID: ${servicoId}`
    );
    res.json({ success: true, message: "Anexo removido com sucesso" });
  } catch (error) {
    console.error("Erro ao remover anexo:", error);
    const statusCode = error.message.includes("Anexo não encontrado")
      ? 404
      : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Erro ao remover anexo",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

module.exports = {
  anexarAPR,
  uploadFotoConclusao,
  deletarAnexo,
};
