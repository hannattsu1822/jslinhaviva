const express = require("express");
const path = require("path");
const xlsx = require("xlsx");
const fs = require("fs");
const { promisePool, upload } = require("../init");
const {
  autenticar,
  verificarPermissaoPorCargo,
  registrarAuditoria,
} = require("../auth");

const router = express.Router();

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

router.get(
  "/transformadores",
  autenticar,
  verificarPermissaoPorCargo,
  (req, res) => {
    res.sendFile(
      path.join(__dirname, "../../public/pages/trafos/transformadores.html")
    );
  }
);
router.get(
  "/upload_transformadores",
  autenticar,
  verificarPermissaoPorCargo,
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "../../public/pages/trafos/upload_transformadores.html"
      )
    );
  }
);
router.get(
  "/formulario_transformadores",
  autenticar,
  verificarPermissaoPorCargo,
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "../../public/pages/trafos/formulario_transformadores.html"
      )
    );
  }
);
router.get(
  "/filtrar_transformadores",
  autenticar,
  verificarPermissaoPorCargo,
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "../../public/pages/trafos/filtrar_transformadores.html"
      )
    );
  }
);
router.get("/relatorio_formulario", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/trafos/relatorio_formulario.html")
  );
});

router.post(
  "/api/upload_transformadores",
  autenticar,
  upload.single("planilha"),
  async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "Nenhum arquivo enviado!" });
    }
    let data = [];
    const dataProcessamentoAtual = new Date().toISOString().split("T")[0];

    try {
      const workbook = xlsx.readFile(req.file.path, { cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      data = xlsx.utils.sheet_to_json(sheet, {
        defval: null,
        raw: false,
        cellDates: true,
      });

      if (!data || data.length === 0) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Planilha vazia ou formato inválido",
          });
      }

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
            (h
              .trim()
              .toUpperCase()
              .includes("DATA DE ENTRADA NO ALMOXARIFADO") &&
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
        reformado_chk: headers.find(
          (h) => h.trim().toUpperCase() === "REFORMADO"
        ),
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
            throw new Error(
              "Número de série não encontrado ou vazio na planilha."
            );

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

          const colNameDataEntrada = columnMap.data_entrada_almox;
          let rawValueDataEntradaDebug = null;
          if (
            colNameDataEntrada &&
            row[colNameDataEntrada] !== undefined &&
            row[colNameDataEntrada] !== null
          ) {
            rawValueDataEntradaDebug = row[colNameDataEntrada];
          }
          console.log(
            `\n--- UPLOAD DEBUG - LINHA ${linhaNro} (Série: ${
              numero_serie_planilha || "N/A"
            }) ---`
          );
          console.log(
            `1. RAW data_entrada_almox (direto da célula): `,
            rawValueDataEntradaDebug,
            `(Tipo: ${typeof rawValueDataEntradaDebug})`
          );

          const data_entrada_almox_val = getValue("data_entrada_almox", true);
          console.log(
            `2. CONVERTED data_entrada_almox_val (APÓS excelSerialDateToJSDate, para SQL): '${data_entrada_almox_val}' (Tipo: ${typeof data_entrada_almox_val})`
          );
          console.log(
            "----------------------------------------------------------------------"
          );

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
              data_fabricacao_final = `${getValue(
                "data_fabricacao_chk"
              )}-01-01`;
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
      let feedbackMessage = `Importação concluída. Processadas ${results.total_rows} linhas.`;
      if (results.new_trafos_imported > 0)
        feedbackMessage += ` ${results.new_trafos_imported} novos transformadores cadastrados.`;
      if (results.trafos_updated > 0)
        feedbackMessage += ` ${results.trafos_updated} transformadores existentes atualizados.`;
      if (results.checklists_imported > 0)
        feedbackMessage += ` ${results.checklists_imported} checklists importados.`;
      if (results.failed_rows > 0)
        feedbackMessage += ` ${results.failed_rows} linhas falharam.`;

      res.json({
        success:
          results.failed_rows < results.total_rows ||
          results.new_trafos_imported > 0 ||
          results.checklists_imported > 0,
        message: feedbackMessage,
        data: results,
      });
    } catch (error) {
      console.error("Erro crítico no upload:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Erro crítico no servidor: " + error.message,
          data: {
            details: [
              { status: "error", message: "Erro crítico: " + error.message },
            ],
            total_rows: data.length,
          },
        });
    } finally {
      if (req.file?.path && fs.existsSync(req.file.path))
        fs.unlinkSync(req.file.path);
    }
  }
);

