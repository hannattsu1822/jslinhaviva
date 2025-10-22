const { promisePool } = require("../../../init");
const XLSX = require("xlsx");

async function importarDadosProcessos(file, planilhaTipo) {
  if (!file) throw new Error("Nenhum arquivo de planilha foi enviado.");
  if (!planilhaTipo) throw new Error("O tipo de planilha é obrigatório.");

  const connection = await promisePool.getConnection();
  try {
    const workbook = XLSX.read(file.buffer, {
      type: "buffer",
      cellDates: true,
    });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName)
      throw new Error("A planilha enviada está vazia ou corrompida.");

    const worksheet = workbook.Sheets[sheetName];
    const dataAsArray = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      blankrows: false,
    });
    if (dataAsArray.length < 2)
      throw new Error(
        "A planilha não contém dados válidos ou está sem cabeçalhos."
      );

    const headers = dataAsArray[0].map((header) => String(header).trim());
    const dataRows = dataAsArray.slice(1);

    const NOME_COLUNA_COMENTARIOS = "PrimeiroDeComentários";
    const indiceComentarios = headers.indexOf(NOME_COLUNA_COMENTARIOS);
    const indiceIdProcessoVisual = headers.indexOf("IDPROCESSO_VISUAL");
    const indicePrevisaoExecucao = headers.indexOf("Previsão execução");
    const indiceProcessoLegado = headers.indexOf("Processo");
    const indiceDataLegado = headers.indexOf("Data");

    if (
      planilhaTipo === "programacao_obras" &&
      (indiceIdProcessoVisual === -1 || indicePrevisaoExecucao === -1)
    ) {
      throw new Error(
        "Cabeçalhos 'IDPROCESSO_VISUAL' ou 'Previsão execução' não encontrados."
      );
    }
    if (
      planilhaTipo === "desligamento_programado" &&
      (indiceProcessoLegado === -1 || indiceDataLegado === -1)
    ) {
      throw new Error("Cabeçalhos 'Processo' ou 'Data' não encontrados.");
    }

    await connection.beginTransaction();
    let importedCount = 0,
      skippedEnergizada = 0,
      skippedDuplicata = 0;
    const horasPossiveis = ["01:00:00", "02:00:00", "03:00:00", "04:00:00"];

    for (const row of dataRows) {
      if (planilhaTipo === "programacao_obras" && indiceComentarios !== -1) {
        if (
          row.length <= indiceComentarios ||
          !String(row[indiceComentarios] || "")
            .toLowerCase()
            .includes("energizada")
        ) {
          skippedEnergizada++;
          continue;
        }
      }

      let processoValue, dataValue;
      if (planilhaTipo === "programacao_obras") {
        processoValue = row[indiceIdProcessoVisual];
        dataValue = row[indicePrevisaoExecucao];
      } else if (planilhaTipo === "desligamento_programado") {
        processoValue = row[indiceProcessoLegado];
        dataValue = row[indiceDataLegado];
      } else {
        throw new Error("Tipo de planilha desconhecido.");
      }

      if (!processoValue || !dataValue) continue;
      const dataDoProcesso = new Date(dataValue);
      if (isNaN(dataDoProcesso.getTime())) continue;

      const dataSql = `${dataDoProcesso.getFullYear()}-${String(
        dataDoProcesso.getMonth() + 1
      ).padStart(2, "0")}-${String(dataDoProcesso.getDate()).padStart(2, "0")}`;
      const [existingProcess] = await connection.execute(
        "SELECT id FROM bas_process WHERE processo = ? AND data = ?",
        [String(processoValue).substring(0, 50), dataSql]
      );

      if (existingProcess.length > 0) {
        skippedDuplicata++;
        continue;
      }

      const horasAleatorias =
        horasPossiveis[Math.floor(Math.random() * horasPossiveis.length)];
      await connection.execute(
        `INSERT INTO bas_process (processo, data, horas) VALUES (?, ?, ?)`,
        [String(processoValue).substring(0, 50), dataSql, horasAleatorias]
      );
      importedCount++;
    }

    await connection.commit();
    return { importedCount, skippedEnergizada, skippedDuplicata, connection };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function obterInfoUsuario(matricula) {
  if (!matricula) throw new Error("Matrícula é obrigatória.");
  const [rows] = await promisePool.query(
    "SELECT nome, cargo FROM users WHERE matricula = ?",
    [matricula]
  );
  if (rows.length === 0) throw new Error("Usuário não encontrado.");
  return rows[0];
}

async function listarProcessosConstrucao() {
  const query = `SELECT id, processo, data, TIME_FORMAT(horas, '%H:%i:%s') as horas FROM bas_process ORDER BY data DESC, processo ASC;`;
  const [rows] = await promisePool.query(query);
  return rows.map((r) => ({
    ...r,
    data: r.data ? new Date(r.data).toISOString().split("T")[0] : null,
  }));
}

