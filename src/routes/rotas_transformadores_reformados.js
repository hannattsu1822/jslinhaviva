const express = require("express");
const path = require("path");
const { chromium } = require("playwright");
const { promisePool, upload } = require("../init");
const { autenticar, verificarNivel, registrarAuditoria } = require("../auth");
const xlsx = require("xlsx");
const fs = require("fs");

const router = express.Router();

router.get(
  "/transformadores_reformados",
  autenticar,
  verificarNivel(3),
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
  verificarNivel(3),
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
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "../../public/pages/trafos/reformados/trafos_reformados_importar.html"
      )
    );
  }
);

router.get(
  "/consultar_historicos.html",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "../../public/pages/trafos/reformados/consultar_historicos.html"
      )
    );
  }
);

router.get(
  "/transformadores/historico/:numero_serie",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "../../public/pages/trafos/reformados/historico_checklist.html"
      )
    );
  }
);

router.get(
  "/api/user_info/:matricula",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
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
  }
);

router.get(
  "/api/transformadores_reformados",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    try {
      const {
        id,
        status,
        status_not_in,
        numero_serie,
        fabricante,
        pot,
        tecnico_responsavel,
        data_avaliacao_inicial,
        data_avaliacao_final,
        getAll,
      } = req.query;

      let page = parseInt(req.query.page) || 1;
      let limit = parseInt(req.query.limit) || 15;

      if (page < 1) page = 1;
      if (limit < 1 && getAll !== "true") limit = 15;

      let queryParams = [];
      let conditions = "WHERE 1=1";

      if (id) {
        conditions += " AND tr.id = ?";
        queryParams.push(id);
      }
      if (status) {
        conditions += " AND tr.status_avaliacao = ?";
        queryParams.push(status);
      }
      if (status_not_in) {
        conditions += " AND tr.status_avaliacao != ?";
        queryParams.push(status_not_in);
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

      const countQuery = `SELECT COUNT(*) as totalItems FROM trafos_reformados tr ${conditions}`;
      const [countResult] = await promisePool.query(countQuery, queryParams);
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
            u.nome as nome_tecnico,
            (
                SELECT COUNT(*) 
                FROM trafos_reformados tr_hist 
                WHERE tr_hist.numero_serie = tr.numero_serie 
            ) as total_ciclos,
            (
                SELECT MAX(tr_anterior.data_avaliacao)
                FROM trafos_reformados tr_anterior
                WHERE tr_anterior.numero_serie = tr.numero_serie
                  AND tr_anterior.id < tr.id
                  AND tr_anterior.status_avaliacao != 'pendente'
            ) AS ultima_avaliacao_anterior
        FROM 
            trafos_reformados tr
        LEFT JOIN users u ON tr.tecnico_responsavel = u.matricula
        ${conditions}
        ORDER BY tr.id DESC
    `;

      if (getAll !== "true") {
        dataQuery += " LIMIT ? OFFSET ?";
        queryParams.push(limit, (page - 1) * limit);
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
      });
    } catch (err) {
      console.error("Erro ao buscar transformadores reformados:", err);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar transformadores reformados",
      });
    }
  }
);

router.get(
  "/api/transformadores_reformados/:id",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await promisePool.query(
        "SELECT * FROM trafos_reformados WHERE id = ?",
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Transformador não encontrado",
        });
      }

      res.json({
        success: true,
        data: rows[0],
      });
    } catch (err) {
      console.error("Erro ao buscar transformador por ID:", err);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar transformador por ID",
      });
    }
  }
);

router.get(
  "/api/checklist_por_registro/:registroId",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    try {
      const { registroId } = req.params;
      const [rows] = await promisePool.query(
        `SELECT tst.*, u.nome as nome_tecnico 
             FROM trafos_reformados_testes tst
             LEFT JOIN users u ON tst.tecnico_responsavel_teste = u.matricula
             WHERE tst.trafos_reformados_id = ?`,
        [registroId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Nenhum checklist encontrado para este registro.",
        });
      }

      res.json({ success: true, data: rows[0] });
    } catch (error) {
      console.error("Erro ao buscar checklist por registro:", error);
      res
        .status(500)
        .json({ success: false, message: "Erro interno ao buscar checklist." });
    }
  }
);

router.get(
  "/api/historico_por_serie/:numero_serie",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    try {
      const { numero_serie } = req.params;
      const [checklists] = await promisePool.query(
        `SELECT 
                tst.*,
                tr.numero_serie,
                u.nome as nome_tecnico
             FROM trafos_reformados_testes tst
             JOIN trafos_reformados tr ON tst.trafos_reformados_id = tr.id
             LEFT JOIN users u ON tst.tecnico_responsavel_teste = u.matricula
             WHERE tr.numero_serie = ? 
             ORDER BY tst.data_teste DESC, tst.id DESC`,
        [numero_serie]
      );
      res.json({ success: true, data: checklists });
    } catch (err) {
      console.error("Erro ao buscar checklists por série:", err);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar checklists por série",
      });
    }
  }
);

router.put(
  "/api/transformadores/:id/reverter",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { id } = req.params;
    try {
      const [result] = await promisePool.query(
        "UPDATE trafos_reformados SET status_avaliacao = 'pendente' WHERE id = ?",
        [id]
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Transformador não encontrado." });
      }

      await registrarAuditoria(
        req.user.matricula,
        "Reverter Status Trafo Reformado",
        `Status do registro de avaliação ID ${id} revertido para 'pendente'.`
      );

      res.json({ success: true, message: "Status revertido com sucesso." });
    } catch (error) {
      console.error("Erro ao reverter status do transformador:", error);
      res
        .status(500)
        .json({ success: false, message: "Erro interno no servidor." });
    }
  }
);

router.put(
  "/api/transformadores_reformados/:id/avaliar_completo",
  autenticar,
  verificarNivel(3),
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
      });
    } finally {
      connection.release();
    }
  }
);

router.post(
  "/api/gerar_pdf_checklist_especifico",
  autenticar,
  verificarNivel(3),
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
  "/api/gerar_pdf_tabela_historico",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { dados, filtros } = req.body;

    if (!dados || dados.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Não há dados para gerar o relatório.",
      });
    }

    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Relatório de Transformadores Avaliados</title>
            <style>
                body { font-family: 'Poppins', sans-serif; font-size: 9px; }
                h1 { text-align: center; color: #2a5298; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #ccc; padding: 5px; text-align: left; }
                th { background-color: #f2f2f2; }
                .info-filtros { margin-bottom: 15px; padding: 10px; border: 1px solid #eee; border-radius: 5px; }
                .info-filtros span { display: inline-block; margin-right: 15px; }
            </style>
        </head>
        <body>
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
            <table>
                <thead>
                    <tr>
                        <th>ID Registro</th>
                        <th>Nº de Série</th>
                        <th>Fabricante</th>
                        <th>Potência</th>
                        <th>Status</th>
                        <th>Data Avaliação</th>
                        <th>Técnico</th>
                    </tr>
                </thead>
                <tbody>
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
                                ? new Date(
                                    trafo.data_avaliacao
                                  ).toLocaleDateString("pt-BR")
                                : "-"
                            }</td>
                            <td>${trafo.nome_tecnico || "-"}</td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </body>
        </html>
      `;

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

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Relatorio_Checklists_Avaliados.pdf`
      );
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Erro ao gerar PDF da tabela de históricos:", error);
      res
        .status(500)
        .json({ success: false, message: "Erro interno no servidor." });
    }
  }
);

router.post(
  "/api/importar_trafos_reformados",
  autenticar,
  verificarNivel(3),
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
        errors_details: [],
      };

      for (const [index, row] of data.entries()) {
        const linha = index + 2;
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
          if (!itemValue) throw new Error("Coluna 'Item' é obrigatória.");
          if (!potValue)
            throw new Error("Coluna 'Potência (POT)' é obrigatória.");
          if (!fabricanteValue)
            throw new Error("Coluna 'Fabricante' é obrigatória.");

          const sql = `
            INSERT INTO trafos_reformados (item, numero_projeto, pot, numero_serie, numero_nota, t_at, t_bt, taps, fabricante, status_avaliacao, data_importacao) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', CURDATE())
          `;

          const params = [
            itemValue,
            getValue("numero_projeto"),
            potValue,
            numeroSerie,
            getValue("numero_nota"),
            getValue("t_at"),
            getValue("t_bt"),
            getValue("taps"),
            fabricanteValue,
          ];

          await connection.query(sql, params);
          results.imported++;
        } catch (error) {
          errorMessage = error.message;
          results.failed++;
          results.errors_details.push({
            linha,
            numero_serie:
              numeroSerie ||
              (columnMap.numero_serie && row[columnMap.numero_serie]) ||
              "",
            erro: errorMessage,
          });
        }
      }
      await connection.commit();
      res.json({
        success: results.imported > 0,
        message: `Importação concluída: ${results.imported} novos registros criados, ${results.failed} falhas.`,
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

router.delete(
  "/api/trafos_pendentes",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    try {
      const [result] = await promisePool.query(
        "DELETE FROM trafos_reformados WHERE status_avaliacao = 'pendente'"
      );

      await registrarAuditoria(
        req.user.matricula,
        "Limpeza de Pendentes",
        `${result.affectedRows} registros de avaliação pendentes foram apagados.`
      );

      res.json({ success: true, deletedCount: result.affectedRows });
    } catch (error) {
      console.error("Erro ao apagar registros pendentes:", error);
      res
        .status(500)
        .json({ success: false, message: "Erro interno no servidor." });
    }
  }
);

router.delete(
  "/api/transformadores_reformados/:id",
  autenticar,
  verificarNivel(3),
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
          "Excluir Ciclo de Avaliação",
          `Ciclo de avaliação (ID: ${id}) para o trafo série ${numero_serie} excluído.`
        );
        res.status(200).json({
          success: true,
          message:
            "Ciclo de avaliação e seu checklist associado foram excluídos com sucesso!",
        });
      } else {
        await connection.rollback();
        res.status(404).json({
          success: false,
          message: "Ciclo de avaliação não encontrado para exclusão!",
        });
      }
    } catch (err) {
      await connection.rollback();
      console.error("Erro ao excluir ciclo de avaliação:", err);
      res.status(500).json({
        success: false,
        message: "Erro ao excluir ciclo de avaliação!",
      });
    } finally {
      connection.release();
    }
  }
);

router.get(
  "/api/tecnicos_responsaveis_trafos_reformados",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    try {
      const [rows] = await promisePool.query(`
            SELECT DISTINCT u.matricula, u.nome 
            FROM users u
            JOIN trafos_reformados tr ON u.matricula = tr.tecnico_responsavel
            ORDER BY u.nome
        `);
      res.status(200).json(rows);
    } catch (err) {
      console.error("Erro ao buscar técnicos responsáveis:", err);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar técnicos responsáveis",
      });
    }
  }
);

router.get(
  "/api/fabricantes_trafos_reformados",
  autenticar,
  verificarNivel(3),
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
      });
    }
  }
);

router.get(
  "/api/potencias_trafos_reformados",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    try {
      const [rows] = await promisePool.query(
        'SELECT DISTINCT pot FROM trafos_reformados WHERE pot IS NOT NULL AND pot != "" ORDER BY CAST(pot AS UNSIGNED)'
      );
      res.status(200).json(rows.map((row) => row.pot));
    } catch (err) {
      console.error("Erro ao buscar potências:", err);
      res.status(500).json({ message: "Erro ao buscar potências!" });
    }
  }
);

module.exports = router;
