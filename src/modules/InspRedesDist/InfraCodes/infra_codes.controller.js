const service = require("./infra_codes.service");
const { registrarAuditoria } = require("../../../auth");
const path = require("path");
const { projectRootDir } = require("../../../shared/path.helper");

async function renderizarPaginaGerenciamento(req, res) {
  try {
    const filePath = path.join(
      projectRootDir,
      "views",
      "pages",
      "InspRedesDist",
      "gerenciar_codigos.html"
    );
    res.sendFile(filePath);
  } catch (error) {
    console.error(
      "Erro ao enviar a página de gerenciamento de códigos:",
      error
    );
    res
      .status(500)
      .send("Erro ao carregar a página de gerenciamento de códigos.");
  }
}

// --- Controllers para Tipos de Código ---

async function handleListarTipos(req, res) {
  try {
    const tipos = await service.obterTodosTipos();
    res.status(200).json(tipos);
  } catch (error) {
    console.error("Erro ao listar tipos de código:", error);
    res
      .status(500)
      .json({ message: "Erro interno ao listar tipos de código." });
  }
}

async function handleCriarTipo(req, res) {
  try {
    const novoTipo = await service.criarTipo(req.body);
    await registrarAuditoria(
      req.session.user.matricula,
      "CRIAR_TIPO_CODIGO_INSPECAO",
      `Tipo de código criado: "${novoTipo.ponto_defeito}" (ID: ${novoTipo.id})`
    );
    res
      .status(201)
      .json({ message: "Tipo de código criado com sucesso!", tipo: novoTipo });
  } catch (error) {
    console.error("Erro ao criar tipo de código:", error);
    const statusCode = error.message.includes("obrigatório") ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function handleAtualizarTipo(req, res) {
  try {
    const tipoAtualizado = await service.atualizarTipo(req.params.id, req.body);
    await registrarAuditoria(
      req.session.user.matricula,
      "ATUALIZAR_TIPO_CODIGO_INSPECAO",
      `Tipo de código ID ${tipoAtualizado.id} atualizado para: "${tipoAtualizado.ponto_defeito}"`
    );
    res.status(200).json({
      message: "Tipo de código atualizado com sucesso!",
      tipo: tipoAtualizado,
    });
  } catch (error) {
    console.error("Erro ao atualizar tipo de código:", error);
    const statusCode = error.message.includes("obrigatório")
      ? 400
      : error.message.includes("não encontrado")
      ? 404
      : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function handleDeletarTipo(req, res) {
  try {
    await service.deletarTipo(req.params.id);
    await registrarAuditoria(
      req.session.user.matricula,
      "DELETAR_TIPO_CODIGO_INSPECAO",
      `Tipo de código ID ${req.params.id} foi excluído.`
    );
    res.status(200).json({ message: "Tipo de código excluído com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar tipo de código:", error);
    const statusCode = error.message.includes("não encontrado")
      ? 404
      : error.message.includes("sendo usado")
      ? 409
      : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

// --- Controllers para Tags de Código ---

async function handleListarTags(req, res) {
  try {
    const tags = await service.obterTodasTags();
    res.status(200).json(tags);
  } catch (error) {
    console.error("Erro ao listar tags de código:", error);
    res.status(500).json({ message: "Erro interno ao listar tags de código." });
  }
}

async function handleCriarTag(req, res) {
  try {
    const novaTag = await service.criarTag(req.body);
    await registrarAuditoria(
      req.session.user.matricula,
      "CRIAR_TAG_CODIGO_INSPECAO",
      `Tag de código criada: "${novaTag.tag_code}" (ID: ${novaTag.id})`
    );
    res
      .status(201)
      .json({ message: "Tag de código criada com sucesso!", tag: novaTag });
  } catch (error) {
    console.error("Erro ao criar tag de código:", error);
    const statusCode = error.message.includes("obrigatórios") ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function handleAtualizarTag(req, res) {
  try {
    const tagAtualizada = await service.atualizarTag(req.params.id, req.body);
    await registrarAuditoria(
      req.session.user.matricula,
      "ATUALIZAR_TAG_CODIGO_INSPECAO",
      `Tag de código ID ${tagAtualizada.id} atualizada. Novo código: "${tagAtualizada.tag_code}"`
    );
    res.status(200).json({
      message: "Tag de código atualizada com sucesso!",
      tag: tagAtualizada,
    });
  } catch (error) {
    console.error("Erro ao atualizar tag de código:", error);
    const statusCode = error.message.includes("obrigatórios")
      ? 400
      : error.message.includes("não encontrada")
      ? 404
      : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function handleDeletarTag(req, res) {
  try {
    await service.deletarTag(req.params.id);
    await registrarAuditoria(
      req.session.user.matricula,
      "DELETAR_TAG_CODIGO_INSPECAO",
      `Tag de código ID ${req.params.id} foi excluída.`
    );
    res.status(200).json({ message: "Tag de código excluída com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar tag de código:", error);
    const statusCode = error.message.includes("não encontrada") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

module.exports = {
  renderizarPaginaGerenciamento,
  handleListarTipos,
  handleCriarTipo,
  handleAtualizarTipo,
  handleDeletarTipo,
  handleListarTags,
  handleCriarTag,
  handleAtualizarTag,
  handleDeletarTag,
};
