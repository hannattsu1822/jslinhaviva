const { promisePool } = require("../../../init");
const { chromium } = require("playwright");
const path = require("path");
const { projectRootDir } = require("../../../shared/path.helper");

async function obterChecklistPorRegistroId(registroId) {
  const [rows] = await promisePool.query(
    `SELECT tst.*, u.nome as nome_tecnico 
         FROM trafos_reformados_testes tst
         LEFT JOIN users u ON tst.tecnico_responsavel_teste = u.matricula
         WHERE tst.trafos_reformados_id = ?`,
    [registroId]
  );
  if (rows.length === 0) {
    throw new Error("Nenhum checklist encontrado para este registro.");
  }
  return rows[0];
}

async function obterHistoricoPorSerie(numero_serie) {
  const [checklists] = await promisePool.query(
    `SELECT tst.*, tr.numero_serie, u.nome as nome_tecnico
         FROM trafos_reformados_testes tst
         JOIN trafos_reformados tr ON tst.trafos_reformados_id = tr.id
         LEFT JOIN users u ON tst.tecnico_responsavel_teste = u.matricula
         WHERE tr.numero_serie = ? 
         ORDER BY tst.data_teste DESC, tst.id DESC`,
    [numero_serie]
  );
  return checklists;
}

async function avaliarCompleto(id, dadosAvaliacao) {
  const {
    matricula_responsavel,
    status_avaliacao,
    resultado_avaliacao,
    checklist_data,
  } = dadosAvaliacao;

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

    await connection.query(
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

    await connection.commit();
  } catch (err) {
    await connection.rollback();
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

  const htmlContent = `
        <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório de Checklist do Transformador</title>
        <style>
            body { font-family: 'Poppins', Arial, sans-serif; color: #333; margin: 20px; font-size: 11px; }
            .container { border: 1px solid #ccc; padding: 20px; border-radius: 8px; max-width: 800px; margin: auto; }
            h1 { color: #2a5298; text-align: center; margin-bottom: 20px; font-size: 18px; }
            h2 { color: #2a5298; font-size: 14px; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;}
            .info-trafo p, .info-checklist p, .section p { margin: 6px 0; line-height: 1.6; }
            .info-trafo strong, .info-checklist strong { color: #102a52; min-width: 140px; display: inline-block; font-weight: 600;}
            .section { margin-bottom:15px; padding-left: 10px; }
            .section p { display: flex; justify-content: space-between; border-bottom: 1px dotted #eaeaea; padding: 4px 0;}
            .section p span:first-child {color: #555;}
            .section p span:last-child { font-weight: bold; text-align: right; color: #111; }
            .obs { margin-top:15px; padding:10px; background-color:#f9f9f9; border: 1px solid #efefef; border-radius:4px; }
            .obs p {border-bottom: none; white-space: pre-wrap; word-wrap: break-word;}
            .footer { margin-top: 30px; font-size: 9px; text-align: center; color: #777; }
        </style></head><body>
        <div class="container">
            <h1>Checklist de Avaliação do Transformador</h1>
            <div class="info-trafo">
                <h2>Dados do Transformador</h2>
                <p><strong>ID do Registro:</strong> ${
                  transformador.id || "N/A"
                }</p>
                <p><strong>Número de Série:</strong> ${
                  transformador.numero_serie || "N/A"
                }</p>
                <p><strong>Fabricante:</strong> ${
                  transformador.fabricante || "N/A"
                }</p>
                <p><strong>Potência:</strong> ${
                  transformador.pot ? transformador.pot + " kVA" : "N/A"
                }</p>
            </div>
            <div class="info-checklist">
                <h2>Detalhes do Teste/Checklist</h2>
                <p><strong>ID do Teste:</strong> ${checklist.id || "N/A"}</p>
                <p><strong>Data do Teste:</strong> ${
                  checklist.data_teste
                    ? new Date(checklist.data_teste).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })
                    : "N/A"
                }</p>
                <p><strong>Técnico Responsável:</strong> ${tecnicoNomeChecklist}</p>
            </div>
            <div class="section">
                <h2>Bobinas Primárias</h2>
                <p><span>Primária I:</span> <span>${
                  checklist.bobina_primaria_i || "N/A"
                }</span></p>
                <p><span>Primária II:</span> <span>${
                  checklist.bobina_primaria_ii || "N/A"
                }</span></p>
                <p><span>Primária III:</span> <span>${
                  checklist.bobina_primaria_iii || "N/A"
                }</span></p>
            </div>
            <div class="section">
                <h2>Bobinas Secundárias</h2>
                <p><span>Secundária I:</span> <span>${
                  checklist.bobina_secundaria_i || "N/A"
                }</span></p>
                <p><span>Secundária II:</span> <span>${
                  checklist.bobina_secundaria_ii || "N/A"
                }</span></p>
                <p><span>Secundária III:</span> <span>${
                  checklist.bobina_secundaria_iii || "N/A"
                }</span></p>
            </div>
            <div class="section">
                <h2>Valores Obtidos - Teste TTR</h2>
                <p><span>Valor Bobina I:</span> <span>${
                  checklist.valor_bobina_i || "N/A"
                }</span></p>
                <p><span>Valor Bobina II:</span> <span>${
                  checklist.valor_bobina_ii || "N/A"
                }</span></p>
                <p><span>Valor Bobina III:</span> <span>${
                  checklist.valor_bobina_iii || "N/A"
                }</span></p>
            </div>
            <div class="section">
                <h2>Outras Verificações</h2>
                <p><span>Estado Físico Geral:</span> <span>${
                  checklist.estado_fisico || "N/A"
                }</span></p>
            </div>
            ${
              checklist.observacoes_checklist
                ? `<div class="section obs"><h2>Observações do Checklist</h2><p>${checklist.observacoes_checklist.replace(
                    /\n/g,
                    "<br>"
                  )}</p></div>`
                : ""
            }
            ${
              transformador.resultado_avaliacao
                ? `<div class="section obs"><h2>Observações Gerais / Motivo da Reprovação</h2><p>${transformador.resultado_avaliacao.replace(
                    /\n/g,
                    "<br>"
                  )}</p></div>`
                : ""
            }
            <div class="section">
                <h2>Conclusão da Avaliação (Checklist)</h2>
                <p><span>Status Final:</span> <span>${
                  checklist.conclusao_checklist || "N/A"
                }</span></p>
            </div>
        </div>
        <div class="footer">Gerado por ${usuarioLogado.nome} (${
    usuarioLogado.matricula
  }) em ${new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  })}</div>
        </body></html>`;

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle" });
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "20mm", right: "10mm", bottom: "20mm", left: "10mm" },
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

module.exports = {
  obterChecklistPorRegistroId,
  obterHistoricoPorSerie,
  avaliarCompleto,
  gerarPdfChecklist,
  gerarPdfTabelaHistorico,
};
