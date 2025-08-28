const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const { autenticar, verificarNivel, registrarAuditoria } = require("../auth");
const { promisePool, upload } = require("../init");

const router = express.Router();

// --- ROTAS DE RENDERIZAÇÃO DE PÁGINAS (Refatoradas) ---

router.get("/avulsos-dashboard", autenticar, verificarNivel(2), (req, res) => {
  res.render("pages/avulsos/dashboard_avulsos.html", { user: req.user });
});

router.get(
  "/autorizacao-horas-extras",
  autenticar,
  verificarNivel(2),
  (req, res) => {
    res.render("pages/avulsos/autorizacao_horas_extras.html", {
      user: req.user,
    });
  }
);

router.get(
  "/bas-importar-dados-pagina",
  autenticar,
  verificarNivel(2),
  (req, res) => {
    res.render("pages/avulsos/bas_importar_dados.html", { user: req.user });
  }
);

router.get(
  "/gerar-formulario-txt-bas",
  autenticar,
  verificarNivel(2),
  (req, res) => {
    res.render("pages/avulsos/gerar_formulario_txt_bas.html", {
      user: req.user,
    });
  }
);

router.get(
  "/gerar-formulario-txt-bas-linhaviva",
  autenticar,
  verificarNivel(2),
  (req, res) => {
    res.render("pages/avulsos/gerar_formulario_txt_bas_linhaviva.html", {
      user: req.user,
    });
  }
);

// --- ROTAS DE API (Permanecem Inalteradas) ---

router.get(
  "/api/avulsos/turmas-encarregados",
  autenticar,
  verificarNivel(2),
  async (req, res) => {
    try {
      const query = `
            SELECT DISTINCT t.turma_encarregado, u.nome as nome_encarregado
            FROM sua_tabela_de_turmas t 
            JOIN users u ON t.turma_encarregado = u.matricula
            ORDER BY u.nome;
        `;
      const [rows] = await promisePool.query(query);
      res.json(rows);
    } catch (error) {
      console.error("Erro ao buscar turmas e encarregados:", error);
      res.status(500).json({ message: "Erro interno ao buscar dados." });
    }
  }
);

