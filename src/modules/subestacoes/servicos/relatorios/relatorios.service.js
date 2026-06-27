const { promisePool } = require("../../../../infrastructure/database");
const { uploadsSubestacoesDir } = require("../../../../infrastructure/uploads");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const { publicPage } = require("../../../../shared/path.helper");
const { escapeHtml } = require("../../../../shared/htmlEscape.helper");
const {
  wrapReportHtml,
  htmlToPdf,
  mergePdfAttachments,
  formatReportDate,
} = require("../../../../shared/reports/pdfReport.service");
const {
  renderStatusBadge,
  gerarGaleriaHtml,
  gerarListaDocumentosHtml,
  applyTemplatePlaceholders,
} = require("../../../../shared/reports/reportHtml.helper");

async function processarImagensParaUrlLocal(anexos) {
  if (!anexos || anexos.length === 0) {
    return [];
  }
  const imagens = anexos.filter(
    (anexo) => anexo.tipo_mime && anexo.tipo_mime.startsWith("image/")
  );

  return imagens
    .map((img) => {
      if (!img.caminho_servidor) return null;
      const serverUrl = process.env.SERVER_URL || "http://localhost:3000";
      const imageUrl = `${serverUrl}${img.caminho_servidor}`;
      return { src: imageUrl, nome: img.nome_original };
    })
    .filter(Boolean);
}

function gerarListaDocumentosHtmlSubestacao(anexos) {
  if (!anexos || anexos.length === 0) {
    return '<p class="lv-empty">Nenhum documento encontrado.</p>';
  }
  const documentos = anexos.filter(
    (anexo) => !anexo.tipo_mime || !anexo.tipo_mime.startsWith("image/")
  );
  return gerarListaDocumentosHtml(documentos);
}

async function preencherTemplateHtmlServicoSubestacao(servicoData) {
  const templatePath = publicPage("templates/relatorio_servico_subestacao.html");
  let templateHtml = await fsPromises.readFile(templatePath, "utf-8");

  const formatarData = (dataStr) => {
    if (!dataStr) return "N/A";
    const dataObj = new Date(dataStr);
    return isNaN(dataObj.getTime())
      ? "Data inválida"
      : new Date(
          dataObj.getTime() + dataObj.getTimezoneOffset() * 60000
        ).toLocaleDateString("pt-BR");
  };
  const formatarHora = (horaStr) =>
    horaStr && typeof horaStr === "string" ? horaStr.substring(0, 5) : "N/A";

  let itensEscopoHtml = "";
  if (servicoData.itens_escopo && servicoData.itens_escopo.length > 0) {
    for (const item of servicoData.itens_escopo) {
      const statusTexto = (item.status_item_escopo || "PENDENTE").replace(
        /_/g,
        " "
      );
      const imagensItemLocal = await processarImagensParaUrlLocal(
        item.anexos || []
      );
      const galeriaItemHtml = gerarGaleriaHtml(imagensItemLocal);
      itensEscopoHtml += `
        <div class="lv-item-card">
          <p class="lv-item-card__title">${escapeHtml(
            item.descricao_item_servico
          )}</p>
          <div class="lv-item-card__meta">
            <p><strong>TAG:</strong> ${escapeHtml(
              item.tag_equipamento_alvo || "N/A"
            )} · <strong>Encarregado:</strong> ${escapeHtml(
        item.encarregado_item_nome || "N/A"
      )} · <strong>Status:</strong> ${renderStatusBadge(statusTexto)}</p>
            ${
              item.observacoes_conclusao_item
                ? `<p><strong>Obs. Conclusão:</strong> ${escapeHtml(item.observacoes_conclusao_item)}</p>`
                : ""
            }
            ${galeriaItemHtml}
          </div>
        </div>`;
    }
  } else {
    itensEscopoHtml =
      '<p class="lv-empty">Nenhum item de escopo detalhado para este serviço.</p>';
  }

  const anexosGerais = servicoData.anexos || [];
  const galeriaAnexosGerais = gerarGaleriaHtml(
    await processarImagensParaUrlLocal(anexosGerais),
    4
  );
  const listaDocumentosGerais = gerarListaDocumentosHtmlSubestacao(anexosGerais);
  const statusFinalTexto = (servicoData.status || "N/A").replace(/_/g, " ");

  const dadosParaTemplate = {
    processo: escapeHtml(servicoData.processo || "N/A"),
    subestacao_nome: escapeHtml(servicoData.subestacao_nome),
    subestacao_sigla: escapeHtml(servicoData.subestacao_sigla),
    tipo_ordem: escapeHtml(servicoData.tipo_ordem || "N/A"),
    prioridade: escapeHtml(servicoData.prioridade || "N/A"),
    responsavel_nome: escapeHtml(servicoData.responsavel_nome || "N/A"),
    data_prevista: formatarData(servicoData.data_prevista),
    horario_previsto: `${formatarHora(
      servicoData.horario_inicio
    )} às ${formatarHora(servicoData.horario_fim)}`,
    motivo: escapeHtml(servicoData.motivo || "Nenhum."),
    itens_escopo_html: itensEscopoHtml,
    status_final_badge: renderStatusBadge(statusFinalTexto),
    data_conclusao: formatarData(servicoData.data_conclusao),
    horario_fim: formatarHora(servicoData.horario_fim),
    observacoes_conclusao: escapeHtml(
      servicoData.observacoes_conclusao || "Nenhuma."
    ),
    galeria_anexos_gerais: galeriaAnexosGerais,
    lista_documentos_gerais: listaDocumentosGerais,
  };

  templateHtml = applyTemplatePlaceholders(templateHtml, dadosParaTemplate);

  return wrapReportHtml(templateHtml, {
    title: "Relatório Final de Serviço de Subestação",
    badge: "Subestações",
    processo: servicoData.processo || "N/A",
    generatedAt: formatReportDate(),
    author: servicoData.responsavel_nome || "",
  });
}

