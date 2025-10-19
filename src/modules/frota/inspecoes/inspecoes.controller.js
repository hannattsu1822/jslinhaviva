const service = require("./inspecoes.service");
const { registrarAuditoria } = require("../../../auth");

async function listarInspecoes(req, res) {
  try {
    const inspecoes = await service.listarInspecoes();
    res.status(200).json(inspecoes);
  } catch (err) {
    console.error("Erro ao buscar inspeções:", err);
    res.status(500).json({ message: "Erro ao buscar inspeções!" });
  }
}

async function obterInspecaoPorId(req, res) {
  try {
    const inspecao = await service.obterInspecaoPorId(req.params.id);
    res.status(200).json(inspecao);
  } catch (err) {
    console.error("Erro ao buscar inspeção:", err);
    const statusCode = err.message.includes("não encontrada") ? 404 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function salvarInspecao(req, res) {
  try {
    await service.salvarInspecao(req.body);
    await registrarAuditoria(
      req.body.matricula,
      "Salvar Inspeção",
      `Inspeção salva para placa: ${req.body.placa}` +
        (req.body.agendamento_id
          ? ` (Agendamento ID: ${req.body.agendamento_id})`
          : "")
    );
    res.status(201).json({ message: "Inspeção salva com sucesso!" });
  } catch (err) {
    console.error("Erro ao salvar inspeção:", err);
    const statusCode =
      err.message.includes("obrigatórios") ||
      err.message.includes("positivos") ||
      err.message.includes("Agendamento não encontrado")
        ? 400
        : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function filtrarInspecoes(req, res) {
  try {
    const inspecoes = await service.filtrarInspecoes(req.body);
    res.status(200).json(inspecoes);
  } catch (err) {
    console.error("Erro ao filtrar inspeções:", err);
    res.status(500).json({ message: "Erro ao filtrar inspeções!" });
  }
}

async function excluirInspecao(req, res) {
  try {
    await service.excluirInspecao(req.params.id);
    await registrarAuditoria(
      req.user.matricula,
      "Excluir Inspeção",
      `Inspeção excluída com ID: ${req.params.id}`
    );
    res.status(200).json({ message: "Inspeção excluída com sucesso!" });
  } catch (err) {
    console.error("Erro ao excluir inspeção:", err);
    const statusCode = err.message.includes("não encontrada") ? 404 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function atualizarInspecao(req, res) {
  try {
    await service.atualizarInspecao(req.params.id, req.body);
    await registrarAuditoria(
      req.user.matricula,
      "Editar Inspeção",
      `Inspeção editada com ID: ${req.params.id}`
    );
    res.status(200).json({ message: "Inspeção atualizada com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar inspeção:", err);
    const statusCode =
      err.message.includes("faltando") ||
      err.message.includes("positivos") ||
      err.message.includes("Nenhum dado")
        ? 400
        : err.message.includes("não encontrada")
        ? 404
        : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function obterUltimoHorimetro(req, res) {
  try {
    const horimetro = await service.obterUltimoHorimetro(req.query.placa);
    res.status(200).json(horimetro);
  } catch (error) {
    console.error("Erro ao buscar horímetro:", error);
    const statusCode = error.message.includes("obrigatória")
      ? 400
      : error.message.includes("Nenhuma inspeção")
      ? 404
      : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function gerarPdfInspecao(req, res) {
  try {
    const { nomeArquivo, pdfBuffer } = await service.gerarPdfInspecao(
      req.params.id,
      req.protocol,
      req.get("host")
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nomeArquivo}"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Erro ao gerar PDF de inspeção de veículo:", err);
    if (!res.headersSent) {
      const statusCode = err.message.includes("não encontrada") ? 404 : 500;
      res.status(statusCode).json({
        message: err.message,
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  }
}

async function obterInspecaoPublica(req, res) {
  try {
    const inspecao = await service.obterInspecaoPorId(req.params.id);
    res.status(200).json(inspecao);
  } catch (err) {
    console.error("Erro ao buscar inspeção pública:", err);
    const statusCode = err.message.includes("não encontrada") ? 404 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

module.exports = {
  listarInspecoes,
  obterInspecaoPorId,
  salvarInspecao,
  filtrarInspecoes,
  excluirInspecao,
  atualizarInspecao,
  obterUltimoHorimetro,
  gerarPdfInspecao,
  obterInspecaoPublica,
};