router.get("/api/responsaveis", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT matricula, nome FROM users WHERE cargo IN ('Engenheiro', 'Técnico', 'Gerente', 'ADMIN', 'ADM', 'Inspetor') ORDER BY nome"
    );
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar responsáveis!" });
  }
});

router.get("/api/supervisores", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT matricula, nome FROM users WHERE cargo IN ('Engenheiro', 'Gerente', 'ADMIN', 'ADM') ORDER BY nome"
    );
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar supervisores!" });
  }
});

router.get(
  "/api/transformadores_sem_checklist",
  autenticar,
  async (req, res) => {
    try {
      const [rows] = await promisePool.query(
        "SELECT t.numero_serie FROM transformadores t WHERE NOT EXISTS (SELECT 1 FROM checklist_transformadores ct WHERE ct.numero_serie = t.numero_serie) ORDER BY t.numero_serie ASC"
      );
      res.status(200).json(rows);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Erro ao buscar transformadores sem checklist!" });
    }
  }
);

router.get(
  "/api/trafos_da_remessa_para_checklist_v2",
  autenticar,
  async (req, res) => {
    const { dataRemessaInicial, dataRemessaFinal } = req.query;
    if (!dataRemessaInicial || !dataRemessaFinal) {
      return res
        .status(400)
        .json({
          message: "Período de data de processamento da remessa é obrigatório.",
        });
    }
    try {
      const query = `
            SELECT 
                t.numero_serie,
                DATE_FORMAT(t.data_processamento_remessa, '%d/%m/%Y') as data_processamento_remessa_formatada,
                DATE_FORMAT(MAX(ct.data_checklist), '%d/%m/%Y') AS data_ultimo_checklist_conhecido_formatada,
                TRUE AS tem_checklist_previo
            FROM 
                transformadores t
            INNER JOIN 
                checklist_transformadores ct ON t.numero_serie = ct.numero_serie
            WHERE 
                t.data_processamento_remessa BETWEEN ? AND ?
            GROUP BY 
                t.numero_serie, t.data_processamento_remessa 
            ORDER BY 
                t.data_processamento_remessa DESC, 
                MAX(ct.data_checklist) DESC, 
                t.numero_serie ASC;
        `;
      const [rows] = await promisePool.query(query, [
        dataRemessaInicial,
        dataRemessaFinal,
      ]);
      const resultados = rows.map((row) => ({
        ...row,
        tem_checklist_previo:
          row.tem_checklist_previo === 1 || row.tem_checklist_previo === true,
      }));
      res.status(200).json(resultados);
    } catch (err) {
      console.error("Erro API /trafos_da_remessa_para_checklist_v2:", err);
      res
        .status(500)
        .json({ message: "Erro ao buscar transformadores da remessa!" });
    }
  }
);

router.get(
  "/api/historico_remessas_transformador/:numero_serie",
  autenticar,
  async (req, res) => {
    const { numero_serie } = req.params;
    try {
      const [logRows] = await promisePool.query(
        "SELECT DISTINCT DATE_FORMAT(data_processamento_remessa, '%d/%m/%Y') as data_proc_fmt FROM log_processamento_remessa_trafos WHERE numero_serie_transformador = ? ORDER BY data_processamento_remessa DESC",
        [numero_serie]
      );
      const datasRemessa = logRows.map((r) => r.data_proc_fmt);
      res.status(200).json({
        numero_serie: numero_serie,
        quantidade_remessas: datasRemessa.length,
        datas_remessas_anteriores: datasRemessa,
      });
    } catch (err) {
      console.error("Erro API /historico_remessas_transformador:", err);
      res
        .status(500)
        .json({ message: "Erro ao buscar histórico de remessas!" });
    }
  }
);

