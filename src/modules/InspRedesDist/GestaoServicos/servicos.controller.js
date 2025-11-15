const service = require("./servicos.service");
const { registrarAuditoria } = require("../../../auth");
const path = require("path");
const { projectRootDir } = require("../../../shared/path.helper");
const { chromium } = require("playwright"); // MUDANÇA: Importa o Playwright
const ejs = require("ejs");
const fs = require("fs");

async function renderizarPaginaListagem(req, res) {
  try {
    const filePath = path.join(
      projectRootDir,
      "views",
      "pages",
      "InspRedesDist",
      "listar_servicos.html"
    );
    res.sendFile(filePath);
  } catch (error) {
    console.error("Erro ao enviar a página de listagem de serviços:", error);
    res.status(500).send("Erro ao carregar a página de listagem de serviços.");
  }
}

async function renderizarPaginaConcluidos(req, res) {
  try {
    const filePath = path.join(
      projectRootDir,
      "views",
      "pages",
      "InspRedesDist",
      "listar_servicos_concluidos.html"
    );
    res.sendFile(filePath);
  } catch (error) {
    console.error("Erro ao enviar a página de serviços concluídos:", error);
    res.status(500).send("Erro ao carregar a página de serviços concluídos.");
  }
}

async function renderizarPaginaCriacao(req, res) {
  try {
    const filePath = path.join(
      projectRootDir,
      "views",
      "pages",
      "InspRedesDist",
      "criar_servico.html"
    );
    res.sendFile(filePath);
  } catch (error) {
    console.error("Erro ao enviar a página de criação de serviço:", error);
    res.status(500).send("Erro ao carregar a página de criação de serviço.");
  }
}

async function renderizarPaginaDetalhes(req, res) {
  try {
    const filePath = path.join(
      projectRootDir,
      "views",
      "pages",
      "InspRedesDist",
      "detalhes_servico.html"
    );
    res.sendFile(filePath);
  } catch (error) {
    console.error("Erro ao enviar a página de detalhes do serviço:", error);
    res.status(500).send("Erro ao carregar a página de detalhes.");
  }
}

function renderizarPaginaColeta(req, res) {
  try {
    const filePath = path.join(
      projectRootDir,
      "views",
      "pages",
      "InspRedesDist",
      "coletar_pontos.html"
    );
    res.sendFile(filePath);
  } catch (error) {
    console.error("Erro ao enviar a página de coleta de pontos:", error);
    res.status(500).send("Erro ao carregar a página de coleta.");
  }
}

