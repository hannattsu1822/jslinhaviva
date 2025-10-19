const { promisePool } = require("../../../init");
const xlsx = require("xlsx");
const fs = require("fs");

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

async function processarUploadPlanilha(filePath) {
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, {
    defval: null,
    raw: false,
    cellDates: true,
  });

  if (!data || data.length === 0) {
    throw new Error("Planilha vazia ou formato inválido");
  }

  const dataProcessamentoAtual = new Date().toISOString().split("T")[0];
  const headers = data.length > 0 ? Object.keys(data[0]) : [];
  const columnMap = {
    item: headers.find((h) => h.trim().toUpperCase() === "ITEM"),
    marca: headers.find((h) => h.trim().toUpperCase() === "MARCA"),
    potencia: headers.find(
      (h) =>
        h.trim().toUpperCase().includes("POTÊNCIA") ||
        h.trim().toUpperCase().includes("POTENCIA") ||
        h.trim().toUpperCase().includes("KVA")
    ),
    fases: headers.find(
      (h) =>
        h.trim().toUpperCase().includes("FASES") ||
        h.trim().toUpperCase().includes("FASE") ||
        h.trim().toUpperCase().includes("N° DE FASES")
    ),
    serie: headers.find(
      (h) =>
        h.trim().toUpperCase().includes("SÉRIE") ||
        h.trim().toUpperCase().includes("SERIE") ||
        h.trim().toUpperCase().includes("N° DE SÉRIE") ||
        h.trim().toUpperCase() === "NUMERO DE SERIE"
    ),
    local: headers.find(
      (h) =>
        h.trim().toUpperCase().includes("LOCAL") ||
        h.trim().toUpperCase().includes("RETIRADA")
    ),
    regional: headers.find((h) => h.trim().toUpperCase() === "REGIONAL"),
    motivo: headers.find(
      (h) =>
        h.trim().toUpperCase().includes("MOTIVO DA DESATIVAÇÃO") ||
        h.trim().toUpperCase().includes("MOTIVO") ||
        h.trim().toUpperCase().includes("DESATIVAÇÃO") ||
        h.trim().toUpperCase().includes("DESATIVACAO")
    ),
    data_entrada_almox: headers.find(
      (h) =>
        (h.trim().toUpperCase().includes("DATA DE ENTRADA NO ALMOXARIFADO") &&
          h.trim().toUpperCase().includes("RETIRADA")) ||
        (h.trim().toUpperCase().includes("DATA ENTRADA") &&
          h.trim().toUpperCase().includes("ALMOX"))
    ),
    data_evento_checklist: headers.find(
      (h) =>
        h.trim().toUpperCase() === "DATA CHECKLIST" ||
        h.trim().toUpperCase() === "DATA DO EVENTO" ||
        h.trim().toUpperCase() === "DATA DA INSPECAO"
    ),
    data_fabricacao_chk: headers.find(
      (h) =>
        h.trim().toUpperCase() === "DATA FABRICACAO" ||
        h.trim().toUpperCase() === "ANO FABRICACAO"
    ),
    reformado_chk: headers.find((h) => h.trim().toUpperCase() === "REFORMADO"),
    data_reformado_chk: headers.find(
      (h) =>
        h.trim().toUpperCase() === "DATA REFORMA" ||
        h.trim().toUpperCase() === "ANO REFORMA"
    ),
    detalhes_tanque_chk: headers.find(
      (h) => h.trim().toUpperCase() === "DETALHES DO TANQUE"
    ),
    corrosao_tanque_chk: headers.find(
      (h) => h.trim().toUpperCase() === "CORROSAO DO TANQUE"
    ),
    buchas_primarias_chk: headers.find(
      (h) => h.trim().toUpperCase() === "BUCHAS PRIMARIAS"
    ),
    buchas_secundarias_chk: headers.find(
      (h) => h.trim().toUpperCase() === "BUCHAS SECUNDARIAS"
    ),
    conectores_chk: headers.find(
      (h) => h.trim().toUpperCase() === "CONECTORES"
    ),
    bobina_i_chk: headers.find(
      (h) =>
        h.trim().toUpperCase() === "AVALIACAO BOBINA I" ||
        h.trim().toUpperCase() === "BOBINA I"
    ),
    bobina_ii_chk: headers.find(
      (h) =>
        h.trim().toUpperCase() === "AVALIACAO BOBINA II" ||
        h.trim().toUpperCase() === "BOBINA II"
    ),
    bobina_iii_chk: headers.find(
      (h) =>
        h.trim().toUpperCase() === "AVALIACAO BOBINA III" ||
        h.trim().toUpperCase() === "BOBINA III"
    ),
    conclusao_chk: headers.find(
      (h) =>
        h.trim().toUpperCase() === "CONCLUSAO" ||
        h.trim().toUpperCase() === "CONCLUSÃO"
    ),
    destinado_chk: headers.find(
      (h) =>
        h.trim().toUpperCase() === "TRANSFORMADOR DESTINADO" ||
        h.trim().toUpperCase() === "DESTINO"
    ),
    responsavel_chk: headers.find(
      (h) =>
        h.trim().toUpperCase() === "MATRICULA RESPONSAVEL" ||
        h.trim().toUpperCase() === "RESPONSAVEL TECNICO" ||
        h.trim().toUpperCase() === "RESPONSAVEL"
    ),
    supervisor_chk: headers.find(
      (h) =>
        h.trim().toUpperCase() === "MATRICULA SUPERVISOR" ||
        h.trim().toUpperCase() === "SUPERVISOR TECNICO" ||
        h.trim().toUpperCase() === "SUPERVISOR"
    ),
    obs_chk: headers.find(
      (h) =>
        h.trim().toUpperCase() === "OBSERVACOES" ||
        h.trim().toUpperCase() === "OBSERVAÇÕES"
    ),
  };

  const requiredBaseColsForTrafo = ["item", "serie", "marca", "potencia"];
  const minColsForChecklist = [
    "data_evento_checklist",
    "conclusao_chk",
    "destinado_chk",
    "responsavel_chk",
    "serie",
  ];
  const results = {
    total_rows: data.length,
    new_trafos_imported: 0,
    trafos_updated: 0,
    checklists_imported: 0,
    failed_rows: 0,
    details: [],
    warnings_planilha: [],
  };

  for (const [index, row] of data.entries()) {
    const linhaNro = index + 2;
    let numero_serie_planilha = null;
    let trafoProcessedMessage = "";
    try {
      const getValue = (key, treatAsDate = false) => {
        const colName = columnMap[key];
        if (
          !colName ||
          row[colName] === undefined ||
          row[colName] === null ||
          (typeof row[colName] === "string" &&
            String(row[colName]).trim() === "")
        )
          return null;
        const rawValue = row[colName];
        if (treatAsDate) return excelSerialDateToJSDate(rawValue);
        return typeof rawValue === "string"
          ? String(rawValue).trim()
          : rawValue;
      };

      numero_serie_planilha = getValue("serie");
      if (!numero_serie_planilha)
        throw new Error("Número de série não encontrado ou vazio na planilha.");

      const missingTrafoColsData = requiredBaseColsForTrafo.filter(
        (key) => !getValue(key)
      );
      if (missingTrafoColsData.length > 0) {
        const missingColNames = missingTrafoColsData.map(
          (key) => columnMap[key] || key
        );
        throw new Error(
          `Dados cadastrais obrigatórios (${missingColNames.join(
            ", "
          )}) ausentes para série: ${numero_serie_planilha}.`
        );
      }

      const [existingTrafos] = await promisePool.query(
        "SELECT numero_serie FROM transformadores WHERE numero_serie = ?",
        [numero_serie_planilha]
      );
      const isNewTransformador = existingTrafos.length === 0;

      const item_val = getValue("item");
      const marca_val = getValue("marca");
      const potencia_val = getValue("potencia");
      const data_entrada_almox_val = getValue("data_entrada_almox", true);

      if (isNewTransformador) {
        await promisePool.query(
          `INSERT INTO transformadores (item, marca, potencia, numero_fases, numero_serie, local_retirada, regional, motivo_desativacao, data_entrada_almoxarifado, data_processamento_remessa) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item_val,
            marca_val,
            potencia_val,
            getValue("fases"),
            numero_serie_planilha,
            getValue("local"),
            getValue("regional"),
            getValue("motivo"),
            data_entrada_almox_val,
            dataProcessamentoAtual,
          ]
        );
        results.new_trafos_imported++;
        trafoProcessedMessage = "Novo transformador cadastrado.";
      } else {
        await promisePool.query(
          "UPDATE transformadores SET item = ?, marca = ?, potencia = ?, numero_fases = ?, local_retirada = ?, regional = ?, motivo_desativacao = ?, data_entrada_almoxarifado = ?, data_processamento_remessa = ? WHERE numero_serie = ?",
          [
            item_val,
            marca_val,
            potencia_val,
            getValue("fases"),
            getValue("local"),
            getValue("regional"),
            getValue("motivo"),
            data_entrada_almox_val,
            dataProcessamentoAtual,
            numero_serie_planilha,
          ]
        );
        results.trafos_updated++;
        trafoProcessedMessage =
          "Transformador existente atualizado (incluindo data de remessa).";
      }

      await promisePool.query(
        "INSERT INTO log_processamento_remessa_trafos (numero_serie_transformador, data_processamento_remessa) VALUES (?, ?)",
        [numero_serie_planilha, dataProcessamentoAtual]
      );

      const canImportChecklist = minColsForChecklist.every(
        (colKey) => columnMap[colKey] && getValue(colKey) !== null
      );
      if (canImportChecklist) {
        const data_checklist_val = getValue("data_evento_checklist", true);
        const conclusao_val = getValue("conclusao_chk");
        const transformador_destinado_val = getValue("destinado_chk");
        const matricula_responsavel_val = getValue("responsavel_chk");

        if (
          !data_checklist_val ||
          !conclusao_val ||
          !transformador_destinado_val ||
          !matricula_responsavel_val
        ) {
          results.details.push({
            linha: linhaNro,
            numero_serie: numero_serie_planilha,
            status: "warning",
            message: `${trafoProcessedMessage} Dados de checklist incompletos. Checklist não importado.`,
          });
          continue;
        }
        const reformado_str = getValue("reformado_chk");
        const reformadoBool = reformado_str
          ? reformado_str.toLowerCase() === "sim" ||
            reformado_str.toLowerCase() === "true" ||
            reformado_str === "1"
          : false;
        const data_reformado_val = reformadoBool
          ? getValue("data_reformado_chk", true)
          : null;
        let data_fabricacao_final = getValue("data_fabricacao_chk", true);
        if (
          getValue("data_fabricacao_chk") &&
          /^\d{4}$/.test(getValue("data_fabricacao_chk"))
        )
          data_fabricacao_final = `${getValue("data_fabricacao_chk")}-01-01`;
        let data_reformado_final = data_reformado_val;
        if (
          data_reformado_val &&
          getValue("data_reformado_chk") &&
          /^\d{4}$/.test(getValue("data_reformado_chk"))
        )
          data_reformado_final = `${getValue("data_reformado_chk")}-01-01`;

        await promisePool.query(
          `INSERT INTO checklist_transformadores (numero_serie, data_fabricacao, reformado, data_reformado, detalhes_tanque, corrosao_tanque, buchas_primarias, buchas_secundarias, conectores, avaliacao_bobina_i, avaliacao_bobina_ii, avaliacao_bobina_iii, conclusao, transformador_destinado, matricula_responsavel, supervisor_tecnico, observacoes, data_checklist) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            numero_serie_planilha,
            data_fabricacao_final,
            reformadoBool,
            data_reformado_final,
            getValue("detalhes_tanque_chk"),
            getValue("corrosao_tanque_chk") || "NENHUMA",
            getValue("buchas_primarias_chk"),
            getValue("buchas_secundarias_chk"),
            getValue("conectores_chk"),
            getValue("bobina_i_chk"),
            getValue("bobina_ii_chk"),
            getValue("bobina_iii_chk"),
            conclusao_val,
            transformador_destinado_val,
            matricula_responsavel_val,
            getValue("supervisor_chk"),
            getValue("obs_chk"),
            data_checklist_val,
          ]
        );
        results.checklists_imported++;
        results.details.push({
          linha: linhaNro,
          numero_serie: numero_serie_planilha,
          status: "success",
          message: `${trafoProcessedMessage} E novo checklist importado.`,
        });
      } else {
        results.details.push({
          linha: linhaNro,
          numero_serie: numero_serie_planilha,
          status: "success",
          message: `${trafoProcessedMessage} Colunas de checklist não encontradas/incompletas. Nenhum checklist importado.`,
        });
      }
    } catch (error) {
      results.failed_rows++;
      results.details.push({
        linha: linhaNro,
        numero_serie: numero_serie_planilha || "N/A",
        status: "error",
        message:
          error.message +
          (error.sqlMessage ? ` (DB: ${error.sqlMessage})` : ""),
      });
    }
  }

  if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return results;
}

async function listarResponsaveis() {
  const [rows] = await promisePool.query(
    "SELECT matricula, nome FROM users WHERE cargo IN ('Engenheiro', 'Técnico', 'Gerente', 'ADMIN', 'ADM', 'Inspetor') ORDER BY nome"
  );
  return rows;
}

async function listarSupervisores() {
  const [rows] = await promisePool.query(
    "SELECT matricula, nome FROM users WHERE cargo IN ('Engenheiro', 'Gerente', 'ADMIN', 'ADM') ORDER BY nome"
  );
  return rows;
}

module.exports = {
  processarUploadPlanilha,
  listarResponsaveis,
  listarSupervisores,
};