async function listarProcessosLinhaViva() {
  const query = `
        SELECT id, processo, data_prevista_execucao as data, TIME_FORMAT(TIMEDIFF(hora_fim, hora_inicio), '%H:%i:%s') as horas
        FROM processos WHERE (tipo IS NULL OR tipo != 'Emergencial') AND ordem_obra = 'ODI' 
        ORDER BY data_prevista_execucao DESC, processo ASC;`;
  const [rows] = await promisePool.query(query);
  return rows.map((r) => ({
    ...r,
    data: r.data ? new Date(r.data).toISOString().split("T")[0] : null,
    horas: r.horas || "00:00:00",
  }));
}

async function salvarCadastroBas(dadosCadastro) {
  const { idBasProcesso, matriculaResponsavel, setor, colaboradores } =
    dadosCadastro;
  if (
    !idBasProcesso ||
    !matriculaResponsavel ||
    !setor ||
    !Array.isArray(colaboradores) ||
    colaboradores.length === 0
  ) {
    throw new Error("Dados incompletos para o cadastro do BAS.");
  }
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const [processoResult] = await connection.execute(
      "SELECT id, processo FROM bas_process WHERE id = ?",
      [idBasProcesso]
    );
    if (processoResult.length === 0)
      throw new Error("Processo BAS não encontrado.");

    const [responsavelInfo] = await connection.execute(
      "SELECT nome, cargo FROM users WHERE matricula = ?",
      [matriculaResponsavel]
    );
    if (responsavelInfo.length === 0)
      throw new Error("Matrícula do responsável não encontrada.");

    await connection.execute(
      "INSERT IGNORE INTO bas_users (person_id, matricula, nome, cargo) VALUES (?, ?, ?, ?)",
      [
        String(idBasProcesso),
        matriculaResponsavel,
        responsavelInfo[0].nome,
        responsavelInfo[0].cargo || null,
      ]
    );

    for (const user of colaboradores) {
      const [colaboradorDetails] = await connection.execute(
        "SELECT nome, cargo FROM users WHERE matricula = ?",
        [user.matricula]
      );
      if (colaboradorDetails.length > 0) {
        await connection.execute(
          "INSERT IGNORE INTO bas_users (person_id, matricula, nome, cargo) VALUES (?, ?, ?, ?)",
          [
            String(idBasProcesso),
            user.matricula,
            colaboradorDetails[0].nome,
            colaboradorDetails[0].cargo || null,
          ]
        );
      }
    }
    await connection.commit();
    return { connection, detalhesProcesso: processoResult[0] };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function gerarRelatorioTxt(dadosRelatorio) {
  const { matricula, razao, dataInicio, dataFim } = dadosRelatorio;
  if (!matricula || !razao || !dataInicio || !dataFim) {
    throw new Error(
      "Matrícula, razão e período (data de início e fim) são obrigatórios."
    );
  }
  const connection = await promisePool.getConnection();
  try {
    const [userRows] = await connection.execute(
      "SELECT person_id, nome FROM bas_users WHERE matricula = ? LIMIT 1",
      [matricula]
    );
    if (userRows.length === 0)
      throw new Error(
        `Usuário com matrícula ${matricula} não encontrado na tabela bas_users.`
      );

    const userInfo = userRows[0];
    if (!userInfo.person_id)
      throw new Error(
        `O usuário com matrícula ${matricula} não possui um person_id definido na tabela bas_users.`
      );

    const [processRows] = await connection.execute(
      `SELECT processo, data FROM bas_process WHERE data BETWEEN ? AND ? ORDER BY data, id`,
      [dataInicio, dataFim]
    );
    if (processRows.length === 0) return { txtContent: "", nomeArquivo: "" };

    const horasPossiveisConstrucao = [
      "01:00:00",
      "02:00:00",
      "03:00:00",
      "04:00:00",
    ];
    const espacamento = "\t";
    let txtContent = `ID${espacamento}PROCESSO${espacamento}RAZAO${espacamento}DATA${espacamento}HORAS\n`;

    for (const proc of processRows) {
      const dataObj = new Date(proc.data);
      if (String(proc.data).length === 10)
        dataObj.setUTCHours(dataObj.getUTCHours() + 3);
      const dataFormatadaParaTxt = `${String(dataObj.getUTCDate()).padStart(
        2,
        "0"
      )}/${String(dataObj.getUTCMonth() + 1).padStart(2, "0")}/${String(
        dataObj.getUTCFullYear()
      ).slice(-2)}`;
      const horasParaTxt =
        horasPossiveisConstrucao[
          Math.floor(Math.random() * horasPossiveisConstrucao.length)
        ];
      txtContent += `${String(userInfo.person_id).trim()}${espacamento}${String(
        proc.processo || ""
      ).replace(/\D/g, "")}${espacamento}${String(
        razao
      ).trim()}${espacamento}${dataFormatadaParaTxt}${espacamento}${horasParaTxt}\n`;
    }

    const formatarDataParaNomeArquivo = (dtStr) => {
      const [y, m, d] = dtStr.split("-");
      return `${d}-${m}-${y}`;
    };
    const nomeArquivo = `${userInfo.nome
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .substring(0, 30)}_${matricula}_${formatarDataParaNomeArquivo(
      dataInicio
    )}_a_${formatarDataParaNomeArquivo(dataFim)}.txt`;

    return {
      txtContent,
      nomeArquivo,
      userInfo,
      totalProcessos: processRows.length,
    };
  } finally {
    if (connection) connection.release();
  }
}

async function gerarRelatorioTxtLinhaViva(dadosRelatorio) {
  const { matricula, razao, dataInicio, dataFim } = dadosRelatorio;
  if (!matricula || !razao || !dataInicio || !dataFim) {
    throw new Error(
      "Matrícula, razão e período (data de início e fim) são obrigatórios."
    );
  }
  const connection = await promisePool.getConnection();
  try {
    const [userRows] = await connection.execute(
      "SELECT person_id, nome FROM bas_users WHERE matricula = ? LIMIT 1",
      [matricula]
    );
    if (userRows.length === 0)
      throw new Error(
        `Usuário com matrícula ${matricula} não encontrado na tabela bas_users.`
      );

    const userInfo = userRows[0];
    if (!userInfo.person_id)
      throw new Error(
        `O usuário com matrícula ${matricula} não possui um person_id definido na tabela bas_users.`
      );

    const [resultadosLinhaViva, resultadosSubestacao] = await Promise.all([
      connection.execute(
        `SELECT processo, data_conclusao FROM processos WHERE data_conclusao BETWEEN ? AND ? AND (tipo IS NULL OR tipo != 'Emergencial') AND ordem_obra = 'ODI' ORDER BY data_conclusao, id`,
        [dataInicio, dataFim]
      ),
      connection.execute(
        `SELECT processo, data_conclusao FROM servicos_subestacoes WHERE data_conclusao BETWEEN ? AND ? AND tipo_ordem = 'ODI' AND status = 'CONCLUIDO' ORDER BY data_conclusao, id`,
        [dataInicio, dataFim]
      ),
    ]);
    const processRows = [...resultadosLinhaViva[0], ...resultadosSubestacao[0]];
    if (processRows.length === 0) return { txtContent: "", nomeArquivo: "" };

    const horasPossiveis = ["01:00:00", "02:00:00", "03:00:00", "04:00:00"];
    const espacamento = "\t";
    let txtContent = `ID${espacamento}PROCESSO${espacamento}RAZAO${espacamento}DATA${espacamento}HORAS\n`;

    for (const proc of processRows) {
      let dataFormatadaParaTxt = "N/A";
      if (proc.data_conclusao) {
        const dataObj = new Date(proc.data_conclusao);
        if (String(proc.data_conclusao).length === 10)
          dataObj.setUTCHours(dataObj.getUTCHours() + 3);
        dataFormatadaParaTxt = `${String(dataObj.getUTCDate()).padStart(
          2,
          "0"
        )}/${String(dataObj.getUTCMonth() + 1).padStart(2, "0")}/${String(
          dataObj.getUTCFullYear()
        ).slice(-2)}`;
      }
      const horasRandomizadasParaTxt =
        horasPossiveis[Math.floor(Math.random() * horasPossiveis.length)];
      txtContent += `${String(userInfo.person_id).trim()}${espacamento}${String(
        proc.processo || ""
      ).replace(/\D/g, "")}${espacamento}${String(
        razao
      ).trim()}${espacamento}${dataFormatadaParaTxt}${espacamento}${horasRandomizadasParaTxt}\n`;
    }

    const formatarDataParaNomeArquivo = (dtStr) => {
      const [y, m, d] = dtStr.split("-");
      return `${d}-${m}-${y}`;
    };
    const nomeArquivo = `${userInfo.nome
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .substring(0, 30)}_${matricula}_${formatarDataParaNomeArquivo(
      dataInicio
    )}_a_${formatarDataParaNomeArquivo(dataFim)}_LINHAVIVA_CONSOLIDADO.txt`;

    return {
      txtContent,
      nomeArquivo,
      userInfo,
      totalProcessos: processRows.length,
    };
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  importarDadosProcessos,
  obterInfoUsuario,
  listarProcessosConstrucao,
  listarProcessosLinhaViva,
  salvarCadastroBas,
  gerarRelatorioTxt,
  gerarRelatorioTxtLinhaViva,
};
