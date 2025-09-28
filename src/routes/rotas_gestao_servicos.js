const express = require("express");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const { promisePool, upload, projectRootDir } = require("../init");
const { autenticar, verificarNivel, registrarAuditoria } = require("../auth");
const puppeteer = require("puppeteer");
const { PDFDocument } = require("pdf-lib");

const router = express.Router();

function gerarHtmlDoRelatorio(data) {
  const gerarSecaoAnexos = (titulo, anexos) => {
    const imagens = anexos.filter((a) => a.dataUrl);
    if (imagens.length === 0) return "";

    return `
            <div class="section">
                <h2 class="section-title">${titulo}</h2>
                <div class="anexos-container">
                    ${imagens
                      .map(
                        (anexo) => `
                        <div class="anexo-item">
                            <img src="${anexo.dataUrl}" alt="${anexo.nome_original}">
                            <p>${anexo.nome_original}</p>
                        </div>`
                      )
                      .join("")}
                </div>
            </div>
        `;
  };

  const anexosRegistro = data.anexos.filter(
    (a) =>
      a.tipo_anexo === "imagem" ||
      a.tipo_anexo === "documento" ||
      a.tipo_anexo === null
  );
  const anexosConclusao = data.anexos.filter(
    (a) =>
      a.tipo_anexo === "imagem_conclusao" ||
      a.tipo_anexo === "documento_conclusao"
  );

  const itensHtml =
    data.itens && Array.isArray(data.itens) && data.itens.length > 0
      ? `
        <div class="section">
            <h2 class="section-title">Itens da Ordem de Serviço (Tarefas)</h2>
            <table class="item-table">
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Descrição da Tarefa</th>
                        <th>Status Final</th>
                        <th>Observações da Finalização</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.itens
                      .map(
                        (item) => `
                        <tr>
                            <td>${item.codigo || "N/A"}</td>
                            <td>${item.descricao || "N/A"}</td>
                            <td class="${
                              item.status === "concluido"
                                ? "status-concluido"
                                : "status-nao-concluido"
                            }">
                                ${(item.status || "")
                                  .replace(/_/g, " ")
                                  .toUpperCase()}
                            </td>
                            <td>${item.observacoes || "Nenhuma"}</td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
        `
      : "";

  const finalizacaoHtml =
    data.status === "concluido" || data.status === "nao_concluido"
      ? `
        <div class="section">
            <h2 class="section-title">Dados de Finalização</h2>
            <div class="grid-container">
                <div class="grid-item"><strong>Data de Finalização:</strong> ${
                  data.data_conclusao || "N/A"
                }</div>
                <div class="grid-item"><strong>Status Final:</strong> ${(
                  data.status || ""
                )
                  .replace("_", " ")
                  .toUpperCase()}</div>
                <div class="grid-item full-width description">
                    <strong>Observações / Motivo da Finalização:</strong>
                    <p>${data.motivo || "Nenhuma observação registrada."}</p>
                </div>
            </div>
        </div>
        `
      : "";

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <title>Relatório de Serviço - ${data.id}</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 20px; font-size: 10pt; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #004a99; padding-bottom: 10px; margin-bottom: 20px; }
            .header h1 { margin: 0; color: #004a99; font-size: 18pt; }
            .header p { margin: 5px 0 0; font-size: 10pt; color: #555; }
            .section { margin-bottom: 20px; page-break-inside: avoid; }
            .section-title { font-size: 12pt; font-weight: bold; color: #004a99; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px; }
            .grid-container { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; }
            .grid-item { background-color: #f8f9fa; border: 1px solid #e9ecef; padding: 8px; border-radius: 4px; overflow-wrap: break-word; }
            .grid-item strong { display: block; color: #495057; margin-bottom: 4px; font-size: 8pt; text-transform: uppercase; }
            .full-width { grid-column: 1 / -1; }
            .description p { margin: 0; }
            .item-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .item-table th, .item-table td { border: 1px solid #dee2e6; padding: 6px; text-align: left; font-size: 9pt; }
            .item-table th { background-color: #e9ecef; font-weight: bold; }
            .status-concluido { color: #155724; }
            .status-nao-concluido { color: #721c24; font-weight: bold; }
            .anexos-container { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; }
            .anexo-item { border: 1px solid #ccc; padding: 10px; text-align: center; page-break-inside: avoid; }
            .anexo-item img { max-width: 100%; height: auto; max-height: 150px; margin-bottom: 5px; }
            .anexo-item p { font-size: 8pt; margin: 0; word-break: break-all; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Relatório Consolidado de Serviço</h1>
            <p>Documento gerado em: ${new Date().toLocaleString("pt-BR")}</p>
        </div>
        <div class="section">
            <h2 class="section-title">Informações Gerais do Serviço</h2>
            <div class="grid-container">
                <div class="grid-item"><strong>ID do Serviço:</strong> ${
                  data.id || "N/A"
                }</div>
                <div class="grid-item"><strong>Processo:</strong> ${
                  data.processo || "N/A"
                }</div>
                <div class="grid-item"><strong>Status:</strong> ${(
                  data.status || ""
                )
                  .replace("_", " ")
                  .toUpperCase()}</div>
                <div class="grid-item"><strong>Data Prevista:</strong> ${
                  data.data_prevista_execucao || "N/A"
                }</div>
                <div class="grid-item"><strong>Subestação:</strong> ${
                  data.subestacao || "N/A"
                }</div>
                <div class="grid-item"><strong>Alimentador:</strong> ${
                  data.alimentador || "N/A"
                }</div>
                <div class="grid-item"><strong>Encarregado(s):</strong> ${
                  data.responsavel_nome || data.responsavel_matricula || "N/A"
                }</div>
                <div class="grid-item"><strong>Desligamento:</strong> ${
                  data.desligamento || "N/A"
                }</div>
            </div>
        </div>
        <div class="section">
            <h2 class="section-title">Descrição do Registro</h2>
            <div class="grid-container">
                <div class="grid-item full-width description">
                    <strong>Descrição / Motivo do Serviço:</strong>
                    <p>${
                      data.descricao_servico ||
                      data.descricao_geral ||
                      "Nenhuma descrição fornecida."
                    }</p>
                </div>
                <div class="grid-item full-width description">
                    <strong>Observações do Registro:</strong>
                    <p>${
                      data.observacoes ||
                      data.observacoes_gerais ||
                      "Nenhuma observação fornecida."
                    }</p>
                </div>
            </div>
        </div>
        ${itensHtml}
        ${finalizacaoHtml}
        ${gerarSecaoAnexos("Anexos do Registro", anexosRegistro)}
        ${gerarSecaoAnexos("Anexos da Conclusão", anexosConclusao)}
    </body>
    </html>
    `;
}