async function gerarPdfRelatorio(servicoId) {
  const connection = await promisePool.getConnection();
  try {
    const [servicoRows] = await connection.query(
      `SELECT ss.*, s.sigla as subestacao_sigla, s.nome as subestacao_nome, u.nome as responsavel_nome FROM servicos_subestacoes ss JOIN subestacoes s ON ss.subestacao_id = s.id JOIN users u ON ss.responsavel_id = u.id WHERE ss.id = ?`,
      [servicoId]
    );
    if (servicoRows.length === 0) {
      throw new Error("Serviço não encontrado");
    }
    const servicoData = servicoRows[0];

    const [anexosGerais] = await connection.query(
      `SELECT * FROM servicos_subestacoes_anexos WHERE id_servico = ?`,
      [servicoId]
    );
    const [itensEscopo] = await connection.query(
      `SELECT sie.*, u.nome as encarregado_item_nome FROM servico_itens_escopo sie LEFT JOIN users u ON sie.encarregado_item_id = u.id WHERE sie.servico_id = ?`,
      [servicoId]
    );

    for (const item of itensEscopo) {
      const [anexosItem] = await connection.query(
        `SELECT * FROM servico_item_escopo_anexos WHERE item_escopo_id = ?`,
        [item.id]
      );
      item.anexos = anexosItem;
    }
    servicoData.anexos = anexosGerais;
    servicoData.itens_escopo = itensEscopo;

    const htmlContent = await preencherTemplateHtmlServicoSubestacao(
      servicoData
    );

    const pdfBuffer = await htmlToPdf(htmlContent, {
      landscape: true,
      footerOnly: true,
    });

    const pdfAttachmentPaths = (servicoData.anexos || [])
      .filter((anexo) => anexo.tipo_mime === "application/pdf")
      .map((anexo) => {
        const caminhoRelativo = anexo.caminho_servidor.replace(
          "/upload_arquivos_subestacoes/",
          ""
        );
        return path.join(uploadsSubestacoesDir, caminhoRelativo);
      });

    const finalBuffer = await mergePdfAttachments(
      pdfBuffer,
      pdfAttachmentPaths
    );

    const nomeArquivo = `relatorio_servico_${(
      servicoData.processo || servicoId
    ).replace(/\//g, "-")}.pdf`;
    return { nomeArquivo, pdfBytes: finalBuffer };
  } finally {
    connection.release();
  }
}

module.exports = {
  gerarPdfRelatorio,
};
