const { promisePool } = require("../../../infrastructure/database");
const ExcelJS = require("exceljs");
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

async function registrarMovimentacaoTransformador(connection, payload) {
  const {
    numero_serie,
    tipo_evento,
    origem = "IMPORT_PLANILHA_AVARIADOS",
    item,
    marca,
    potencia,
    numero_fases,
    local_retirada,
    regional,
    motivo_desativacao,
    data_entrada_almoxarifado,
    data_processamento_remessa,
  } = payload;

  try {
    await connection.query(
      `INSERT INTO transformadores_movimentacoes (
        numero_serie, tipo_evento, origem,
        item, marca, potencia, numero_fases,
        local_retirada, regional, motivo_desativacao,
        data_entrada_almoxarifado, data_processamento_remessa,
        data_evento
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        numero_serie,
        tipo_evento,
        origem,
        item || null,
        marca || null,
        potencia || null,
        numero_fases || null,
        local_retirada || null,
        regional || null,
        motivo_desativacao || null,
        data_entrada_almoxarifado || null,
        data_processamento_remessa || null,
      ]
    );
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR") {
      return;
    }
    throw error;
  }
}

async function buscarMovimentacoesTransformador(numeroSerie) {
  try {
    const [rows] = await promisePool.query(
      `SELECT id, numero_serie, tipo_evento, origem,
              item, marca, potencia, numero_fases,
              local_retirada, regional, motivo_desativacao,
              data_entrada_almoxarifado, data_processamento_remessa, data_evento
       FROM transformadores_movimentacoes
       WHERE numero_serie = ?
       ORDER BY data_evento DESC, id DESC`,
      [numeroSerie]
    );
    return rows;
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      return [];
    }
    throw error;
  }
}

async function processarUploadPlanilha(filePath, options = {}) {
  const dryRun = options.dryRun === true;
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount < 2) {
      throw new Error("Planilha vazia ou formato inválido");
    }

    const headerRow = worksheet.getRow(1);
    const headers = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      headers[colNumber - 1] = cell.value ? String(cell.value).trim() : "";
    });

    const dataProcessamentoAtual = new Date().toISOString().split("T")[0];

    const columnMap = {
      item: headers.findIndex((h) => h.toUpperCase() === "ITEM"),
      marca: headers.findIndex((h) => h.toUpperCase() === "MARCA"),
      potencia: headers.findIndex(
        (h) =>
          h.toUpperCase().includes("POTÊNCIA") ||
          h.toUpperCase().includes("POTENCIA") ||
          h.toUpperCase().includes("KVA")
      ),
      fases: headers.findIndex(
        (h) =>
          h.toUpperCase().includes("FASES") ||
          h.toUpperCase().includes("FASE") ||
          h.toUpperCase().includes("N° DE FASES")
      ),
      serie: headers.findIndex(
        (h) =>
          h.toUpperCase().includes("SÉRIE") ||
          h.toUpperCase().includes("SERIE") ||
          h.toUpperCase().includes("N° DE SÉRIE") ||
          h.toUpperCase() === "NUMERO DE SERIE"
      ),
      local: headers.findIndex(
        (h) =>
          h.toUpperCase().includes("LOCAL") ||
          h.toUpperCase().includes("RETIRADA")
      ),
      regional: headers.findIndex((h) => h.toUpperCase() === "REGIONAL"),
      motivo: headers.findIndex(
        (h) =>
          h.toUpperCase().includes("MOTIVO DA DESATIVAÇÃO") ||
          h.toUpperCase().includes("MOTIVO") ||
          h.toUpperCase().includes("DESATIVAÇÃO") ||
          h.toUpperCase().includes("DESATIVACAO")
      ),
      data_entrada_almox: headers.findIndex(
        (h) =>
          (h.toUpperCase().includes("DATA DE ENTRADA NO ALMOXARIFADO") &&
            h.toUpperCase().includes("RETIRADA")) ||
          (h.toUpperCase().includes("DATA ENTRADA") &&
            h.toUpperCase().includes("ALMOX"))
      ),
      data_evento_checklist: headers.findIndex(
        (h) =>
          h.toUpperCase() === "DATA CHECKLIST" ||
          h.toUpperCase() === "DATA DO EVENTO" ||
          h.toUpperCase() === "DATA DA INSPECAO"
      ),
      data_fabricacao_chk: headers.findIndex(
        (h) =>
          h.toUpperCase() === "DATA FABRICACAO" ||
          h.toUpperCase() === "ANO FABRICACAO"
      ),
      reformado_chk: headers.findIndex((h) => h.toUpperCase() === "REFORMADO"),
      data_reformado_chk: headers.findIndex(
        (h) =>
          h.toUpperCase() === "DATA REFORMA" ||
          h.toUpperCase() === "ANO REFORMA"
      ),
      detalhes_tanque_chk: headers.findIndex(
        (h) => h.toUpperCase() === "DETALHES DO TANQUE"
      ),
      corrosao_tanque_chk: headers.findIndex(
        (h) => h.toUpperCase() === "CORROSAO DO TANQUE"
      ),
      buchas_primarias_chk: headers.findIndex(
        (h) => h.toUpperCase() === "BUCHAS PRIMARIAS"
      ),
      buchas_secundarias_chk: headers.findIndex(
        (h) => h.toUpperCase() === "BUCHAS SECUNDARIAS"
      ),
      conectores_chk: headers.findIndex(
        (h) => h.toUpperCase() === "CONECTORES"
      ),
      bobina_i_chk: headers.findIndex(
        (h) =>
          h.toUpperCase() === "AVALIACAO BOBINA I" ||
          h.toUpperCase() === "BOBINA I"
      ),
      bobina_ii_chk: headers.findIndex(
        (h) =>
          h.toUpperCase() === "AVALIACAO BOBINA II" ||
          h.toUpperCase() === "BOBINA II"
      ),
      bobina_iii_chk: headers.findIndex(
        (h) =>
          h.toUpperCase() === "AVALIACAO BOBINA III" ||
          h.toUpperCase() === "BOBINA III"
      ),
      conclusao_chk: headers.findIndex(
        (h) =>
          h.toUpperCase() === "CONCLUSAO" ||
          h.toUpperCase() === "CONCLUSÃO"
      ),
      destinado_chk: headers.findIndex(
        (h) =>
          h.toUpperCase() === "TRANSFORMADOR DESTINADO" ||
          h.toUpperCase() === "DESTINO"
      ),
      responsavel_chk: headers.findIndex(
        (h) =>
          h.toUpperCase() === "MATRICULA RESPONSAVEL" ||
          h.toUpperCase() === "RESPONSAVEL TECNICO" ||
          h.toUpperCase() === "RESPONSAVEL"
      ),
      supervisor_chk: headers.findIndex(
        (h) =>
          h.toUpperCase() === "MATRICULA SUPERVISOR" ||
          h.toUpperCase() === "SUPERVISOR TECNICO" ||
          h.toUpperCase() === "SUPERVISOR"
      ),
      obs_chk: headers.findIndex(
        (h) =>
          h.toUpperCase() === "OBSERVACOES" ||
          h.toUpperCase() === "OBSERVAÇÕES"
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
      total_rows: worksheet.rowCount - 1,
      new_trafos_imported: 0,
      trafos_updated: 0,
      checklists_imported: 0,
      failed_rows: 0,
      details: [],
      warnings_planilha: [],
    };

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const linhaNro = rowNumber;
      let numero_serie_planilha = null;
      let trafoProcessedMessage = "";

      try {
        const getValue = (key, treatAsDate = false) => {
          const colIndex = columnMap[key];
          if (colIndex === -1) return null;
          const cell = row.getCell(colIndex + 1);
          if (!cell || cell.value === undefined || cell.value === null) return null;
          let rawValue = cell.value;
          if (rawValue && typeof rawValue === "object" && rawValue.richText) {
            rawValue = rawValue.richText.map((r) => r.text).join("");
          }
          if (rawValue && typeof rawValue === "object" && rawValue.result !== undefined) {
            rawValue = rawValue.result;
          }
          if (typeof rawValue === "string" && String(rawValue).trim() === "") return null;
          if (treatAsDate) return excelSerialDateToJSDate(rawValue);
          return typeof rawValue === "string" ? String(rawValue).trim() : rawValue;
        };

        numero_serie_planilha = getValue("serie");
        if (!numero_serie_planilha)
          throw new Error("Número de série não encontrado ou vazio na planilha.");

        numero_serie_planilha = String(numero_serie_planilha).trim();
        if (!numero_serie_planilha)
          throw new Error("Número de série não encontrado ou vazio na planilha.");

        const missingTrafoColsData = requiredBaseColsForTrafo.filter(
          (key) => !getValue(key)
        );
        if (missingTrafoColsData.length > 0) {
          const missingColNames = missingTrafoColsData.map(
            (key) => headers[columnMap[key]] || key
          );
          throw new Error(
            `Dados cadastrais obrigatórios (${missingColNames.join(
              ", "
            )}) ausentes para série: ${numero_serie_planilha}.`
          );
        }

        const [existingTrafos] = await connection.query(
          "SELECT numero_serie FROM transformadores WHERE numero_serie = ?",
          [numero_serie_planilha]
        );
        const isNewTransformador = existingTrafos.length === 0;

        const item_val = getValue("item");
        const marca_val = getValue("marca");
        const potencia_val = getValue("potencia");
        const data_entrada_almox_val = getValue("data_entrada_almox", true);

        if (isNewTransformador) {
          const insertParams = [
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
          ];
          try {
            await connection.query(
              `INSERT INTO transformadores (item, marca, potencia, numero_fases, numero_serie, local_retirada, regional, motivo_desativacao, data_entrada_almoxarifado, data_processamento_remessa, tipo_entrada)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVARIADO_QUEIMADO')`,
              insertParams
            );
          } catch (insertError) {
            if (insertError.code !== "ER_BAD_FIELD_ERROR") throw insertError;
            await connection.query(
              `INSERT INTO transformadores (item, marca, potencia, numero_fases, numero_serie, local_retirada, regional, motivo_desativacao, data_entrada_almoxarifado, data_processamento_remessa)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              insertParams
            );
          }
          results.new_trafos_imported++;
          trafoProcessedMessage = "Novo transformador cadastrado.";
        } else {
          const updateParams = [
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
          ];
          try {
            await connection.query(
              "UPDATE transformadores SET item = ?, marca = ?, potencia = ?, numero_fases = ?, local_retirada = ?, regional = ?, motivo_desativacao = ?, data_entrada_almoxarifado = ?, data_processamento_remessa = ?, tipo_entrada = 'AVARIADO_QUEIMADO' WHERE numero_serie = ?",
              updateParams
            );
          } catch (updateError) {
            if (updateError.code !== "ER_BAD_FIELD_ERROR") throw updateError;
            await connection.query(
              "UPDATE transformadores SET item = ?, marca = ?, potencia = ?, numero_fases = ?, local_retirada = ?, regional = ?, motivo_desativacao = ?, data_entrada_almoxarifado = ?, data_processamento_remessa = ? WHERE numero_serie = ?",
              updateParams
            );
          }
          results.trafos_updated++;
          trafoProcessedMessage =
            "Transformador existente atualizado (incluindo data de remessa).";
        }

        await registrarMovimentacaoTransformador(connection, {
          numero_serie: numero_serie_planilha,
          tipo_evento: isNewTransformador
            ? "CADASTRO_AVARIADO_QUEIMADO"
            : "ATUALIZACAO_AVARIADO_QUEIMADO",
          item: item_val,
          marca: marca_val,
          potencia: potencia_val,
          numero_fases: getValue("fases"),
          local_retirada: getValue("local"),
          regional: getValue("regional"),
          motivo_desativacao: getValue("motivo"),
          data_entrada_almoxarifado: data_entrada_almox_val,
          data_processamento_remessa: dataProcessamentoAtual,
        });

        await connection.query(
          "INSERT INTO log_processamento_remessa_trafos (numero_serie_transformador, data_processamento_remessa) VALUES (?, ?)",
          [numero_serie_planilha, dataProcessamentoAtual]
        );

        const canImportChecklist = minColsForChecklist.every(
          (colKey) => columnMap[colKey] !== -1 && getValue(colKey) !== null
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

          await connection.query(
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

    if (dryRun) {
      await connection.rollback();
      return { ...results, dry_run: true };
    }

    await connection.commit();
    return { ...results, dry_run: false };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
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

async function obterHistoricoUnificadoPorSerie(
  numeroSerieRaw,
  { page = 1, limit = 10 } = {}
) {
  const numeroSerie = String(numeroSerieRaw || "").trim();
  if (!numeroSerie) throw new Error("Número de série é obrigatório.");
  const currentPage = Number.isFinite(Number(page))
    ? Math.max(1, parseInt(page, 10))
    : 1;
  const pageSize = Number.isFinite(Number(limit))
    ? Math.min(100, Math.max(1, parseInt(limit, 10)))
    : 10;

  const [[transformadorRows], movimentacoesRows, [remessasRows], [reformadosRows], [testesRows], [checklistsRows]] =
    await Promise.all([
      promisePool.query(
        `SELECT numero_serie, item, marca, potencia, numero_fases, local_retirada, regional,
                motivo_desativacao, data_entrada_almoxarifado, data_processamento_remessa
         FROM transformadores
         WHERE numero_serie = ?
         LIMIT 1`,
        [numeroSerie]
      ),
      buscarMovimentacoesTransformador(numeroSerie),
      promisePool.query(
        `SELECT id, data_processamento_remessa
         FROM log_processamento_remessa_trafos
         WHERE numero_serie_transformador = ?
         ORDER BY data_processamento_remessa DESC, id DESC`,
        [numeroSerie]
      ),
      promisePool.query(
        `SELECT id, status_avaliacao, data_importacao, data_avaliacao, resultado_avaliacao,
                tecnico_responsavel, fabricante, pot
         FROM trafos_reformados
         WHERE numero_serie = ?
         ORDER BY id DESC`,
        [numeroSerie]
      ),
      promisePool.query(
        `SELECT tst.id, tst.trafos_reformados_id, tst.conclusao_checklist, tst.data_teste,
                tst.tecnico_responsavel_teste, tr.status_avaliacao
         FROM trafos_reformados_testes tst
         JOIN trafos_reformados tr ON tr.id = tst.trafos_reformados_id
         WHERE tr.numero_serie = ?
         ORDER BY tst.data_teste DESC, tst.id DESC`,
        [numeroSerie]
      ),
      promisePool.query(
        `SELECT id, data_checklist, conclusao, matricula_responsavel, supervisor_tecnico,
                transformador_destinado, observacoes, reformado
         FROM checklist_transformadores
         WHERE numero_serie = ?
         ORDER BY data_checklist DESC, id DESC`,
        [numeroSerie]
      ),
    ]);

  const transformador = transformadorRows[0] || null;
  const eventos = [];

  if (transformador) {
    eventos.push({
      tipo: "cadastro_transformador",
      data_evento:
        transformador.data_processamento_remessa ||
        transformador.data_entrada_almoxarifado ||
        null,
      titulo: "Cadastro/estado atual no almoxarifado",
      detalhes: {
        item: transformador.item,
        marca: transformador.marca,
        potencia: transformador.potencia,
        numero_fases: transformador.numero_fases,
        local_retirada: transformador.local_retirada,
        regional: transformador.regional,
        motivo_desativacao: transformador.motivo_desativacao,
        data_entrada_almoxarifado: transformador.data_entrada_almoxarifado,
      },
    });
  }

  movimentacoesRows.forEach((row) => {
    eventos.push({
      tipo: "movimentacao_almoxarifado",
      data_evento:
        row.data_evento ||
        row.data_processamento_remessa ||
        row.data_entrada_almoxarifado ||
        null,
      titulo: `Movimentação (${row.tipo_evento || "EVENTO"})`,
      detalhes: {
        id_movimentacao: row.id,
        origem: row.origem,
        item: row.item,
        marca: row.marca,
        potencia: row.potencia,
        numero_fases: row.numero_fases,
        local_retirada: row.local_retirada,
        regional: row.regional,
        motivo_desativacao: row.motivo_desativacao,
        data_entrada_almoxarifado: row.data_entrada_almoxarifado,
        data_processamento_remessa: row.data_processamento_remessa,
      },
    });
  });

  remessasRows.forEach((row) => {
    eventos.push({
      tipo: "remessa_almoxarifado",
      data_evento: row.data_processamento_remessa || null,
      titulo: "Processamento de remessa no almoxarifado",
      detalhes: { id_log: row.id },
    });
  });

  reformadosRows.forEach((row) => {
    eventos.push({
      tipo: "ciclo_reformado",
      data_evento: row.data_avaliacao || row.data_importacao || null,
      titulo: `Ciclo reformado #${row.id} (${row.status_avaliacao})`,
      detalhes: {
        id_registro: row.id,
        status_avaliacao: row.status_avaliacao,
        data_importacao: row.data_importacao,
        data_avaliacao: row.data_avaliacao,
        resultado_avaliacao: row.resultado_avaliacao,
        tecnico_responsavel: row.tecnico_responsavel,
        fabricante: row.fabricante,
        pot: row.pot,
      },
    });
  });

  testesRows.forEach((row) => {
    eventos.push({
      tipo: "avaliacao_reformado",
      data_evento: row.data_teste || null,
      titulo: `Avaliação técnica (teste #${row.id})`,
      detalhes: {
        id_teste: row.id,
        id_registro_reformado: row.trafos_reformados_id,
        conclusao_checklist: row.conclusao_checklist,
        status_registro: row.status_avaliacao,
        tecnico_responsavel_teste: row.tecnico_responsavel_teste,
      },
    });
  });

  checklistsRows.forEach((row) => {
    eventos.push({
      tipo: "checklist_transformador",
      data_evento: row.data_checklist || null,
      titulo: `Checklist do módulo transformadores (#${row.id})`,
      detalhes: {
        id_checklist: row.id,
        conclusao: row.conclusao,
        matricula_responsavel: row.matricula_responsavel,
        supervisor_tecnico: row.supervisor_tecnico,
        transformador_destinado: row.transformador_destinado,
        observacoes: row.observacoes,
        reformado: row.reformado,
      },
    });
  });

  eventos.sort((a, b) => {
    const da = a.data_evento ? new Date(a.data_evento).getTime() : 0;
    const db = b.data_evento ? new Date(b.data_evento).getTime() : 0;
    return db - da;
  });
  const totalEventos = eventos.length;
  const offset = (currentPage - 1) * pageSize;
  const eventosPaginados = eventos.slice(offset, offset + pageSize);

  return {
    numero_serie: numeroSerie,
    transformador,
    totais: {
      movimentacoes: movimentacoesRows.length,
      remessas: remessasRows.length,
      ciclos_reformados: reformadosRows.length,
      avaliacoes_reformado: testesRows.length,
      checklists_transformador: checklistsRows.length,
      eventos: totalEventos,
    },
    eventos: eventosPaginados,
    pagination: {
      page: currentPage,
      limit: pageSize,
      total_items: totalEventos,
      total_pages: Math.max(1, Math.ceil(totalEventos / pageSize)),
      has_prev: currentPage > 1,
      has_next: offset + eventosPaginados.length < totalEventos,
    },
  };
}

module.exports = {
  processarUploadPlanilha,
  listarResponsaveis,
  listarSupervisores,
  obterHistoricoUnificadoPorSerie,
};
