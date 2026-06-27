const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const { promisePool } = require("../../../infrastructure/database");
const { projectRootDir, publicPage } = require("../../../shared/path.helper");
const { escapeHtml } = require("../../../shared/htmlEscape.helper");
const {
  wrapReportHtml,
  htmlToPdf,
  mergePdfAttachments,
  formatReportDate,
} = require("../../../shared/reports/pdfReport.service");
const {
  renderStatusBadge,
  gerarGaleriaHtml,
  gerarListaDocumentosHtml,
  renderInfoItem,
  renderTextBlock,
} = require("../../../shared/reports/reportHtml.helper");

async function processarImagensParaBase64(imagens) {
  const imagensProcessadas = await Promise.all(
    imagens.map(async (img) => {
      if (!img.caminho) return null;
      const caminhoRelativo = img.caminho.replace("/api/upload_arquivos/", "");
      const caminhoFisico = path.join(
        projectRootDir,
        "upload_arquivos",
        caminhoRelativo
      );

      if (fs.existsSync(caminhoFisico)) {
        try {
          const buffer = await fsPromises.readFile(caminhoFisico);
          const ext = path.extname(img.nomeOriginal).substring(1);
          return {
            src: `data:image/${ext};base64,${buffer.toString("base64")}`,
            nome: img.nomeOriginal,
          };
        } catch (e) {
          console.error(`Erro ao ler o arquivo de imagem: ${caminhoFisico}`, e);
          return null;
        }
      }
      return null;
    })
  );
  return imagensProcessadas.filter(Boolean);
}

function formatarData(dataStr, comHora = false) {
  if (!dataStr) return "N/A";
  const options = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  };
  if (comHora) {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }
  const dataObj = new Date(dataStr);
  if (isNaN(dataObj.getTime())) return "Data inválida";
  return dataObj.toLocaleDateString("pt-BR", options);
}

async function preencherTemplateHtml(servicoData) {
  const templatePath = publicPage("templates/relatorio_servico.html");
  let templateHtml = await fsPromises.readFile(templatePath, "utf-8");

  const todasAsImagens = servicoData.anexos.filter((anexo) =>
    ["imagem", "foto_conclusao", "foto_nao_conclusao"].includes(anexo.tipo)
  );
  const anexosPDF = servicoData.anexos.filter(
    (anexo) => anexo.caminho && anexo.caminho.toLowerCase().endsWith(".pdf")
  );

  const imagensBase64 = await processarImagensParaBase64(todasAsImagens);
  const galeriaGeralHtml = gerarGaleriaHtml(imagensBase64);
  const listaAnexosPdfHtml = gerarListaDocumentosHtml(
    anexosPDF,
    "Nenhum documento PDF foi anexado a este serviço."
  );

  let listaResponsaveisHtml =
    '<p class="lv-empty">Nenhum responsável atribuído.</p>';
  if (servicoData.responsaveis && servicoData.responsaveis.length > 0) {
    listaResponsaveisHtml = `
      <table class="lv-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Matrícula</th>
            <th>Status</th>
            <th>Data Conclusão</th>
            <th>Observações</th>
          </tr>
        </thead>
        <tbody>
          ${servicoData.responsaveis
            .map(
              (resp) => `
            <tr>
              <td>${escapeHtml(resp.nome || "N/A")}</td>
              <td>${escapeHtml(resp.responsavel_matricula || "N/A")}</td>
              <td>${renderStatusBadge(resp.status_individual || "N/A")}</td>
              <td>${
                resp.data_conclusao_individual
                  ? new Date(resp.data_conclusao_individual).toLocaleString(
                      "pt-BR"
                    )
                  : "N/A"
              }</td>
              <td>${escapeHtml(resp.observacoes_individuais || "")}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  }

  const statusFinalTexto =
    servicoData.status === "concluido" ? "Concluído" : "Não Concluído";

  const detalhesServicoGrid = [
    renderInfoItem("Processo", escapeHtml(servicoData.processo || "N/A")),
    renderInfoItem("ID do Serviço", escapeHtml(String(servicoData.id))),
    renderInfoItem(
      "Data Prevista",
      formatarData(servicoData.data_prevista_execucao)
    ),
    renderInfoItem("Tipo", escapeHtml(servicoData.tipo || "N/A")),
    renderInfoItem("Subestação", escapeHtml(servicoData.subestacao || "N/A")),
    renderInfoItem("Alimentador", escapeHtml(servicoData.alimentador || "N/A")),
    renderInfoItem(
      "Chave Montante",
      escapeHtml(servicoData.chave_montante || "N/A")
    ),
    renderInfoItem(
      "Desligamento",
      escapeHtml(
        `${servicoData.desligamento || "N/A"} ${
          servicoData.desligamento === "SIM"
            ? `(${servicoData.hora_inicio || ""} - ${servicoData.hora_fim || ""})`
            : ""
        }`
      )
    ),
    renderInfoItem(
      "Descrição do Serviço",
      renderTextBlock(
        escapeHtml(servicoData.descricao_servico || "Nenhuma.")
      ),
      true
    ),
    renderInfoItem(
      "Observações Iniciais",
      renderTextBlock(escapeHtml(servicoData.observacoes || "Nenhuma.")),
      true
    ),
  ].join("");

  let detalhesFinalizacaoGrid = [
    renderInfoItem("Status Final", renderStatusBadge(statusFinalTexto)),
    renderInfoItem(
      "Data da Finalização",
      formatarData(servicoData.data_conclusao, true)
    ),
    renderInfoItem(
      "Responsável pela Finalização",
      escapeHtml(
        `${servicoData.responsavel_nome || "N/A"} (${
          servicoData.responsavel_matricula || "N/A"
        })`
      ),
      true
    ),
  ];

  if (servicoData.status === "nao_concluido") {
    detalhesFinalizacaoGrid.push(
      renderInfoItem(
        "Motivo da Não Conclusão",
        renderTextBlock(
          escapeHtml(servicoData.motivo_nao_conclusao || "Nenhum.")
        ),
        true
      )
    );
  }

  detalhesFinalizacaoGrid.push(
    renderInfoItem(
      "Observações da Conclusão",
      renderTextBlock(
        escapeHtml(servicoData.observacoes_conclusao || "Nenhuma.")
      ),
      true
    )
  );

  const dadosParaTemplate = {
    detalhes_servico_grid: detalhesServicoGrid,
    lista_responsaveis: listaResponsaveisHtml,
    detalhes_finalizacao_grid: detalhesFinalizacaoGrid.join(""),
    galeria_geral: galeriaGeralHtml,
    lista_anexos_pdf: listaAnexosPdfHtml,
  };

  for (const key in dadosParaTemplate) {
    const regex = new RegExp(`{{${key}}}`, "g");
    templateHtml = templateHtml.replace(regex, dadosParaTemplate[key]);
  }

  return wrapReportHtml(templateHtml, {
    title: "Relatório Final de Serviço de Redes de Distribuição",
    badge: "Gestão de Serviços",
    processo: servicoData.processo || "N/A",
    generatedAt: formatReportDate(),
    author: servicoData.responsavel_nome
      ? `${servicoData.responsavel_nome} (${servicoData.responsavel_matricula || "N/A"})`
      : "",
  });
}

