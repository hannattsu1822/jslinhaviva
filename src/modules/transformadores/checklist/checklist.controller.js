const service = require("./checklist.service");
const { registrarAuditoria } = require("../../../auth");

async function listarTrafosSemChecklist(req, res) {
  try {
    const trafos = await service.listarTrafosSemChecklist();
    res.status(200).json(trafos);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Erro ao buscar transformadores sem checklist!" });
  }
}

async function listarTrafosDaRemessa(req, res) {
  try {
    const { dataRemessaInicial, dataRemessaFinal } = req.query;
    const trafos = await service.listarTrafosDaRemessa(
      dataRemessaInicial,
      dataRemessaFinal
    );
    res.status(200).json(trafos);
  } catch (err) {
    console.error("Erro API /trafos_da_remessa_para_checklist_v2:", err);
    const statusCode = err.message.includes("obrigatório") ? 400 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function obterHistoricoRemessas(req, res) {
  try {
    const { numero_serie } = req.params;
    const datasRemessa = await service.obterHistoricoRemessas(numero_serie);
    res.status(200).json({
      numero_serie: numero_serie,
      quantidade_remessas: datasRemessa.length,
      datas_remessas_anteriores: datasRemessa,
    });
  } catch (err) {
    console.error("Erro API /historico_remessas_transformador:", err);
    res.status(500).json({ message: "Erro ao buscar histórico de remessas!" });
  }
}

async function salvarChecklist(req, res) {
  try {
    await service.salvarChecklist(req.body);
    await registrarAuditoria(
      req.user.matricula,
      "Salvar Checklist",
      `Checklist manual: ${req.body.numero_serie}`
    );
    res.status(201).json({ message: "Checklist salvo com sucesso!" });
  } catch (error) {
    const statusCode = error.message.includes("obrigatórios") ? 400 : 500;
    res
      .status(statusCode)
      .json({ message: "Erro ao salvar checklist: " + error.message });
  }
}

async function obterChecklistPublico(req, res) {
  try {
    const checklist = await service.obterChecklistPublico(req.params.id);
    res.status(200).json(checklist);
  } catch (err) {
    console.error("Erro API /checklist_transformadores_publico:", err);
    const statusCode = err.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function excluirChecklist(req, res) {
  try {
    await service.excluirChecklist(req.params.id);
    await registrarAuditoria(
      req.user.matricula,
      "Excluir Checklist",
      `Checklist ID: ${req.params.id} excluído.`
    );
    res
      .status(200)
      .json({ message: "Checklist de transformador excluído com sucesso!" });
  } catch (err) {
    if (err.code === "ER_ROW_IS_REFERENCED_2") {
      return res
        .status(400)
        .json({
          message: "Não é possível excluir: referenciado em outros registros.",
        });
    }
    const statusCode = err.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function filtrarChecklists(req, res) {
  try {
    const checklists = await service.filtrarChecklists(req.body);
    res.status(200).json(checklists);
  } catch (err) {
    console.error("Erro ao filtrar checklists:", err);
    res.status(500).json({ message: "Erro ao filtrar checklists" });
  }
}

async function gerarPdfChecklist(req, res) {
  let browser;
  try {
    const { id } = req.params;
    const { nomeArquivo, pdfBuffer } = await service.gerarPdfChecklist(
      id,
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
    if (!res.headersSent) {
      const statusCode = err.message.includes("não encontrado") ? 404 : 500;
      res
        .status(statusCode)
        .json({ message: "Erro ao gerar PDF!", error: err.message });
    }
  }
}

async function gerarPdfTabela(req, res) {
  if (!req.user?.nome) {
    return res
      .status(401)
      .json({ success: false, message: "Usuário não autenticado." });
  }
  try {
    const pdfBuffer = await service.gerarPdfTabela(
      req.body.dados,
      req.body.filtros,
      req.user
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Relatorio_Checklists_Transformadores.pdf"
    );
    res.send(pdfBuffer);
  } catch (error) {
    if (!res.headersSent) {
      const statusCode = error.message.includes("Nenhum dado") ? 400 : 500;
      res.status(statusCode).json({ success: false, message: error.message });
    }
  }
}

module.exports = {
  listarTrafosSemChecklist,
  listarTrafosDaRemessa,
  obterHistoricoRemessas,
  salvarChecklist,
  obterChecklistPublico,
  excluirChecklist,
  filtrarChecklists,
  gerarPdfChecklist,
  gerarPdfTabela,
};
