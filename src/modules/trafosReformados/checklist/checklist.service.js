const { promisePool } = require("../../../init");
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { projectRootDir } = require("../../../shared/path.helper");

async function obterChecklistPorRegistroId(registroId) {
  const [rows] = await promisePool.query(
    `SELECT 
        tst.*, 
        u.nome as nome_tecnico,
        tr.numero_serie,
        tr.fabricante,
        tr.pot,
        tr.resultado_avaliacao
     FROM trafos_reformados_testes tst
     JOIN trafos_reformados tr ON tst.trafos_reformados_id = tr.id
     LEFT JOIN users u ON tst.tecnico_responsavel_teste = u.matricula
     WHERE tst.trafos_reformados_id = ?
     ORDER BY tst.data_teste DESC, tst.id DESC
     LIMIT 1`,
    [registroId]
  );
  if (rows.length === 0) {
    throw new Error("Nenhum checklist encontrado para este registro.");
  }

  const checklist = rows[0];

  const [anexos] = await promisePool.query(
    "SELECT * FROM reform_anexos_checklist WHERE teste_id = ?",
    [checklist.id]
  );

  checklist.anexos = anexos;

  return checklist;
}

async function obterHistoricoPorSerie(numero_serie) {
  const [checklists] = await promisePool.query(
    `SELECT 
        tst.*, 
        tr.numero_serie, 
        tr.fabricante,
        tr.pot,
        tr.resultado_avaliacao,
        u.nome as nome_tecnico
     FROM trafos_reformados_testes tst
     JOIN trafos_reformados tr ON tst.trafos_reformados_id = tr.id
     LEFT JOIN users u ON tst.tecnico_responsavel_teste = u.matricula
     WHERE tr.numero_serie = ? 
     ORDER BY tst.data_teste DESC, tst.id DESC`,
    [numero_serie]
  );

  if (checklists.length > 0) {
    const testeIds = checklists.map((c) => c.id);
    const [anexos] = await promisePool.query(
      "SELECT * FROM reform_anexos_checklist WHERE teste_id IN (?)",
      [testeIds]
    );

    const anexosMap = anexos.reduce((acc, anexo) => {
      if (!acc[anexo.teste_id]) {
        acc[anexo.teste_id] = [];
      }
      acc[anexo.teste_id].push(anexo);
      return acc;
    }, {});

    checklists.forEach((checklist) => {
      checklist.anexos = anexosMap[checklist.id] || [];
    });
  }

  return checklists;
}

