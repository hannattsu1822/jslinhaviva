const service = require("./itens.service");
const { registrarAuditoria } = require("../../../../auth");
const fs = require("fs");

async function atualizarEncarregados(req, res) {
  try {
    const { logDetalhes, connection } = await service.atualizarEncarregados(
      req.params.servicoId,
      req.body.atualizacoes_encarregados
    );
    if (req.user?.matricula) {
      await registrarAuditoria(
        req.user.matricula,
        "UPDATE_ENCARREGADOS_ITENS_SERVICO",
        logDetalhes,
        connection
      );
    }
    res.json({ message: "Encarregados dos itens atualizados com sucesso." });
  } catch (error) {
    const statusCode = error.message.includes("inválido")
      ? 400
      : error.message.includes("não encontrado")
      ? 404
      : 500;
    res
      .status(statusCode)
      .json({
        message: "Erro ao atualizar encarregados dos itens.",
        detalhes: error.message,
      });
  }
}

async function concluirItem(req, res) {
  const arquivos = req.files;
  try {
    await service.concluirItem(req.params.itemEscopoId, req.body, arquivos);
    res.json({ message: "Status do item atualizado com sucesso!" });
  } catch (error) {
    if (arquivos?.length)
      arquivos.forEach((f) => {
        if (f.path) fs.unlink(f.path, () => {});
      });
    const statusCode =
      error.message.includes("inválido") ||
      error.message.includes("obrigatória")
        ? 400
        : error.message.includes("não encontrado")
        ? 404
        : 500;
    res
      .status(statusCode)
      .json({
        message: "Erro interno ao atualizar o status do item.",
        detalhes: error.message,
      });
  }
}

module.exports = {
  atualizarEncarregados,
  concluirItem,
};
