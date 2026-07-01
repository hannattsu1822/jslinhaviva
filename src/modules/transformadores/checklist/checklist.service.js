const { promisePool } = require("../../../infrastructure/database");
const fsPromises = require("fs").promises;
const { publicPage } = require("../../../shared/path.helper");
const { escapeHtml } = require("../../../shared/htmlEscape.helper");
const {
  wrapReportHtml,
  htmlToPdf,
  formatReportDate,
  buildDocumentCode,
  buildTransformerDocumentCode,
} = require("../../../shared/reports/pdfReport.service");
const {
  renderInfoItem,
  renderTextBlock,
  gerarTabelaKeyValueHtml,
  applyTemplatePlaceholders,
} = require("../../../shared/reports/reportHtml.helper");

function formatarValoresConcatenados(valor) {
  if (!valor) return "Não informado";
  return String(valor)
    .split(",")
    .map((item) => item.trim())
    .join(", ");
}

function parseObservacoesSecoes(data) {
  if (!data?.observacoes_secoes) return {};
  try {
    return typeof data.observacoes_secoes === "string"
      ? JSON.parse(data.observacoes_secoes)
      : data.observacoes_secoes;
  } catch {
    return {};
  }
}

function isReformado(data) {
  return (
    data.reformado === 1 ||
    data.reformado === true ||
    String(data.reformado).toLowerCase() === "true"
  );
}

function extrairItensAvaliacao(data, obsSecoes) {
  return [
    {
      label: "Detalhes do Tanque",
      value: formatarValoresConcatenados(data.detalhes_tanque),
      observacao: obsSecoes.tanque,
    },
    {
      label: "Corrosão do Tanque",
      value: data.corrosao_tanque || "N/A",
    },
    {
      label: "Buchas Primárias",
      value: formatarValoresConcatenados(data.buchas_primarias),
      observacao: obsSecoes.buchas_primarias,
    },
    {
      label: "Buchas Secundárias",
      value: formatarValoresConcatenados(data.buchas_secundarias),
      observacao: obsSecoes.buchas_secundarias,
    },
    {
      label: "Conectores",
      value: formatarValoresConcatenados(data.conectores),
      observacao: obsSecoes.conectores,
    },
    {
      label: "Bobina I",
      value: data.avaliacao_bobina_i || "N/A",
      observacao: obsSecoes.bobina_i,
    },
    {
      label: "Bobina II",
      value: data.avaliacao_bobina_ii || "N/A",
      observacao: obsSecoes.bobina_ii,
    },
    {
      label: "Bobina III",
      value: data.avaliacao_bobina_iii || "N/A",
      observacao: obsSecoes.bobina_iii,
    },
  ];
}