async function avaliarCompleto(id, dadosAvaliacao) {
  const {
    matricula_responsavel,
    status_avaliacao,
    resultado_avaliacao,
    anexos_imagem,
  } = dadosAvaliacao;

  const checklist_data = JSON.parse(dadosAvaliacao.checklist_data);

  if (!matricula_responsavel || !status_avaliacao) {
    throw new Error(
      "Matrícula do responsável e status da avaliação são obrigatórios."
    );
  }
  if (!checklist_data) {
    throw new Error("Dados do checklist são obrigatórios.");
  }

  let conclusaoChecklistParaDb;
  if (status_avaliacao === "avaliado") {
    conclusaoChecklistParaDb = "APROVADO";
  } else if (status_avaliacao === "reprovado") {
    conclusaoChecklistParaDb = "REPROVADO";
  } else {
    throw new Error("Status de avaliação inválido para o checklist.");
  }

  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();

    const [tecnico] = await connection.query(
      `SELECT matricula FROM users WHERE matricula = ? AND cargo IN ('ADMIN', 'ADM', 'Engenheiro', 'Técnico', 'Inspetor')`,
      [matricula_responsavel]
    );
    if (tecnico.length === 0) {
      throw new Error("Técnico responsável não encontrado ou não autorizado.");
    }

    await connection.query(
      `UPDATE trafos_reformados SET tecnico_responsavel = ?, status_avaliacao = ?, resultado_avaliacao = ?, data_avaliacao = NOW() WHERE id = ?`,
      [matricula_responsavel, status_avaliacao, resultado_avaliacao || null, id]
    );

    const [testeResult] = await connection.query(
      `INSERT INTO trafos_reformados_testes (
                trafos_reformados_id, bobina_primaria_i, bobina_primaria_ii, bobina_primaria_iii,
                bobina_secundaria_i, bobina_secundaria_ii, bobina_secundaria_iii, estado_fisico,
                conclusao_checklist, observacoes_checklist, tecnico_responsavel_teste, data_teste,
                valor_bobina_i, valor_bobina_ii, valor_bobina_iii
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
      [
        id,
        checklist_data.bobina_primaria_i,
        checklist_data.bobina_primaria_ii,
        checklist_data.bobina_primaria_iii,
        checklist_data.bobina_secundaria_i,
        checklist_data.bobina_secundaria_ii,
        checklist_data.bobina_secundaria_iii,
        checklist_data.estado_fisico,
        conclusaoChecklistParaDb,
        checklist_data.observacoes_checklist,
        matricula_responsavel,
        checklist_data.valor_bobina_i || null,
        checklist_data.valor_bobina_ii || null,
        checklist_data.valor_bobina_iii || null,
      ]
    );

    const novoTesteId = testeResult.insertId;
    const anexosSalvos = [];

    if (anexos_imagem && anexos_imagem.length > 0) {
      for (const file of anexos_imagem) {
        const anexoPathParaDB = `trafos_reformados_anexos/${id}/${file.filename}`;
        const [anexoResult] = await connection.query(
          `INSERT INTO reform_anexos_checklist (teste_id, caminho_arquivo, nome_original, tamanho_arquivo, tipo_mime) VALUES (?, ?, ?, ?, ?)`,
          [
            novoTesteId,
            anexoPathParaDB,
            file.originalname,
            file.size,
            file.mimetype,
          ]
        );
        anexosSalvos.push({
          id: anexoResult.insertId,
          caminho_arquivo: anexoPathParaDB,
          nome_original: file.originalname,
        });
      }
    }

    await connection.commit();
    return { teste_id: novoTesteId, anexos: anexosSalvos };
  } catch (err) {
    await connection.rollback();
    if (anexos_imagem && anexos_imagem.length > 0) {
      for (const file of anexos_imagem) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }
    throw err;
  } finally {
    connection.release();
  }
}

async function gerarPdfChecklist(checklist, transformador, usuarioLogado) {
  let tecnicoNomeChecklist = checklist.tecnico_responsavel_teste || "N/A";
  if (checklist.tecnico_responsavel_teste) {
    const [userRows] = await promisePool.query(
      "SELECT nome FROM users WHERE matricula = ?",
      [checklist.tecnico_responsavel_teste]
    );
    if (userRows.length > 0) {
      tecnicoNomeChecklist = `${userRows[0].nome} (${checklist.tecnico_responsavel_teste})`;
    }
  }

  let anexoHtml = "";
  if (checklist.anexos && checklist.anexos.length > 0) {
    const imageTags = checklist.anexos
      .map((anexo) => {
        const absoluteImagePath = path.join(
          projectRootDir,
          anexo.caminho_arquivo
        );
        if (fs.existsSync(absoluteImagePath)) {
          const imageBuffer = fs.readFileSync(absoluteImagePath);
          const base64Image = imageBuffer.toString("base64");
          const mimeType = anexo.tipo_mime || "image/jpeg";
          const imageSrc = `data:${mimeType};base64,${base64Image}`;

          return `<div class="anexo-item">
                    <img src="${imageSrc}" alt="${anexo.nome_original}">
                    <p>${anexo.nome_original}</p>
                  </div>`;
        }
        return "";
      })
      .join("");

    if (imageTags) {
      anexoHtml = `
        <div class="page-break"></div>
        <div class="section">
            <h2>Anexos Fotográficos</h2>
            <div class="anexos-container">
                ${imageTags}
            </div>
        </div>
      `;
    }
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <title>Relatório de Avaliação do Transformador</title>
        <style>
            body { font-family: Arial, sans-serif; color: #333; font-size: 10pt; }
            .container { padding: 0 1cm; }
            h1 {
                color: #003366; text-align: center; margin-bottom: 20px;
                font-size: 16pt; border-bottom: 2px solid #003366; padding-bottom: 10px;
            }
            h2 {
                color: #004a99; font-size: 12pt; margin-top: 25px;
                margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px;
            }
            .info-grid {
                display: grid; grid-template-columns: 1fr 1fr;
                gap: 0 20px; margin-bottom: 20px;
            }
            .info-grid p { margin: 5px 0; }
            .info-grid strong { color: #003366; min-width: 120px; display: inline-block; }
            table {
                width: 100%; border-collapse: collapse; margin-top: 10px;
            }
            th, td {
                border: 1px solid #ddd; padding: 8px; text-align: left;
            }
            th {
                background-color: #f2f9ff; font-weight: bold; color: #003366;
            }
            .obs-box {
                margin-top: 20px; padding: 15px; background-color: #f9f9f9;
                border: 1px solid #eee; border-radius: 5px;
                white-space: pre-wrap; word-wrap: break-word;
            }
            .status { font-weight: bold; }
            .status.aprovado { color: #28a745; }
            .status.reprovado { color: #dc3545; }
            .page-break { page-break-before: always; }
            .anexos-container {
                display: flex; flex-wrap: wrap; gap: 15px; justify-content: flex-start;
            }
            .anexo-item {
                width: calc(50% - 10px); text-align: center; border: 1px solid #eee;
                padding: 10px; border-radius: 5px;
            }
            .anexo-item img {
                max-width: 100%; height: auto; max-height: 280px;
                border-radius: 4px; margin-bottom: 5px;
            }
            .anexo-item p { font-size: 8pt; color: #555; margin: 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="info-grid">
                <div>
                    <h2>Dados do Transformador</h2>
                    <p><strong>ID do Registro:</strong> ${transformador.id || "N/A"}</p>
                    <p><strong>Número de Série:</strong> ${transformador.numero_serie || "N/A"}</p>
                    <p><strong>Fabricante:</strong> ${transformador.fabricante || "N/A"}</p>
                    <p><strong>Potência:</strong> ${transformador.pot ? transformador.pot + " kVA" : "N/A"}</p>
                </div>
                <div>
                    <h2>Detalhes da Avaliação</h2>
                    <p><strong>ID do Teste:</strong> ${checklist.id || "N/A"}</p>
                    <p><strong>Data do Teste:</strong> ${checklist.data_teste ? new Date(checklist.data_teste).toLocaleString("pt-BR") : "N/A"}</p>
                    <p><strong>Técnico Responsável:</strong> ${tecnicoNomeChecklist}</p>
                </div>
            </div>

            <h2>Resultados do Checklist Técnico</h2>
            <table>
                <tr><th>Verificação</th><th>Fase I</th><th>Fase II</th><th>Fase III</th></tr>
                <tr><td><strong>Bobinas Primárias</strong></td><td>${checklist.bobina_primaria_i || "N/A"}</td><td>${checklist.bobina_primaria_ii || "N/A"}</td><td>${checklist.bobina_primaria_iii || "N/A"}</td></tr>
                <tr><td><strong>Bobinas Secundárias</strong></td><td>${checklist.bobina_secundaria_i || "N/A"}</td><td>${checklist.bobina_secundaria_ii || "N/A"}</td><td>${checklist.bobina_secundaria_iii || "N/A"}</td></tr>
                <tr><td><strong>Valores Teste TTR</strong></td><td>${checklist.valor_bobina_i || "N/A"}</td><td>${checklist.valor_bobina_ii || "N/A"}</td><td>${checklist.valor_bobina_iii || "N/A"}</td></tr>
            </table>

            <table>
                <tr>
                    <th style="width: 200px;">Estado Físico Geral</th>
                    <td>${checklist.estado_fisico || "N/A"}</td>
                </tr>
            </table>

            ${checklist.observacoes_checklist ? `
                <h2>Observações do Checklist</h2>
                <div class="obs-box">${checklist.observacoes_checklist}</div>
            ` : ""}
            
            ${transformador.resultado_avaliacao ? `
                <h2>Observações Gerais / Motivo da Reprovação</h2>
                <div class="obs-box">${transformador.resultado_avaliacao}</div>
            ` : ""}

            <h2>Conclusão Final</h2>
            <table>
                <tr>
                    <th style="width: 200px;">Status Final</th>
                    <td class="status ${checklist.conclusao_checklist === "APROVADO" ? "aprovado" : "reprovado"}">
                        ${checklist.conclusao_checklist || "N/A"}
                    </td>
                </tr>
            </table>
            ${anexoHtml}
        </div>
    </body>
    </html>`;

  const headerTemplate = `
    <div style="font-family: Arial, sans-serif; font-size: 10pt; color: #003366; width: 100%; text-align: center; padding: 0.5cm 1cm; border-bottom: 1px solid #ccc;">
        Relatório de Avaliação de Transformadores Reformados
    </div>`;

  const footerTemplate = `
    <div style="font-family: Arial, sans-serif; font-size: 8pt; color: #777; width: 100%; padding: 0 1cm;">
        <table style="width: 100%; border: 0;">
            <tr>
                <td style="text-align: left; border: 0;">Gerado por: ${usuarioLogado.nome} (${usuarioLogado.matricula})</td>
                <td style="text-align: right; border: 0;">Página <span class="pageNumber"></span> de <span class="totalPages"></span></td>
            </tr>
            <tr>
                <td colspan="2" style="text-align: left; border: 0;">Data de Geração: ${new Date().toLocaleString("pt-BR")}</td>
            </tr>
        </table>
    </div>`;

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle" });
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "2cm", right: "1cm", bottom: "2.5cm", left: "1cm" },
    headerTemplate: headerTemplate,
    footerTemplate: footerTemplate,
    displayHeaderFooter: true,
  });
  await browser.close();
  return pdfBuffer;
}

