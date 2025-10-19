const service = require("./gestaoServicos.service");
const { registrarAuditoria } = require("../../auth");

async function criarServico(req, res) {
  try {
    const resultado = await service.criarServico(req.body, req.files);
    if (req.user?.matricula) {
      await registrarAuditoria(
        req.user.matricula,
        "Registro de Serviço",
        `Serviço ${resultado.tipo} registrado: ${
          resultado.processo || `ID ${resultado.id}`
        }`
      );
    }
    res.status(201).json({
      success: true,
      processo: resultado.processo,
      id: resultado.id,
      tipo: resultado.tipo,
      anexos: resultado.anexos,
    });
  } catch (error) {
    console.error("Erro ao registrar serviço:", error);
    service.limparArquivosTemporarios(req.files);
    res.status(500).json({
      success: false,
      message: "Erro interno ao registrar serviço",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

async function listarServicos(req, res) {
  try {
    const { status } = req.query;
    const userLevel = req.user.nivel;
    const servicos = await service.listarServicos(status, userLevel);
    res.status(200).json(servicos);
  } catch (error) {
    console.error("Erro ao buscar serviços:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao buscar serviços",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

async function obterDetalhesServico(req, res) {
  try {
    const { id } = req.params;
    const resultado = await service.obterDetalhesServico(id);
    res.status(200).json({ success: true, data: resultado });
  } catch (error) {
    console.error("Erro ao buscar detalhes do serviço:", error);
    const statusCode = error.message === "Serviço não encontrado" ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Erro ao buscar detalhes do serviço",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

async function atualizarServico(req, res) {
  try {
    const { id: servicoId } = req.params;
    const resultado = await service.atualizarServico(
      servicoId,
      req.body,
      req.files
    );
    await registrarAuditoria(
      req.user.matricula,
      "Edição de Serviço",
      `Serviço ${servicoId} editado. Processo alterado para: ${resultado.processo}`
    );
    res.json({
      success: true,
      message: "Serviço atualizado com sucesso!",
      redirect: `/detalhes_servico?id=${servicoId}`,
    });
  } catch (error) {
    console.error("Erro ao atualizar serviço:", error);
    service.limparArquivosTemporarios(req.files);
    res.status(500).json({
      success: false,
      message: "Erro ao atualizar serviço",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

async function anexarAPR(req, res) {
  try {
    const { servicoId } = req.params;
    const resultado = await service.anexarAPR(servicoId, req.file);
    await registrarAuditoria(
      req.user.matricula,
      "Upload de APR",
      `APR anexada ao Serviço ID: ${servicoId}`
    );
    res.json({
      success: true,
      message: "APR anexada com sucesso!",
      caminho_apr_anexo: resultado.caminho_apr_anexo,
      nome_original_apr_anexo: resultado.nome_original_apr_anexo,
    });
  } catch (error) {
    console.error("Erro detalhado ao fazer upload da APR:", error);
    service.limparArquivosTemporarios(req.file);
    res.status(500).json({
      success: false,
      message: `Erro interno ao fazer upload da APR: ${error.message}`,
    });
  }
}

async function deletarServico(req, res) {
  try {
    const { id } = req.params;
    const resultado = await service.deletarServico(id);
    await registrarAuditoria(
      req.user.matricula,
      "Exclusão de Serviço",
      `Serviço excluído - ID: ${id}, Processo: ${resultado.nomeProcessoOriginal}`
    );
    res.json({
      success: true,
      message: "Serviço e seus anexos/pasta foram excluídos com sucesso",
    });
  } catch (error) {
    console.error("Erro ao excluir serviço:", error);
    const statusCode = error.message === "Serviço não encontrado" ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Erro ao excluir serviço",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

async function concluirServico(req, res) {
  try {
    const { id: servicoId } = req.params;
    const matricula = req.user?.matricula;
    const resultado = await service.concluirServico(
      servicoId,
      req.body,
      matricula
    );
    await registrarAuditoria(
      matricula,
      resultado.status_final === "concluido"
        ? "Conclusão de Serviço"
        : "Não Conclusão de Serviço",
      resultado.auditMessage
    );
    res.status(200).json({
      success: true,
      message: `Informações do serviço marcadas como ${
        resultado.status_final === "concluido" ? "Concluído" : "Não Concluído"
      } com sucesso.`,
    });
  } catch (error) {
    console.error("Erro ao finalizar/não concluir serviço (info):", error);
    res.status(500).json({
      success: false,
      message: "Erro interno ao processar informações do serviço",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : error.code === "WARN_DATA_TRUNCATED"
          ? "Tipo de anexo inválido."
          : undefined,
    });
  }
}

async function uploadFotoConclusao(req, res) {
  try {
    const { servicoId } = req.params;
    const { status_final } = req.body;
    await service.uploadFotoConclusao(servicoId, status_final, req.file);
    res.status(201).json({
      success: true,
      message: `Arquivo ${req.file.originalname} enviado com sucesso.`,
    });
  } catch (error) {
    service.limparArquivosTemporarios(req.file);
    console.error("Erro ao fazer upload de foto de conclusão:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno ao processar o upload do arquivo.",
    });
  }
}

async function reativarServico(req, res) {
  try {
    await service.reativarServico(req.params.id);
    await registrarAuditoria(
      req.user.matricula,
      "Reativação de Serviço",
      `Serviço ${req.params.id} retornado para ativo.`
    );
    res.json({ message: "Serviço reativado com sucesso" });
  } catch (error) {
    console.error("Erro ao reativar serviço:", error);
    const statusCode = error.message === "Serviço não encontrado" ? 404 : 500;
    res
      .status(statusCode)
      .json({ message: error.message || "Erro ao reativar serviço" });
  }
}

async function deletarAnexo(req, res) {
  try {
    const { servicoId, anexoId } = req.params;
    const resultado = await service.deletarAnexo(servicoId, anexoId);
    await registrarAuditoria(
      req.user.matricula,
      "Remoção de Anexo",
      `Anexo ${resultado.nomeOriginal} removido do Serviço ID: ${servicoId}`
    );
    res.json({ success: true, message: "Anexo removido com sucesso" });
  } catch (error) {
    console.error("Erro ao remover anexo:", error);
    const statusCode = error.message.includes("Anexo não encontrado")
      ? 404
      : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Erro ao remover anexo",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

async function contarServicos(req, res) {
  try {
    const { status } = req.query;
    const total = await service.contarServicos(status);
    res.json(total);
  } catch (error) {
    console.error("Erro ao contar serviços:", error);
    res.status(500).json({ message: "Erro ao contar serviços" });
  }
}

async function listarEncarregados(req, res) {
  try {
    const encarregados = await service.listarEncarregados();
    res.status(200).json(encarregados);
  } catch (err) {
    console.error("Erro ao buscar encarregados:", err);
    res.status(500).json({ message: "Erro ao buscar encarregados!" });
  }
}

async function listarSubestacoes(req, res) {
  try {
    const subestacoes = await service.listarSubestacoes();
    res.status(200).json(subestacoes);
  } catch (err) {
    console.error("Erro ao buscar subestações:", err);
    res.status(500).json({ message: "Erro ao buscar subestações!" });
  }
}

async function atribuirResponsavel(req, res) {
  try {
    const { id } = req.params;
    const { responsavel_matricula } = req.body;
    await service.atribuirResponsavel(id, responsavel_matricula);
    await registrarAuditoria(
      req.user.matricula,
      "Atribuição de Responsável",
      `Serviço ID ${id} atribuído a ${responsavel_matricula}`
    );
    res.json({
      success: true,
      message: "Responsável atualizado com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao atualizar responsável:", error);
    const statusCode = error.message.includes("Serviço não encontrado")
      ? 404
      : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Erro ao atualizar responsável",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

async function gerarPdfConsolidado(req, res) {
  try {
    const { id: servicoId } = req.params;
    const { nomeArquivo, buffer } = await service.gerarPdfConsolidado(
      servicoId
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nomeArquivo}"`
    );
    res.send(buffer);
  } catch (error) {
    console.error("Erro ao gerar relatório PDF:", error);
    const statusCode = error.message === "Serviço não encontrado" ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: "Erro interno ao gerar o relatório PDF.",
    });
  }
}

module.exports = {
  criarServico,
  listarServicos,
  obterDetalhesServico,
  atualizarServico,
  anexarAPR,
  deletarServico,
  concluirServico,
  uploadFotoConclusao,
  reativarServico,
  deletarAnexo,
  contarServicos,
  listarEncarregados,
  listarSubestacoes,
  atribuirResponsavel,
  gerarPdfConsolidado,
};
