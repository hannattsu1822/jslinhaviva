const express = require("express");
const path = require("path");
const { chromium } = require("playwright");
const { promisePool, upload } = require("../init");
const {
  autenticar,
  verificarPermissaoPorCargo,
  registrarAuditoria,
} = require("../auth");
const xlsx = require("xlsx");
const fs = require("fs");

const router = express.Router();

router.get(
  "/transformadores_reformados",
  autenticar,
  verificarPermissaoPorCargo,
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "../../public/pages/trafos/reformados/transformadores_reformados.html"
      )
    );
  }
);

router.get(
  "/trafos_reformados_filtrar.html",
  autenticar,
  verificarPermissaoPorCargo,
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "../../public/pages/trafos/reformados/trafos_reformados_filtrar.html"
      )
    );
  }
);

router.get(
  "/trafos_reformados_importar.html",
  autenticar,
  verificarPermissaoPorCargo,
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "../../public/pages/trafos/reformados/trafos_reformados_importar.html"
      )
    );
  }
);

router.get("/api/user_info/:matricula", autenticar, async (req, res) => {
  try {
    const { matricula } = req.params;
    const [rows] = await promisePool.query(
      "SELECT nome, matricula FROM users WHERE matricula = ?",
      [matricula]
    );
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).json({ message: "Usuário não encontrado" });
    }
  } catch (error) {
    console.error("Erro ao buscar informações do usuário:", error);
    res.status(500).json({ message: "Erro interno ao buscar usuário" });
  }
});