router.post("/api/salvar_checklist", autenticar, async (req, res) => {
  const {
    numero_serie,
    data_fabricacao,
    reformado,
    data_reformado,
    detalhes_tanque,
    corrosao_tanque,
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
  } = req.body;
  if (
    !numero_serie ||
    !matricula_responsavel ||
    !conclusao ||
    !transformador_destinado
  ) {
    return res
      .status(400)
      .json({ message: "Campos obrigatórios não preenchidos!" });
  }
  try {
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

    await promisePool.query(
      `INSERT INTO checklist_transformadores (numero_serie, data_fabricacao, reformado, data_reformado, detalhes_tanque, corrosao_tanque, buchas_primarias, buchas_secundarias, conectores, avaliacao_bobina_i, avaliacao_bobina_ii, avaliacao_bobina_iii, conclusao, transformador_destinado, matricula_responsavel, supervisor_tecnico, observacoes, data_checklist) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
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
      ]
    );
    await registrarAuditoria(
      req.user.matricula,
      "Salvar Checklist",
      `Checklist manual: ${numero_serie}`
    );
    res.status(201).json({ message: "Checklist salvo com sucesso!" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erro ao salvar checklist: " + error.message });
  }
});

router.get("/api/checklist_transformadores_publico/:id", async (req, res) => {
  const { id } = req.params;
  try {
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
    if (rows.length > 0) {
      let result = rows[0];
      if (
        result.supervisor_tecnico === "" ||
        result.supervisor_tecnico === null
      ) {
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
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Checklist não encontrado!" });
    }
  } catch (err) {
    console.error("Erro API /checklist_transformadores_publico:", err);
    res.status(500).json({ message: "Erro ao buscar dados do checklist!" });
  }
});

router.delete(
  "/api/excluir_transformador/:id",
  autenticar,
  async (req, res) => {
    const { id } = req.params;
    try {
      const [chkInfo] = await promisePool.query(
        "SELECT 1 FROM checklist_transformadores WHERE id = ?",
        [id]
      );
      if (chkInfo.length === 0)
        return res.status(404).json({ message: "Checklist não encontrado!" });
      await promisePool.query(
        "DELETE FROM checklist_transformadores WHERE id = ?",
        [id]
      );
      await registrarAuditoria(
        req.user.matricula,
        "Excluir Checklist",
        `Checklist ID: ${id} excluído.`
      );
      res
        .status(200)
        .json({ message: "Checklist de transformador excluído com sucesso!" });
    } catch (err) {
      if (err.code === "ER_ROW_IS_REFERENCED_2")
        return res
          .status(400)
          .json({
            message:
              "Não é possível excluir: referenciado em outros registros.",
          });
      res.status(500).json({ message: "Erro ao excluir checklist!" });
    }
  }
);

router.post("/api/filtrar_transformadores", autenticar, async (req, res) => {
  const {
    numero_serie,
    matricula_responsavel,
    dataInicial,
    dataFinal,
    dataRemessaInicial,
    dataRemessaFinal,
  } = req.body;
  try {
    let query = `
            SELECT ct.id, t.numero_serie, t.potencia, t.marca,
                   DATE_FORMAT(ct.data_checklist, '%d/%m/%Y %H:%i') as data_formulario, 
                   ct.matricula_responsavel, u.nome as nome_responsavel, ct.transformador_destinado,
                   DATE_FORMAT(t.data_processamento_remessa, '%d/%m/%Y') as data_processamento_remessa_formatada
            FROM checklist_transformadores ct
            INNER JOIN transformadores t ON ct.numero_serie = t.numero_serie
            INNER JOIN users u ON ct.matricula_responsavel = u.matricula
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
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao filtrar checklists:", err);
    res.status(500).json({ message: "Erro ao filtrar checklists" });
  }
});

router.get("/api/gerar_pdf/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  let browser;
  try {
    const [chkRows] = await promisePool.query(
      "SELECT t.marca, t.numero_serie FROM checklist_transformadores ct INNER JOIN transformadores t ON ct.numero_serie = t.numero_serie WHERE ct.id = ?",
      [id]
    );
    if (chkRows.length === 0)
      return res.status(404).json({ message: "Checklist não encontrado!" });
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

    const { chromium } = require("playwright");
    browser = await chromium.launch({
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
    await page.goto(
      `${req.protocol}://${req.get("host")}/relatorio_formulario?id=${id}`,
      { waitUntil: "networkidle", timeout: 90000 }
    );
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
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nomeArquivo}"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    if (!res.headersSent)
      res
        .status(500)
        .json({ message: "Erro ao gerar PDF!", error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

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

router.post(
  "/api/gerar_pdf_tabela_transformadores",
  autenticar,
  async (req, res) => {
    const { dados, filtros } = req.body;
    let browser;
    if (!req.user?.nome)
      return res
        .status(401)
        .json({ success: false, message: "Usuário não autenticado." });
    if (!dados?.length)
      return res
        .status(400)
        .json({ success: false, message: "Nenhum dado para gerar PDF." });

    try {
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
                <div class="info-header">Gerado por: ${req.user.nome} (${
        req.user.matricula
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
      const { chromium } = require("playwright");
      browser = await chromium.launch({
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
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=Relatorio_Checklists_Transformadores.pdf"
      );
      res.send(pdfBuffer);
    } catch (error) {
      if (!res.headersSent)
        res
          .status(500)
          .json({
            success: false,
            message: "Erro ao gerar PDF da tabela.",
            error: error.message,
          });
    } finally {
      if (browser) await browser.close();
    }
  }
);

module.exports = router;
