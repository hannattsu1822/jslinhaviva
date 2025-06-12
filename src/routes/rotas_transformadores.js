const express = require("express");
const path = require("path");
const xlsx = require("xlsx");
const { chromium } = require("playwright");
const fs = require("fs");
const { promisePool, upload } = require("../init");
const {
  autenticar,
  verificarPermissaoPorCargo,
  registrarAuditoria,
} = require("../auth");

const router = express.Router();

function excelSerialDateToJSDate(input) {
  if (input instanceof Date) {
    if (!isNaN(input.getTime())) {
      return input.toISOString().split("T")[0];
    }
  }
  if (
    typeof input === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(input)
  ) {
    try {
      const date = new Date(input);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
    } catch (e) {
      // Continua
    }
  }
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    try {
      const date = new Date(input + "T00:00:00Z");
      if (
        !isNaN(date.getTime()) &&
        input === date.toISOString().split("T")[0]
      ) {
        return input;
      }
      if (!isNaN(new Date(input).getTime())) {
        return new Date(input).toISOString().split("T")[0];
      }
    } catch (e) {
      // Continua
    }
  }
  if (!isNaN(parseFloat(input)) && isFinite(input)) {
    try {
      const numInput = Number(input);
      const utcDays = Math.floor(numInput - (numInput > 60 ? 25569 : 25568));
      const utcValue = utcDays * 86400;
      const date = new Date(utcValue * 1000);
      if (isNaN(date.getTime())) {
        throw new Error("Data serial do Excel inválida após conversão");
      }
      return date.toISOString().split("T")[0];
    } catch (err) {
      console.error("Erro ao converter data serial do Excel:", input, err);
      return null;
    }
  }
  if (typeof input === "string") {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) {
      try {
        const [day, month, year] = input.split("/");
        if (
          parseInt(month, 10) > 0 &&
          parseInt(month, 10) <= 12 &&
          parseInt(day, 10) > 0 &&
          parseInt(day, 10) <= 31
        ) {
          const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split("T")[0];
          }
        }
      } catch (err) {
        console.error("Erro ao converter data string DD/MM/YYYY:", input, err);
        return null;
      }
    }
    try {
      const directDate = new Date(input);
      if (!isNaN(directDate.getTime())) {
        if (String(Number(input)) !== input) {
          return directDate.toISOString().split("T")[0];
        }
      }
    } catch (e) {
      // Ignora
    }
  }
  console.warn(
    "Formato de data não reconhecido pela excelSerialDateToJSDate:",
    input
  );
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

router.get(
  "/editar_transformadores",
  autenticar,
  verificarPermissaoPorCargo,
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "../../public/pages/trafos/editar_transformadores.html"
      )
    );
  }
);