async function preencherTemplateHtmlChecklist(data) {
  const templatePath = publicPage(
    "templates/relatorio_checklist_transformador.html"
  );
  let templateHtml = await fsPromises.readFile(templatePath, "utf-8");

  const obsSecoes = parseObservacoesSecoes(data);
  const responsavelLabel = `${data.nome_responsavel || "N/A"} (${data.matricula_responsavel || "N/A"})`;
  const supervisorLabel = `${data.nome_supervisor_fmt || "N/A"} (${data.matricula_supervisor_fmt || "N/A"})`;
  const anoReforma = isReformado(data)
    ? data.data_reformado_formatada || "N/A"
    : "Não Reformado";

  const detalhesChecklistGrid = [
    renderInfoItem("ID do Checklist", escapeHtml(String(data.id))),
    renderInfoItem(
      "Nº de Série",
      escapeHtml(data.numero_serie || data.serie_transformador_ref || "N/A")
    ),
    renderInfoItem(
      "Ano de Fabricação",
      escapeHtml(data.data_fabricacao_formatada || "N/A")
    ),
    renderInfoItem("Ano da Reforma", escapeHtml(anoReforma)),
    renderInfoItem(
      "Data do Formulário",
      escapeHtml(data.data_formulario_completa || "N/A")
    ),
    renderInfoItem("Responsável", escapeHtml(responsavelLabel), true),
    renderInfoItem("Supervisor Técnico", escapeHtml(supervisorLabel), true),
  ].join("");

  const detalhesTransformadorGrid = [
    renderInfoItem("Marca", escapeHtml(data.marca || "N/A")),
    renderInfoItem("Potência (kVA)", escapeHtml(String(data.potencia ?? "N/A"))),
    renderInfoItem(
      "Número de Fases",
      escapeHtml(String(data.numero_fases ?? "N/A"))
    ),
    renderInfoItem(
      "Local de Retirada",
      escapeHtml(data.local_retirada || "N/A")
    ),
    renderInfoItem("Regional", escapeHtml(data.regional || "N/A")),
    renderInfoItem(
      "Entrada no Almoxarifado",
      escapeHtml(data.data_entrada_almoxarifado_formatada || "N/A")
    ),
    renderInfoItem(
      "Último Proc. Remessa",
      escapeHtml(data.data_processamento_remessa_formatada || "N/A")
    ),
    renderInfoItem(
      "Motivo de Desativação",
      escapeHtml(data.motivo_desativacao || "N/A"),
      true
    ),
  ].join("");

  const detalhesConclusaoGrid = [
    renderInfoItem("Conclusão Técnica", escapeHtml(data.conclusao || "N/A")),
    renderInfoItem(
      "Transformador Destinado Para",
      escapeHtml(data.transformador_destinado || "N/A"),
      true
    ),
  ].join("");

  const avaliacaoTecnicaTable = gerarTabelaKeyValueHtml(
    extrairItensAvaliacao(data, obsSecoes),
    {
      dualColumn: true,
      minItemsForDual: 6,
      valueLabel: "Avaliação",
      showObs: true,
    }
  );

  const observacoesBlock = renderTextBlock(
    escapeHtml(data.observacoes || "Nenhuma observação registrada.")
  );

  templateHtml = applyTemplatePlaceholders(templateHtml, {
    detalhes_checklist_grid: detalhesChecklistGrid,
    detalhes_transformador_grid: detalhesTransformadorGrid,
    avaliacao_tecnica_table: avaliacaoTecnicaTable,
    detalhes_conclusao_grid: detalhesConclusaoGrid,
    observacoes_block: observacoesBlock,
  });

  const numeroSerie = data.numero_serie || data.serie_transformador_ref;
  const author = data.nome_responsavel || data.matricula_responsavel || "";

  return wrapReportHtml(templateHtml, {
    title: "Relatório Técnico de Inspeção de Transformador",
    badge: "Transformadores · Checklist",
    processo: `CHK-${data.id}`,
    referenceId: data.id,
    generatedAt: formatReportDate(),
    author: responsavelLabel,
    showSignatures: Boolean(author),
  });
}

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

