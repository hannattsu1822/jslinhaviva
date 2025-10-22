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

async function atualizarEncarregadosItens(req, res) {
  try {
    const { servicoId } = req.params;
    const { atualizacoes_encarregados } = req.body;

    const { connection } = await service.atualizarEncarregadosItens(
      servicoId,
      atualizacoes_encarregados
    );

    if (req.user?.matricula) {
      await registrarAuditoria(
        req.user.matricula,
        "UPDATE_SERVICO_ENCARREGADOS",
        `Encarregados dos itens do serviço ID ${servicoId} foram atualizados.`,
        connection
      );
    }

    res.json({ message: "Encarregados atualizados com sucesso!" });
  } catch (error) {
    res.status(500).json({
      message: "Erro ao atualizar encarregados dos itens.",
      detalhes: error.message,
    });
  }
}

async function concluirItemServico(req, res) {
  try {
    const { itemEscopoId } = req.params;
    const dadosConclusao = req.body;
    const arquivos = req.files || [];

    await service.concluirItemServico(itemEscopoId, dadosConclusao, arquivos);

    if (req.user?.matricula) {
      await registrarAuditoria(
        req.user.matricula,
        "CONCLUDE_SERVICO_ITEM",
        `Item de serviço ID ${itemEscopoId} foi concluído.`
      );
    }

    res.json({ message: "Item de serviço concluído com sucesso!" });
  } catch (error) {
    if (req.files?.length) {
      req.files.forEach((f) => {
        if (f.path) fs.unlink(f.path, () => {});
      });
    }
    res.status(500).json({
      message: "Erro ao concluir o item de serviço.",
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
  reabrirServico,
  excluirServico,
  atualizarEncarregadosItens,
  concluirItemServico,
};
