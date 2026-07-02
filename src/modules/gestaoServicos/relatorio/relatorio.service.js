const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const { promisePool } = require("../../../infrastructure/database");
const { projectRootDir } = require("../../../shared/path.helper");
const { escapeHtml } = require("../../../shared/htmlEscape.helper");
const {
  renderServicoDetailsReport,
  htmlToPdf,
  formatReportDate,
  buildDocumentCode,
} = require("../../../shared/reports/pdfReport.service");
const {
  gerarAnexosDetalhesPdfHtml,
  renderPdfField,
  renderPdfStatusBadge,
} = require("../../../shared/reports/reportHtml.helper");
const {
  buildPublicAnexoViewUrl,
  createPublicAnexoToken,
} = require("../../../shared/reports/publicAnexoUrl.helper");

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
          const ext = path.extname(img.nomeOriginal).substring(1) || "jpeg";
          return {
            src: `data:image/${ext};base64,${buffer.toString("base64")}`,
            nome: img.nomeOriginal,
            tipo: img.tipo,
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
  if (!dataStr) return "Não informado";
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

function formatarHora(horaString) {
  if (!horaString) return "Não informado";
  const partes = String(horaString).split(":");
  if (partes.length >= 2) return `${partes[0]}:${partes[1]}`;
  return horaString;
}

function statusLabel(status) {
  const map = {
    ativo: "Ativo",
    em_progresso: "Em Progresso",
    concluido: "Concluído",
    nao_concluido: "Não Concluído",
  };
  return map[status] || status || "Não informado";
}

async function preencherTemplateHtml(servicoData, options = {}) {
  const { baseUrl = "" } = options;
  const anexos = servicoData.anexos || [];
  const responsaveis = servicoData.responsaveis || [];
  const imagens = anexos.filter((anexo) =>
    ["imagem", "foto_conclusao", "foto_nao_conclusao"].includes(anexo.tipo)
  );

  const imagensBase64 = await processarImagensParaBase64(imagens);
  const anexosParaGrid = anexos.map((anexo) => {
    const imgProc = imagensBase64.find(
      (i) => i.nome === anexo.nomeOriginal
    );
    const isPdf =
      anexo.caminho && anexo.caminho.toLowerCase().endsWith(".pdf");
    const token = anexo.id ? createPublicAnexoToken(anexo.id) : "";
    const viewUrl =
      anexo.id && baseUrl
        ? buildPublicAnexoViewUrl(baseUrl, anexo.id, token)
        : "";
    return {
      nome: anexo.nomeOriginal,
      nomeOriginal: anexo.nomeOriginal,
      tipo: isPdf ? "pdf" : anexo.tipo,
      src: imgProc ? imgProc.src : null,
      href: viewUrl,
    };
  });

  const anexosGridHtml = gerarAnexosDetalhesPdfHtml(anexosParaGrid);

  const basicInfoHtml = [
    renderPdfField("ID do Serviço", escapeHtml(String(servicoData.id))),
    renderPdfField(
      "Número do Processo / Tipo",
      escapeHtml(servicoData.processo || "Não informado")
    ),
    renderPdfField("Status", renderPdfStatusBadge(servicoData.status)),
    renderPdfField(
      "Subestação",
      escapeHtml(servicoData.subestacao || "Não informado")
    ),
    renderPdfField(
      "Alimentador",
      escapeHtml(servicoData.alimentador || "Não informado")
    ),
    renderPdfField(
      "Chave Montante",
      escapeHtml(servicoData.chave_montante || "Não informado")
    ),
    renderPdfField(
      "Ordem de Obra",
      escapeHtml(servicoData.ordem_obra || "Não especificada")
    ),
  ].join("");

  const datasFields = [
    renderPdfField(
      "Data Prevista",
      formatarData(servicoData.data_prevista_execucao)
    ),
    renderPdfField(
      "Desligamento",
      servicoData.desligamento === "SIM" ? "Sim" : "Não"
    ),
  ];

  if (servicoData.desligamento === "SIM") {
    datasFields.push(
      renderPdfField("Hora de Início", formatarHora(servicoData.hora_inicio)),
      renderPdfField("Hora de Término", formatarHora(servicoData.hora_fim))
    );
  }

  if (
    servicoData.status === "concluido" ||
    servicoData.status === "nao_concluido"
  ) {
    datasFields.push(
      renderPdfField(
        "Data de Conclusão",
        formatarData(servicoData.data_conclusao, true)
      )
    );
  }

  const datasHtml = datasFields.join("");

  let equipeHtml =
    '<p class="srv-pdf__empty">Nenhuma equipe atribuída a este serviço.</p>';
  if (responsaveis.length > 0) {
    equipeHtml = `
      <table class="srv-pdf__table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Matrícula</th>
            <th>Status</th>
            <th>Data Conclusão</th>
          </tr>
        </thead>
        <tbody>
          ${responsaveis
            .map(
              (resp) => `
            <tr>
              <td>${escapeHtml(resp.nome || "N/A")}</td>
              <td>${escapeHtml(resp.responsavel_matricula || "N/A")}</td>
              <td>${renderPdfStatusBadge(resp.status_individual)}</td>
              <td>${
                resp.data_conclusao_individual
                  ? new Date(resp.data_conclusao_individual).toLocaleString(
                      "pt-BR"
                    )
                  : "N/A"
              }</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  }

  const mapsHtml =
    servicoData.maps && String(servicoData.maps).trim()
      ? `<p class="srv-pdf__maps">${escapeHtml(servicoData.maps)}</p>`
      : '<p class="srv-pdf__maps">Link do mapa não fornecido</p>';

  const descricaoHtml = [
    renderPdfField(
      "Descrição / Motivo do Serviço",
      escapeHtml(servicoData.descricao_servico || "Nenhuma descrição informada."),
      true
    ),
    renderPdfField(
      "Observações",
      escapeHtml(servicoData.observacoes || "Nenhuma observação informada."),
      true
    ),
  ].join("");

  const showFinalizacao =
    servicoData.status === "concluido" ||
    servicoData.status === "nao_concluido";

  let finalizacaoHtml = "";
  if (showFinalizacao) {
    const finalizacaoFields = [];
    if (servicoData.status === "nao_concluido") {
      finalizacaoFields.push(
        renderPdfField(
          "Motivo da Não Conclusão",
          `<span class="srv-pdf__motivo">${escapeHtml(
            servicoData.motivo_nao_conclusao || "Motivo não especificado."
          )}</span>`,
          true
        )
      );
    }
    finalizacaoFields.push(
      renderPdfField(
        "Observações Gerais",
        escapeHtml(
          servicoData.observacoes_conclusao || "Nenhuma observação registrada."
        ),
        true
      )
    );
    finalizacaoHtml = finalizacaoFields.join("");
  }

  const docCode = buildDocumentCode(servicoData.processo, servicoData.id);

  return renderServicoDetailsReport({
    servicoId: servicoData.id,
    processo: servicoData.processo || "N/A",
    generatedAt: formatReportDate(),
    docCode,
    overviewProcesso: servicoData.processo || "Não informado",
    overviewStatus: statusLabel(servicoData.status),
    overviewEquipe: String(responsaveis.length),
    overviewAnexos: String(anexos.length),
    basicInfoHtml,
    datasHtml,
    equipeHtml,
    mapsHtml,
    descricaoHtml,
    showFinalizacao,
    finalizacaoHtml,
    anexosGridHtml,
  });
}

async function gerarPdfConsolidado(servicoId, baseUrl = "") {
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

    const servicoData = { ...servicoRows[0], anexos: anexos || [], responsaveis };
    const htmlContent = await preencherTemplateHtml(servicoData, { baseUrl });
    const docCode = buildDocumentCode(
      servicoData.processo,
      servicoData.id
    );

    const pdfBuffer = await htmlToPdf(htmlContent, {
      landscape: false,
      footerOnly: true,
      docCode,
      margin: { top: "8mm", right: "10mm", bottom: "12mm", left: "10mm" },
    });

    return {
      nomeArquivo: `relatorio_servico_${(
        servicoData.processo || servicoId
      ).replace(/\//g, "-")}.pdf`,
      buffer: pdfBuffer,
    };
  } finally {
    connection.release();
  }
}

module.exports = {
  gerarPdfConsolidado,
};
