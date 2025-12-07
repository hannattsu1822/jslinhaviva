const service = require("./servicos.service");
const { registrarAuditoria } = require("../../../auth");

async function obterResponsaveis(req, res) {
  try {
    const responsaveis = await service.obterResponsaveis();
    res.render("pages/fibra_optica/registro_projeto.html", {
      user: req.session.user,
      responsaveis: responsaveis,
    });
  } catch (error) {
    res.status(500).send("Erro ao carregar a página de registro de projeto.");
  }
}

async function registrarProjeto(req, res) {
  try {
    const { servicoId, processo, connection } = await service.registrarProjeto(
      req.body,
      req.files
    );
    await registrarAuditoria(
      req.session.user.matricula,
      "CADASTRO_SERVICO_FIBRA",
      `Serviço ID ${servicoId} (Processo: ${processo}) criado.`,
      connection
    );
    res
      .status(201)
      .json({ message: "Serviço registrado com sucesso!", servicoId });
  } catch (error) {
    const statusCode = error.message.includes("obrigatório") ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function listarProjetosAndamento(req, res) {
  try {
    const statusPermitidos = ["Pendente", "Em Andamento", "Pausado"];
    const { servicos, encarregadosParaFiltro } = await service.listarProjetos(
      req.query,
      req.session.user,
      statusPermitidos
    );
    res.render("pages/fibra_optica/projetos_andamento.html", {
      user: req.session.user,
      servicos: servicos,
      encarregados: encarregadosParaFiltro,
      statusOptions: statusPermitidos,
      filtros: req.query,
    });
  } catch (error) {
    console.error("Erro ao carregar projetos em andamento:", error);
    res.status(500).send("Erro ao carregar a página de serviços em andamento.");
  }
}

async function listarProjetosConcluidos(req, res) {
  try {
    const statusPermitidos = [
      "Concluído",
      "Concluído com Pendência",
      "Cancelado",
    ];
    const { servicos, encarregadosParaFiltro } = await service.listarProjetos(
      req.query,
      req.session.user,
      statusPermitidos
    );
    res.render("pages/fibra_optica/projetos_concluidos.html", {
      user: req.session.user,
      servicos: servicos,
      encarregados: encarregadosParaFiltro,
      statusOptions: statusPermitidos,
      filtros: req.query,
    });
  } catch (error) {
    res.status(500).send("Erro ao carregar a página de serviços concluídos.");
  }
}

async function obterDetalhesServico(req, res) {
  try {
    const { servico, anexos } = await service.obterDetalhesServico(
      req.params.id
    );

    const servicoParaRenderizar = {
      ...servico,
      data_servico_formatada: servico.data_servico
        ? new Date(servico.data_servico).toLocaleDateString("pt-BR", {
            timeZone: "UTC",
          })
        : "Não definida",
      horario_inicio_formatado: servico.horario_inicio
        ? servico.horario_inicio.substring(0, 5)
        : "N/A",
      horario_fim_formatado: servico.horario_fim
        ? servico.horario_fim.substring(0, 5)
        : "N/A",
      // Novos campos formatados para conclusão
      data_conclusao_formatada: servico.data_conclusao
        ? new Date(servico.data_conclusao).toLocaleDateString("pt-BR", {
            timeZone: "UTC",
          })
        : null,
      horario_conclusao_formatado: servico.horario_conclusao
        ? servico.horario_conclusao.substring(0, 5)
        : null,
    };

    res.render("pages/fibra_optica/servico_detalhes.html", {
      user: req.session.user,
      servico: servicoParaRenderizar,
      anexos: anexos,
    });
  } catch (error) {
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).send(error.message);
  }
}

async function obterDadosParaEdicao(req, res) {
  try {
    const { servico, responsaveis, anexos } =
      await service.obterDadosParaEdicao(req.params.id);
    res.render("pages/fibra_optica/editar_servico.html", {
      user: req.session.user,
      servico: servico,
      responsaveis: responsaveis,
      anexos: anexos,
    });
  } catch (error) {
    console.error("Erro ao carregar página de edição:", error);
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).send(error.message);
  }
}

