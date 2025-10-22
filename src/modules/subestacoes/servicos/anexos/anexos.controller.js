const service = require("./anexos.service");
const { registrarAuditoria } = require("../../../../auth");
const fs = require("fs");

async function anexarPosterior(req, res) {
  const arquivos = req.files;
  try {
    await service.anexarPosterior(
      req.params.servicoId,
      req.body.descricao_anexo,
      arquivos
    );
    res.status(201).json({ message: "Anexos adicionados com sucesso!" });
  } catch (error) {
    if (arquivos?.length)
      arquivos.forEach((f) => {
        if (f.path) fs.unlink(f.path, () => {});
      });
    const statusCode = error.message.includes("Nenhum arquivo") ? 400 : 500;
    res
      .status(statusCode)
      .json({ message: "Erro ao adicionar anexos.", detalhes: error.message });
  }
}

async function anexarAPR(req, res) {
  const arquivos = req.files;
  try {
    const { connection } = await service.anexarAPR(
      req.params.servicoId,
      arquivos
    );
    if (req.user && req.user.matricula) {
      await registrarAuditoria(
        req.user.matricula,
        "UPLOAD_APR_SERVICO",
        `APR(s) anexada(s) ao Serviço ID ${req.params.servicoId}.`,
        connection
      );
    }
    res.status(201).json({ message: "APR(s) anexada(s) com sucesso!" });
  } catch (error) {
    if (arquivos?.length)
      arquivos.forEach((f) => {
        if (f.path) fs.unlink(f.path, () => {});
      });
    const statusCode = error.message.includes("Nenhum arquivo") ? 400 : 500;
    res
      .status(statusCode)
      .json({ message: "Erro ao anexar APR.", detalhes: error.message });
  }
}

async function excluirAnexo(req, res) {
  try {
    const { nomeOriginal, connection } = await service.excluirAnexo(
      req.params.anexoId
    );
    if (req.user && req.user.matricula) {
      await registrarAuditoria(
        req.user.matricula,
        "DELETE_ANEXO_SERVICO",
        `Anexo ID ${req.params.anexoId} (Nome: ${nomeOriginal}) foi excluído.`,
        connection
      );
    }
    res.json({ message: "Anexo excluído com sucesso." });
  } catch (error) {
    const statusCode = error.message.includes("inválido")
      ? 400
      : error.message.includes("não encontrado")
      ? 404
      : 500;
    res.status(statusCode).json({
      message: "Erro interno ao excluir o anexo.",
      detalhes: error.message,
    });
  }
}

module.exports = {
  anexarPosterior,
  anexarAPR,
  excluirAnexo,
};
