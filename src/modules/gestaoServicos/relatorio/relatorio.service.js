const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const { PDFDocument } = require("pdf-lib");
const playwright = require("playwright");
const { promisePool } = require("../../../init");
const { projectRootDir } = require("../../../shared/path.helper");

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

function gerarGaleriaHtml(imagens) {
  if (!imagens || imagens.length === 0) {
    return '<p class="no-content">Nenhuma imagem encontrada para esta seção.</p>';
  }

  let galleryHtml = "";
  for (let i = 0; i < imagens.length; i += 4) {
    const chunk = imagens.slice(i, i + 4);
    galleryHtml += '<div class="photo-grid-container">';
    galleryHtml += '<div class="photo-grid-4">';
    chunk.forEach((img) => {
      galleryHtml += `
                <div class="gallery-item">
                    <img src="${img.src}" alt="${img.nome}">
                    <p class="caption">${img.nome}</p>
                </div>
            `;
    });
    galleryHtml += "</div></div>";
  }
  return galleryHtml;
}

async function preencherTemplateHtml(servicoData) {
  const templatePath = path.join(
    projectRootDir,
    "public/pages/templates/relatorio_servico.html"
  );
  let templateHtml = await fsPromises.readFile(templatePath, "utf-8");

  const formatarData = (dataStr, comHora = false) => {
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
  };

  const imagensRegistro = servicoData.anexos.filter(
    (anexo) => anexo.tipo === "imagem"
  );
  const imagensFinalizacao = servicoData.anexos.filter((anexo) =>
    ["foto_conclusao", "foto_nao_conclusao"].includes(anexo.tipo)
  );
  const anexosPDF = servicoData.anexos.filter(
    (anexo) => anexo.caminho && anexo.caminho.toLowerCase().endsWith(".pdf")
  );

  const imagensRegistroBase64 = await processarImagensParaBase64(
    imagensRegistro
  );
  const imagensFinalizacaoBase64 = await processarImagensParaBase64(
    imagensFinalizacao
  );

  const galeriaRegistroHtml = gerarGaleriaHtml(imagensRegistroBase64);
  const galeriaFinalizacaoHtml = gerarGaleriaHtml(imagensFinalizacaoBase64);

  const listaAnexosPdfHtml =
    anexosPDF.length > 0
      ? `<ul>${anexosPDF
          .map((pdf) => `<li>${pdf.nomeOriginal} (Tipo: ${pdf.tipo})</li>`)
          .join("")}</ul>`
      : '<p class="no-content">Nenhum documento PDF foi anexado a este serviço.</p>';

  let listaResponsaveisHtml =
    '<p class="no-content">Nenhum responsável atribuído.</p>';
  if (servicoData.responsaveis && servicoData.responsaveis.length > 0) {
    listaResponsaveisHtml = '<table class="responsaveis-table">';
    listaResponsaveisHtml +=
      "<thead><tr><th>Nome</th><th>Matrícula</th><th>Status</th><th>Data Conclusão</th><th>Observações</th></tr></thead>";
    listaResponsaveisHtml += "<tbody>";
    servicoData.responsaveis.forEach((resp) => {
      listaResponsaveisHtml += `
            <tr>
                <td>${resp.nome || "N/A"}</td>
                <td>${resp.responsavel_matricula || "N/A"}</td>
                <td>${resp.status_individual || "N/A"}</td>
                <td>${
                  resp.data_conclusao_individual
                    ? new Date(resp.data_conclusao_individual).toLocaleString(
                        "pt-BR"
                      )
                    : "N/A"
                }</td>
                <td>${resp.observacoes_individuais || ""}</td>
            </tr>
        `;
    });
    listaResponsaveisHtml += "</tbody></table>";
  }

  const dadosParaTemplate = {
    titulo_relatorio: "Relatório Final de Serviço de Redes de Distribuição",
    processo: servicoData.processo || "N/A",
    id: servicoData.id,
    tipo: servicoData.tipo || "N/A",
    data_prevista_execucao: formatarData(servicoData.data_prevista_execucao),
    subestacao: servicoData.subestacao || "N/A",
    alimentador: servicoData.alimentador || "N/A",
    chave_montante: servicoData.chave_montante || "N/A",
    desligamento: `${servicoData.desligamento || "N/A"} ${
      servicoData.desligamento === "SIM"
        ? `(${servicoData.hora_inicio || ""} - ${servicoData.hora_fim || ""})`
        : ""
    }`,
    descricao_servico: servicoData.descricao_servico || "Nenhuma.",
    observacoes: servicoData.observacoes || "Nenhuma.",
    status_final_classe:
      servicoData.status === "concluido"
        ? "status-concluido"
        : "status-nao-concluido",
    status_final_texto:
      servicoData.status === "concluido" ? "Concluído" : "Não Concluído",
    data_finalizacao: formatarData(servicoData.data_conclusao, true),
    responsavel_finalizacao: `${servicoData.responsavel_nome || "N/A"} (${
      servicoData.responsavel_matricula || "N/A"
    })`,
    motivo_nao_conclusao_html:
      servicoData.status === "nao_concluido"
        ? `<div class="grid-item full-width"><strong>Motivo da Não Conclusão</strong><div class="text-area">${
            servicoData.motivo_nao_conclusao || "Nenhum."
          }</div></div>`
        : "",
    observacoes_conclusao: servicoData.observacoes_conclusao || "Nenhuma.",
    galeria_registro: galeriaRegistroHtml,
    galeria_finalizacao: galeriaFinalizacaoHtml,
    lista_anexos_pdf: listaAnexosPdfHtml,
    lista_responsaveis: listaResponsaveisHtml,
    data_geracao: new Date().toLocaleString("pt-BR"),
  };

  for (const key in dadosParaTemplate) {
    const regex = new RegExp(`{{${key}}}`, "g");
    templateHtml = templateHtml.replace(regex, dadosParaTemplate[key]);
  }

  return templateHtml;
}