async function handleGerarRelatorio(req, res) {
  let browser;
  try {
    const { id } = req.params;
    const servico = await service.obterServicoCompletoPorId(id);

    const dataForTemplate = {
      ...servico,
      data_servico: new Date(servico.data_servico).toLocaleDateString("pt-BR", {
        timeZone: "UTC",
      }),
      data_finalizacao: servico.data_finalizacao
        ? new Date(servico.data_finalizacao).toLocaleDateString("pt-BR", {
            timeZone: "UTC",
          })
        : "N/A",
      rotaCompletaUrl: "",
      pontos: servico.pontos.map((ponto) => {
        const anexoComBase64 = ponto.anexos.map((anexo) => {
          const fullPath = path.join(
            projectRootDir,
            anexo.caminho_arquivo.substring(1)
          );
          if (fs.existsSync(fullPath)) {
            const fileBuffer = fs.readFileSync(fullPath);
            const base64String = fileBuffer.toString("base64");
            return {
              ...anexo,
              base64Src: `data:${anexo.tipo_arquivo};base64,${base64String}`,
            };
          }
          return { ...anexo, base64Src: "" };
        });
        return {
          ...ponto,
          mapsUrl: `https://www.google.com/maps?q=${ponto.coordenada_y},${ponto.coordenada_x}`,
          anexos: anexoComBase64,
        };
      }),
    };

    if (dataForTemplate.pontos.length > 0) {
      const waypoints = dataForTemplate.pontos
        .map((p) => `${p.coordenada_y},${p.coordenada_x}`)
        .join("/");
      dataForTemplate.rotaCompletaUrl = `https://www.google.com/maps/dir/${waypoints}`;
    }

    const templatePath = path.join(
      projectRootDir,
      "views",
      "pages",
      "InspRedesDist",
      "relatorio_template.html"
    );
    const html = await ejs.renderFile(templatePath, dataForTemplate);

    // MUDANÇA: Bloco de código trocado para Playwright
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px",
      },
    });

    const filename = `Relatorio_Inspecao_${servico.processo.replace(
      /\s+/g,
      "_"
    )}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.send(pdf);
  } catch (error) {
    console.error("Erro ao gerar relatório PDF:", error);
    res.status(500).send("Erro interno ao gerar o relatório.");
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function handleListarServicos(req, res) {
  try {
    const servicos = await service.listarServicos();
    res.status(200).json(servicos);
  } catch (error) {
    console.error("Erro ao listar serviços via API:", error);
    res.status(500).json({ message: "Erro ao buscar a lista de serviços." });
  }
}

async function handleListarServicosConcluidos(req, res) {
  try {
    const servicos = await service.listarServicosConcluidos();
    res.status(200).json(servicos);
  } catch (error) {
    console.error("Erro ao listar serviços concluídos via API:", error);
    res
      .status(500)
      .json({ message: "Erro ao buscar a lista de serviços concluídos." });
  }
}

async function handleObterResponsaveis(req, res) {
  try {
    const responsaveis = await service.obterResponsaveis();
    res.status(200).json(responsaveis);
  } catch (error) {
    console.error("Erro ao obter responsáveis via API:", error);
    res
      .status(500)
      .json({ message: "Erro ao buscar a lista de responsáveis." });
  }
}

async function handleObterDadosServico(req, res) {
  try {
    const servico = await service.obterServicoCompletoPorId(req.params.id);
    res.status(200).json(servico);
  } catch (error) {
    console.error("Erro ao buscar dados do serviço via API:", error);
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function handleObterDadosPonto(req, res) {
  try {
    const { idPonto } = req.params;
    const ponto = await service.obterPontoCompletoPorId(idPonto);
    res.status(200).json({ ponto });
  } catch (error) {
    console.error("Erro ao buscar dados do ponto via API:", error);
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function handleCriarServico(req, res) {
  try {
    const { id: novoServicoId } = await service.criarServico(
      req.body,
      req.files
    );
    await registrarAuditoria(
      req.session.user.matricula,
      "CRIAR_SERVICO_INSPECAO",
      `Serviço de Inspeção criado (ID: ${novoServicoId}, Processo: ${req.body.processo})`
    );
    res.status(201).json({
      message: "Serviço de inspeção criado com sucesso!",
      servicoId: novoServicoId,
    });
  } catch (error) {
    console.error("Erro ao criar serviço de inspeção:", error);
    const statusCode = error.message.includes("obrigatórios") ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function handleAdicionarAnexosGerais(req, res) {
  try {
    const { id } = req.params;
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "Nenhum arquivo foi enviado." });
    }
    await service.adicionarAnexosGerais(id, req.files);
    await registrarAuditoria(
      req.session.user.matricula,
      "UPLOAD_ANEXO_GERAL_INSPECAO",
      `${req.files.length} anexo(s) geral(is) adicionado(s) ao Serviço ID ${id}.`
    );
    res.status(200).json({ message: "Anexo(s) adicionado(s) com sucesso!" });
  } catch (error) {
    console.error("Erro ao adicionar anexos gerais:", error);
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function handleAtribuirResponsaveis(req, res) {
  try {
    const { id: idServico } = req.params;
    const { responsaveis_matriculas } = req.body;
    await service.atribuirResponsaveis(idServico, responsaveis_matriculas);
    await registrarAuditoria(
      req.session.user.matricula,
      "ATRIBUIR_RESPONSAVEIS_INSPECAO",
      `Equipe de execução atribuída ao Serviço de Inspeção ID ${idServico}.`
    );
    const responsaveis = await service.obterResponsaveis();
    const nomes = responsaveis
      .filter((r) => responsaveis_matriculas.includes(String(r.matricula)))
      .map((r) => r.nome)
      .join(", ");
    res.status(200).json({
      message: "Responsáveis atribuídos com sucesso!",
      nomesResponsaveis: nomes || "Pendente",
    });
  } catch (error) {
    console.error("Erro ao atribuir responsáveis:", error);
    res.status(500).json({ message: error.message });
  }
}

async function handleAtualizarServico(req, res) {
  try {
    const { id } = await service.atualizarServico(req.params.id, req.body);
    await registrarAuditoria(
      req.session.user.matricula,
      "ATUALIZAR_SERVICO_INSPECAO",
      `Serviço de Inspeção ID ${id} atualizado.`
    );
    res.status(200).json({
      message: "Serviço de inspeção atualizado com sucesso!",
      servicoId: id,
    });
  } catch (error) {
    console.error("Erro ao atualizar serviço de inspeção:", error);
    const statusCode = error.message.includes("obrigatórios")
      ? 400
      : error.message.includes("não encontrado")
      ? 404
      : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function handleDeletarServico(req, res) {
  try {
    await service.deletarServico(req.params.id);
    await registrarAuditoria(
      req.session.user.matricula,
      "DELETAR_SERVICO_INSPECAO",
      `Serviço de Inspeção ID ${req.params.id} foi excluído.`
    );
    res
      .status(200)
      .json({ message: "Serviço de inspeção excluído com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar serviço de inspeção:", error);
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function handleAdicionarPonto(req, res) {
  try {
    const { id: idServico } = req.params;
    const novoPonto = await service.adicionarPonto(idServico, req.body);
    await registrarAuditoria(
      req.session.user.matricula,
      "ADICIONAR_PONTO_INSPECAO",
      `Novo ponto (ID: ${novoPonto.id}) adicionado ao Serviço de Inspeção ID ${idServico}.`
    );
    res.status(201).json({
      message: "Ponto de inspeção adicionado com sucesso!",
      ponto: novoPonto,
    });
  } catch (error) {
    console.error("Erro ao adicionar ponto de inspeção:", error);
    const statusCode = error.message.includes("obrigatórios") ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function handleAtualizarPonto(req, res) {
  try {
    const { idPonto } = req.params;
    const pontoAtualizado = await service.atualizarPonto(idPonto, req.body);
    await registrarAuditoria(
      req.session.user.matricula,
      "ATUALIZAR_PONTO_INSPECAO",
      `Ponto de Inspeção ID ${pontoAtualizado.id} foi atualizado.`
    );
    res.status(200).json({
      message: "Ponto de inspeção atualizado com sucesso!",
      ponto: pontoAtualizado,
    });
  } catch (error) {
    console.error("Erro ao atualizar ponto de inspeção:", error);
    const statusCode = error.message.includes("obrigatórios")
      ? 400
      : error.message.includes("não encontrado")
      ? 404
      : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function handleDeletarPonto(req, res) {
  try {
    const { idPonto } = req.params;
    await service.deletarPonto(idPonto);
    await registrarAuditoria(
      req.session.user.matricula,
      "DELETAR_PONTO_INSPECAO",
      `Ponto de Inspeção ID ${idPonto} e seus anexos foram excluídos.`
    );
    res
      .status(200)
      .json({ message: "Ponto de inspeção excluído com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar ponto de inspeção:", error);
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function handleSincronizarPontos(req, res) {
  try {
    const { idServico } = req.params;
    const syncData = req.body;

    const result = await service.sincronizarPontos(idServico, syncData);

    const logMessage =
      `Sincronização de pontos para o Serviço ID ${idServico} concluída. ` +
      `Criados: ${syncData.pontosParaCriar?.length || 0}, ` +
      `Atualizados: ${syncData.pontosParaAtualizar?.length || 0}, ` +
      `Deletados: ${syncData.pontosParaDeletar?.length || 0}.`;

    await registrarAuditoria(
      req.session.user.matricula,
      "SINCRONIZAR_PONTOS_INSPECAO",
      logMessage
    );

    res.status(200).json({
      message: "Pontos sincronizados com sucesso!",
      idMap: result.idMap,
    });
  } catch (error) {
    console.error("Erro no controller ao sincronizar pontos:", error);
    res.status(500).json({
      message: error.message || "Erro interno ao sincronizar pontos.",
    });
  }
}

async function handleAdicionarAnexos(req, res) {
  try {
    const { idServico, idPonto } = req.params;
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "Nenhum arquivo foi enviado." });
    }
    await service.adicionarAnexos(idPonto, idServico, req.files);
    await registrarAuditoria(
      req.session.user.matricula,
      "UPLOAD_ANEXO_INSPECAO",
      `${req.files.length} anexo(s) adicionado(s) ao Ponto ID ${idPonto} (Serviço ID ${idServico}).`
    );
    res.status(201).json({ message: "Anexo(s) adicionado(s) com sucesso!" });
  } catch (error) {
    console.error("Erro ao adicionar anexos:", error);
    res.status(500).json({ message: "Erro interno ao processar anexos." });
  }
}

async function handleDeletarAnexo(req, res) {
  try {
    const { idAnexo } = req.params;
    await service.deletarAnexo(idAnexo);
    await registrarAuditoria(
      req.session.user.matricula,
      "DELETAR_ANEXO_INSPECAO",
      `Anexo de Inspeção ID ${idAnexo} foi excluído.`
    );
    res.status(200).json({ message: "Anexo excluído com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar anexo:", error);
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function handleFinalizarServico(req, res) {
  try {
    const { id } = req.params;
    const { data_finalizacao } = req.body;
    await service.finalizarServico(id, data_finalizacao);
    await registrarAuditoria(
      req.session.user.matricula,
      "FINALIZAR_SERVICO_INSPECAO",
      `Serviço de Inspeção ID ${id} foi finalizado.`
    );
    res.status(200).json({
      message: "Serviço de inspeção finalizado com sucesso!",
      servicoId: id,
    });
  } catch (error) {
    console.error("Erro ao finalizar serviço de inspeção:", error);
    const statusCode = error.message.includes("obrigatória")
      ? 400
      : error.message.includes("não encontrado")
      ? 404
      : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function handleReativarServico(req, res) {
  try {
    const { id } = req.params;
    await service.reativarServico(id);
    await registrarAuditoria(
      req.session.user.matricula,
      "REATIVAR_SERVICO_INSPECAO",
      `Serviço de Inspeção ID ${id} foi reativado.`
    );
    res.status(200).json({
      message: "Serviço de inspeção reativado com sucesso!",
      servicoId: id,
    });
  } catch (error) {
    console.error("Erro ao reativar serviço de inspeção:", error);
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

module.exports = {
  renderizarPaginaListagem,
  renderizarPaginaConcluidos,
  renderizarPaginaCriacao,
  renderizarPaginaDetalhes,
  renderizarPaginaColeta,
  handleGerarRelatorio,
  handleListarServicos,
  handleListarServicosConcluidos,
  handleObterResponsaveis,
  handleObterDadosServico,
  handleObterDadosPonto,
  handleCriarServico,
  handleAdicionarAnexosGerais,
  handleAtribuirResponsaveis,
  handleAtualizarServico,
  handleDeletarServico,
  handleAdicionarPonto,
  handleAtualizarPonto,
  handleDeletarPonto,
  handleAdicionarAnexos,
  handleDeletarAnexo,
  handleSincronizarPontos,
  handleFinalizarServico,
  handleReativarServico,
};