async function listarAvariadosPendentes({ page = 1, limit = 15, numero_serie = "" }) {
  const currentPage = Number.isFinite(Number(page))
    ? Math.max(1, parseInt(page, 10))
    : 1;
  const pageSize = Number.isFinite(Number(limit))
    ? Math.min(100, Math.max(1, parseInt(limit, 10)))
    : 15;
  const offset = (currentPage - 1) * pageSize;
  const filtroSerie = String(numero_serie || "").trim();

  let whereSql = `WHERE NOT EXISTS (
      SELECT 1
      FROM checklist_transformadores ct
      WHERE ct.numero_serie = t.numero_serie
    )`;
  const params = [];
  if (filtroSerie) {
    whereSql += " AND t.numero_serie LIKE ?";
    params.push(`%${filtroSerie}%`);
  }

  const [[countRows]] = await promisePool.query(
    `SELECT COUNT(*) AS total
     FROM transformadores t
     ${whereSql}`,
    params
  );
  const totalItems = Number(countRows?.total || 0);

  const [rows] = await promisePool.query(
    `SELECT
      t.numero_serie,
      t.marca,
      t.potencia,
      t.local_retirada,
      t.regional,
      t.data_processamento_remessa
     FROM transformadores t
     ${whereSql}
     ORDER BY t.data_processamento_remessa DESC, t.numero_serie ASC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return {
    items: rows,
    pagination: {
      currentPage,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      totalItems,
      itemsPerPage: pageSize,
      hasPrev: currentPage > 1,
      hasNext: offset + rows.length < totalItems,
    },
  };
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
    page = 1,
    limit = 15,
  } = filtros;
  const currentPage = Number.isFinite(Number(page))
    ? Math.max(1, parseInt(page, 10))
    : 1;
  const pageSize = Number.isFinite(Number(limit))
    ? Math.min(100, Math.max(1, parseInt(limit, 10)))
    : 15;
  const offset = (currentPage - 1) * pageSize;
  let whereSql = " WHERE 1=1";
  const params = [];
  if (numero_serie) {
    whereSql += " AND t.numero_serie LIKE ?";
    params.push(`%${numero_serie.trim()}%`);
  }
  if (matricula_responsavel) {
    whereSql += " AND ct.matricula_responsavel = ?";
    params.push(matricula_responsavel.trim());
  }
  if (dataInicial) {
    whereSql += " AND DATE(ct.data_checklist) >= ?";
    params.push(dataInicial);
  }
  if (dataFinal) {
    whereSql += " AND DATE(ct.data_checklist) <= ?";
    params.push(dataFinal);
  }
  if (dataRemessaInicial && dataRemessaFinal) {
    whereSql += " AND t.data_processamento_remessa BETWEEN ? AND ?";
    params.push(dataRemessaInicial, dataRemessaFinal);
  }
  const baseFromSql = `
        FROM checklist_transformadores ct
        INNER JOIN transformadores t ON ct.numero_serie = t.numero_serie
        LEFT JOIN users u ON ct.matricula_responsavel = u.matricula`;
  const countQuery = `
        SELECT COUNT(*) as total
        ${baseFromSql}
        ${whereSql}`;
  const [countRows] = await promisePool.query(countQuery, params);
  const totalItems = Number(countRows?.[0]?.total || 0);

  const query = `
        SELECT ct.id, t.numero_serie, t.potencia, t.marca,
               DATE_FORMAT(ct.data_checklist, '%d/%m/%Y %H:%i') as data_formulario, 
               ct.matricula_responsavel, u.nome as nome_responsavel, ct.transformador_destinado,
               DATE_FORMAT(t.data_processamento_remessa, '%d/%m/%Y') as data_processamento_remessa_formatada
        ${baseFromSql}
        ${whereSql}
        ORDER BY ct.data_checklist DESC, ct.id DESC
        LIMIT ? OFFSET ?`;
  const [rows] = await promisePool.query(query, [...params, pageSize, offset]);
  return {
    items: rows,
    pagination: {
      currentPage,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      totalItems,
      itemsPerPage: pageSize,
      hasPrev: currentPage > 1,
      hasNext: offset + rows.length < totalItems,
    },
  };
}

async function gerarPdfChecklist(id, _protocol, _host) {
  const data = await obterChecklistPublico(id);
  const sanitize = (str, fb = "val") =>
    str == null || String(str).trim() === ""
      ? fb
      : String(str)
          .replace(/[^a-zA-Z0-9\-_]/g, "_")
          .replace(/_{2,}/g, "_")
          .replace(/^_|_$/g, "");
  const nomeArquivo = `Checklist_${sanitize(id, `ID${id}`)}_${sanitize(
    data.marca,
    "MarcaDesconhecida"
  )}_${sanitize(data.numero_serie, "SerieDesconhecida")}.pdf`;

  const docCode = buildTransformerDocumentCode(id, data.numero_serie);
  const htmlContent = await preencherTemplateHtmlChecklist(data);
  const pdfBuffer = await htmlToPdf(htmlContent, {
    landscape: true,
    footerOnly: true,
    docCode,
  });

  return { nomeArquivo, pdfBuffer };
}

async function gerarPdfTabela(dados, filtros, usuario) {
  if (!dados?.length) {
    throw new Error("Nenhum dado para gerar PDF.");
  }

  const filtroRemessaAplicado =
    filtros?.dataRemessaInicial && filtros?.dataRemessaFinal;

  const filtrosLinhas = [
    `Data Checklist Inicial: ${filtros?.dataInicial ? formatarDataParaPDFRelatorioTabela(filtros.dataInicial) : "N/A"}`,
    `Data Checklist Final: ${filtros?.dataFinal ? formatarDataParaPDFRelatorioTabela(filtros.dataFinal) : "N/A"}`,
    `Nº Série: ${filtros?.numero_serie || "N/A"}`,
    `Responsável: ${filtros?.responsavel || "N/A"}`,
  ];
  if (filtroRemessaAplicado) {
    filtrosLinhas.push(
      `Data Proc. Remessa Inicial: ${formatarDataParaPDFRelatorioTabela(filtros.dataRemessaInicial)}`,
      `Data Proc. Remessa Final: ${formatarDataParaPDFRelatorioTabela(filtros.dataRemessaFinal)}`
    );
  }

  const colunaRemessaTh = filtroRemessaAplicado
    ? "<th>Data Proc. Remessa</th>"
    : "";
  const linhasTabela = dados
    .map((item) => {
      const colunaRemessaTd = filtroRemessaAplicado
        ? `<td>${escapeHtml(item.data_processamento_remessa_formatada || "-")}</td>`
        : "";
      return `<tr>
        <td>${escapeHtml(String(item.id ?? "-"))}</td>
        <td>${escapeHtml(item.numero_serie || "-")}</td>
        <td>${escapeHtml(String(item.potencia ?? "-"))}</td>
        <td>${escapeHtml(item.marca || "-")}</td>
        <td>${escapeHtml(item.data_formulario || "-")}</td>
        <td>${escapeHtml(item.nome_responsavel || item.responsavel || "-")}</td>
        <td>${escapeHtml(item.transformador_destinado || item.destinado || "-")}</td>
        ${colunaRemessaTd}
      </tr>`;
    })
    .join("");

  const bodyHtml = `
    <section class="lv-section rt-section">
      <h2 class="rt-section__heading">
        <span class="rt-section__num">1</span> Filtros Aplicados
      </h2>
      <div class="lv-section__body">
        <div class="lv-text-block">${filtrosLinhas.map((l) => escapeHtml(l)).join("<br>")}</div>
      </div>
    </section>
    <section class="lv-section rt-section">
      <h2 class="rt-section__heading">
        <span class="rt-section__num">2</span> Listagem de Checklists
      </h2>
      <div class="lv-section__body">
        <table class="lv-table lv-table--checklist">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nº Série</th>
              <th>Potência</th>
              <th>Marca</th>
              <th>Data Formulário</th>
              <th>Responsável</th>
              <th>Destinado</th>
              ${colunaRemessaTh}
            </tr>
          </thead>
          <tbody>${linhasTabela}</tbody>
        </table>
      </div>
    </section>`;

  const docCode = buildDocumentCode("LIST", Date.now(), { prefix: "LV-TRF" });
  const htmlContent = await wrapReportHtml(bodyHtml, {
    title: "Relatório de Checklists de Transformadores",
    badge: "Transformadores · Listagem",
    processo: "LISTAGEM",
    referenceId: "000",
    generatedAt: formatReportDate(),
    author: `${usuario.nome} (${usuario.matricula})`,
    showSignatures: false,
  });

  return htmlToPdf(htmlContent, {
    landscape: true,
    footerOnly: true,
    docCode,
  });
}

module.exports = {
  listarTrafosSemChecklist,
  listarAvariadosPendentes,
  listarTrafosDaRemessa,
  obterHistoricoRemessas,
  salvarChecklist,
  obterChecklistPublico,
  excluirChecklist,
  filtrarChecklists,
  gerarPdfChecklist,
  gerarPdfTabela,
};