async function gerarPdfConsolidado(servicoId) {
  const connection = await promisePool.getConnection();
  let browser;
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

    browser = await playwright.chromium.launch();
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      landscape: true,
      margin: { top: "20mm", right: "10mm", bottom: "20mm", left: "10mm" },
    });
    await browser.close();
    browser = null;

    const pdfsAnexos = anexos.filter(
      (anexo) => anexo.caminho && anexo.caminho.toLowerCase().endsWith(".pdf")
    );

    if (pdfsAnexos.length > 0) {
      const mergedPdfDoc = await PDFDocument.load(pdfBuffer);

      for (const anexo of pdfsAnexos) {
        const caminhoRelativo = anexo.caminho.replace(
          "/api/upload_arquivos/",
          ""
        );
        const caminhoFisico = path.join(
          projectRootDir,
          "upload_arquivos",
          caminhoRelativo
        );

        if (fs.existsSync(caminhoFisico)) {
          const anexoPdfBytes = await fsPromises.readFile(caminhoFisico);
          try {
            const anexoPdfDoc = await PDFDocument.load(anexoPdfBytes, {
              ignoreEncryption: true,
            });
            const copiedPages = await mergedPdfDoc.copyPages(
              anexoPdfDoc,
              anexoPdfDoc.getPageIndices()
            );
            copiedPages.forEach((page) => mergedPdfDoc.addPage(page));
          } catch (pdfError) {
            console.error(
              `Falha ao processar o anexo PDF ${anexo.nomeOriginal}: ${pdfError.message}. Anexo ignorado.`
            );
          }
        }
      }
      const finalPdfBytes = await mergedPdfDoc.save();
      return {
        nomeArquivo: `relatorio_servico_${(
          servicoData.processo || servicoId
        ).replace(/\//g, "-")}.pdf`,
        buffer: Buffer.from(finalPdfBytes),
      };
    }

    return {
      nomeArquivo: `relatorio_servico_${(
        servicoData.processo || servicoId
      ).replace(/\//g, "-")}.pdf`,
      buffer: pdfBuffer,
    };
  } catch (error) {
    if (browser) await browser.close();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  gerarPdfConsolidado,
};