async function gerarPdfConsolidado(servicoId) {
  const connection = await promisePool.getConnection();
  try {
    const [servicoRows] = await connection.query(
      `
      SELECT
          p.*,
          p.status_geral AS status,
          u_finalizador.nome AS responsavel_nome,
          u_finalizador.matricula AS responsavel_matricula
      FROM
          processos p
      LEFT JOIN (
          SELECT
              sr.servico_id,
              sr.responsavel_matricula
          FROM
              servicos_responsaveis sr
          INNER JOIN (
              SELECT servico_id, MAX(data_conclusao_individual) as max_data
              FROM servicos_responsaveis
              WHERE servico_id = ?
              GROUP BY servico_id
          ) as max_sr ON sr.servico_id = max_sr.servico_id AND sr.data_conclusao_individual = max_sr.max_data
      ) AS ultimo_responsavel ON p.id = ultimo_responsavel.servico_id
      LEFT JOIN users u_finalizador ON ultimo_responsavel.responsavel_matricula = u_finalizador.matricula
      WHERE p.id = ?;
    `,
      [servicoId, servicoId]
    );

    if (servicoRows.length === 0) {
      throw new Error("Serviço não encontrado");
    }
    const [anexos] = await connection.query(
      `SELECT id, nome_original as nomeOriginal, caminho_servidor as caminho, tipo_anexo as tipo FROM processos_anexos WHERE processo_id = ?`,
      [servicoId]
    );
    const [responsaveis] = await connection.query(
      `SELECT sr.*, u.nome FROM servicos_responsaveis sr JOIN users u ON sr.responsavel_matricula = u.matricula WHERE sr.servico_id = ?`,
      [servicoId]
    );

    const servicoData = { ...servicoRows[0], anexos, responsaveis };
    const htmlContent = await preencherTemplateHtml(servicoData);

    const pdfBuffer = await htmlToPdf(htmlContent, {
      landscape: true,
      headerMeta: {
        title: "Relatório de Serviço — Redes de Distribuição",
        subtitle: servicoData.processo || "",
      },
    });

    const pdfAttachmentPaths = anexos
      .filter(
        (anexo) => anexo.caminho && anexo.caminho.toLowerCase().endsWith(".pdf")
      )
      .map((anexo) => {
        const caminhoRelativo = anexo.caminho.replace(
          "/api/upload_arquivos/",
          ""
        );
        return path.join(projectRootDir, "upload_arquivos", caminhoRelativo);
      });

    const finalBuffer = await mergePdfAttachments(
      pdfBuffer,
      pdfAttachmentPaths
    );

    return {
      nomeArquivo: `relatorio_servico_${(
        servicoData.processo || servicoId
      ).replace(/\//g, "-")}.pdf`,
      buffer: finalBuffer,
    };
  } finally {
    connection.release();
  }
}

module.exports = {
  gerarPdfConsolidado,
};
