const service = require("./core.service");
const { registrarAuditoria } = require("../../../../auth");
const fs = require("fs");

async function listarUsuariosResponsaveis(req, res) {
  try {
    const cargos = [
      "Técnico",
      "Engenheiro",
      "Gerente",
      "ADMIN",
      "ADM",
      "Inspetor",
    ];
    const usuarios = await service.listarUsuariosPorCargo(cargos);
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar usuários responsáveis." });
  }
}

async function listarEncarregadosInspetores(req, res) {
  try {
    const cargos = ["Encarregado", "Inspetor", "Técnico"];
    const usuarios = await service.listarUsuariosPorCargo(cargos);
    res.json(usuarios);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erro ao buscar encarregados e inspetores." });
  }
}

async function listarCatalogoDefeitos(req, res) {
  try {
    const catalogo = await service.listarCatalogoDefeitos();
    res.json(catalogo);
  } catch (error) {
    res.status(500).json({
      message: "Erro ao buscar catálogo de defeitos.",
      detalhes: error.message,
    });
  }
}

async function criarServico(req, res) {
  const arquivos = req.files;
  try {
    const { novoServicoId, connection } = await service.criarServico(
      req.body,
      arquivos
    );
    if (req.user && req.user.matricula) {
      await registrarAuditoria(
        req.user.matricula,
        "CREATE_SERVICO_SUBESTACAO",
        `Serviço ID ${novoServicoId} (Proc: ${req.body.processo}) criado.`,
        connection
      );
    }
    res
      .status(201)
      .json({ id: novoServicoId, message: "Serviço registrado com sucesso!" });
  } catch (error) {
    if (arquivos?.length)
      arquivos.forEach((f) => {
        if (f.path) fs.unlink(f.path, () => {});
      });
    const statusCode =
      error.message.includes("obrigatórios") ||
      error.message.includes("inválido")
        ? 400
        : 500;
    res
      .status(statusCode)
      .json({ message: "Erro ao criar serviço.", detalhes: error.message });
  }
}

async function listarServicos(req, res) {
  try {
    const result = await service.listarServicos(req.query, req.user);
    res.json(result);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Erro ao listar serviços.", detalhes: err.message });
  }
}

async function obterServicoPorId(req, res) {
  try {
    const servico = await service.obterServicoPorId(req.params.servicoId);
    res.json(servico);
  } catch (err) {
    const statusCode = err.message.includes("inválido")
      ? 400
      : err.message.includes("não encontrado")
      ? 404
      : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function atualizarServico(req, res) {
  const { servicoId } = req.params;
  const dados = req.body;
  const arquivos = req.files;

  try {
    const { connection } = await service.atualizarServico(
      servicoId,
      dados,
      arquivos
    );

    if (req.user?.matricula) {
      await registrarAuditoria(
        req.user.matricula,
        "UPDATE_SERVICO_SUBESTACAO",
        `Serviço ID ${servicoId} (Proc: ${req.servico.processo}) foi atualizado.`,
        connection
      );
    }

    res.json({ message: "Serviço atualizado com sucesso!" });
  } catch (error) {
    // Limpa arquivos temporários em caso de falha
    if (arquivos?.length) {
      arquivos.forEach((f) => {
        if (f.path) fs.unlink(f.path, () => {});
      });
    }
    const statusCode =
      error.message.includes("inválido") ||
      error.message.includes("obrigatórios")
        ? 400
        : error.message.includes("não encontrado")
        ? 404
        : 500;
    res.status(statusCode).json({
      message: "Erro ao atualizar o serviço.",
      detalhes: error.message,
    });
  }
}

async function reabrirServico(req, res) {
  try {
    const { connection } = await service.reabrirServico(
      req.params.servicoId,
      req.servico
    );
    if (req.user?.matricula) {
      await registrarAuditoria(
        req.user.matricula,
        "REOPEN_SERVICO_SUBESTACAO",
        `Serviço ${req.params.servicoId} (Proc: ${req.servico.processo}) reaberto.`,
        connection
      );
    }
    res.json({
      message: `Serviço (Processo: ${req.servico.processo}) reaberto! Status: EM ANDAMENTO.`,
    });
  } catch (error) {
    const statusCode = error.message.includes("não pode ser reaberto")
      ? 400
      : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function excluirServico(req, res) {
  try {
    const { processo, connection } = await service.excluirServico(
      req.params.servicoId
    );
    if (req.user?.matricula) {
      await registrarAuditoria(
        req.user.matricula,
        "DELETE_SERVICO_SUBESTACAO",
        `Serviço ID ${req.params.servicoId} (Proc: ${processo}) foi excluído.`,
        connection
      );
    }
    res.json({ message: "Serviço excluído com sucesso." });
  } catch (error) {
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({
      message: "Erro ao excluir o serviço.",
      detalhes: error.message,
    });
  }
}

module.exports = {
  listarUsuariosResponsaveis,
  listarEncarregadosInspetores,
  listarCatalogoDefeitos,
  criarServico,
  listarServicos,
  obterServicoPorId,
  atualizarServico,
  reabrirServico,
  excluirServico,
};
