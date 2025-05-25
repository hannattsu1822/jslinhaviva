const express = require("express");
const path = require("path");
const { chromium } = require("playwright");
const { promisePool } = require("../init");
const {
  autenticar,
  verificarPermissaoPorCargo,
  registrarAuditoria,
} = require("../auth");

const router = express.Router();

router.get("/gestao-turmas", autenticar, (req, res, next) => {
  const cargosPermitidos = [
    "ADMIN",
    "Gerente",
    "Encarregado",
    "Inspetor",
    "Engenheiro",
    "Técnico",
  ];
  if (req.user && cargosPermitidos.includes(req.user.cargo)) {
    res.sendFile(
      path.join(
        __dirname,
        "../../public/pages/gestao_turmas/gestao-turmas.html"
      )
    );
  } else {
    res.status(403).json({ message: "Acesso negado!" });
  }
});

router.get("/diarias", autenticar, verificarPermissaoPorCargo, (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/gestao_turmas/diarias.html")
  );
});

router.get(
  "/turmas_ativas",
  autenticar,
  verificarPermissaoPorCargo,
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "../../public/pages/gestao_turmas/turmas_ativas.html"
      )
    );
  }
);

router.get("/api/turmas", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT id, matricula, nome, cargo, turma_encarregado FROM turmas ORDER BY turma_encarregado, nome"
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar usuários das turmas:", err);
    res.status(500).json({
      message: "Erro ao buscar usuários das turmas!",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

router.post(
  "/api/turmas/adicionar",
  autenticar,
  verificarPermissaoPorCargo,
  async (req, res) => {
    const { matricula, nome, cargo, turma_encarregado } = req.body;

    if (!matricula || !nome || !cargo || !turma_encarregado) {
      return res.status(400).json({
        message:
          "Todos os campos são obrigatórios: matrícula, nome, cargo e turma do encarregado.",
      });
    }

    try {
      const [existingUserInTurmas] = await promisePool.query(
        "SELECT * FROM turmas WHERE matricula = ?",
        [matricula]
      );
      if (existingUserInTurmas.length > 0) {
        return res
          .status(400)
          .json({ message: "Este usuário já está cadastrado em uma turma." });
      }

      await promisePool.query(
        "INSERT INTO turmas (matricula, nome, cargo, turma_encarregado) VALUES (?, ?, ?, ?)",
        [matricula, nome, cargo, turma_encarregado]
      );
      await registrarAuditoria(
        req.user.matricula,
        "Adicionar Membro Turma",
        `Matrícula: ${matricula}, Nome: ${nome}, Turma: ${turma_encarregado}`
      );
      res.status(201).json({ message: "Membro adicionado com sucesso!" });
    } catch (err) {
      console.error("Erro ao adicionar membro:", err);
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          message:
            "Já existe um usuário com esta matrícula na tabela de turmas!",
        });
      }
      res.status(500).json({
        message: "Erro ao adicionar membro!",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  }
);

router.put(
  "/api/turmas/:id",
  autenticar,
  verificarPermissaoPorCargo,
  async (req, res) => {
    const { id } = req.params;
    const { turma_encarregado, nome, cargo, matricula } = req.body;

    if (
      req.body.turma_encarregado === undefined &&
      req.body.nome === undefined &&
      req.body.cargo === undefined &&
      req.body.matricula === undefined
    ) {
      return res
        .status(400)
        .json({ message: "Nenhum dado fornecido para atualização." });
    }

    try {
      let query = "UPDATE turmas SET ";
      const params = [];
      const fieldsToUpdate = [];

      if (req.body.hasOwnProperty("turma_encarregado")) {
        fieldsToUpdate.push("turma_encarregado = ?");
        params.push(turma_encarregado);
      }
      if (req.body.hasOwnProperty("nome")) {
        fieldsToUpdate.push("nome = ?");
        params.push(nome);
      }
      if (req.body.hasOwnProperty("cargo")) {
        fieldsToUpdate.push("cargo = ?");
        params.push(cargo);
      }
      if (req.body.hasOwnProperty("matricula")) {
        fieldsToUpdate.push("matricula = ?");
        params.push(matricula);
      }

      if (fieldsToUpdate.length === 0) {
        return res.status(400).json({
          message: "Nenhum campo válido para atualização especificado.",
        });
      }

      query += fieldsToUpdate.join(", ") + " WHERE id = ?";
      params.push(id);

      const [result] = await promisePool.query(query, params);

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ message: "Membro não encontrado na tabela de turmas." });
      }
      await registrarAuditoria(
        req.user.matricula,
        "Atualizar Membro Turma",
        `ID Turma: ${id}, Novos Dados: ${JSON.stringify(req.body)}`
      );
      res.status(200).json({ message: "Membro atualizado com sucesso!" });
    } catch (err) {
      console.error("Erro ao atualizar membro:", err);
      if (err.code === "ER_DUP_ENTRY" && req.body.hasOwnProperty("matricula")) {
        return res
          .status(409)
          .json({ message: "A matrícula informada já está em uso." });
      }
      res.status(500).json({
        message: "Erro ao atualizar membro!",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  }
);

router.delete(
  "/api/turmas/:id",
  autenticar,
  verificarPermissaoPorCargo,
  async (req, res) => {
    const { id } = req.params;
    try {
      const [result] = await promisePool.query(
        "DELETE FROM turmas WHERE id = ?",
        [id]
      );
      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ message: "Membro não encontrado na tabela de turmas." });
      }
      await registrarAuditoria(
        req.user.matricula,
        "Remover Membro Turma",
        `ID Turma: ${id}`
      );
      res.status(200).json({ message: "Membro removido com sucesso!" });
    } catch (err) {
      console.error("Erro ao remover membro:", err);
      res.status(500).json({
        message: "Erro ao remover membro!",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  }
);

router.get(
  "/api/funcionarios_por_turma/:turma_encarregado_id",
  autenticar,
  async (req, res) => {
    try {
      const { turma_encarregado_id } = req.params;
      const privilegedRoles = [
        "Tecnico",
        "Engenheiro",
        "ADMIN",
        "Admin",
        "Inspetor",
      ];
      let userTurmaEncarregado = null;

      if (req.user && req.user.matricula) {
        const [userTurmaDetails] = await promisePool.query(
          "SELECT turma_encarregado FROM turmas WHERE matricula = ? LIMIT 1",
          [req.user.matricula]
        );
        if (userTurmaDetails.length > 0) {
          userTurmaEncarregado = userTurmaDetails[0].turma_encarregado;
        }
      }

      const isUserPrivileged =
        privilegedRoles.includes(req.user.cargo) ||
        (userTurmaEncarregado && userTurmaEncarregado.toString() === "2193");

      if (
        req.user.cargo === "Encarregado" &&
        !isUserPrivileged &&
        (userTurmaEncarregado
          ? userTurmaEncarregado.toString()
          : req.user.matricula.toString()) !== turma_encarregado_id.toString()
      ) {
        return res.status(403).json({
          message:
            "Acesso negado: Supervisores não privilegiados só podem visualizar funcionários de sua própria turma.",
        });
      }

      const [rows] = await promisePool.query(
        "SELECT matricula, nome, cargo FROM turmas WHERE turma_encarregado = ? ORDER BY nome",
        [turma_encarregado_id]
      );
      res.status(200).json(rows);
    } catch (err) {
      console.error("Erro ao buscar funcionários por turma:", err);
      res.status(500).json({
        message: "Erro ao buscar funcionários!",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  }
);

router.get(
  "/api/funcionarios/:matricula/ultimos-processos",
  autenticar,
  async (req, res) => {
    const { matricula } = req.params;

    if (!matricula) {
      return res
        .status(400)
        .json({ message: "Matrícula do funcionário é obrigatória." });
    }

    try {
      const [rows] = await promisePool.query(
        `SELECT DISTINCT processo
       FROM diarias
       WHERE matricula = ?
         AND processo IS NOT NULL AND processo != ''
       ORDER BY data DESC
       LIMIT 5`,
        [matricula]
      );
      res.status(200).json(rows);
    } catch (err) {
      console.error("Erro ao buscar últimos processos do funcionário:", err);
      res.status(500).json({
        message: "Erro ao buscar últimos processos!",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  }
);

router.post("/api/diarias", autenticar, async (req, res) => {
  const { data, processo, matricula, qs, qd } = req.body;
  const loggedInUserMatricula = req.user.matricula;
  const loggedInUserCargo = req.user.cargo;

  if (
    !data ||
    !processo ||
    !matricula ||
    (qs === undefined && qd === undefined)
  ) {
    return res
      .status(400)
      .json({
        message:
          "Campos obrigatórios não fornecidos: data, processo, matrícula e tipo de diária (QS/QD).",
      });
  }
  if (qs === false && qd === false) {
    return res
      .status(400)
      .json({
        message:
          "Pelo menos um tipo de diária (QS ou QD) deve ser selecionado.",
      });
  }

  try {
    let loggedInUserTeamId = null;
    if (loggedInUserMatricula) {
      const [userTurmaDetails] = await promisePool.query(
        "SELECT turma_encarregado FROM turmas WHERE matricula = ? LIMIT 1",
        [loggedInUserMatricula]
      );
      if (userTurmaDetails.length > 0) {
        loggedInUserTeamId = userTurmaDetails[0].turma_encarregado;
      }
    }

    const privilegedRoles = [
      "Tecnico",
      "Engenheiro",
      "ADMIN",
      "Admin",
      "Inspetor",
    ];
    const isGenerallyPrivileged =
      privilegedRoles.includes(loggedInUserCargo) ||
      (loggedInUserTeamId && loggedInUserTeamId.toString() === "2193");

    let canProceed = false;
    let permissionErrorMessage =
      "Acesso negado. Você não tem permissão para realizar esta ação.";

    const [targetEmployeeRows] = await promisePool.query(
      "SELECT nome, cargo, turma_encarregado FROM turmas WHERE matricula = ? LIMIT 1",
      [matricula]
    );

    if (targetEmployeeRows.length === 0) {
      return res
        .status(404)
        .json({
          message: `Funcionário alvo (matrícula: ${matricula}) não encontrado na tabela de turmas.`,
        });
    }
    const targetFuncionario = targetEmployeeRows[0];

    if (isGenerallyPrivileged) {
      canProceed = true;
    } else if (loggedInUserCargo === "Encarregado") {
      if (!loggedInUserTeamId) {
        permissionErrorMessage =
          "Acesso negado: Seu usuário Encarregado não está associado a uma turma para gerenciar.";
      } else {
        const targetEmployeeTeamId = targetFuncionario.turma_encarregado;
        if (
          targetEmployeeTeamId &&
          targetEmployeeTeamId.toString() === loggedInUserTeamId.toString()
        ) {
          canProceed = true;
        } else {
          permissionErrorMessage =
            "Acesso negado: Encarregados não privilegiados só podem adicionar diárias para membros de sua própria turma.";
        }
      }
    } else {
      permissionErrorMessage =
        "Acesso negado: Seu cargo não permite adicionar diárias.";
    }

    if (!canProceed) {
      return res.status(403).json({ message: permissionErrorMessage });
    }

    const [existingDiarias] = await promisePool.query(
      "SELECT id FROM diarias WHERE matricula = ? AND data = ? LIMIT 1",
      [matricula, data]
    );

    if (existingDiarias.length > 0) {
      const dataFormatada = new Date(data).toLocaleDateString("pt-BR", {
        timeZone: "UTC",
      });
      return res.status(409).json({
        message: `O funcionário ${targetFuncionario.nome} (matrícula: ${matricula}) já possui uma diária lançada para a data ${dataFormatada}. Não é permitido mais de uma diária por dia para o mesmo funcionário.`,
      });
    }

    const [result] = await promisePool.query(
      "INSERT INTO diarias (data, processo, matricula, nome, cargo, qs, qd) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        data,
        processo,
        matricula,
        targetFuncionario.nome,
        targetFuncionario.cargo,
        qs || false,
        qd || false,
      ]
    );

    if (result.affectedRows > 0) {
      await registrarAuditoria(
        loggedInUserMatricula,
        "Adicionar Diária",
        `Matrícula Func: ${matricula}, Nome: ${targetFuncionario.nome}, Processo: ${processo}, Data: ${data}, ID Diaria: ${result.insertId}`
      );
      res
        .status(201)
        .json({
          message: "Diária adicionada com sucesso!",
          id: result.insertId,
        });
    } else {
      throw new Error("Nenhuma linha afetada ao inserir a diária.");
    }
  } catch (err) {
    console.error("Erro ao adicionar diária no banco:", err);
    res.status(500).json({
      message: "Erro ao adicionar diária!",
      error:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Erro interno do servidor",
      sqlError:
        process.env.NODE_ENV === "development" && err.sqlMessage
          ? err.sqlMessage
          : undefined,
    });
  }
});

router.get("/api/diarias", autenticar, async (req, res) => {
  try {
    let query =
      "SELECT d.id, d.matricula, d.nome, d.cargo, d.data, d.processo, d.qs, d.qd FROM diarias d";
    const params = [];
    const whereClauses = [];
    let joinedTurmas = false;

    const privilegedRoles = [
      "Tecnico",
      "Engenheiro",
      "ADMIN",
      "Admin",
      "Inspetor",
    ];
    let userTurmaEncarregadoOrigin = null;
    if (req.user && req.user.matricula) {
      const [userTurmaDetails] = await promisePool.query(
        "SELECT turma_encarregado FROM turmas WHERE matricula = ? LIMIT 1",
        [req.user.matricula]
      );
      if (userTurmaDetails.length > 0) {
        userTurmaEncarregadoOrigin = userTurmaDetails[0].turma_encarregado;
      }
    }
    const isUserPrivileged =
      privilegedRoles.includes(req.user.cargo) ||
      (userTurmaEncarregadoOrigin &&
        userTurmaEncarregadoOrigin.toString() === "2193");

    if (req.user.cargo === "Encarregado" && !isUserPrivileged) {
      if (!joinedTurmas) {
        query += " JOIN turmas t ON d.matricula = t.matricula";
        joinedTurmas = true;
      }
      whereClauses.push("t.turma_encarregado = ?");
      params.push(userTurmaEncarregadoOrigin || req.user.matricula.toString());
    } else if (req.query.turma) {
      if (!joinedTurmas) {
        query += " JOIN turmas t ON d.matricula = t.matricula";
        joinedTurmas = true;
      }
      whereClauses.push("t.turma_encarregado = ?");
      params.push(req.query.turma);
    }

    if (req.query.matricula) {
      whereClauses.push("d.matricula LIKE ?");
      params.push(`%${req.query.matricula}%`);
    }
    if (req.query.dataInicial) {
      whereClauses.push("d.data >= ?");
      params.push(req.query.dataInicial);
    }
    if (req.query.dataFinal) {
      whereClauses.push("d.data <= ?");
      params.push(req.query.dataFinal);
    }
    if (req.query.processo) {
      whereClauses.push("d.processo LIKE ?");
      params.push(`%${req.query.processo}%`);
    }
    if (req.query.qs === "true") {
      whereClauses.push("d.qs = 1");
    }
    if (req.query.qd === "true") {
      whereClauses.push("d.qd = 1");
    }

    if (whereClauses.length > 0) {
      query += " WHERE " + whereClauses.join(" AND ");
    } else {
      query += " WHERE 1=1";
    }

    if (req.query.ordenar === "data_asc") {
      query += " ORDER BY d.matricula ASC, d.data ASC";
    } else {
      query += " ORDER BY d.matricula ASC, d.data DESC";
    }

    const [rows] = await promisePool.query(query, params);
    const diariassFormatadas = rows.map((d) => ({
      ...d,
      data_formatada: new Date(d.data).toLocaleDateString("pt-BR", {
        timeZone: "UTC",
      }),
    }));
    res.status(200).json(diariassFormatadas);
  } catch (err) {
    console.error("Erro ao buscar diárias:", err);
    res.status(500).json({
      message: "Erro ao buscar diárias!",
      error:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Erro interno do servidor",
    });
  }
});

router.delete("/api/diarias/:id", autenticar, async (req, res) => {
  const diariaId = req.params.id;
  const usuarioAuditoria = req.user.matricula;

  if (!diariaId) {
    return res.status(400).json({ message: "ID da diária não fornecido." });
  }

  try {
    const [diariaExistente] = await promisePool.query(
      "SELECT matricula, processo, data FROM diarias WHERE id = ?",
      [diariaId]
    );

    if (diariaExistente.length === 0) {
      return res
        .status(404)
        .json({ message: "Diária não encontrada para remoção." });
    }

    const [result] = await promisePool.query(
      "DELETE FROM diarias WHERE id = ?",
      [diariaId]
    );

    if (result.affectedRows > 0) {
      const detalhesDiaria = diariaExistente[0];
      await registrarAuditoria(
        usuarioAuditoria,
        "Remover Diária",
        `ID Diária: ${diariaId}, Matrícula Func: ${
          detalhesDiaria.matricula
        }, Processo: ${detalhesDiaria.processo}, Data: ${new Date(
          detalhesDiaria.data
        ).toLocaleDateString("pt-BR")}`
      );
      res.status(200).json({ message: "Diária removida com sucesso!" });
    } else {
      res
        .status(404)
        .json({ message: "Diária não encontrada ou já removida." });
    }
  } catch (err) {
    console.error("Erro ao remover diária do banco:", err);
    res.status(500).json({
      message: "Erro ao remover diária!",
      error:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Erro interno do servidor",
    });
  }
});

router.post("/api/gerar_pdf_diarias", autenticar, async (req, res) => {
  try {
    const { diarias, filtros, usuario } = req.body;
    const htmlContent = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Relatório de Diárias</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; font-size: 10px; }
                    h1 { color: #2a5298; text-align: center; font-size: 16px; margin-bottom: 10px; }
                    .header-info { margin-bottom: 10px; text-align: center; font-size: 10px; }
                    .filters { background-color: #f5f5f5; padding: 5px; border-radius: 3px; margin-bottom: 10px; font-size: 9px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9px; }
                    th { background-color: #2a5298; color: white; padding: 3px; text-align: left; }
                    td { padding: 3px; border-bottom: 1px solid #ddd; }
                    .group-header { background-color: #e6f0ff; font-weight: bold; }
                    .footer { margin-top: 20px; font-size: 9px; text-align: center; }
                    .assinatura { margin-top: 60px; border-top: 1px solid #000; width: 60%; margin-left: auto; margin-right: auto; padding-top: 5px; text-align: center; }
                    .text-center { text-align: center; }
                </style>
            </head>
            <body>
                <h1>Relatório de Diárias</h1>
                <div class="header-info">
                    <p>Gerado em: ${new Date().toLocaleDateString("pt-BR")}</p>
                </div>
                <div class="filters">
                    <h3>Filtros Aplicados</h3>
                    <p><strong>Turma:</strong> ${filtros.turma || "N/A"}</p>
                    <p><strong>Período:</strong> ${
                      filtros.dataInicial || "N/A"
                    } ${filtros.dataFinal ? "até " + filtros.dataFinal : ""}</p>
                    <p><strong>Processo:</strong> ${
                      filtros.processo || "N/A"
                    }</p>
                    <p><strong>Matrícula:</strong> ${
                      filtros.matricula || "N/A"
                    }</p>
                    <p><strong>QS:</strong> ${filtros.qs ? "Sim" : "Não"}</p>
                    <p><strong>QD:</strong> ${filtros.qd ? "Sim" : "Não"}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Matrícula</th>
                            <th>Nome</th>
                            <th>Função</th>
                            <th>Data</th>
                            <th class="text-center">QS</th>
                            <th class="text-center">QD</th>
                            <th>Processo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(diarias)
                          .map(
                            ([matricula, dados]) => `
                                <tr class="group-header">
                                    <td colspan="7">${matricula} - ${
                              dados.nome
                            } (${dados.cargo || "N/A"})</td>
                                </tr>
                                ${dados.diarias
                                  .map(
                                    (diaria) => `
                                    <tr>
                                        <td>${matricula}</td>
                                        <td>${dados.nome}</td>
                                        <td>${dados.cargo || "N/A"}</td>
                                        <td>${
                                          diaria.data_formatada ||
                                          new Date(
                                            diaria.data
                                          ).toLocaleDateString("pt-BR", {
                                            timeZone: "UTC",
                                          })
                                        }</td>
                                        <td class="text-center">${
                                          diaria.qs ? "X" : ""
                                        }</td>
                                        <td class="text-center">${
                                          diaria.qd ? "X" : ""
                                        }</td>
                                        <td>${diaria.processo}</td>
                                    </tr>
                                `
                                  )
                                  .join("")}
                            `
                          )
                          .join("")}
                    </tbody>
                </table>
                <div class="footer">
                    <p>Total de diárias: ${Object.values(diarias).reduce(
                      (acc, curr) => acc + curr.diarias.length,
                      0
                    )}</p>
                    <div class="assinatura">
                        <p>Gerado por: ${usuario.nome} (${
      usuario.matricula
    })</p>
                    </div>
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
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    });
    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Relatorio_Diarias.pdf"
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Erro ao gerar PDF de diárias:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao gerar PDF",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

router.get("/api/user-team-details", autenticar, async (req, res) => {
  try {
    if (!req.user || !req.user.matricula) {
      return res.status(400).json({
        message: "Matrícula do usuário não encontrada na requisição.",
      });
    }
    const [userTurmaEntry] = await promisePool.query(
      "SELECT turma_encarregado FROM turmas WHERE matricula = ? LIMIT 1",
      [req.user.matricula]
    );
    if (userTurmaEntry.length > 0) {
      res.json({ turma_encarregado: userTurmaEntry[0].turma_encarregado });
    } else {
      res.json({ turma_encarregado: null });
    }
  } catch (error) {
    console.error("Erro ao buscar detalhes da turma do usuário:", error);
    res
      .status(500)
      .json({ message: "Erro interno ao processar a solicitação." });
  }
});

module.exports = router;
