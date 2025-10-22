const service = require("./core.service");
const { registrarAuditoria } = require("../../../../auth");

async function obterModeloPadrao(req, res) {
  try {
    const modelo = await service.obterModeloPadrao();
    res.json(modelo);
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Erro interno ao buscar modelo de checklist.",
        detalhes: error.message,
      });
  }
}

async function criarInspecao(req, res) {
  let arquivosMovidos = [];
  try {
    const {
      novaInspecaoId,
      connection,
      arquivosMovidos: movidos,
    } = await service.criarInspecao(req.body);
    arquivosMovidos = movidos;
    await registrarAuditoria(
      req.user.matricula,
      "CREATE_INSPECAO_SUBESTACAO",
      `Inspeção ID ${novaInspecaoId} (Modo: ${req.body.inspection_mode}) criada.`,
      connection
    );
    res
      .status(201)
      .json({
        id: novaInspecaoId,
        message: "Inspeção registrada com sucesso!",
      });
  } catch (error) {
    for (const caminho of arquivosMovidos) {
      try {
        await fs.unlink(caminho);
      } catch (e) {}
    }
    console.error("Erro ao registrar a inspeção:", error);
    const statusCode = error.message.includes("obrigatórios") ? 400 : 500;
    res
      .status(statusCode)
      .json({
        message: "Erro interno ao registrar a inspeção.",
        detalhes: error.message,
      });
  }
}

async function atualizarInspecao(req, res) {
  let arquivosMovidos = [];
  try {
    const { connection, arquivosMovidos: movidos } =
      await service.atualizarInspecao(req.params.id, req.body);
    arquivosMovidos = movidos;
    await registrarAuditoria(
      req.user.matricula,
      "UPDATE_INSPECAO_SUBESTACAO",
      `Inspeção ID ${req.params.id} (Modo: ${req.body.inspection_mode}) atualizada.`,
      connection
    );
    res
      .status(200)
      .json({ id: req.params.id, message: "Inspeção atualizada com sucesso!" });
  } catch (error) {
    for (const caminho of arquivosMovidos) {
      try {
        await fs.unlink(caminho);
      } catch (e) {}
    }
    console.error("Erro ao atualizar a inspeção:", error);
    res
      .status(500)
      .json({
        message: "Erro interno ao atualizar a inspeção.",
        detalhes: error.message,
      });
  }
}

async function listarInspecoes(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const resultado = await service.listarInspecoes(req.query, { page, limit });
    res.json(resultado);
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Erro interno ao listar inspeções.",
        detalhes: error.message,
      });
  }
}

async function obterInspecaoCompleta(req, res) {
  try {
    const inspecao = await service.obterInspecaoCompleta(req.params.id);
    res.json(inspecao);
  } catch (error) {
    console.error("Erro ao buscar detalhes da inspeção:", error);
    const statusCode = error.message.includes("inválido")
      ? 400
      : error.message.includes("não encontrada")
      ? 404
      : 500;
    res
      .status(statusCode)
      .json({
        message: "Erro interno ao buscar detalhes da inspeção.",
        detalhes: error.message,
      });
  }
}

async function concluirInspecao(req, res) {
  try {
    const { connection } = await service.concluirInspecao(req.inspecaoId);
    if (req.user?.matricula) {
      await registrarAuditoria(
        req.user.matricula,
        "CONCLUDE_INSPECAO_SUBESTACAO",
        `Inspeção ${req.inspecaoId} marcada como CONCLUÍDA.`,
        connection
      );
    }
    res.json({ message: `Inspeção ID ${req.inspecaoId} concluída!` });
  } catch (error) {
    const statusCode = error.message.includes("não encontrada")
      ? 404
      : error.message.includes("já está")
      ? 400
      : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function reabrirInspecao(req, res) {
  try {
    const { connection } = await service.reabrirInspecao(req.inspecaoId);
    if (req.user?.matricula) {
      await registrarAuditoria(
        req.user.matricula,
        "REOPEN_INSPECAO_SUBESTACAO",
        `Inspeção ${req.inspecaoId} reaberta (EM_ANDAMENTO).`,
        connection
      );
    }
    res.json({ message: `Inspeção ID ${req.inspecaoId} reaberta!` });
  } catch (error) {
    const statusCode = error.message.includes("não encontrada")
      ? 404
      : error.message.includes("não pode ser reaberta")
      ? 400
      : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function deletarInspecao(req, res) {
  try {
    const { connection } = await service.deletarInspecao(
      req.inspecaoId,
      req.inspecao
    );
    await registrarAuditoria(
      req.user.matricula,
      "DELETE_INSPECAO_SUBESTACAO",
      `Inspeção ID ${req.inspecaoId} (Form: ${
        req.inspecao.formulario_inspecao_num || "N/A"
      }) e seus anexos foram excluídos.`,
      connection
    );
    res.json({
      message: `Inspeção ID ${req.inspecaoId} excluída com sucesso.`,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erro interno ao excluir.", detalhes: error.message });
  }
}

module.exports = {
  obterModeloPadrao,
  criarInspecao,
  atualizarInspecao,
  listarInspecoes,
  obterInspecaoCompleta,
  concluirInspecao,
  reabrirInspecao,
  deletarInspecao,
};
