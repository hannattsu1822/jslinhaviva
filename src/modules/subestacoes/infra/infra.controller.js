const service = require("./infra.service");
const { registrarAuditoria } = require("../../../auth");

async function listarSubestacoes(req, res) {
  try {
    const subestacoes = await service.listarSubestacoes();
    res.json(subestacoes);
  } catch (error) {
    console.error("Erro ao buscar subestações:", error);
    res.status(500).json({ message: "Erro interno ao buscar subestações." });
  }
}

async function obterSubestacaoPorId(req, res) {
  try {
    const subestacao = await service.obterSubestacaoPorId(req.params.id);
    res.json(subestacao);
  } catch (error) {
    console.error("Erro ao buscar subestação por ID:", error);
    const statusCode = error.message.includes("inválido")
      ? 400
      : error.message.includes("não encontrada")
      ? 404
      : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function criarSubestacao(req, res) {
  try {
    const novaSubestacao = await service.criarSubestacao(req.body);
    if (req.user && req.user.matricula) {
      await registrarAuditoria(
        req.user.matricula,
        "CREATE_SUBESTACAO",
        `Subestação criada: ID ${novaSubestacao.id}, Sigla: ${novaSubestacao.sigla}`
      );
    }
    res
      .status(201)
      .json({ ...novaSubestacao, message: "Subestação criada com sucesso!" });
  } catch (error) {
    console.error("Erro ao criar subestação:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ message: "Erro ao criar subestação: Sigla já cadastrada." });
    }
    const statusCode =
      error.message.includes("obrigatórios") ||
      error.message.includes("inválido")
        ? 400
        : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function atualizarSubestacao(req, res) {
  try {
    const updatedFields = await service.atualizarSubestacao(
      req.params.id,
      req.body
    );
    if (req.user && req.user.matricula) {
      await registrarAuditoria(
        req.user.matricula,
        "UPDATE_SUBESTACAO",
        `Subestação atualizada: ID ${req.params.id}`
      );
    }
    res.json({
      id: parseInt(req.params.id),
      ...updatedFields,
      message: "Subestação atualizada com sucesso!",
    });
  } catch (error) {
    console.error("Erro ao atualizar subestação:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({
          message:
            "Erro ao atualizar subestação: Sigla já cadastrada para outra subestação.",
        });
    }
    const statusCode = error.message.includes("inválido")
      ? 400
      : error.message.includes("obrigatórios")
      ? 400
      : error.message.includes("não encontrada")
      ? 404
      : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function deletarSubestacao(req, res) {
  try {
    await service.deletarSubestacao(req.params.id);
    if (req.user && req.user.matricula) {
      await registrarAuditoria(
        req.user.matricula,
        "DELETE_SUBESTACAO",
        `Subestação excluída: ID ${req.params.id}`
      );
    }
    res.json({ message: "Subestação excluída com sucesso!" });
  } catch (error) {
    console.error("Erro ao excluir subestação:", error);
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res
        .status(409)
        .json({
          message:
            "Não é possível excluir subestação: Existem registros associados em outras tabelas.",
        });
    }
    const statusCode = error.message.includes("inválido")
      ? 400
      : error.message.includes("associados")
      ? 409
      : error.message.includes("não encontrada")
      ? 404
      : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function listarCatalogo(req, res) {
  try {
    const catalogo = await service.listarCatalogo();
    res.json(catalogo);
  } catch (error) {
    console.error("Erro ao buscar catálogo de equipamentos:", error);
    res
      .status(500)
      .json({ message: "Erro ao buscar catálogo de equipamentos." });
  }
}

async function criarItemCatalogo(req, res) {
  try {
    const novoItem = await service.criarItemCatalogo(req.body);
    await registrarAuditoria(
      req.user.matricula,
      "CREATE_CATALOGO_EQUIP",
      `Item de catálogo criado: ID ${novoItem.id}, Código: ${req.body.codigo}`
    );
    res
      .status(201)
      .json({
        id: novoItem.id,
        message: "Item de catálogo criado com sucesso!",
      });
  } catch (error) {
    console.error("Erro ao criar item no catálogo:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ message: "Erro: Código já existe no catálogo." });
    }
    const statusCode = error.message.includes("obrigatórios") ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function atualizarItemCatalogo(req, res) {
  try {
    await service.atualizarItemCatalogo(req.params.id, req.body);
    await registrarAuditoria(
      req.user.matricula,
      "UPDATE_CATALOGO_EQUIP",
      `Item de catálogo atualizado: ID ${req.params.id}`
    );
    res.json({ message: "Item de catálogo atualizado com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar item do catálogo:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({
          message: "Erro: Código já pertence a outro item do catálogo.",
        });
    }
    const statusCode =
      error.message.includes("inválido") ||
      error.message.includes("obrigatórios")
        ? 400
        : error.message.includes("não encontrado")
        ? 404
        : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function deletarItemCatalogo(req, res) {
  try {
    await service.deletarItemCatalogo(req.params.id);
    await registrarAuditoria(
      req.user.matricula,
      "DELETE_CATALOGO_EQUIP",
      `Item de catálogo excluído: ID ${req.params.id}`
    );
    res.json({ message: "Item de catálogo excluído com sucesso!" });
  } catch (error) {
    console.error("Erro ao excluir item do catálogo:", error);
    const statusCode = error.message.includes("inválido")
      ? 400
      : error.message.includes("está sendo usado")
      ? 409
      : error.message.includes("não encontrado")
      ? 404
      : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

module.exports = {
  listarSubestacoes,
  obterSubestacaoPorId,
  criarSubestacao,
  atualizarSubestacao,
  deletarSubestacao,
  listarCatalogo,
  criarItemCatalogo,
  atualizarItemCatalogo,
  deletarItemCatalogo,
};