router.post(
  "/api/upload_transformadores",
  autenticar,
  upload.single("planilha"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Nenhum arquivo enviado!",
      });
    }
    try {
      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet, { defval: null });

      if (!data || data.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Planilha vazia ou formato inválido",
        });
      }

      const headers = Object.keys(data[0]);
      const columnMap = {
        item: headers.find((h) => h.trim().toUpperCase() === "ITEM"),
        marca: headers.find((h) => h.trim().toUpperCase() === "MARCA"),
        potencia: headers.find(
          (h) =>
            h.trim().toUpperCase().includes("POTÊNCIA") ||
            h.trim().toUpperCase().includes("KVA")
        ),
        fases: headers.find(
          (h) =>
            h.trim().toUpperCase().includes("FASES") ||
            h.trim().toUpperCase().includes("FASE")
        ),
        serie: headers.find(
          (h) =>
            h.trim().toUpperCase().includes("SÉRIE") ||
            h.trim().toUpperCase().includes("SERIE")
        ),
        local: headers.find(
          (h) =>
            h.trim().toUpperCase().includes("LOCAL") ||
            h.trim().toUpperCase().includes("RETIRADA")
        ),
        regional: headers.find((h) => h.trim().toUpperCase() === "REGIONAL"),
        motivo: headers.find(
          (h) =>
            h.trim().toUpperCase().includes("MOTIVO") ||
            h.trim().toUpperCase().includes("DESATIVAÇÃO") ||
            h.trim().toUpperCase().includes("DESATIVACAO")
        ),
        data: headers.find(
          (h) =>
            h.trim().toUpperCase().includes("DATA") ||
            h.trim().toUpperCase().includes("ENTRADA") ||
            h.trim().toUpperCase().includes("ALMOXARIFADO")
        ),
      };

      const requiredColumns = ["marca", "potencia", "serie", "data"];
      const missingColumns = requiredColumns.filter((col) => !columnMap[col]);
      if (missingColumns.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Colunas obrigatórias não encontradas: ${missingColumns.join(
            ", "
          )}`,
        });
      }

      const transformadores = data.map((row, idx) => {
        const getValue = (key) => {
          const colName = columnMap[key];
          return colName && row[colName] !== undefined
            ? String(row[colName]).trim()
            : null;
        };
        const dataRaw = getValue("data");
        let dataEntrada = null;
        if (dataRaw) {
          dataEntrada = excelSerialDateToJSDate(dataRaw);
        }
        return {
          linha: idx + 2,
          item: getValue("item"),
          marca: getValue("marca"),
          potencia: getValue("potencia"),
          numero_fases: getValue("fases"),
          numero_serie: getValue("serie"),
          local_retirada: getValue("local"),
          regional: getValue("regional"),
          motivo_desativacao: getValue("motivo"),
          data_entrada: dataEntrada,
          errors: [],
        };
      });

      transformadores.forEach((tf) => {
        if (!tf.numero_serie) tf.errors.push("Número de série é obrigatório");
        if (!tf.marca) tf.errors.push("Marca é obrigatória");
        if (!tf.potencia) tf.errors.push("Potência é obrigatória");
        if (!tf.data_entrada)
          tf.errors.push("Data de entrada inválida ou faltando");
      });

      const serialNumbers = transformadores
        .map((t) => t.numero_serie)
        .filter(Boolean);
      const duplicatesInSheet = [
        ...new Set(
          serialNumbers.filter((num, i) => serialNumbers.indexOf(num) !== i)
        ),
      ];

      const uniqueSerials = [...new Set(serialNumbers)];
      const existingInDb = [];
      if (uniqueSerials.length > 0) {
        const [existing] = await promisePool.query(
          "SELECT numero_serie FROM transformadores WHERE numero_serie IN (?)",
          [uniqueSerials]
        );
        existing.forEach((item) => existingInDb.push(item.numero_serie));
      }

      const results = {
        total: transformadores.length,
        imported: 0,
        failed: 0,
        duplicates_in_sheet: duplicatesInSheet,
        duplicates_in_db: existingInDb,
        details: [],
      };

      for (const tf of transformadores) {
        try {
          if (tf.errors.length > 0) throw new Error(tf.errors.join("; "));
          if (
            duplicatesInSheet.includes(tf.numero_serie) &&
            serialNumbers.indexOf(tf.numero_serie) !==
              transformadores.findIndex(
                (t) => t.numero_serie === tf.numero_serie
              )
          ) {
            throw new Error(
              "Número de série duplicado na planilha (não é a primeira ocorrência)"
            );
          }
          if (existingInDb.includes(tf.numero_serie)) {
            throw new Error("Número de série já existe no banco");
          }

          await promisePool.query(
            `INSERT INTO transformadores (item, marca, potencia, numero_fases, numero_serie, local_retirada, regional, motivo_desativacao, data_entrada_almoxarifado) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              tf.item,
              tf.marca,
              tf.potencia,
              tf.numero_fases,
              tf.numero_serie,
              tf.local_retirada,
              tf.regional,
              tf.motivo_desativacao,
              tf.data_entrada,
            ]
          );
          results.imported++;
          results.details.push({
            linha: tf.linha,
            numero_serie: tf.numero_serie,
            status: "success",
          });
        } catch (error) {
          results.failed++;
          results.details.push({
            linha: tf.linha,
            numero_serie: tf.numero_serie,
            status: "error",
            message: error.message,
          });
        }
      }
      res.json({
        success:
          results.imported > 0 || (results.failed === 0 && results.total > 0),
        ...results,
      });
    } catch (error) {
      console.error(
        "Erro no processamento do upload de transformadores:",
        error
      );
      res.status(500).json({
        success: false,
        message: "Erro no processamento: " + error.message,
      });
    } finally {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
  }
);

