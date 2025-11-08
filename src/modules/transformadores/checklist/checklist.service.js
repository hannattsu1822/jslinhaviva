const { promisePool } = require("../../../init");
const { chromium } = require("playwright");
const path = require("path");
const { projectRootDir } = require("../../../shared/path.helper");

function excelSerialDateToJSDate(input) {
  if (!input && typeof input !== "number") return null;
  if (input instanceof Date) {
    if (!isNaN(input.getTime())) return input.toISOString().split("T")[0];
  }
  if (typeof input === "string") {
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/.test(input)) {
      try {
        const date = new Date(input);
        if (!isNaN(date.getTime())) return date.toISOString().split("T")[0];
      } catch (e) {}
    }
    if (/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.test(input)) {
      try {
        const parts = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
        let day = parseInt(parts[1], 10);
        let month = parseInt(parts[2], 10) - 1;
        let year = parseInt(parts[3], 10);
        if (parts[3].length === 2) {
          year += year < 70 ? 2000 : 1900;
        }
        if (
          year < 1900 ||
          year > 2200 ||
          month < 0 ||
          month > 11 ||
          day < 1 ||
          day > 31
        )
          return null;
        const date = new Date(Date.UTC(year, month, day));
        if (!isNaN(date.getTime())) return date.toISOString().split("T")[0];
      } catch (err) {
        return null;
      }
    }
  }
  if (typeof input === "number" && isFinite(input)) {
    if (
      input < 10000 &&
      Number.isInteger(input) &&
      input > 1899 &&
      input < 2200
    ) {
      return null;
    }
    try {
      const offset = input > 60 ? 25569 : 25568;
      const utcDays = Math.floor(input - offset);
      const date = new Date(utcDays * 86400 * 1000);
      const fractionalDay = input - Math.floor(input);
      if (fractionalDay > 0) {
        const totalSeconds = Math.round(fractionalDay * 86400);
        date.setUTCSeconds(date.getUTCSeconds() + totalSeconds);
      }
      if (isNaN(date.getTime())) throw new Error("Data serial inválida");
      return date.toISOString().split("T")[0];
    } catch (err) {
      return null;
    }
  }
  if (typeof input === "string" && isNaN(Number(input))) {
    try {
      const directDate = new Date(input);
      if (!isNaN(directDate.getTime()))
        return directDate.toISOString().split("T")[0];
    } catch (e) {}
  }
  return null;
}

function formatarDataParaPDFRelatorioTabela(dataISO) {
  if (!dataISO) return "N/A";
  if (typeof dataISO === "string" && dataISO.match(/^\d{2}\/\d{2}\/\d{4}/))
    return dataISO.substring(0, 10);
  const dateParts = String(dataISO).split("-");
  if (dateParts.length === 3)
    return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
  try {
    const dateObj = new Date(dataISO);
    if (!isNaN(dateObj.getTime())) {
      const dia = String(dateObj.getUTCDate()).padStart(2, "0");
      const mes = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
      const ano = dateObj.getUTCFullYear();
      return `${dia}/${mes}/${ano}`;
    }
  } catch (e) {}
  return dataISO;
}

async function listarTrafosSemChecklist() {
  const [rows] = await promisePool.query(
    "SELECT t.numero_serie FROM transformadores t WHERE NOT EXISTS (SELECT 1 FROM checklist_transformadores ct WHERE ct.numero_serie = t.numero_serie) ORDER BY t.numero_serie ASC"
  );
  return rows;
}

async function listarTrafosDaRemessa(dataRemessaInicial, dataRemessaFinal) {
  if (!dataRemessaInicial || !dataRemessaFinal) {
    throw new Error(
      "Período de data de processamento da remessa é obrigatório."
    );
  }
  const query = `
    SELECT 
        t.numero_serie,
        DATE_FORMAT(t.data_processamento_remessa, '%d/%m/%Y') as data_processamento_remessa_formatada,
        DATE_FORMAT(MAX(ct.data_checklist), '%d/%m/%Y') AS data_ultimo_checklist_conhecido_formatada,
        TRUE AS tem_checklist_previo
    FROM transformadores t
    INNER JOIN checklist_transformadores ct ON t.numero_serie = ct.numero_serie
    WHERE t.data_processamento_remessa BETWEEN ? AND ?
    GROUP BY t.numero_serie, t.data_processamento_remessa 
    ORDER BY t.data_processamento_remessa DESC, MAX(ct.data_checklist) DESC, t.numero_serie ASC;
  `;
  const [rows] = await promisePool.query(query, [
    dataRemessaInicial,
    dataRemessaFinal,
  ]);
  return rows.map((row) => ({
    ...row,
    tem_checklist_previo:
      row.tem_checklist_previo === 1 || row.tem_checklist_previo === true,
  }));
}

