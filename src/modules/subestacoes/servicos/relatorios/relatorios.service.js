  const { promisePool, uploadsSubestacoesDir } = require("../../../../init");
  const path = require("path");
  const fs = require("fs");
  const fsPromises = require("fs").promises;
  const playwright = require("playwright");
  const { PDFDocument } = require("pdf-lib");
  const { projectRootDir } = require("../../../../shared/path.helper");

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

  function gerarGaleriaHtml(imagens) {
    if (!imagens || imagens.length === 0) {
      return '<p class="no-content">Nenhuma imagem encontrada.</p>';
    }
    let galleryHtml = "";
    for (let i = 0; i < imagens.length; i += 4) {
      const chunk = imagens.slice(i, i + 4);
      galleryHtml +=
        '<div class="photo-grid-container"><div class="photo-grid-4">';
      chunk.forEach((img) => {
        galleryHtml += `<div class="gallery-item"><img src="${img.src}" alt="${img.nome}"><p class="caption">${img.nome}</p></div>`;
      });
      galleryHtml += "</div></div>";
    }
    return galleryHtml;
  }

  function gerarListaDocumentosHtml(anexos) {
    if (!anexos || anexos.length === 0) {
      return '<p class="no-content">Nenhum documento encontrado.</p>';
    }
    const documentos = anexos.filter(
      (anexo) => !anexo.tipo_mime || !anexo.tipo_mime.startsWith("image/")
    );
    if (documentos.length === 0) {
      return '<p class="no-content">Nenhum documento encontrado.</p>';
    }
    let listHtml = '<ul class="doc-list">';
    documentos.forEach((doc) => {
      listHtml += `<li>${doc.nome_original}</li>`;
    });
    listHtml += "</ul>";
    return listHtml;
  }

  async function preencherTemplateHtmlServicoSubestacao(servicoData) {
    const templatePath = path.join(
      projectRootDir,
      "public/pages/templates/relatorio_servico_subestacao.html"
    );
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
        const statusClasse = (
          item.status_item_escopo || "pendente"
        ).toLowerCase();
        const imagensItemLocal = await processarImagensParaUrlLocal(
          item.anexos || []
        );
        const galeriaItemHtml = gerarGaleriaHtml(imagensItemLocal);
        itensEscopoHtml += `
                  <div class="item-card">
                      <p class="item-card-header">${
                        item.descricao_item_servico
                      }</p>
                      <div class="item-card-details">
                          <p><strong>TAG:</strong> ${
                            item.tag_equipamento_alvo || "N/A"
                          } | <strong>Encarregado:</strong> ${
          item.encarregado_item_nome || "N/A"
        } | <strong>Status:</strong> <span class="status-badge status-${statusClasse}">${statusTexto}</span></p>
                          ${
                            item.observacoes_conclusao_item
                              ? `<p><strong>Obs. Conclusão:</strong> ${item.observacoes_conclusao_item}</p>`
                              : ""
                          }
                          ${galeriaItemHtml}
                      </div>
                  </div>`;
      }
    } else {
      itensEscopoHtml =
        '<p class="no-content">Nenhum item de escopo detalhado para este serviço.</p>';
    }

    const anexosGerais = servicoData.anexos || [];
    const galeriaAnexosGerais = gerarGaleriaHtml(
      await processarImagensParaUrlLocal(anexosGerais)
    );
    const listaDocumentosGerais = gerarListaDocumentosHtml(anexosGerais);
    const statusFinalTexto = (servicoData.status || "N/A").replace(/_/g, " ");
    const statusFinalClasse = (
      servicoData.status || "desconhecido"
    ).toLowerCase();

    const dadosParaTemplate = {
      processo: servicoData.processo || "N/A",
      subestacao_nome: servicoData.subestacao_nome,
      subestacao_sigla: servicoData.subestacao_sigla,
      tipo_ordem: servicoData.tipo_ordem || "N/A",
      prioridade: servicoData.prioridade || "N/A",
      responsavel_nome: servicoData.responsavel_nome || "N/A",
      data_prevista: formatarData(servicoData.data_prevista),
      horario_previsto: `${formatarHora(
        servicoData.horario_inicio
      )} às ${formatarHora(servicoData.horario_fim)}`,
      motivo: servicoData.motivo || "Nenhum.",
      itens_escopo_html: itensEscopoHtml,
      status_final_classe: `status-${statusFinalClasse}`,
      status_final_texto: statusFinalTexto,
      data_conclusao: formatarData(servicoData.data_conclusao),
      horario_fim: formatarHora(servicoData.horario_fim),
      observacoes_conclusao: servicoData.observacoes_conclusao || "Nenhuma.",
      galeria_anexos_gerais: galeriaAnexosGerais,
      lista_documentos_gerais: listaDocumentosGerais,
      data_geracao: new Date().toLocaleString("pt-BR"),
    };

    for (const key in dadosParaTemplate) {
      const regex = new RegExp(`{{${key}}}`, "g");
      templateHtml = templateHtml.replace(regex, dadosParaTemplate[key]);
    }
    return templateHtml;
  }

  async function gerarPdfRelatorio(servicoId) {
    const connection = await promisePool.getConnection();
    let browser;
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

      browser = await playwright.chromium.launch();
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: "networkidle" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20mm", right: "10mm", bottom: "20mm", left: "10mm" },
      });
      await browser.close();
      browser = null;

      const pdfsAnexos = servicoData.anexos.filter(
        (anexo) => anexo.tipo_mime === "application/pdf"
      );
      let finalPdfBytes = pdfBuffer;

      if (pdfsAnexos.length > 0) {
        const mergedPdfDoc = await PDFDocument.load(pdfBuffer);
        for (const anexo of pdfsAnexos) {
          const caminhoRelativo = anexo.caminho_servidor.replace(
            "/upload_arquivos_subestacoes/",
            ""
          );
          const caminhoFisico = path.join(uploadsSubestacoesDir, caminhoRelativo);
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
                `Falha ao processar o anexo PDF ${anexo.nome_original}: ${pdfError.message}. Anexo ignorado.`
              );
            }
          }
        }
        finalPdfBytes = await mergedPdfDoc.save();
      }

      const nomeArquivo = `relatorio_servico_${(
        servicoData.processo || servicoId
      ).replace(/\//g, "-")}.pdf`;
      return { nomeArquivo, pdfBytes: Buffer.from(finalPdfBytes) };
    } catch (error) {
      if (browser) await browser.close();
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  module.exports = {
    gerarPdfRelatorio,
  };