router.get(
  "/api/transformadores_sem_checklist",
  autenticar,
  async (req, res) => {
    try {
      const query = `
            SELECT t.numero_serie 
            FROM transformadores t
            LEFT JOIN checklist_transformadores ct ON t.numero_serie = ct.numero_serie
            WHERE ct.numero_serie IS NULL
        `;
      const [rows] = await promisePool.query(query);
      res.status(200).json(rows);
    } catch (err) {
      console.error("Erro ao buscar transformadores sem checklist:", err);
      res
        .status(500)
        .json({ message: "Erro ao buscar transformadores sem checklist!" });
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

  if (!numero_serie || !matricula_responsavel) {
    return res
      .status(400)
      .json({ message: "Número de série e responsável são obrigatórios!" });
  }
  try {
    const isReformado = reformado === "true";
    const dataFabricacaoFormatada = data_fabricacao
      ? data_fabricacao.includes("-")
        ? data_fabricacao
        : `${data_fabricacao}-01-01`
      : null;
    const dataReformadoFormatada =
      isReformado && data_reformado
        ? data_reformado.includes("-")
          ? data_reformado
          : `${data_reformado}-01-01`
        : null;

    const query = `
            INSERT INTO checklist_transformadores (
                numero_serie, data_fabricacao, reformado, data_reformado,
                detalhes_tanque, corrosao_tanque, buchas_primarias, buchas_secundarias,
                conectores, avaliacao_bobina_i, avaliacao_bobina_ii, avaliacao_bobina_iii,
                conclusao, transformador_destinado, matricula_responsavel, supervisor_tecnico, observacoes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
    const values = [
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
    ];
    await promisePool.query(query, values);
    await registrarAuditoria(
      matricula_responsavel,
      "Salvar Checklist",
      `Checklist salvo para transformador: ${numero_serie}`
    );
    res.status(201).json({ message: "Checklist salvo com sucesso!" });
  } catch (error) {
    console.error("Erro ao salvar checklist:", error);
    res.status(500).json({ message: "Erro ao salvar checklist!" });
  }
});

router.get("/api/responsaveis", autenticar, async (req, res) => {
  try {
    const query = `SELECT matricula, nome FROM users WHERE cargo IN ('Engenheiro', 'Técnico', 'Gerente', 'ADMIN', 'ADM', 'Inspetor') ORDER BY nome`;
    const [rows] = await promisePool.query(query);
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar responsáveis:", err);
    res.status(500).json({ message: "Erro ao buscar responsáveis técnicos!" });
  }
});

router.get("/api/supervisores", autenticar, async (req, res) => {
  try {
    const query = `SELECT matricula, nome FROM users WHERE cargo IN ('Engenheiro', 'Gerente') ORDER BY nome`;
    const [rows] = await promisePool.query(query);
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar supervisores:", err);
    res.status(500).json({ message: "Erro ao buscar supervisores técnicos!" });
  }
});

router.get(
  "/api/checklist_transformadores/:id",
  autenticar,
  async (req, res) => {
    const { id } = req.params;
    try {
      const query = `
            SELECT ct.*, t.potencia, t.numero_serie AS serie_transformador, t.local_retirada, t.regional,
                   t.numero_fases, t.marca, t.motivo_desativacao, t.data_entrada_almoxarifado,
                   u_resp.nome AS nome_responsavel, u_sup.nome AS nome_supervisor,
                   DATE_FORMAT(ct.data_checklist, '%Y-%m-%d') as data_formulario
            FROM checklist_transformadores ct
            INNER JOIN transformadores t ON ct.numero_serie = t.numero_serie
            INNER JOIN users u_resp ON ct.matricula_responsavel = u_resp.matricula
            LEFT JOIN users u_sup ON ct.supervisor_tecnico = u_sup.matricula
            WHERE ct.id = ?
        `;
      const [rows] = await promisePool.query(query, [id]);
      if (rows.length > 0) {
        const result = rows[0];
        if (result.data_entrada_almoxarifado) {
          result.data_entrada_almoxarifado = excelSerialDateToJSDate(
            result.data_entrada_almoxarifado
          );
        }
        res.status(200).json(result);
      } else {
        res.status(404).json({ message: "Checklist não encontrado!" });
      }
    } catch (err) {
      console.error("Erro ao buscar checklist de transformador:", err);
      res.status(500).json({ message: "Erro ao buscar checklist!" });
    }
  }
);

router.get("/api/checklist_transformadores_publico/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
            SELECT ct.*, t.potencia, t.numero_serie AS serie_transformador, t.local_retirada, t.regional,
                   t.numero_fases, t.marca, t.motivo_desativacao, t.data_entrada_almoxarifado,
                   u_resp.nome AS nome_responsavel, u_sup.nome AS nome_supervisor,
                   DATE_FORMAT(ct.data_checklist, '%Y-%m-%d') as data_formulario
            FROM checklist_transformadores ct
            INNER JOIN transformadores t ON ct.numero_serie = t.numero_serie
            INNER JOIN users u_resp ON ct.matricula_responsavel = u_resp.matricula
            LEFT JOIN users u_sup ON ct.supervisor_tecnico = u_sup.matricula
            WHERE ct.id = ?
        `;
    const [rows] = await promisePool.query(query, [id]);
    if (rows.length > 0) {
      const result = rows[0];
      if (result.data_entrada_almoxarifado) {
        result.data_entrada_almoxarifado = excelSerialDateToJSDate(
          result.data_entrada_almoxarifado
        );
      }
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Checklist não encontrado!" });
    }
  } catch (err) {
    console.error("Erro ao buscar checklist público:", err);
    res.status(500).json({ message: "Erro ao buscar checklist!" });
  }
});

router.delete(
  "/api/excluir_transformador/:id",
  autenticar,
  async (req, res) => {
    const { id } = req.params;
    try {
      const [result] = await promisePool.query(
        "DELETE FROM checklist_transformadores WHERE id = ?",
        [id]
      );
      if (result.affectedRows > 0) {
        await registrarAuditoria(
          req.user.matricula,
          "Excluir Checklist Transformador",
          `Checklist de transformador excluído com ID: ${id}`
        );
        res.status(200).json({
          message: "Checklist de transformador excluído com sucesso!",
        });
      } else {
        res
          .status(404)
          .json({ message: "Checklist de transformador não encontrado!" });
      }
    } catch (err) {
      console.error("Erro ao excluir checklist de transformador:", err);
      res
        .status(500)
        .json({ message: "Erro ao excluir checklist de transformador!" });
    }
  }
);

router.post("/api/filtrar_transformadores", autenticar, async (req, res) => {
  const { numero_serie, matricula_responsavel, dataInicial, dataFinal } =
    req.body;
  try {
    let query = `
            SELECT ct.id, t.numero_serie, t.potencia, t.marca,
                   DATE_FORMAT(ct.data_checklist, '%d/%m/%Y') as data_formulario, 
                   ct.matricula_responsavel, u.nome as nome_responsavel, ct.transformador_destinado
            FROM checklist_transformadores ct
            INNER JOIN transformadores t ON ct.numero_serie = t.numero_serie
            INNER JOIN users u ON ct.matricula_responsavel = u.matricula
            WHERE 1=1
        `;
    const params = [];
    if (numero_serie && numero_serie.trim() !== "") {
      query += " AND t.numero_serie LIKE ?";
      params.push(`%${numero_serie}%`);
    }
    if (matricula_responsavel && matricula_responsavel.trim() !== "") {
      query += " AND ct.matricula_responsavel = ?";
      params.push(matricula_responsavel);
    }
    if (dataInicial || dataFinal) {
      if (dataInicial && dataFinal) {
        query += " AND DATE(ct.data_checklist) BETWEEN ? AND ?";
        params.push(dataInicial, dataFinal);
      } else if (dataInicial) {
        query += " AND DATE(ct.data_checklist) >= ?";
        params.push(dataInicial);
      } else if (dataFinal) {
        query += " AND DATE(ct.data_checklist) <= ?";
        params.push(dataFinal);
      }
    }
    query += " ORDER BY ct.data_checklist DESC";
    const [rows] = await promisePool.query(query, params);
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao filtrar checklists de transformadores:", {
      message: err.message,
      stack: err.stack,
      sql: err.sql,
    });
    res.status(500).json({
      message: "Erro ao filtrar checklists de transformadores",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

router.get("/api/gerar_pdf/:id", autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    const query = `SELECT t.marca, t.numero_serie FROM checklist_transformadores ct
                     INNER JOIN transformadores t ON ct.numero_serie = t.numero_serie
                     WHERE ct.id = ?`;
    const [rows] = await promisePool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Checklist não encontrado!" });
    }

    const { marca, numero_serie } = rows[0];
    const sanitize = (str, fallback) => {
      if (str === null || str === undefined) return fallback;
      return String(str)
        .replace(/[^a-zA-Z0-9\-_]/g, "_")
        .replace(/[\-_]{2,}/g, "_")
        .replace(/^_|_$/g, "");
    };
    let idSanitized = sanitize(id, "ID");
    let marcaSanitized = sanitize(marca, "MARCA");
    let serieSanitized = sanitize(numero_serie, "SERIE");

    if (!idSanitized) idSanitized = "ID_DESCONHECIDO";
    if (!marcaSanitized) marcaSanitized = "MARCA_DESCONHECIDA";
    if (!serieSanitized) serieSanitized = "SERIE_DESCONHECIDA";

    const nomeArquivo = `${idSanitized}_${marcaSanitized}_${serieSanitized}.pdf`;

    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    const url = `${req.protocol}://${req.get(
      "host"
    )}/relatorio_formulario?id=${id}`;

    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    const headerFooterStyle = `font-family: 'Poppins', Arial, sans-serif; font-size: 9px; color: #333; width: 100%;`;
    const primarySystemColor = "#2a5298";

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "35mm", right: "10mm", bottom: "25mm", left: "10mm" },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="${headerFooterStyle} padding: 0 10mm; height: 25mm; display: flex; flex-direction: column; justify-content: center; align-items: center; border-bottom: 1px solid #ddd;">
          <div style="font-size: 14px; color: ${primarySystemColor}; font-weight: 600;">Relatório de Inspeção de Transformador</div>
          <div style="font-size: 10px; color: #555;">SULGIPE - LINHA VIVA SYSTEM</div>
        </div>
      `,
      footerTemplate: `
        <div style="${headerFooterStyle} padding: 0 10mm; height: 15mm; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #ddd;">
          <span>Gerado em: <span class="date"></span></span>
          <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
        </div>
      `,
    });
    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nomeArquivo}"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Erro ao gerar PDF de checklist individual:", err);
    if (!res.headersSent) {
      res.status(500).json({
        message: "Erro ao gerar PDF do checklist!",
        error:
          process.env.NODE_ENV === "development" ? err.message : "Erro interno",
      });
    }
  }
});

router.post(
  "/api/gerar_pdf_tabela_transformadores",
  autenticar,
  async (req, res) => {
    const { dados, filtros } = req.body;

    if (!req.user || !req.user.nome || !req.user.matricula) {
      return res.status(401).json({
        success: false,
        message:
          "Usuário não autenticado ou dados do usuário ausentes na sessão.",
      });
    }
    if (!dados || !Array.isArray(dados)) {
      return res.status(400).json({
        success: false,
        message: "Dados para o PDF não fornecidos ou em formato inválido.",
      });
    }

    try {
      const htmlContent = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Relatório de Checklists de Transformadores</title>
                <style>
                    body { font-family: 'Poppins', sans-serif; color: #495057; padding: 20px; font-size: 10px; }
                    h1 { color: #2a5298; text-align: center; margin-bottom: 15px; font-size: 18px; }
                    .info-filtros { background-color: #f0f4f8; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 9px; border: 1px solid #d6e0ea; }
                    .info-filtros strong { display: block; margin-bottom: 5px; color: #1e3c72; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th { background-color: #2a5298; color: white; padding: 8px; text-align: left; font-weight: 500; font-size: 9.5px; }
                    td { padding: 8px; border-bottom: 1px solid #dee2e6; vertical-align: middle; font-size: 9px; }
                    tr:nth-child(even) { background-color: #f8f9fa; }
                    .footer { margin-top: 25px; font-size: 8.5px; text-align: right; color: #6c757d; }
                </style>
            </head>
            <body>
                <h1>Relatório de Checklists de Transformadores</h1>
                <div class="info-filtros">
                    <strong>Filtros aplicados:</strong><br>
                    ${
                      filtros && filtros.dataInicial
                        ? `Data Inicial: ${new Date(
                            filtros.dataInicial + "T00:00:00"
                          ).toLocaleDateString("pt-BR", {
                            timeZone: "UTC",
                          })}<br>`
                        : ""
                    }
                    ${
                      filtros && filtros.dataFinal
                        ? `Data Final: ${new Date(
                            filtros.dataFinal + "T00:00:00"
                          ).toLocaleDateString("pt-BR", {
                            timeZone: "UTC",
                          })}<br>`
                        : ""
                    }
                    ${
                      filtros && filtros.numero_serie
                        ? `Número de Série: ${filtros.numero_serie}<br>`
                        : ""
                    }
                    ${
                      filtros && filtros.responsavel
                        ? `Responsável (Matrícula): ${filtros.responsavel}<br>`
                        : ""
                    }
                    Data de geração: ${new Date().toLocaleDateString("pt-BR", {
                      timeZone: "UTC",
                    })}
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>ID Checklist</th>
                            <th>Nº de Série</th>
                            <th>Potência</th>
                            <th>Marca</th>
                            <th>Data Formulário</th>
                            <th>Responsável</th>
                            <th>Destinado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                          dados && Array.isArray(dados)
                            ? dados
                                .map(
                                  (item) => `
                            <tr>
                                <td>${item.id || "-"}</td>
                                <td>${item.numero_serie || "-"}</td>
                                <td>${item.potencia || "-"}</td>
                                <td>${item.marca || "-"}</td>
                                <td>${item.data_formulario || "-"}</td>
                                <td>${item.responsavel || "-"}</td>
                                <td>${item.destinado || "-"}</td>
                            </tr>
                        `
                                )
                                .join("")
                            : "<tr><td colspan='7'>Nenhum dado para exibir.</td></tr>"
                        }
                    </tbody>
                </table>
                <div class="footer">
                    Gerado por ${req.user.nome} (${
        req.user.matricula
      }) em ${new Date().toLocaleString("pt-BR", {
        timeZone: "America/Maceio",
      })} 
                </div>
            </body>
            </html>
        `;
      const browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: "networkidle" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "15mm", right: "10mm", bottom: "15mm", left: "10mm" },
      });
      await browser.close();

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=Relatorio_Checklists_Transformadores.pdf"
      );
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Erro ao gerar PDF da tabela de checklists:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao gerar PDF da tabela de checklists",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Erro interno no servidor",
      });
    }
  }
);

module.exports = router;