async function gerarPdfTabelaHistorico(dados, filtros) {
  if (!dados || dados.length === 0) {
    throw new Error("Não há dados para gerar o relatório.");
  }
  const htmlContent = `
        <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório de Transformadores Avaliados</title>
        <style>
            body { font-family: 'Poppins', sans-serif; font-size: 9px; }
            h1 { text-align: center; color: #2a5298; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ccc; padding: 5px; text-align: left; }
            th { background-color: #f2f2f2; }
            .info-filtros { margin-bottom: 15px; padding: 10px; border: 1px solid #eee; border-radius: 5px; }
            .info-filtros span { display: inline-block; margin-right: 15px; }
        </style></head><body>
        <h1>Relatório de Transformadores Avaliados</h1>
        <div class="info-filtros">
            <strong>Filtros Aplicados:</strong><br>
            ${Object.entries(filtros)
              .map(([key, value]) =>
                value ? `<span><b>${key}:</b> ${value}</span>` : ""
              )
              .filter(Boolean)
              .join("\n")}
        </div>
        <table><thead><tr>
            <th>ID Registro</th><th>Nº de Série</th><th>Fabricante</th><th>Potência</th><th>Status</th><th>Data Avaliação</th><th>Técnico</th>
        </tr></thead><tbody>
            ${dados
              .map(
                (trafo) => `
                <tr>
                    <td>${trafo.id}</td>
                    <td>${trafo.numero_serie}</td>
                    <td>${trafo.fabricante || "-"}</td>
                    <td>${trafo.pot || "-"}</td>
                    <td>${
                      trafo.status_avaliacao === "avaliado"
                        ? "Aprovado"
                        : "Reprovado"
                    }</td>
                    <td>${
                      trafo.data_avaliacao
                        ? new Date(trafo.data_avaliacao).toLocaleDateString(
                            "pt-BR"
                          )
                        : "-"
                    }</td>
                    <td>${trafo.nome_tecnico || "-"}</td>
                </tr>
            `
              )
              .join("")}
        </tbody></table></body></html>`;

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle" });
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    landscape: true,
    margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
  });
  await browser.close();
  return pdfBuffer;
}

async function excluirAnexo(anexoId) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();

    const [anexoRows] = await connection.query(
      "SELECT caminho_arquivo FROM reform_anexos_checklist WHERE id = ?",
      [anexoId]
    );

    if (anexoRows.length === 0) {
      throw new Error("Anexo não encontrado.");
    }

    const anexo = anexoRows[0];
    const absolutePath = path.join(projectRootDir, anexo.caminho_arquivo);

    const [deleteResult] = await connection.query(
      "DELETE FROM reform_anexos_checklist WHERE id = ?",
      [anexoId]
    );

    if (deleteResult.affectedRows === 0) {
      throw new Error(
        "Falha ao excluir o registro do anexo do banco de dados."
      );
    }

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  obterChecklistPorRegistroId,
  obterHistoricoPorSerie,
  avaliarCompleto,
  gerarPdfChecklist,
  gerarPdfTabelaHistorico,
  excluirAnexo,
};
