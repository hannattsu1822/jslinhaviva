const service = require("./usuarios.service");

async function listarUsuarios(req, res) {
  try {
    const page = parseInt(req.query.pagina) || 1;
    const { users, totalPages } = await service.listarUsuarios({
      ...req.query,
      pagina: page,
    });
    res.json({ users, currentPage: page, totalPages });
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    res.status(500).json({ message: "Erro interno ao buscar usuários." });
  }
}

async function obterUsuarioPorId(req, res) {
  try {
    const usuario = await service.obterUsuarioPorId(req.params.id);
    res.json(usuario);
  } catch (error) {
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function criarUsuario(req, res) {
  try {
    const { id } = await service.criarUsuario(req.body);
    res.status(201).json({ id, message: "Usuário criado com sucesso!" });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ message: "A matrícula informada já está em uso." });
    }
    const statusCode = error.message.includes("obrigatórios") ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function atualizarUsuario(req, res) {
  try {
    await service.atualizarUsuario(req.params.id, req.body);
    res.json({ message: "Usuário atualizado com sucesso!" });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "A matrícula informada já está em uso por outro usuário.",
      });
    }
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function atualizarStatusUsuario(req, res) {
  try {
    const novoNivel = await service.atualizarStatusUsuario(
      req.params.id,
      req.body.nivelAtual
    );
    res.json({
      message: `Usuário ${
        novoNivel > 0 ? "ativado" : "desativado"
      } com sucesso!`,
    });
  } catch (error) {
    res.status(500).json({ message: "Erro ao alterar status do usuário." });
  }
}

async function deletarUsuario(req, res) {
  try {
    await service.deletarUsuario(req.params.id);
    res.json({ message: "Usuário excluído permanentemente com sucesso!" });
  } catch (error) {
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

module.exports = {
  listarUsuarios,
  obterUsuarioPorId,
  criarUsuario,
  atualizarUsuario,
  atualizarStatusUsuario,
  deletarUsuario,
};