router.post(
  "/api/avulsos/solicitacao-horas-extras",
  autenticar,
  verificarNivel(2),
  async (req, res) => {
    const connection = await promisePool.getConnection();
    try {
      const { matricula, nomeEmpregado, mesAno, servicos } = req.body;
      if (
        !matricula ||
        !nomeEmpregado ||
        !mesAno ||
        !servicos ||
        !Array.isArray(servicos) ||
        servicos.length === 0
      ) {
        return res.status(400).json({
          message: "Dados incompletos para solicitação de horas extras.",
        });
      }
      await connection.beginTransaction();
      const [autorizacaoResult] = await connection.execute(
        "INSERT INTO autorizacoes_horas_extras (matricula_empregado, nome_empregado, mes_referencia, status_aprovacao) VALUES (?, ?, ?, ?)",
        [matricula, nomeEmpregado, mesAno, "PENDENTE"]
      );
      const autorizacaoId = autorizacaoResult.insertId;
      for (const servico of servicos) {
        await connection.execute(
          "INSERT INTO servicos_horas_extras (autorizacao_id, data_servico, descricao_servico, horas_solicitadas) VALUES (?, ?, ?, ?)",
          [autorizacaoId, servico.data, servico.descricao, servico.horas]
        );
      }
      await connection.commit();
      await registrarAuditoria(
        req.user.matricula,
        "Solicitação Horas Extras",
        `Solicitação para ${nomeEmpregado} (ID: ${autorizacaoId}) enviada.`
      );
      res.status(201).json({
        message: "Solicitação de horas extras enviada com sucesso!",
        id: autorizacaoId,
      });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("Erro ao processar solicitação de horas extras:", error);
      let userMessage = "Erro interno no servidor ao processar a solicitação.";
      if (
        error.code === "ER_NO_REFERENCED_ROW_2" ||
        (error.message &&
          error.message.includes("foreign key constraint fails"))
      ) {
        userMessage =
          "Erro de dados: Verifique se a matrícula do empregado é válida ou se há referências corretas.";
      } else if (error.code === "ER_DATA_TOO_LONG") {
        userMessage =
          "Erro de dados: Um dos campos excedeu o tamanho máximo permitido.";
      } else if (
        error.code === "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD" ||
        error.code === "WARN_DATA_TRUNCATED"
      ) {
        userMessage =
          "Erro de dados: Valor inválido para um dos campos numéricos ou de data.";
      }
      res.status(500).json({ message: userMessage });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.post(
  "/api/bas/importar-dados-processos",
  autenticar,
  verificarNivel(2),
  upload.single("csvFile"),
  async (req, res) => {
    if (!req.file)
      return res
        .status(400)
        .json({ message: "Nenhum arquivo de planilha foi enviado." });
    if (!req.body.planilhaTipo)
      return res
        .status(400)
        .json({ message: "O tipo de planilha é obrigatório." });
    const { planilhaTipo } = req.body;
    const connection = await promisePool.getConnection();
    const NOME_COLUNA_COMENTARIOS = "PrimeiroDeComentários";
    try {
      const workbook = XLSX.read(req.file.buffer, {
        type: "buffer",
        cellDates: true,
      });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName)
        return res
          .status(400)
          .json({ message: "A planilha enviada está vazia ou corrompida." });
      const worksheet = workbook.Sheets[sheetName];
      const dataAsArray = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        blankrows: false,
      });
      if (dataAsArray.length < 2)
        return res.status(400).json({
          message:
            "A planilha não contém dados válidos ou está sem cabeçalhos.",
        });
      const headers = dataAsArray[0].map((header) => String(header).trim());
      const dataRows = dataAsArray.slice(1);
      const indiceComentarios = headers.indexOf(NOME_COLUNA_COMENTARIOS);
      const indiceIdProcessoVisual = headers.indexOf("IDPROCESSO_VISUAL");
      const indicePrevisaoExecucao = headers.indexOf("Previsão execução");
      const indiceProcessoLegado = headers.indexOf("Processo");
      const indiceDataLegado = headers.indexOf("Data");
      if (
        planilhaTipo === "programacao_obras" &&
        (indiceIdProcessoVisual === -1 || indicePrevisaoExecucao === -1)
      ) {
        return res.status(400).json({
          message:
            "Cabeçalhos 'IDPROCESSO_VISUAL' ou 'Previsão execução' não encontrados.",
        });
      }
      if (
        planilhaTipo === "desligamento_programado" &&
        (indiceProcessoLegado === -1 || indiceDataLegado === -1)
      ) {
        return res.status(400).json({
          message: "Cabeçalhos 'Processo' ou 'Data' não encontrados.",
        });
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
          await connection.rollback();
          return res
            .status(400)
            .json({ message: "Tipo de planilha desconhecido." });
        }
        if (!processoValue || !dataValue) continue;
        const dataDoProcesso = new Date(dataValue);
        if (isNaN(dataDoProcesso.getTime())) continue;
        const dataSql = `${dataDoProcesso.getFullYear()}-${String(
          dataDoProcesso.getMonth() + 1
        ).padStart(2, "0")}-${String(dataDoProcesso.getDate()).padStart(
          2,
          "0"
        )}`;
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
      await registrarAuditoria(
        req.user.matricula,
        "Importação BAS Processos",
        `${importedCount} registros importados via ${planilhaTipo}.`
      );
      res.status(200).json({
        message: `${importedCount} registros importados. ${skippedEnergizada} não processadas. ${skippedDuplicata} duplicatas.`,
      });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("Erro ao importar dados de processos BAS:", error);
      res.status(500).json({ message: `Erro interno: ${error.message}` });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.get(
  "/api/bas/user-info",
  autenticar,
  verificarNivel(2),
  async (req, res) => {
    const { matricula } = req.query;
    if (!matricula)
      return res.status(400).json({ message: "Matrícula é obrigatória." });
    try {
      const [rows] = await promisePool.query(
        "SELECT nome, cargo FROM users WHERE matricula = ?",
        [matricula]
      );
      if (rows.length > 0) res.json(rows[0]);
      else res.status(404).json({ message: "Usuário não encontrado." });
    } catch (error) {
      console.error("Erro API /user-info:", error);
      res.status(500).json({ message: "Erro interno servidor." });
    }
  }
);

router.get(
  "/api/bas/processos-construcao",
  autenticar,
  verificarNivel(2),
  async (req, res) => {
    try {
      const query = `
      SELECT id, processo, data, TIME_FORMAT(horas, '%H:%i:%s') as horas 
      FROM bas_process ORDER BY data DESC, processo ASC;`;
      const [rows] = await promisePool.query(query);
      res.json(
        rows.map((r) => ({
          ...r,
          data: r.data ? new Date(r.data).toISOString().split("T")[0] : null,
        }))
      );
    } catch (error) {
      console.error("Erro API /processos-construcao:", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar processos de Construção." });
    }
  }
);

router.get(
  "/api/bas/processos-linhaviva",
  autenticar,
  verificarNivel(2),
  async (req, res) => {
    try {
      const query = `
      SELECT id, processo, data_prevista_execucao as data, TIME_FORMAT(TIMEDIFF(hora_fim, hora_inicio), '%H:%i:%s') as horas
      FROM processos 
      WHERE (tipo IS NULL OR tipo != 'Emergencial') AND ordem_obra = 'ODI' 
      ORDER BY data_prevista_execucao DESC, processo ASC;`;
      const [rows] = await promisePool.query(query);
      res.json(
        rows.map((r) => ({
          ...r,
          data: r.data ? new Date(r.data).toISOString().split("T")[0] : null,
          horas: r.horas || "00:00:00",
        }))
      );
    } catch (error) {
      console.error("Erro API /processos-linhaviva:", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar processos de Linha Viva." });
    }
  }
);

router.post(
  "/api/bas/salvar-bas-cadastro",
  autenticar,
  verificarNivel(2),
  async (req, res) => {
    const { idBasProcesso, matriculaResponsavel, setor, colaboradores } =
      req.body;
    const connection = await promisePool.getConnection();
    try {
      if (
        !idBasProcesso ||
        !matriculaResponsavel ||
        !setor ||
        !Array.isArray(colaboradores) ||
        colaboradores.length === 0
      ) {
        return res
          .status(400)
          .json({ message: "Dados incompletos para o cadastro do BAS." });
      }
      await connection.beginTransaction();
      const [processoResult] = await connection.execute(
        "SELECT id, processo FROM bas_process WHERE id = ?",
        [idBasProcesso]
      );
      if (processoResult.length === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({ message: "Processo BAS não encontrado." });
      }
      const basProcessoDetalhes = processoResult[0];
      const [responsavelInfo] = await connection.execute(
        "SELECT nome, cargo FROM users WHERE matricula = ?",
        [matriculaResponsavel]
      );
      if (responsavelInfo.length === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({ message: "Matrícula do responsável não encontrada." });
      }

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
        } else {
          console.warn(
            `Matrícula ${user.matricula} (colaborador) não encontrada. Pulando.`
          );
        }
      }
      await registrarAuditoria(
        req.user.matricula,
        "Cadastro BAS",
        `BAS para processo ${basProcessoDetalhes.processo} (ID ${idBasProcesso}) salvo.`
      );
      await connection.commit();
      res.status(200).json({
        message: "BAS cadastrado e colaboradores associados com sucesso!",
      });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("Erro ao salvar cadastro BAS:", error);
      if (error.code === "ER_DUP_ENTRY")
        res.status(409).json({
          message: "Colaborador já associado a este BAS de processo.",
        });
      else res.status(500).json({ message: `Erro interno: ${error.message}` });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.post(
  "/api/bas/gerar-relatorio-processos-txt",
  autenticar,
  verificarNivel(2),
  async (req, res) => {
    const { matricula, razao, dataInicio, dataFim } = req.body;
    const usuarioLogadoMatricula = req.user.matricula;

    if (!matricula || !razao || !dataInicio || !dataFim) {
      return res.status(400).json({
        message:
          "Matrícula, razão e período (data de início e fim) são obrigatórios.",
      });
    }

    let connection;
    try {
      connection = await promisePool.getConnection();

      const [userRows] = await connection.execute(
        "SELECT person_id, nome FROM bas_users WHERE matricula = ? LIMIT 1",
        [matricula]
      );

      if (userRows.length === 0) {
        return res.status(404).json({
          message: `Usuário com matrícula ${matricula} não encontrado na tabela bas_users.`,
        });
      }
      const userInfo = userRows[0];
      const personIdParaRelatorio = userInfo.person_id;
      const nomeUsuarioParaArquivo = userInfo.nome
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .substring(0, 30);

      if (!personIdParaRelatorio) {
        return res.status(404).json({
          message: `O usuário com matrícula ${matricula} não possui um person_id definido na tabela bas_users.`,
        });
      }

      const [processRows] = await connection.execute(
        `SELECT 
           processo, 
           data
         FROM bas_process 
         WHERE data BETWEEN ? AND ? 
         ORDER BY data, id`,
        [dataInicio, dataFim]
      );

      if (processRows.length === 0) {
        return res.status(200).send("");
      }

      const horasPossiveisConstrucao = [
        "01:00:00",
        "02:00:00",
        "03:00:00",
        "04:00:00",
      ];
      const espacamento = "\t";
      const header = `ID${espacamento}PROCESSO${espacamento}RAZAO${espacamento}DATA${espacamento}HORAS\n`;
      let txtContent = header;

      const idLimpo = String(personIdParaRelatorio).trim();
      const razaoLimpa = String(razao).trim();

      for (const proc of processRows) {
        const processoLimpo = String(proc.processo || "").replace(/\D/g, "");

        const dataObj = new Date(proc.data);
        if (String(proc.data).length === 10) {
          dataObj.setUTCHours(dataObj.getUTCHours() + 3);
        }
        const dia = String(dataObj.getUTCDate()).padStart(2, "0");
        const mes = String(dataObj.getUTCMonth() + 1).padStart(2, "0");
        const ano = String(dataObj.getUTCFullYear()).slice(-2);
        const dataFormatadaParaTxt = `${dia}/${mes}/${ano}`;

        const horasParaTxt =
          horasPossiveisConstrucao[
            Math.floor(Math.random() * horasPossiveisConstrucao.length)
          ];

        txtContent += `${idLimpo}${espacamento}${processoLimpo}${espacamento}${razaoLimpa}${espacamento}${dataFormatadaParaTxt}${espacamento}${horasParaTxt}\n`;
      }

      const dataInicioObj = new Date(dataInicio + "T00:00:00Z");
      const dataFimObj = new Date(dataFim + "T00:00:00Z");

      const formatarDataParaNomeArquivo = (dtObj) => {
        const d = String(dtObj.getUTCDate()).padStart(2, "0");
        const m = String(dtObj.getUTCMonth() + 1).padStart(2, "0");
        const a = dtObj.getUTCFullYear();
        return `${d}-${m}-${a}`;
      };

      const periodoNomeArquivo = `${formatarDataParaNomeArquivo(
        dataInicioObj
      )}_a_${formatarDataParaNomeArquivo(dataFimObj)}`;
      const nomeArquivo = `${nomeUsuarioParaArquivo}_${matricula}_${periodoNomeArquivo}.txt`;

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${nomeArquivo}`
      );
      res.send(txtContent);

      await registrarAuditoria(
        usuarioLogadoMatricula,
        "Geração Relatório TXT BAS Construção",
        `Relatório TXT "${nomeArquivo}" gerado para matrícula ${matricula} (colaborador: ${userInfo.nome}), person_id: ${personIdParaRelatorio}, razão ${razao}, período ${dataInicio} a ${dataFim}. Total de ${processRows.length} processos.`
      );
    } catch (error) {
      console.error("Erro ao gerar relatório TXT BAS Construção:", error);
      if (!res.headersSent) {
        res.status(500).json({
          message: `Erro interno no servidor: ${error.message}`,
        });
      }
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

router.post(
  "/api/bas/gerar-relatorio-processos-txt-linhaviva",
  autenticar,
  verificarNivel(2),
  async (req, res) => {
    const { matricula, razao, dataInicio, dataFim } = req.body;
    const usuarioLogadoMatricula = req.user.matricula;

    if (!matricula || !razao || !dataInicio || !dataFim) {
      return res.status(400).json({
        message:
          "Matrícula, razão e período (data de início e fim) são obrigatórios.",
      });
    }

    let connection;
    try {
      connection = await promisePool.getConnection();

      const [userRows] = await connection.execute(
        "SELECT person_id, nome FROM bas_users WHERE matricula = ? LIMIT 1",
        [matricula]
      );

      if (userRows.length === 0) {
        return res.status(404).json({
          message: `Usuário com matrícula ${matricula} não encontrado na tabela bas_users.`,
        });
      }
      const userInfo = userRows[0];
      const personIdParaRelatorio = userInfo.person_id;
      const nomeUsuarioParaArquivo = userInfo.nome
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .substring(0, 30);

      if (!personIdParaRelatorio) {
        return res.status(404).json({
          message: `O usuário com matrícula ${matricula} não possui um person_id definido na tabela bas_users.`,
        });
      }

      const [resultadosLinhaViva, resultadosSubestacao] = await Promise.all([
        connection.execute(
          `SELECT 
             processo, 
             data_conclusao
           FROM processos 
           WHERE 
             data_conclusao BETWEEN ? AND ? AND
             (tipo IS NULL OR tipo != 'Emergencial') AND
             ordem_obra = 'ODI'
           ORDER BY data_conclusao, id`,
          [dataInicio, dataFim]
        ),
        connection.execute(
          `SELECT 
             processo, 
             data_conclusao
           FROM servicos_subestacoes 
           WHERE 
             data_conclusao BETWEEN ? AND ? AND
             tipo_ordem = 'ODI' AND
             status = 'CONCLUIDO'
           ORDER BY data_conclusao, id`,
          [dataInicio, dataFim]
        ),
      ]);

      const processRows = [
        ...resultadosLinhaViva[0],
        ...resultadosSubestacao[0],
      ];

      if (processRows.length === 0) {
        return res.status(200).send("");
      }

      const horasPossiveis = ["01:00:00", "02:00:00", "03:00:00", "04:00:00"];
      const espacamento = "\t";
      const header = `ID${espacamento}PROCESSO${espacamento}RAZAO${espacamento}DATA${espacamento}HORAS\n`;
      let txtContent = header;

      const idLimpo = String(personIdParaRelatorio).trim();
      const razaoLimpa = String(razao).trim();

      for (const proc of processRows) {
        const processoFormatadoParaTxt = String(proc.processo || "").replace(
          /\D/g,
          ""
        );

        const dataConclusao = proc.data_conclusao;
        let dataFormatadaParaTxt = "N/A";
        if (dataConclusao) {
          const dataObj = new Date(dataConclusao);
          if (String(dataConclusao).length === 10) {
            dataObj.setUTCHours(dataObj.getUTCHours() + 3);
          } else if (dataConclusao instanceof Date) {
          }

          const dia = String(dataObj.getUTCDate()).padStart(2, "0");
          const mes = String(dataObj.getUTCMonth() + 1).padStart(2, "0");
          const ano = String(dataObj.getUTCFullYear()).slice(-2);
          dataFormatadaParaTxt = `${dia}/${mes}/${ano}`;
        }

        const horasRandomizadasParaTxt =
          horasPossiveis[Math.floor(Math.random() * horasPossiveis.length)];

        txtContent += `${idLimpo}${espacamento}${processoFormatadoParaTxt}${espacamento}${razaoLimpa}${espacamento}${dataFormatadaParaTxt}${espacamento}${horasRandomizadasParaTxt}\n`;
      }

      const dataInicioObj = new Date(dataInicio + "T00:00:00Z");
      const dataFimObj = new Date(dataFim + "T00:00:00Z");

      const formatarDataParaNomeArquivo = (dtObj) => {
        const d = String(dtObj.getUTCDate()).padStart(2, "0");
        const m = String(dtObj.getUTCMonth() + 1).padStart(2, "0");
        const a = dtObj.getUTCFullYear();
        return `${d}-${m}-${a}`;
      };

      const periodoNomeArquivo = `${formatarDataParaNomeArquivo(
        dataInicioObj
      )}_a_${formatarDataParaNomeArquivo(dataFimObj)}`;
      const nomeArquivo = `${nomeUsuarioParaArquivo}_${matricula}_${periodoNomeArquivo}_LINHAVIVA_CONSOLIDADO.txt`;

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${nomeArquivo}`
      );
      res.send(txtContent);

      await registrarAuditoria(
        usuarioLogadoMatricula,
        "Geração Relatório TXT BAS Linha Viva Consolidado",
        `Relatório TXT "${nomeArquivo}" gerado para matrícula ${matricula}, person_id: ${personIdParaRelatorio}, razão ${razao}, período ${dataInicio} a ${dataFim}. Total de ${processRows.length} processos (Linha Viva + Subestação).`
      );
    } catch (error) {
      console.error(
        "Erro ao gerar relatório TXT BAS Linha Viva Consolidado:",
        error
      );
      if (!res.headersSent) {
        res.status(500).json({
          message: `Erro interno no servidor: ${error.message}`,
        });
      }
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

module.exports = router;