router.get("/api/transformadores_reformados", autenticar, async (req, res) => {
  try {
    const {
      status,
      numero_serie,
      fabricante,
      pot,
      tecnico_responsavel,
      data_avaliacao_inicial,
      data_avaliacao_final,
      data_importacao_inicial,
      data_importacao_final,
      getAll,
    } = req.query;

    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 15;

    if (page < 1) page = 1;
    if (limit < 1 && getAll !== "true") limit = 15;

    let queryParams = [];
    let countQueryParams = [];

    let baseQuery = `
        FROM trafos_reformados tr
        LEFT JOIN users u ON tr.tecnico_responsavel = u.matricula
        WHERE 1=1
    `;
    let conditions = "";

    if (status) {
      conditions += " AND tr.status_avaliacao = ?";
      queryParams.push(status);
    }
    if (numero_serie) {
      conditions += " AND tr.numero_serie LIKE ?";
      queryParams.push(`%${numero_serie}%`);
    }
    if (fabricante) {
      conditions += " AND tr.fabricante LIKE ?";
      queryParams.push(`%${fabricante}%`);
    }
    if (pot) {
      conditions += " AND tr.pot LIKE ?";
      queryParams.push(`%${pot}%`);
    }
    if (tecnico_responsavel) {
      conditions += " AND tr.tecnico_responsavel = ?";
      queryParams.push(tecnico_responsavel);
    }
    if (data_avaliacao_inicial && data_avaliacao_final) {
      conditions += " AND DATE(tr.data_avaliacao) BETWEEN ? AND ?";
      queryParams.push(data_avaliacao_inicial, data_avaliacao_final);
    } else if (data_avaliacao_inicial) {
      conditions += " AND DATE(tr.data_avaliacao) >= ?";
      queryParams.push(data_avaliacao_inicial);
    } else if (data_avaliacao_final) {
      conditions += " AND DATE(tr.data_avaliacao) <= ?";
      queryParams.push(data_avaliacao_final);
    }
    if (data_importacao_inicial && data_importacao_final) {
      conditions += " AND DATE(tr.data_importacao) BETWEEN ? AND ?";
      queryParams.push(data_importacao_inicial, data_importacao_final);
    } else if (data_importacao_inicial) {
      conditions += " AND DATE(tr.data_importacao) >= ?";
      queryParams.push(data_importacao_inicial);
    } else if (data_importacao_final) {
      conditions += " AND DATE(tr.data_importacao) <= ?";
      queryParams.push(data_importacao_final);
    }

    baseQuery += conditions;
    countQueryParams = [...queryParams];

    const countQuery = `SELECT COUNT(*) as totalItems ${baseQuery}`;
    const [countResult] = await promisePool.query(countQuery, countQueryParams);
    const totalItems = countResult[0].totalItems;

    let totalPages = 1;
    if (getAll !== "true" && totalItems > 0) {
      totalPages = Math.ceil(totalItems / limit);
      if (page > totalPages) page = totalPages;
    } else if (getAll !== "true" && totalItems === 0) {
      page = 1;
      totalPages = 1;
    }

    let dataQuery = `
        SELECT 
            tr.*,
            u.nome as nome_tecnico
        ${baseQuery}
        ORDER BY tr.id DESC
    `;

    if (getAll !== "true") {
      const offset = (page - 1) * limit;
      dataQuery += " LIMIT ? OFFSET ?";
      queryParams.push(limit, offset);
    }

    const [trafos] = await promisePool.query(dataQuery, queryParams);

    res.json({
      success: true,
      data: trafos,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalItems,
        itemsPerPage: getAll === "true" ? totalItems : limit,
      },
      filtros: req.query,
    });
  } catch (err) {
    console.error("Erro ao buscar transformadores reformados:", err);
    res.status(500).json({
      success: false,
      message: "Erro ao buscar transformadores reformados",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

router.get(
  "/api/transformadores_reformados/:id",
  autenticar,
  async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await promisePool.query(
        `
            SELECT 
                tr.*, 
                u.nome as nome_tecnico,
                u.matricula as matricula_tecnico
            FROM trafos_reformados tr
            LEFT JOIN users u ON tr.tecnico_responsavel = u.matricula
            WHERE tr.id = ?
        `,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Transformador não encontrado",
        });
      }
      const transformador = rows[0];

      const [checklistRows] = await promisePool.query(
        `SELECT * FROM trafos_reformados_testes 
         WHERE trafos_reformados_id = ? 
         ORDER BY data_teste DESC, id DESC LIMIT 1`,
        [id]
      );
      if (checklistRows.length > 0) {
        transformador.checklist_teste = checklistRows[0];
      } else {
        transformador.checklist_teste = null;
      }

      res.json({
        success: true,
        data: transformador,
      });
    } catch (err) {
      console.error("Erro ao buscar transformador:", err);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar transformador",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  }
);

router.put(
  "/api/transformadores_reformados/:id/avaliar_completo",
  autenticar,
  async (req, res) => {
    const { id } = req.params;
    const {
      matricula_responsavel,
      status_avaliacao,
      resultado_avaliacao,
      checklist_data,
    } = req.body;

    if (!matricula_responsavel || !status_avaliacao) {
      return res.status(400).json({
        success: false,
        message:
          "Matrícula do responsável e status da avaliação são obrigatórios.",
      });
    }
    if (!checklist_data) {
      return res.status(400).json({
        success: false,
        message: "Dados do checklist são obrigatórios.",
      });
    }

    let conclusaoChecklistParaDb;
    if (status_avaliacao === "avaliado") {
      conclusaoChecklistParaDb = "APROVADO";
    } else if (status_avaliacao === "reprovado") {
      conclusaoChecklistParaDb = "REPROVADO";
    } else {
      return res.status(400).json({
        success: false,
        message: "Status de avaliação inválido para o checklist.",
      });
    }

    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();

      const [tecnico] = await connection.query(
        `SELECT matricula FROM users 
         WHERE matricula = ? 
         AND cargo IN ('ADMIN', 'ADM', 'Engenheiro', 'Técnico', 'Inspetor')`,
        [matricula_responsavel]
      );
      if (tecnico.length === 0) {
        throw new Error(
          "Técnico responsável não encontrado ou não autorizado."
        );
      }

      await connection.query(
        `UPDATE trafos_reformados 
         SET 
            tecnico_responsavel = ?,
            status_avaliacao = ?,
            resultado_avaliacao = ?,
            data_avaliacao = NOW()
         WHERE id = ?`,
        [
          matricula_responsavel,
          status_avaliacao,
          resultado_avaliacao || null,
          id,
        ]
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
      res.json({
        success: true,
        message: "Avaliação completa salva com sucesso.",
      });
    } catch (err) {
      await connection.rollback();
      console.error("Erro ao salvar avaliação completa:", err);
      res.status(500).json({
        success: false,
        message: "Erro ao salvar avaliação completa: " + err.message,
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    } finally {
      connection.release();
    }
  }
);

router.post(
  "/api/gerar_pdf_checklist_especifico",
  autenticar,
  async (req, res) => {
    const { checklist, transformador } = req.body;

    if (!checklist || !transformador) {
      return res.status(400).json({
        success: false,
        message: "Dados do checklist ou do transformador ausentes.",
      });
    }

    try {
      let tecnicoNomeChecklist = checklist.tecnico_responsavel_teste || "N/A";
      if (checklist.tecnico_responsavel_teste) {
        try {
          const [userRows] = await promisePool.query(
            "SELECT nome FROM users WHERE matricula = ?",
            [checklist.tecnico_responsavel_teste]
          );
          if (userRows.length > 0) {
            tecnicoNomeChecklist = `${userRows[0].nome} (${checklist.tecnico_responsavel_teste})`;
          }
        } catch (e) {
          console.error(
            "Erro buscando nome do técnico para PDF do checklist:",
            e
          );
        }
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Relatório de Checklist do Transformador</title>
            <style>
                body { font-family: 'Poppins', Arial, sans-serif; color: #333; margin: 20px; font-size: 11px; }
                .container { border: 1px solid #ccc; padding: 20px; border-radius: 8px; max-width: 800px; margin: auto; }
                h1 { color: #2a5298; text-align: center; margin-bottom: 20px; font-size: 18px; }
                h2 { color: #2a5298; font-size: 14px; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;}
                .info-trafo, .info-checklist { margin-bottom: 15px; }
                .info-trafo p, .info-checklist p, .section p { margin: 6px 0; line-height: 1.6; }
                .info-trafo strong, .info-checklist strong { color: #102a52; min-width: 140px; display: inline-block; font-weight: 600;}
                .section { margin-bottom:15px; padding-left: 10px; }
                .section p { display: flex; justify-content: space-between; border-bottom: 1px dotted #eaeaea; padding: 4px 0;}
                .section p span:first-child {color: #555;}
                .section p span:last-child { font-weight: bold; text-align: right; color: #111; }
                .obs { margin-top:15px; padding:10px; background-color:#f9f9f9; border: 1px solid #efefef; border-radius:4px; }
                .obs p {border-bottom: none; white-space: pre-wrap; word-wrap: break-word;}
                .footer { margin-top: 30px; font-size: 9px; text-align: center; color: #777; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Checklist de Avaliação do Transformador</h1>
                
                <div class="info-trafo">
                    <h2>Dados do Transformador</h2>
                    <p><strong>ID:</strong> ${transformador.id || "N/A"}</p>
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
                    <p><strong>ID do Teste:</strong> ${
                      checklist.id || "N/A"
                    }</p>
                    <p><strong>Data do Teste:</strong> ${
                      checklist.data_teste
                        ? new Date(checklist.data_teste).toLocaleString(
                            "pt-BR",
                            { timeZone: "America/Sao_Paulo" }
                          )
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
                    : '<div class="section obs"><p>Nenhuma observação no checklist.</p></div>'
                }

                <div class="section">
                    <h2>Conclusão da Avaliação (Checklist)</h2>
                    <p><span>Status Final:</span> <span>${
                      checklist.conclusao_checklist || "N/A"
                    }</span></p>
                </div>
            </div>
            <div class="footer">
                Gerado por ${req.user.nome} (${
        req.user.matricula
      }) em ${new Date().toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
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
        margin: { top: "20mm", right: "10mm", bottom: "20mm", left: "10mm" },
      });
      await browser.close();

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Checklist_Trafo_${transformador.numero_serie}_ID${checklist.id}.pdf`
      );
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Erro ao gerar PDF do checklist específico:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao gerar PDF do checklist.",
        error: error.message,
      });
    }
  }
);

router.post(
  "/api/gerar_pdf_trafos_reformados",
  autenticar,
  async (req, res) => {
    const { dados, filtros } = req.body;
    try {
      const htmlContent = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Relatório de Transformadores Reformados</title>
                <style>
                    body { font-family: 'Poppins', sans-serif; color: #495057; padding: 20px; font-size: 10px;}
                    h1 { color: #2a5298; text-align: center; margin-bottom: 15px; font-size: 18px;}
                    .info-filtros { background-color: #f0f4f8; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 9px; border: 1px solid #d6e0ea;}
                    .info-filtros strong { display: block; margin-bottom: 5px; color: #1e3c72;}
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th { background-color: #2a5298; color: white; padding: 8px; text-align: left; font-weight: 500; font-size: 9.5px; }
                    td { padding: 8px; border-bottom: 1px solid #dee2e6; vertical-align: middle; font-size: 9px;}
                    tr:nth-child(even) { background-color: #f8f9fa; }
                    .badge { padding: 4px 8px; border-radius: 10px; font-size: 8.5px; font-weight: 500; text-transform: capitalize;}
                    .bg-success { background-color: #28a745; color: white; }
                    .bg-warning { background-color: #ffc107; color: #212529; }
                    .bg-danger { background-color: #dc3545; color: white; }
                    .footer { margin-top: 25px; font-size: 8.5px; text-align: right; color: #6c757d; }
                </style>
            </head>
            <body>
                <h1>Relatório de Transformadores Reformados</h1>
                <div class="info-filtros">
                    <strong>Filtros aplicados:</strong><br>
                    ${
                      filtros.status &&
                      filtros.status !== "Todos" &&
                      filtros.status !== ""
                        ? `Status: ${filtros.status}<br>`
                        : ""
                    }
                    ${
                      filtros.fabricante && filtros.fabricante !== "Todos"
                        ? `Fabricante: ${filtros.fabricante}<br>`
                        : ""
                    }
                    ${
                      filtros.pot && filtros.pot !== "Todas"
                        ? `Potência: ${filtros.pot} kVA<br>`
                        : ""
                    }
                    ${
                      filtros.tecnico_responsavel &&
                      filtros.tecnico_responsavel !== "Todos"
                        ? `Técnico: ${filtros.tecnico_responsavel}<br>`
                        : ""
                    }
                    ${
                      filtros.data_avaliacao_inicial
                        ? `Data Avaliação De: ${filtros.data_avaliacao_inicial}<br>`
                        : ""
                    }
                    ${
                      filtros.data_avaliacao_final
                        ? `Data Avaliação Até: ${filtros.data_avaliacao_final}<br>`
                        : ""
                    }
                    ${
                      filtros.data_importacao_inicial
                        ? `Data Importação De: ${filtros.data_importacao_inicial}<br>`
                        : ""
                    }
                    ${
                      filtros.data_importacao_final
                        ? `Data Importação Até: ${filtros.data_importacao_final}<br>`
                        : ""
                    }
                    Data de geração: ${new Date().toLocaleDateString("pt-BR")}
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nº de Série</th>
                            <th>Fabricante</th>
                            <th>Potência</th>
                            <th>Status</th>
                            <th>Data Avaliação</th>
                            <th>Técnico Responsável</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dados
                          .map((item) => {
                            let statusClass, statusText;
                            switch (item.status_avaliacao) {
                              case "avaliado":
                                statusClass = "bg-success";
                                statusText = "Aprovado";
                                break;
                              case "reprovado":
                                statusClass = "bg-danger";
                                statusText = "Reprovado";
                                break;
                              default:
                                statusClass = "bg-warning";
                                statusText = "Pendente";
                            }
                            const dataAvaliacaoFormatada = item.data_avaliacao
                              ? new Date(
                                  item.data_avaliacao
                                ).toLocaleDateString("pt-BR")
                              : "-";
                            return `
                                <tr>
                                    <td>${item.id}</td>
                                    <td>${item.numero_serie}</td>
                                    <td>${item.fabricante || "-"}</td>
                                    <td>${item.pot || "-"}</td>
                                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                                    <td>${dataAvaliacaoFormatada}</td>
                                    <td>${
                                      item.nome_tecnico ||
                                      item.tecnico_responsavel ||
                                      "-"
                                    }</td>
                                </tr>
                            `;
                          })
                          .join("")}
                    </tbody>
                </table>
                <div class="footer">
                    Gerado por ${req.user.nome} (${
        req.user.matricula
      }) em ${new Date().toLocaleString("pt-BR")}
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
        "attachment; filename=Relatorio_Transformadores_Reformados.pdf"
      );
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Erro ao gerar PDF da tabela de trafos reformados:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao gerar PDF da tabela de transformadores reformados",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

router.get(
  "/api/tecnicos_responsaveis_trafos_reformados",
  autenticar,
  async (req, res) => {
    try {
      const [rows] = await promisePool.query(`
            SELECT matricula, nome, cargo
            FROM users 
            WHERE cargo IN ('ADMIN', 'ADM', 'Engenheiro', 'Técnico', 'Inspetor')
            ORDER BY nome
        `);
      res.status(200).json(rows);
    } catch (err) {
      console.error("Erro ao buscar técnicos responsáveis:", err);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar técnicos responsáveis",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  }
);

router.get(
  "/api/fabricantes_trafos_reformados",
  autenticar,
  async (req, res) => {
    try {
      const [rows] = await promisePool.query(
        'SELECT DISTINCT fabricante FROM trafos_reformados WHERE fabricante IS NOT NULL AND fabricante != "" ORDER BY fabricante'
      );
      res.setHeader("Content-Type", "application/json");
      res.status(200).json(rows.map((row) => row.fabricante));
    } catch (err) {
      console.error("Erro ao buscar fabricantes:", err);
      res.setHeader("Content-Type", "application/json");
      res.status(500).json({
        success: false,
        message: "Erro ao buscar fabricantes!",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  }
);

router.get("/api/potencias_trafos_reformados", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      'SELECT DISTINCT pot FROM trafos_reformados WHERE pot IS NOT NULL AND pot != "" ORDER BY CAST(pot AS UNSIGNED)'
    );
    res.status(200).json(rows.map((row) => row.pot));
  } catch (err) {
    console.error("Erro ao buscar potências:", err);
    res.status(500).json({ message: "Erro ao buscar potências!" });
  }
});

router.delete(
  "/api/transformadores_reformados/:id",
  autenticar,
  async (req, res) => {
    const { id } = req.params;
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();

      const [trafoRows] = await connection.query(
        "SELECT numero_serie FROM trafos_reformados WHERE id = ?",
        [id]
      );
      if (trafoRows.length === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({ success: false, message: "Transformador não encontrado!" });
      }
      const numero_serie = trafoRows[0].numero_serie;

      await connection.query(
        "DELETE FROM trafos_reformados_testes WHERE trafos_reformados_id = ?",
        [id]
      );
      const [result] = await connection.query(
        "DELETE FROM trafos_reformados WHERE id = ?",
        [id]
      );

      if (result.affectedRows > 0) {
        await connection.commit();
        await registrarAuditoria(
          req.user.matricula,
          "Excluir Transformador Reformado",
          `Transformador (reforma) excluído com ID: ${id}, Série: ${numero_serie}`
        );
        res.status(200).json({
          success: true,
          message:
            "Transformador e todos os seus testes associados foram excluídos com sucesso!",
        });
      } else {
        await connection.rollback();
        res.status(404).json({
          success: false,
          message:
            "Transformador não encontrado para exclusão após verificação!",
        });
      }
    } catch (err) {
      await connection.rollback();
      console.error("Erro ao excluir transformador reformado:", err);
      res.status(500).json({
        success: false,
        message: "Erro ao excluir transformador reformado!",
      });
    } finally {
      connection.release();
    }
  }
);

router.post(
  "/api/importar_trafos_reformados",
  autenticar,
  upload.single("planilha"),
  async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "Nenhum arquivo enviado" });
    }
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();
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
        numero_projeto: headers.find(
          (h) =>
            h.trim().toUpperCase().includes("PROJETO") ||
            h.trim().toUpperCase().includes("PROJ")
        ),
        pot: headers.find(
          (h) =>
            h.trim().toUpperCase() === "POT" ||
            h.trim().toUpperCase() === "POTENCIA" ||
            h.trim().toUpperCase() === "POTÊNCIA"
        ),
        numero_serie: headers.find(
          (h) =>
            h.trim().toUpperCase().includes("SÉRIE") ||
            h.trim().toUpperCase().includes("SERIE") ||
            h.trim().toUpperCase() === "N. SÉRIE"
        ),
        numero_nota: headers.find(
          (h) =>
            h.trim().toUpperCase().includes("NOTA") ||
            h.trim().toUpperCase() === "N. NOTA"
        ),
        t_at: headers.find(
          (h) =>
            h.trim().toUpperCase().includes("T AT") ||
            h.trim().toUpperCase().includes("TENSÃO AT")
        ),
        t_bt: headers.find(
          (h) =>
            h.trim().toUpperCase().includes("T BT") ||
            h.trim().toUpperCase().includes("TENSÃO BT")
        ),
        taps: headers.find((h) => h.trim().toUpperCase().includes("TAP")),
        fabricante: headers.find((h) =>
          h.trim().toUpperCase().includes("FABRICANTE")
        ),
      };

      const requiredColumns = ["item", "numero_serie", "pot", "fabricante"];
      const missingColumns = requiredColumns.filter((col) => !columnMap[col]);
      if (missingColumns.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Colunas obrigatórias não encontradas na planilha: ${missingColumns.join(
            ", "
          )}`,
        });
      }

      const results = {
        total: data.length,
        imported: 0,
        failed: 0,
        duplicates_in_db: [],
        duplicates_in_sheet: [],
        details: [],
      };
      const serialNumbersInSheet = data
        .map((row) => {
          const colName = columnMap.numero_serie;
          const rawValue = row[colName];
          return rawValue ? String(rawValue).trim() : null;
        })
        .filter(Boolean);

      const uniqueSerialsInSheet = [...new Set(serialNumbersInSheet)];
      results.duplicates_in_sheet = serialNumbersInSheet.filter(
        (item, index) => serialNumbersInSheet.indexOf(item) !== index
      );
      results.duplicates_in_sheet = [...new Set(results.duplicates_in_sheet)];

      let existingSerialsInDb = [];
      if (uniqueSerialsInSheet.length > 0) {
        const [existingRows] = await connection.query(
          "SELECT numero_serie FROM trafos_reformados WHERE numero_serie IN (?)",
          [uniqueSerialsInSheet]
        );
        existingSerialsInDb = existingRows.map((r) => r.numero_serie);
        results.duplicates_in_db = existingSerialsInDb;
      }

      for (const [index, row] of data.entries()) {
        const linha = index + 2;
        let status = "success";
        let errorMessage = "";
        let numeroSerie = "";
        try {
          const getValue = (key) => {
            const colName = columnMap[key];
            if (!colName || row[colName] === undefined || row[colName] === null)
              return null;
            return String(row[colName]).trim();
          };
          numeroSerie = getValue("numero_serie");
          if (!numeroSerie) throw new Error("Número de série é obrigatório");

          const itemValue = getValue("item");
          const potValue = getValue("pot");
          const fabricanteValue = getValue("fabricante");
          if (!itemValue)
            throw new Error("Coluna 'Item' (ou ID) é obrigatória.");
          if (!potValue)
            throw new Error("Coluna 'Potência (POT)' é obrigatória.");
          if (!fabricanteValue)
            throw new Error("Coluna 'Fabricante' é obrigatória.");

          if (
            results.duplicates_in_sheet.includes(numeroSerie) &&
            serialNumbersInSheet.indexOf(numeroSerie) !== index
          ) {
            throw new Error(
              "Número de série duplicado dentro da planilha (esta não é a primeira ocorrência)"
            );
          }
          if (existingSerialsInDb.includes(numeroSerie)) {
            throw new Error("Número de série já existe no banco de dados");
          }

          await connection.query(
            `INSERT INTO trafos_reformados (item, numero_projeto, pot, numero_serie, numero_nota, t_at, t_bt, taps, fabricante, status_avaliacao, data_importacao) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', CURDATE())`,
            [
              itemValue,
              getValue("numero_projeto"),
              potValue,
              numeroSerie,
              getValue("numero_nota"),
              getValue("t_at"),
              getValue("t_bt"),
              getValue("taps"),
              fabricanteValue,
            ]
          );
          results.imported++;
        } catch (error) {
          status = "error";
          errorMessage = error.message;
          results.failed++;
        } finally {
          results.details.push({
            linha,
            numero_serie:
              numeroSerie ||
              (columnMap.numero_serie && row[columnMap.numero_serie]) ||
              "",
            status,
            message: errorMessage,
          });
        }
      }
      await connection.commit();
      res.json({
        success:
          results.imported > 0 || (results.failed === 0 && results.total > 0),
        message: `Importação concluída: ${results.imported} registros importados, ${results.failed} falhas.`,
        ...results,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro no processamento da importação:", error);
      res.status(500).json({
        success: false,
        message: "Erro no processamento da importação: " + error.message,
      });
    } finally {
      connection.release();
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
  }
);

module.exports = router;