router.get("/gestao-servicos", autenticar, verificarNivel(2), (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/gestao_servico.html")
  );
});

router.get("/servicos_ativos", autenticar, verificarNivel(3), (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/servicos_ativos.html")
  );
});

router.get(
  "/servicos_concluidos",
  autenticar,
  verificarNivel(2),
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "../../public/pages/servicos/servicos_concluidos.html"
      )
    );
  }
);

router.get("/detalhes_servico", autenticar, verificarNivel(2), (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/detalhes_servico.html")
  );
});

router.get("/editar_servico", autenticar, verificarNivel(4), (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/editar_servico.html")
  );
});

router.get("/api/servicos", autenticar, verificarNivel(2), async (req, res) => {
  const { status } = req.query;
  const { nivel, matricula } = req.user;

  if (!status) {
    return res
      .status(400)
      .json({ success: false, message: "O parâmetro 'status' é obrigatório." });
  }

  const connection = await promisePool.getConnection();
  try {
    const statusMap = {
      ativo: ["ativo"],
      concluido: ["concluido", "nao_concluido"],
    };

    if (!statusMap[status]) {
      return res
        .status(400)
        .json({ success: false, message: "Status inválido." });
    }

    const dbStatus = statusMap[status];

    let whereClauseLegado = "";
    const paramsLegado = [dbStatus];
    if (nivel < 5) {
      whereClauseLegado = "AND p.responsavel_matricula = ?";
      paramsLegado.push(matricula);
    }

    let whereClauseModerno = "";
    const paramsModerno = [dbStatus];
    if (nivel < 5) {
      whereClauseModerno = `AND EXISTS (SELECT 1 FROM ordem_servico_itens osi WHERE osi.ordem_servico_id = os.id AND osi.responsavel_matricula = ?)`;
      paramsModerno.push(matricula);
    }

    await connection.query("SET SESSION group_concat_max_len = 10000;");

    const queryLegado = `
      SELECT
          p.id, p.processo, p.subestacao, p.alimentador, p.data_prevista_execucao,
          p.desligamento, p.ordem_obra, p.status, p.data_conclusao,
          p.responsavel_matricula, u.nome as responsavel_nome,
          'legado' as sistema_versao,
          NULL as progresso_concluidos,
          NULL as progresso_total,
          p.observacoes_conclusao as motivo
      FROM processos p
      LEFT JOIN users u ON p.responsavel_matricula = u.matricula
      WHERE p.status IN (?) ${whereClauseLegado};
    `;
    const [servicosLegado] = await connection.query(queryLegado, paramsLegado);

    const queryModerno = `
      SELECT
          os.id, os.processo, os.subestacao, os.alimentador, os.data_prevista_execucao,
          os.desligamento, os.ordem_obra, os.status, os.data_conclusao,
          (
            SELECT GROUP_CONCAT(DISTINCT CASE WHEN osi.responsavel_matricula = 'pendente' THEN 'Pendente' ELSE u_item.nome END SEPARATOR ', ')
            FROM ordem_servico_itens osi
            LEFT JOIN users u_item ON osi.responsavel_matricula = u_item.matricula
            WHERE osi.ordem_servico_id = os.id
          ) as responsavel_matricula,
          NULL as responsavel_nome,
          'moderno' as sistema_versao,
          (SELECT COUNT(*) FROM ordem_servico_itens WHERE ordem_servico_id = os.id AND status IN ('concluido', 'finalizacao_impossibilitada')) as progresso_concluidos,
          (SELECT COUNT(*) FROM ordem_servico_itens WHERE ordem_servico_id = os.id) as progresso_total,
          (SELECT GROUP_CONCAT(osi_obs.observacoes SEPARATOR '; ') FROM ordem_servico_itens osi_obs WHERE osi_obs.ordem_servico_id = os.id AND osi_obs.status = 'finalizacao_impossibilitada') as motivo
      FROM ordens_servico os
      WHERE os.status IN (?) ${whereClauseModerno};
    `;
    const [servicosModernos] = await connection.query(
      queryModerno,
      paramsModerno
    );

    const servicosUnificados = [...servicosLegado, ...servicosModernos];

    servicosUnificados.sort((a, b) => {
      const dateA = a.data_prevista_execucao
        ? new Date(a.data_prevista_execucao)
        : 0;
      const dateB = b.data_prevista_execucao
        ? new Date(b.data_prevista_execucao)
        : 0;
      if (dateB - dateA !== 0) {
        return dateB - dateA;
      }
      return b.id - a.id;
    });

    res.status(200).json(servicosUnificados);
  } catch (error) {
    console.error("Erro ao buscar serviços unificados:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao buscar serviços",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
});

router.get(
  "/api/servicos/:id",
  autenticar,
  verificarNivel(2),
  async (req, res) => {
    const { id } = req.params;
    const connection = await promisePool.getConnection();
    try {
      const [servicoRows] = await connection.query(
        `SELECT p.*, u.nome as responsavel_nome FROM processos p LEFT JOIN users u ON p.responsavel_matricula = u.matricula WHERE p.id = ?`,
        [id]
      );
      if (servicoRows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Serviço não encontrado" });
      }
      const [anexos] = await connection.query(
        `SELECT id, nome_original as nomeOriginal, caminho_servidor as caminho, tamanho, tipo_anexo as tipo FROM processos_anexos WHERE processo_id = ?`,
        [id]
      );
      const resultado = { ...servicoRows[0], anexos };
      res.status(200).json({ success: true, data: resultado });
    } catch (error) {
      console.error("Erro ao buscar detalhes do serviço legado:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar detalhes do serviço",
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.put(
  "/api/servicos/:id",
  autenticar,
  verificarNivel(5),
  upload.array("anexos", 5),
  async (req, res) => {
    const { id } = req.params;
    const {
      processo,
      subestacao,
      alimentador,
      chave_montante,
      desligamento,
      hora_inicio,
      hora_fim,
      responsavel_matricula,
      ordem_obra,
      maps,
      descricao_geral,
      observacoes_gerais,
    } = req.body;

    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        `UPDATE processos SET
          processo = ?, subestacao = ?, alimentador = ?, chave_montante = ?,
          desligamento = ?, hora_inicio = ?, hora_fim = ?, responsavel_matricula = ?,
          ordem_obra = ?, maps = ?, descricao_servico = ?, observacoes = ?
        WHERE id = ?`,
        [
          processo,
          subestacao,
          alimentador,
          chave_montante,
          desligamento,
          desligamento === "SIM" ? hora_inicio : null,
          desligamento === "SIM" ? hora_fim : null,
          responsavel_matricula || "pendente",
          ordem_obra,
          maps,
          descricao_geral,
          observacoes_gerais,
          id,
        ]
      );

      if (req.files && req.files.length > 0) {
      }

      await connection.commit();
      await registrarAuditoria(
        req.user.matricula,
        "Edição de Serviço (Legado)",
        `Serviço legado ID ${id} foi atualizado.`
      );
      res.json({
        success: true,
        message: "Serviço atualizado com sucesso!",
        redirect: `/detalhes_servico?id=${id}`,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao atualizar serviço legado:", error);
      res
        .status(500)
        .json({ success: false, message: "Erro ao atualizar serviço." });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.patch(
  "/api/servicos/:id/responsavel",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { id } = req.params;
    const { responsavel_matricula } = req.body;
    if (!responsavel_matricula) {
      return res.status(400).json({
        success: false,
        message: "Matrícula do responsável é obrigatória.",
      });
    }
    const connection = await promisePool.getConnection();
    try {
      const [result] = await connection.query(
        "UPDATE processos SET responsavel_matricula = ? WHERE id = ?",
        [responsavel_matricula, id]
      );
      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Serviço não encontrado." });
      }
      await registrarAuditoria(
        req.user.matricula,
        "Atribuição de Responsável (Legado)",
        `Serviço ID ${id} atribuído a ${responsavel_matricula}`
      );
      res.json({
        success: true,
        message: "Responsável atualizado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao atualizar responsável legado:", error);
      res
        .status(500)
        .json({ success: false, message: "Erro ao atualizar responsável" });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.delete(
  "/api/servicos/:id",
  autenticar,
  verificarNivel(5),
  async (req, res) => {
    const { id } = req.params;
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();
      const [servicoRows] = await connection.query(
        "SELECT processo FROM processos WHERE id = ?",
        [id]
      );
      if (servicoRows.length === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({ success: false, message: "Serviço legado não encontrado." });
      }

      await connection.query(
        "DELETE FROM processos_anexos WHERE processo_id = ?",
        [id]
      );
      await connection.query("DELETE FROM processos WHERE id = ?", [id]);

      await connection.commit();
      await registrarAuditoria(
        req.user.matricula,
        "Exclusão de Serviço (Legado)",
        `Serviço legado ID ${id} (Processo: ${servicoRows[0].processo}) foi excluído.`
      );
      res.json({
        success: true,
        message: "Serviço legado excluído com sucesso.",
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao excluir serviço legado:", error);
      res
        .status(500)
        .json({ success: false, message: "Erro ao excluir serviço legado." });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.get(
  "/api/encarregados",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const connection = await promisePool.getConnection();
    try {
      const [rows] = await connection.query(
        "SELECT DISTINCT matricula, nome FROM users WHERE cargo IN ('Encarregado', 'Engenheiro', 'Técnico', 'ADM', 'ADMIN', 'Inspetor') ORDER BY nome"
      );
      res.status(200).json(rows);
    } catch (err) {
      console.error("Erro ao buscar encarregados:", err);
      res.status(500).json({ message: "Erro ao buscar encarregados!" });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.get(
  "/api/subestacoes",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const connection = await promisePool.getConnection();
    try {
      const [rows] = await connection.query(
        '(SELECT DISTINCT subestacao as nome FROM processos WHERE subestacao IS NOT NULL AND subestacao != "") UNION (SELECT DISTINCT subestacao as nome FROM ordens_servico WHERE subestacao IS NOT NULL AND subestacao != "") ORDER BY nome'
      );
      res.status(200).json(rows);
    } catch (err) {
      console.error("Erro ao buscar subestações:", err);
      res.status(500).json({ message: "Erro ao buscar subestações!" });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.get(
  "/api/servicos/:id/relatorio-completo",
  autenticar,
  verificarNivel(2),
  async (req, res) => {
    const { id } = req.params;
    const connection = await promisePool.getConnection();
    let browser = null;

    try {
      let servico,
        anexos = [],
        itens = [];
      const [servicoLegado] = await connection.query(
        "SELECT p.*, u.nome as responsavel_nome FROM processos p LEFT JOIN users u ON p.responsavel_matricula = u.matricula WHERE p.id = ?",
        [id]
      );

      if (servicoLegado.length > 0) {
        servico = servicoLegado[0];
        const [anexosLegado] = await connection.query(
          "SELECT *, nome_original as nome_original, caminho_servidor as caminho_servidor, tipo_anexo FROM processos_anexos WHERE processo_id = ?",
          [id]
        );
        anexos = anexosLegado;
      } else {
        const [servicoModerno] = await connection.query(
          "SELECT * FROM ordens_servico WHERE id = ?",
          [id]
        );
        if (servicoModerno.length === 0) {
          return res.status(404).json({ message: "Serviço não encontrado." });
        }
        servico = servicoModerno[0];

        const [anexosPrincipais] = await connection.query(
          "SELECT *, nome_original as nome_original, caminho_servidor as caminho_servidor, tipo_anexo FROM ordem_servico_anexos WHERE ordem_servico_id = ?",
          [id]
        );

        const [anexosDeItens] = await connection.query(
          `
                SELECT osia.*, osia.nome_original as nome_original, osia.caminho_servidor as caminho_servidor, osia.tipo_anexo 
                FROM ordem_servico_item_anexos osia
                JOIN ordem_servico_itens osi ON osia.item_id = osi.id
                WHERE osi.ordem_servico_id = ?`,
          [id]
        );

        anexos = [...anexosPrincipais, ...anexosDeItens];

        const [itensModernos] = await connection.query(
          "SELECT osi.*, cd.codigo, cd.descricao FROM ordem_servico_itens osi JOIN codigos_defeito cd ON osi.codigo_defeito_id = cd.id WHERE osi.ordem_servico_id = ?",
          [id]
        );
        itens = itensModernos;
      }

      servico.itens = itens;
      servico.anexos = anexos;
      if (servico.data_prevista_execucao) {
        servico.data_prevista_execucao = new Date(
          servico.data_prevista_execucao
        ).toLocaleDateString("pt-BR", { timeZone: "UTC" });
      }
      if (servico.data_conclusao) {
        servico.data_conclusao = new Date(
          servico.data_conclusao
        ).toLocaleString("pt-BR", { timeZone: "UTC" });
      }

      for (const anexo of servico.anexos) {
        if (
          anexo.caminho_servidor &&
          /\.(jpg|jpeg|png)$/i.test(anexo.nome_original)
        ) {
          const anexoFullPath = path.join(
            projectRootDir,
            anexo.caminho_servidor.replace("/api/", "")
          );
          if (fs.existsSync(anexoFullPath)) {
            const imageBuffer = await fsPromises.readFile(anexoFullPath);
            const mimeType = anexo.nome_original.toLowerCase().endsWith(".png")
              ? "image/png"
              : "image/jpeg";
            anexo.dataUrl = `data:${mimeType};base64,${imageBuffer.toString(
              "base64"
            )}`;
          }
        }
      }

      const htmlContent = gerarHtmlDoRelatorio(servico);

      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: "networkidle0" });
      const coverPagePdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
      });

      const mergedPdf = await PDFDocument.create();
      const coverDoc = await PDFDocument.load(coverPagePdfBuffer);
      const coverPages = await mergedPdf.copyPages(
        coverDoc,
        coverDoc.getPageIndices()
      );
      coverPages.forEach((page) => mergedPdf.addPage(page));

      const anexosPdf = anexos.filter(
        (a) => a.nome_original && a.nome_original.toLowerCase().endsWith(".pdf")
      );

      for (const anexo of anexosPdf) {
        const anexoPath = anexo.caminho_servidor;
        const anexoFullPath = path.join(
          projectRootDir,
          anexoPath.replace("/api/", "")
        );

        if (fs.existsSync(anexoFullPath)) {
          try {
            const anexoPdfBytes = await fsPromises.readFile(anexoFullPath);
            const anexoDoc = await PDFDocument.load(anexoPdfBytes);
            const anexoPages = await mergedPdf.copyPages(
              anexoDoc,
              anexoDoc.getPageIndices()
            );
            anexoPages.forEach((page) => mergedPdf.addPage(page));
          } catch (e) {
            console.warn(
              `Não foi possível anexar o PDF: ${anexoPath}. Erro: ${e.message}`
            );
          }
        }
      }

      const finalPdfBytes = await mergedPdf.save();

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=relatorio_servico_${id}.pdf`
      );
      res.send(Buffer.from(finalPdfBytes));
    } catch (error) {
      console.error("Erro ao gerar relatório completo:", error);
      res.status(500).json({ message: "Erro ao gerar relatório." });
    } finally {
      if (browser) await browser.close();
      if (connection) connection.release();
    }
  }
);

module.exports = router;
