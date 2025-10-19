const service = require("./diarias.service");
const { registrarAuditoria } = require("../../../auth");

async function listarUltimosProcessos(req, res) {
  try {
    const processos = await service.listarUltimosProcessos(
      req.params.matricula
    );
    res.status(200).json(processos);
  } catch (err) {
    console.error("Erro ao buscar últimos processos do funcionário:", err);
    const statusCode = err.message.includes("obrigatória") ? 400 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function adicionarDiaria(req, res) {
  try {
    const { id, nomeFuncionario } = await service.adicionarDiaria(
      req.body,
      req.user
    );
    await registrarAuditoria(
      req.user.matricula,
      "Adicionar Diária",
      `Matrícula Func: ${req.body.matricula}, Nome: ${nomeFuncionario}, Processo: ${req.body.processo}, Data: ${req.body.data}, ID Diaria: ${id}`
    );
    res.status(201).json({ message: "Diária adicionada com sucesso!", id });
  } catch (err) {
    console.error("Erro ao adicionar diária no banco:", err);
    const statusCode =
      err.message.includes("obrigatórios") ||
      err.message.includes("deve ser selecionado")
        ? 400
        : err.message.includes("já possui uma diária")
        ? 409
        : err.message.includes("não encontrado")
        ? 404
        : err.message.includes("Acesso negado")
        ? 403
        : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function listarDiarias(req, res) {
  try {
    const diarias = await service.listarDiarias(req.query, req.user);
    res.status(200).json(diarias);
  } catch (err) {
    console.error("Erro ao buscar diárias:", err);
    res.status(500).json({ message: "Erro ao buscar diárias!" });
  }
}

async function removerDiaria(req, res) {
  try {
    const detalhesDiaria = await service.removerDiaria(req.params.id);
    await registrarAuditoria(
      req.user.matricula,
      "Remover Diária",
      `ID Diária: ${req.params.id}, Matrícula Func: ${
        detalhesDiaria.matricula
      }, Processo: ${detalhesDiaria.processo}, Data: ${new Date(
        detalhesDiaria.data
      ).toLocaleDateString("pt-BR")}`
    );
    res.status(200).json({ message: "Diária removida com sucesso!" });
  } catch (err) {
    console.error("Erro ao remover diária do banco:", err);
    const statusCode = err.message.includes("não encontrada") ? 404 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function gerarPdfDiarias(req, res) {
  try {
    const pdfBuffer = await service.gerarPdfDiarias(req.body);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Relatorio_Diarias.pdf"
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Erro ao gerar PDF de diárias:", error);
    const statusCode = error.message.includes("insuficientes") ? 400 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
}

module.exports = {
  listarUltimosProcessos,
  adicionarDiaria,
  listarDiarias,
  removerDiaria,
  gerarPdfDiarias,
};