async function obterHistoricoRemessas(numero_serie) {
  const [logRows] = await promisePool.query(
    "SELECT DISTINCT DATE_FORMAT(data_processamento_remessa, '%d/%m/%Y') as data_proc_fmt FROM log_processamento_remessa_trafos WHERE numero_serie_transformador = ? ORDER BY data_processamento_remessa DESC",
    [numero_serie]
  );
  return logRows.map((r) => r.data_proc_fmt);
}

async function salvarChecklist(dadosChecklist) {
  const {
    numero_serie,
    matricula_responsavel,
    conclusao,
    transformador_destinado,
    reformado,
    data_fabricacao,
    data_reformado,
    observacoes_secoes,
    detalhes_tanque,
    corrosao_tanque,
    buchas_primarias,
    buchas_secundarias,
    conectores,
    avaliacao_bobina_i,
    avaliacao_bobina_ii,
    avaliacao_bobina_iii,
    matricula_supervisor,
    observacoes,
  } = dadosChecklist;

  if (
    !numero_serie ||
    !matricula_responsavel ||
    !conclusao ||
    !transformador_destinado
  ) {
    throw new Error("Campos obrigatórios não preenchidos!");
  }

  const isReformado =
    String(reformado).toLowerCase() === "true" ||
    reformado === true ||
    reformado === 1;
  let dataFabricacaoFormatada = data_fabricacao
    ? excelSerialDateToJSDate(data_fabricacao)
    : null;
  if (data_fabricacao && /^\d{4}$/.test(data_fabricacao))
    dataFabricacaoFormatada = `${data_fabricacao}-01-01`;

  let dataReformadoFormatada =
    isReformado && data_reformado
      ? excelSerialDateToJSDate(data_reformado)
      : null;
  if (isReformado && data_reformado && /^\d{4}$/.test(data_reformado))
    dataReformadoFormatada = `${data_reformado}-01-01`;

  const observacoesSecoesJSON = observacoes_secoes
    ? JSON.stringify(observacoes_secoes)
    : null;

  await promisePool.query(
    `INSERT INTO checklist_transformadores (numero_serie, data_fabricacao, reformado, data_reformado, detalhes_tanque, corrosao_tanque, buchas_primarias, buchas_secundarias, conectores, avaliacao_bobina_i, avaliacao_bobina_ii, avaliacao_bobina_iii, conclusao, transformador_destinado, matricula_responsavel, supervisor_tecnico, observacoes, observacoes_secoes, data_checklist) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      numero_serie,
      dataFabricacaoFormatada,
      isReformado,
      dataReformadoFormatada,
      detalhes_tanque,
      corrosao_tanque || "NENHUMA",
      buchas_primarias,
      buchas_secundarias,
      conectores,
      avaliacao_bobina_i,
      avaliacao_bobina_ii,
      avaliacao_bobina_iii,
      conclusao,
      transformador_destinado,
      matricula_responsavel,
      matricula_supervisor,
      observacoes,
      observacoesSecoesJSON,
    ]
  );
}

async function obterChecklistPublico(id) {
  const query = `
        SELECT 
            ct.*, t.potencia, t.numero_serie AS serie_transformador_ref, t.local_retirada, t.regional,
            t.numero_fases, t.marca, t.motivo_desativacao, 
            DATE_FORMAT(t.data_entrada_almoxarifado, '%d/%m/%Y') as data_entrada_almoxarifado_formatada,
            DATE_FORMAT(t.data_processamento_remessa, '%d/%m/%Y') as data_processamento_remessa_formatada,
            u_resp.nome AS nome_responsavel, 
            DATE_FORMAT(ct.data_checklist, '%d/%m/%Y %H:%i:%S') as data_formulario_completa,
            DATE_FORMAT(ct.data_fabricacao, '%Y') as data_fabricacao_formatada,
            DATE_FORMAT(ct.data_reformado, '%Y') as data_reformado_formatada,
            IF(ct.supervisor_tecnico IS NOT NULL AND ct.supervisor_tecnico != '', u_sup.nome, 'Não especificado') AS nome_supervisor_fmt,
            IF(ct.supervisor_tecnico IS NOT NULL AND ct.supervisor_tecnico != '', ct.supervisor_tecnico, 'N/A') AS matricula_supervisor_fmt
        FROM checklist_transformadores ct
        INNER JOIN transformadores t ON ct.numero_serie = t.numero_serie
        INNER JOIN users u_resp ON ct.matricula_responsavel = u_resp.matricula
        LEFT JOIN users u_sup ON ct.supervisor_tecnico = u_sup.matricula
        WHERE ct.id = ?`;
  const [rows] = await promisePool.query(query, [id]);
  if (rows.length === 0) {
    throw new Error("Checklist não encontrado!");
  }
  let result = rows[0];
  if (result.supervisor_tecnico === "" || result.supervisor_tecnico === null) {
    result.nome_supervisor_fmt = "Não especificado";
    result.matricula_supervisor_fmt = "N/A";
  } else if (
    (!result.nome_supervisor_fmt ||
      result.nome_supervisor_fmt === "Não especificado") &&
    result.matricula_supervisor_fmt !== "N/A"
  ) {
    const [svUser] = await promisePool.query(
      "SELECT nome FROM users WHERE matricula = ?",
      [result.supervisor_tecnico]
    );
    result.nome_supervisor_fmt =
      svUser.length > 0
        ? svUser[0].nome
        : `Supervisor (${result.matricula_supervisor_fmt} - nome não encontrado)`;
  }
  return result;
}

async function excluirChecklist(id) {
  const [chkInfo] = await promisePool.query(
    "SELECT 1 FROM checklist_transformadores WHERE id = ?",
    [id]
  );
  if (chkInfo.length === 0) {
    throw new Error("Checklist não encontrado!");
  }
  await promisePool.query(
    "DELETE FROM checklist_transformadores WHERE id = ?",
    [id]
  );
}

async function filtrarChecklists(filtros) {
  const {
    numero_serie,
    matricula_responsavel,
    dataInicial,
    dataFinal,
    dataRemessaInicial,
    dataRemessaFinal,
  } = filtros;
  let query = `
        SELECT ct.id, t.numero_serie, t.potencia, t.marca,
               DATE_FORMAT(ct.data_checklist, '%d/%m/%Y %H:%i') as data_formulario, 
               ct.matricula_responsavel, u.nome as nome_responsavel, ct.transformador_destinado,
               DATE_FORMAT(t.data_processamento_remessa, '%d/%m/%Y') as data_processamento_remessa_formatada
        FROM checklist_transformadores ct
        INNER JOIN transformadores t ON ct.numero_serie = t.numero_serie
        LEFT JOIN users u ON ct.matricula_responsavel = u.matricula
        WHERE 1=1`;
  const params = [];
  if (numero_serie) {
    query += " AND t.numero_serie LIKE ?";
    params.push(`%${numero_serie.trim()}%`);
  }
  if (matricula_responsavel) {
    query += " AND ct.matricula_responsavel = ?";
    params.push(matricula_responsavel.trim());
  }
  if (dataInicial) {
    query += " AND DATE(ct.data_checklist) >= ?";
    params.push(dataInicial);
  }
  if (dataFinal) {
    query += " AND DATE(ct.data_checklist) <= ?";
    params.push(dataFinal);
  }
  if (dataRemessaInicial && dataRemessaFinal) {
    query += " AND t.data_processamento_remessa BETWEEN ? AND ?";
    params.push(dataRemessaInicial, dataRemessaFinal);
  }
  query += " ORDER BY ct.data_checklist DESC, ct.id DESC";
  const [rows] = await promisePool.query(query, params);
  return rows;
}

async function gerarPdfChecklist(id, protocol, host) {
  const [chkRows] = await promisePool.query(
    "SELECT t.marca, t.numero_serie FROM checklist_transformadores ct INNER JOIN transformadores t ON ct.numero_serie = t.numero_serie WHERE ct.id = ?",
    [id]
  );
  if (chkRows.length === 0) {
    throw new Error("Checklist não encontrado!");
  }
  const { marca, numero_serie } = chkRows[0];
  const sanitize = (str, fb = "val") =>
    str == null || String(str).trim() === ""
      ? fb
      : String(str)
          .replace(/[^a-zA-Z0-9\-_]/g, "_")
          .replace(/_{2,}/g, "_")
          .replace(/^_|_$/g, "");
  const nomeArquivo = `Checklist_${sanitize(id, `ID${id}`)}_${sanitize(
    marca,
    "MarcaDesconhecida"
  )}_${sanitize(numero_serie, "SerieDesconhecida")}.pdf`;

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
  });
  const page = await (
    await browser.newContext({ javaScriptEnabled: true, bypassCSP: true })
  ).newPage();
  await page.goto(`${protocol}://${host}/relatorio_formulario?id=${id}`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.waitForTimeout(1500);

  const hfStyle = `font-family:'Poppins',Arial,sans-serif;font-size:9px;color:#333;width:100%;`;
  const primaryColor = "#2a5298";
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "30mm", right: "10mm", bottom: "20mm", left: "10mm" },
    displayHeaderFooter: true,
    headerTemplate: `<div style="${hfStyle}padding:0 10mm;height:20mm;display:flex;flex-direction:column;justify-content:center;align-items:center;border-bottom:1px solid #ddd;"><div style="font-size:14px;color:${primaryColor};font-weight:600;">Relatório de Inspeção de Transformador</div><div style="font-size:10px;color:#555;">SULGIPE - Linha Viva System</div></div>`,
    footerTemplate: `<div style="${hfStyle}padding:0 10mm;height:10mm;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #ddd;"><span>Gerado em: <span class="date"></span></span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
    timeout: 90000,
  });
  await browser.close();
  return { nomeArquivo, pdfBuffer };
}

async function gerarPdfTabela(dados, filtros, usuario) {
  if (!dados?.length) {
    throw new Error("Nenhum dado para gerar PDF.");
  }
  let colunasAdicionaisTh = "";
  let colunasAdicionaisTdFn = (item) => "";
  const filtroRemessaAplicado =
    filtros?.dataRemessaInicial && filtros?.dataRemessaFinal;

  if (filtroRemessaAplicado) {
    colunasAdicionaisTh = "<th>Data Proc. Remessa</th>";
    colunasAdicionaisTdFn = (item) =>
      `<td>${item.data_processamento_remessa_formatada || "-"}</td>`;
  }
  const htmlContent = `
        <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório Checklists</title>
        <style>body{font-family:'Poppins',sans-serif;color:#333;font-size:9pt;margin:0;padding:0}.container{padding:20px}.info-header{text-align:center;font-size:8pt;color:#555;margin-bottom:20px}.info-filtros{background-color:#f0f4f8;padding:10px;border-radius:4px;margin-bottom:15px;font-size:8pt;border:1px solid #d6e0ea}.info-filtros strong{display:block;margin-bottom:3px;color:#1e3c72}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top;word-break:break-word}th{background-color:#2a5298;color:white;font-weight:500;font-size:9pt}td{font-size:8pt}tr:nth-child(even){background-color:#f8f9fa}@page{size:A4 portrait;margin:25mm 15mm 20mm 15mm;@top-center{content:"Relatório de Checklists de Transformadores";font-size:12pt;color:#2a5298;font-weight:bold;vertical-align:bottom;padding-bottom:5mm}@bottom-left{content:"SULGIPE - Linha Viva System";font-size:8pt;color:#555}@bottom-right{content:"Página " counter(page) " de " counter(pages);font-size:8pt;color:#555}}</style></head>
        <body><div class="container">
            <div class="info-header">Gerado por: ${usuario.nome} (${
    usuario.matricula
  }) em ${new Date().toLocaleString("pt-BR", {
    timeZone: "America/Maceio",
  })}</div>
            <div class="info-filtros"><strong>Filtros aplicados:</strong>
                ${
                  filtros?.dataInicial
                    ? `Data Checklist Inicial: ${formatarDataParaPDFRelatorioTabela(
                        filtros.dataInicial
                      )}<br>`
                    : "Data Checklist Inicial: N/A<br>"
                }
                ${
                  filtros?.dataFinal
                    ? `Data Checklist Final: ${formatarDataParaPDFRelatorioTabela(
                        filtros.dataFinal
                      )}<br>`
                    : "Data Checklist Final: N/A<br>"
                }
                ${
                  filtros?.numero_serie
                    ? `Nº Série: ${filtros.numero_serie}<br>`
                    : "Nº Série: N/A<br>"
                }
                ${
                  filtros?.responsavel
                    ? `Responsável: ${filtros.responsavel}<br>`
                    : "Responsável: N/A<br>"
                }
                ${
                  filtroRemessaAplicado && filtros?.dataRemessaInicial
                    ? `Data Proc. Remessa Inicial: ${formatarDataParaPDFRelatorioTabela(
                        filtros.dataRemessaInicial
                      )}<br>`
                    : ""
                }
                ${
                  filtroRemessaAplicado && filtros?.dataRemessaFinal
                    ? `Data Proc. Remessa Final: ${formatarDataParaPDFRelatorioTabela(
                        filtros.dataRemessaFinal
                      )}<br>`
                    : ""
                }
            </div>
            <table><thead><tr><th>ID</th><th>Nº Série</th><th>Potência</th><th>Marca</th><th>Data Formulário</th><th>Responsável</th><th>Destinado</th>${colunasAdicionaisTh}</tr></thead>
            <tbody>${dados
              .map(
                (item) =>
                  `<tr><td>${item.id || "-"}</td><td>${
                    item.numero_serie || "-"
                  }</td><td>${item.potencia || "-"}</td><td>${
                    item.marca || "-"
                  }</td><td>${item.data_formulario || "-"}</td><td>${
                    item.nome_responsavel || item.responsavel || "-"
                  }</td><td>${
                    item.transformador_destinado || item.destinado || "-"
                  }</td>${colunasAdicionaisTdFn(item)}</tr>`
              )
              .join("")}</tbody>
        </table></div></body></html>`;

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
  });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle" });
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    timeout: 90000,
  });
  await browser.close();
  return pdfBuffer;
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
