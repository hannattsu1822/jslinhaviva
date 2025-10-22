const service = require("./bas.service");
const { registrarAuditoria } = require("../../../auth");

async function importarDadosProcessos(req, res) {
  try {
    const { importedCount, skippedEnergizada, skippedDuplicata, connection } =
      await service.importarDadosProcessos(req.file, req.body.planilhaTipo);
    await registrarAuditoria(
      req.user.matricula,
      "Importação BAS Processos",
      `${importedCount} registros importados via ${req.body.planilhaTipo}.`,
      connection
    );
    res.status(200).json({
      message: `${importedCount} registros importados. ${skippedEnergizada} não processadas. ${skippedDuplicata} duplicatas.`,
    });
  } catch (error) {
    console.error("Erro ao importar dados de processos BAS:", error);
    const statusCode =
      error.message.includes("Nenhum arquivo") ||
      error.message.includes("obrigatório") ||
      error.message.includes("vazia") ||
      error.message.includes("Cabeçalhos") ||
      error.message.includes("desconhecido")
        ? 400
        : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function obterInfoUsuario(req, res) {
  try {
    const userInfo = await service.obterInfoUsuario(req.query.matricula);
    res.json(userInfo);
  } catch (error) {
    console.error("Erro API /user-info:", error);
    const statusCode = error.message.includes("obrigatória")
      ? 400
      : error.message.includes("não encontrado")
      ? 404
      : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function listarProcessosConstrucao(req, res) {
  try {
    const processos = await service.listarProcessosConstrucao();
    res.json(processos);
  } catch (error) {
    console.error("Erro API /processos-construcao:", error);
    res
      .status(500)
      .json({ message: "Erro ao buscar processos de Construção." });
  }
}

async function listarProcessosLinhaViva(req, res) {
  try {
    const processos = await service.listarProcessosLinhaViva();
    res.json(processos);
  } catch (error) {
    console.error("Erro API /processos-linhaviva:", error);
    res
      .status(500)
      .json({ message: "Erro ao buscar processos de Linha Viva." });
  }
}

async function salvarCadastroBas(req, res) {
  try {
    const { connection, detalhesProcesso } = await service.salvarCadastroBas(
      req.body
    );
    await registrarAuditoria(
      req.user.matricula,
      "Cadastro BAS",
      `BAS para processo ${detalhesProcesso.processo} (ID ${detalhesProcesso.id}) salvo.`,
      connection
    );
    res
      .status(200)
      .json({
        message: "BAS cadastrado e colaboradores associados com sucesso!",
      });
  } catch (error) {
    console.error("Erro ao salvar cadastro BAS:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ message: "Colaborador já associado a este BAS de processo." });
    }
    const statusCode = error.message.includes("incompletos")
      ? 400
      : error.message.includes("não encontrado")
      ? 404
      : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function gerarRelatorioTxt(req, res) {
  try {
    const { txtContent, nomeArquivo, userInfo, totalProcessos } =
      await service.gerarRelatorioTxt(req.body);
    if (!nomeArquivo) {
      return res.status(200).send("");
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=${nomeArquivo}`);
    res.send(txtContent);
    await registrarAuditoria(
      req.user.matricula,
      "Geração Relatório TXT BAS Construção",
      `Relatório TXT "${nomeArquivo}" gerado para matrícula ${req.body.matricula} (colaborador: ${userInfo.nome}), person_id: ${userInfo.person_id}, razão ${req.body.razao}, período ${req.body.dataInicio} a ${req.body.dataFim}. Total de ${totalProcessos} processos.`
    );
  } catch (error) {
    console.error("Erro ao gerar relatório TXT BAS Construção:", error);
    if (!res.headersSent) {
      const statusCode = error.message.includes("obrigatórios")
        ? 400
        : error.message.includes("não encontrado") ||
          error.message.includes("não possui um person_id")
        ? 404
        : 500;
      res.status(statusCode).json({ message: error.message });
    }
  }
}

async function gerarRelatorioTxtLinhaViva(req, res) {
  try {
    const { txtContent, nomeArquivo, userInfo, totalProcessos } =
      await service.gerarRelatorioTxtLinhaViva(req.body);
    if (!nomeArquivo) {
      return res.status(200).send("");
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=${nomeArquivo}`);
    res.send(txtContent);
    await registrarAuditoria(
      req.user.matricula,
      "Geração Relatório TXT BAS Linha Viva Consolidado",
      `Relatório TXT "${nomeArquivo}" gerado para matrícula ${req.body.matricula}, person_id: ${userInfo.person_id}, razão ${req.body.razao}, período ${req.body.dataInicio} a ${req.body.dataFim}. Total de ${totalProcessos} processos (Linha Viva + Subestação).`
    );
  } catch (error) {
    console.error(
      "Erro ao gerar relatório TXT BAS Linha Viva Consolidado:",
      error
    );
    if (!res.headersSent) {
      const statusCode = error.message.includes("obrigatórios")
        ? 400
        : error.message.includes("não encontrado") ||
          error.message.includes("não possui um person_id")
        ? 404
        : 500;
      res.status(statusCode).json({ message: error.message });
    }
  }
}

module.exports = {
  importarDadosProcessos,
  obterInfoUsuario,
  listarProcessosConstrucao,
  listarProcessosLinhaViva,
  salvarCadastroBas,
  gerarRelatorioTxt,
  gerarRelatorioTxtLinhaViva,
};
