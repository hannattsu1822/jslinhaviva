const service = require("./anexos.service");
const { registrarAuditoria } = require("../../../../auth");
const fs = require("fs").promises;

async function uploadTemporario(req, res) {
  try {
    const fileData = await service.salvarUploadTemporario(req.file);
    res.status(201).json(fileData);
  } catch (error) {
    if (req.file && req.file.path)
      await fs.unlink(req.file.path).catch(() => {});
    const statusCode = error.message.includes("Nenhum arquivo") ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function anexarEscritorio(req, res) {
  try {
    const { connection, anexosSalvosInfo } = await service.anexarEscritorio(
      req.inspecaoId,
      req.body.anexos
    );
    if (req.user?.matricula) {
      await registrarAuditoria(
        req.user.matricula,
        "UPLOAD_ANEXO_ESCRITORIO_INSPECAO",
        `Anexos escritório adicionados à Inspeção ID ${
          req.inspecaoId
        }. Arquivos: ${anexosSalvosInfo
          .map((a) => a.nome_original)
          .join(", ")}`,
        connection
      );
    }
    res
      .status(201)
      .json({
        message: "Anexos de escritório salvos!",
        anexos: anexosSalvosInfo,
      });
  } catch (error) {
    const statusCode = error.message.includes("Nenhum anexo") ? 400 : 500;
    res
      .status(statusCode)
      .json({
        message: "Erro interno ao salvar anexos escritório.",
        detalhes: error.message,
      });
  }
}

async function anexarTermografia(req, res) {
  try {
    const { connection, anexosSalvosInfo } = await service.anexarTermografia(
      req.inspecaoId,
      req.params.itemChecklistId,
      req.body.item_especificacao_id,
      req.body.anexos
    );
    if (req.user?.matricula) {
      await registrarAuditoria(
        req.user.matricula,
        "UPLOAD_TERMOGRAFIA_ITEM_INSPECAO",
        `Imagens termográficas adicionadas ao Item ID ${req.params.itemChecklistId} da Inspeção ID ${req.inspecaoId}.`,
        connection
      );
    }
    res
      .status(201)
      .json({
        message: "Imagens termográficas salvas com sucesso!",
        anexos: anexosSalvosInfo,
      });
  } catch (error) {
    const statusCode =
      error.message.includes("inválido") ||
      error.message.includes("Nenhum anexo")
        ? 400
        : error.message.includes("não encontrada")
        ? 404
        : 500;
    res
      .status(statusCode)
      .json({
        message: "Erro interno ao salvar imagens termográficas do item.",
        detalhes: error.message,
      });
  }
}

async function anexarAPR(req, res) {
  try {
    await service.anexarAPR(req.inspecaoId, req.files);
    await registrarAuditoria(
      req.user.matricula,
      "UPLOAD_APR_INSPECAO",
      `APR(s) anexada(s) à Inspeção ID ${req.inspecaoId}.`
    );
    res.status(201).json({ message: "APR(s) anexada(s) com sucesso!" });
  } catch (error) {
    if (req.files?.length)
      req.files.forEach((f) => {
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
    const { anexo, connection } = await service.excluirAnexo(
      req.params.anexoId
    );
    if (req.user && req.user.matricula) {
      await registrarAuditoria(
        req.user.matricula,
        "DELETE_ANEXO_INSPECAO",
        `Anexo ID ${req.params.anexoId} (Nome: ${anexo.nome_original}) da Inspeção ID ${anexo.inspecao_id} foi excluído.`,
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
    res
      .status(statusCode)
      .json({
        message: "Erro interno ao excluir o anexo.",
        detalhes: error.message,
      });
  }
}

module.exports = {
  uploadTemporario,
  anexarEscritorio,
  anexarTermografia,
  anexarAPR,
  excluirAnexo,
};
