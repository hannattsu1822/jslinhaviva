const { promisePool } = require("../../../init");
const { chromium } = require("playwright");

async function listarUltimosProcessos(matricula) {
  if (!matricula) {
    throw new Error("Matrícula do funcionário é obrigatória.");
  }
  const [rows] = await promisePool.query(
    `SELECT DISTINCT processo
     FROM diarias
     WHERE matricula = ? AND processo IS NOT NULL AND processo != ''
     ORDER BY data DESC
     LIMIT 5`,
    [matricula]
  );
  return rows;
}

async function adicionarDiaria(dadosDiaria, usuarioLogado) {
  const { data, processo, matricula, qs, qd } = dadosDiaria;
  const { matricula: loggedInUserMatricula, cargo: loggedInUserCargo } =
    usuarioLogado;

  if (
    !data ||
    !processo ||
    !matricula ||
    (qs === undefined && qd === undefined)
  ) {
    throw new Error(
      "Campos obrigatórios não fornecidos: data, processo, matrícula e tipo de diária (QS/QD)."
    );
  }
  if (qs === false && qd === false) {
    throw new Error(
      "Pelo menos um tipo de diária (QS ou QD) deve ser selecionado."
    );
  }

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

  const [targetEmployeeRows] = await promisePool.query(
    "SELECT nome, cargo, turma_encarregado FROM turmas WHERE matricula = ? LIMIT 1",
    [matricula]
  );

  if (targetEmployeeRows.length === 0) {
    throw new Error(
      `Funcionário alvo (matrícula: ${matricula}) não encontrado na tabela de turmas.`
    );
  }
  const targetFuncionario = targetEmployeeRows[0];

  if (!isGenerallyPrivileged && loggedInUserCargo === "Encarregado") {
    if (!loggedInUserTeamId) {
      throw new Error(
        "Acesso negado: Seu usuário Encarregado não está associado a uma turma para gerenciar."
      );
    }
    const targetEmployeeTeamId = targetFuncionario.turma_encarregado;
    if (
      !targetEmployeeTeamId ||
      targetEmployeeTeamId.toString() !== loggedInUserTeamId.toString()
    ) {
      throw new Error(
        "Acesso negado: Encarregados não privilegiados só podem adicionar diárias para membros de sua própria turma."
      );
    }
  } else if (!isGenerallyPrivileged) {
    throw new Error("Acesso negado: Seu cargo não permite adicionar diárias.");
  }

  const [existingDiarias] = await promisePool.query(
    "SELECT id FROM diarias WHERE matricula = ? AND data = ? LIMIT 1",
    [matricula, data]
  );

  if (existingDiarias.length > 0) {
    const dataFormatada = new Date(data).toLocaleDateString("pt-BR", {
      timeZone: "UTC",
    });
    throw new Error(
      `O funcionário ${targetFuncionario.nome} (matrícula: ${matricula}) já possui uma diária lançada para a data ${dataFormatada}. Não é permitido mais de uma diária por dia para o mesmo funcionário.`
    );
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

  return {
    id: result.insertId,
    nomeFuncionario: targetFuncionario.nome,
  };
}

async function listarDiarias(filtros, usuarioLogado) {
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
  if (usuarioLogado && usuarioLogado.matricula) {
    const [userTurmaDetails] = await promisePool.query(
      "SELECT turma_encarregado FROM turmas WHERE matricula = ? LIMIT 1",
      [usuarioLogado.matricula]
    );
    if (userTurmaDetails.length > 0) {
      userTurmaEncarregadoOrigin = userTurmaDetails[0].turma_encarregado;
    }
  }
  const isUserPrivileged =
    privilegedRoles.includes(usuarioLogado.cargo) ||
    (userTurmaEncarregadoOrigin &&
      userTurmaEncarregadoOrigin.toString() === "2193");

  if (usuarioLogado.cargo === "Encarregado" && !isUserPrivileged) {
    if (!joinedTurmas) {
      query += " JOIN turmas t ON d.matricula = t.matricula";
      joinedTurmas = true;
    }
    whereClauses.push("t.turma_encarregado = ?");
    params.push(
      userTurmaEncarregadoOrigin || usuarioLogado.matricula.toString()
    );
  } else if (filtros.turma) {
    if (!joinedTurmas) {
      query += " JOIN turmas t ON d.matricula = t.matricula";
      joinedTurmas = true;
    }
    whereClauses.push("t.turma_encarregado = ?");
    params.push(filtros.turma);
  }

  if (filtros.matricula) {
    whereClauses.push("d.matricula LIKE ?");
    params.push(`%${filtros.matricula}%`);
  }
  if (filtros.dataInicial) {
    whereClauses.push("d.data >= ?");
    params.push(filtros.dataInicial);
  }
  if (filtros.dataFinal) {
    whereClauses.push("d.data <= ?");
    params.push(filtros.dataFinal);
  }
  if (filtros.processo) {
    whereClauses.push("d.processo LIKE ?");
    params.push(`%${filtros.processo}%`);
  }
  if (filtros.qs === "true") {
    whereClauses.push("d.qs = 1");
  }
  if (filtros.qd === "true") {
    whereClauses.push("d.qd = 1");
  }

  if (whereClauses.length > 0) {
    query += " WHERE " + whereClauses.join(" AND ");
  }

  query +=
    filtros.ordenar === "data_asc"
      ? " ORDER BY d.matricula ASC, d.data ASC"
      : " ORDER BY d.matricula ASC, d.data DESC";

  const [rows] = await promisePool.query(query, params);
  return rows.map((d) => ({
    ...d,
    data_formatada: new Date(d.data).toLocaleDateString("pt-BR", {
      timeZone: "UTC",
    }),
  }));
}

async function removerDiaria(diariaId) {
  const [diariaExistente] = await promisePool.query(
    "SELECT matricula, processo, data FROM diarias WHERE id = ?",
    [diariaId]
  );

  if (diariaExistente.length === 0) {
    throw new Error("Diária não encontrada para remoção.");
  }

  const [result] = await promisePool.query("DELETE FROM diarias WHERE id = ?", [
    diariaId,
  ]);

  if (result.affectedRows === 0) {
    throw new Error("Diária não encontrada ou já removida.");
  }
  return diariaExistente[0];
}

async function gerarPdfDiarias(dados) {
  const { diarias, filtros, usuario } = dados;
  if (!diarias || !filtros || !usuario) {
    throw new Error(
      "Dados insuficientes para gerar o PDF. Faltam informações essenciais na requisição."
    );
  }

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
            <div class="header-info"><p>Gerado em: ${new Date().toLocaleDateString(
              "pt-BR"
            )}</p></div>
            <div class="filters">
                <h3>Filtros Aplicados</h3>
                <p><strong>Turma:</strong> ${filtros?.turma || "N/A"}</p>
                <p><strong>Período:</strong> ${filtros?.dataInicial || "N/A"} ${
    filtros?.dataFinal ? "até " + filtros.dataFinal : ""
  }</p>
                <p><strong>Processo:</strong> ${filtros?.processo || "N/A"}</p>
                <p><strong>Matrícula:</strong> ${
                  filtros?.matricula || "N/A"
                }</p>
                <p><strong>QS:</strong> ${filtros?.qs ? "Sim" : "Não"}</p>
                <p><strong>QD:</strong> ${filtros?.qd ? "Sim" : "Não"}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Matrícula</th><th>Nome</th><th>Função</th><th>Data</th>
                        <th class="text-center">QS</th><th class="text-center">QD</th><th>Processo</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(diarias)
                      .map(
                        ([matricula, dados]) => `
                        <tr class="group-header"><td colspan="7">${matricula} - ${
                          dados?.nome || "Nome Indisponível"
                        } (${dados?.cargo || "N/A"})</td></tr>
                        ${
                          dados?.diarias
                            ?.map(
                              (diaria) => `
                            <tr>
                                <td>${matricula}</td>
                                <td>${dados?.nome || "N/A"}</td>
                                <td>${dados?.cargo || "N/A"}</td>
                                <td>${
                                  diaria?.data_formatada ||
                                  (diaria?.data
                                    ? new Date(diaria.data).toLocaleDateString(
                                        "pt-BR",
                                        { timeZone: "UTC" }
                                      )
                                    : "N/A")
                                }</td>
                                <td class="text-center">${
                                  diaria?.qs ? "X" : ""
                                }</td>
                                <td class="text-center">${
                                  diaria?.qd ? "X" : ""
                                }</td>
                                <td>${diaria?.processo || ""}</td>
                            </tr>
                        `
                            )
                            .join("") || ""
                        }
                    `
                      )
                      .join("")}
                </tbody>
            </table>
            <div class="footer">
                <p>Total de diárias: ${Object.values(diarias).reduce(
                  (acc, curr) => acc + (curr?.diarias?.length || 0),
                  0
                )}</p>
                <div class="assinatura"><p>Gerado por: ${
                  usuario?.nome || "Usuário Desconhecido"
                } (${usuario?.matricula || "N/A"})</p></div>
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

  return pdfBuffer;
}

module.exports = {
  listarUltimosProcessos,
  adicionarDiaria,
  listarDiarias,
  removerDiaria,
  gerarPdfDiarias,
};