async function editarServico(req, res) {
  try {
    const { connection } = await service.editarServico(
      req.params.id,
      req.body,
      req.files
    );
    await registrarAuditoria(
      req.session.user.matricula,
      "EDICAO_SERVICO_FIBRA",
      `Serviço ID ${req.params.id} foi atualizado.`,
      connection
    );
    res.status(200).json({
      message: "Serviço atualizado com sucesso!",
      servicoId: req.params.id,
    });
  } catch (error) {
    console.error("Erro ao atualizar serviço:", error);
    res.status(500).json({ message: "Erro interno ao atualizar o serviço." });
  }
}

async function listarEncarregados(req, res) {
  try {
    const encarregados = await service.listarEncarregados();
    res.json(encarregados);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar lista de encarregados." });
  }
}

async function modificarAtribuicao(req, res) {
  try {
    const { servicoId, encarregadoMatricula } = req.body;
    const { message, action, details } = await service.modificarAtribuicao(
      servicoId,
      encarregadoMatricula
    );
    await registrarAuditoria(req.session.user.matricula, action, details);
    res.json({ message });
  } catch (error) {
    const statusCode = error.message.includes("obrigatório") ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function finalizarServico(req, res) {
  try {
    const pontosMapa = req.body.pontosMapa
      ? JSON.parse(req.body.pontosMapa)
      : [];
    const { connection, detalhesAuditoria } = await service.finalizarServico(
      req.body,
      req.files,
      pontosMapa,
      req.session.user.matricula
    );
    await registrarAuditoria(
      req.session.user.matricula,
      "FINALIZACAO_SERVICO_FIBRA",
      detalhesAuditoria,
      connection
    );
    res.json({ message: "Serviço finalizado com sucesso!" });
  } catch (error) {
    const statusCode =
      error.message.includes("incompletos") ||
      error.message.includes("inválido")
        ? 400
        : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function reabrirServico(req, res) {
  try {
    await service.reabrirServico(req.body.servicoId);
    await registrarAuditoria(
      req.session.user.matricula,
      "REABERTURA_SERVICO_FIBRA",
      `Serviço de Fibra ID ${req.body.servicoId} foi reaberto.`
    );
    res.json({ message: "Serviço reaberto com sucesso!" });
  } catch (error) {
    const statusCode = error.message.includes("obrigatório") ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function anexarAPR(req, res) {
  try {
    const { connection, fileCount } = await service.anexarAPR(
      req.body.servicoId,
      req.files
    );
    await registrarAuditoria(
      req.session.user.matricula,
      "UPLOAD_APR_FIBRA",
      `${fileCount} anexo(s) APR adicionado(s) ao Serviço ID ${req.body.servicoId}.`,
      connection
    );
    res.json({ message: "APR(s) anexadas com sucesso!" });
  } catch (error) {
    const statusCode = error.message.includes("obrigatórios") ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function excluirServico(req, res) {
  try {
    const { connection } = await service.excluirServico(req.params.id);
    await registrarAuditoria(
      req.session.user.matricula,
      "EXCLUSAO_SERVICO_FIBRA",
      `Serviço de Fibra ID ${req.params.id} e seus anexos foram excluídos.`,
      connection
    );
    res.json({ message: "Serviço excluído com sucesso!" });
  } catch (error) {
    res.status(500).json({ message: "Erro interno ao excluir o serviço." });
  }
}

async function obterAnexosAPR(req, res) {
  try {
    const anexos = await service.obterAnexosAPR(req.params.id);
    res.json(anexos);
  } catch (error) {
    console.error("Erro ao buscar anexos APR:", error);
    res.status(500).json({ message: "Erro interno ao buscar anexos." });
  }
}

async function excluirAnexoAPR(req, res) {
  try {
    const { connection } = await service.excluirAnexoAPR(req.params.id);
    await registrarAuditoria(
      req.session.user.matricula,
      "EXCLUSAO_ANEXO_APR_FIBRA",
      `Anexo APR ID ${req.params.id} foi excluído.`,
      connection
    );
    res.json({ message: "Anexo APR excluído com sucesso!" });
  } catch (error) {
    console.error("Erro ao excluir anexo APR:", error);
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

module.exports = {
  obterResponsaveis,
  registrarProjeto,
  listarProjetosAndamento,
  listarProjetosConcluidos,
  obterDetalhesServico,
  obterDadosParaEdicao,
  editarServico,
  listarEncarregados,
  modificarAtribuicao,
  finalizarServico,
  reabrirServico,
  anexarAPR,
  excluirServico,
  obterAnexosAPR,
  excluirAnexoAPR,
};
