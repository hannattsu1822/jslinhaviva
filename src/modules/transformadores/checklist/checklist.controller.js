const service = require("./checklist.service");
const { registrarAuditoria } = require("../../../auth");
const { verifyReportToken } = require("../../../shared/reportToken.helper");
const { assertAcessoRecursoProprio } = require("../../../shared/accessControl.helper");

function statusFromError(err, fallback = 500) {
  if (err.statusCode) return err.statusCode;
  if (err.message.includes("não encontrado")) return 404;
  if (err.message.includes("Acesso negado")) return 403;
  return fallback;
}

async function assertAcessoChecklist(id, user) {
  const checklist = await service.obterChecklistPublico(id);
  assertAcessoRecursoProprio(
    user,
    checklist.matricula_responsavel,
    "Acesso negado a este checklist."
  );
  return checklist;
}

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
    const dados = {
      ...req.body,
      matricula_responsavel: req.user.matricula,
    };
    await service.salvarChecklist(dados);
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
  const token = req.query.token;
  const hasValidToken = verifyReportToken(
    token,
    "checklist_transformador",
    req.params.id
  );

  if (!hasValidToken) {
    return res.status(403).json({ message: "Token inválido ou expirado." });
  }

  try {
    const checklist = await service.obterChecklistPublico(req.params.id);
    res.status(200).json(checklist);
  } catch (err) {
    console.error("Erro API /checklist_transformadores_publico:", err);
    const statusCode = err.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function obterChecklistAutenticado(req, res) {
  try {
    const checklist = await assertAcessoChecklist(req.params.id, req.user);
    res.status(200).json(checklist);
  } catch (err) {
    console.error("Erro API /checklist_transformadores:", err);
    res.status(statusFromError(err)).json({ message: err.message });
  }
}

async function excluirChecklist(req, res) {
  try {
    await assertAcessoChecklist(req.params.id, req.user);
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
    await assertAcessoChecklist(id, req.user);
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
    console.error("❌ [DEBUG PDF] Erro ao gerar PDF da tabela:", error);
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
  obterChecklistAutenticado,
  excluirChecklist,
  filtrarChecklists,
  gerarPdfChecklist,
  gerarPdfTabela,
};
