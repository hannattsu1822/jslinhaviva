const express = require("express");
const path = require("path");
const { autenticar, registrarAuditoria } = require("../auth");
const { promisePool } = require("../init");

const router = express.Router();

// Rota para servir a página HTML do formulário de horas extras
router.get("/autorizacao-horas-extras", autenticar, (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "../../public/pages/avulsos/autorizacao_horas_extras.html"
    )
  );
});

// NOVO: Rota para buscar turmas (identificadores únicos de turma_encarregado)
router.get("/api/avulsos/turmas-encarregados", autenticar, async (req, res) => {
  try {
    // Seleciona distintos 'turma_encarregado' e também busca o nome do encarregado na tabela 'users'
    // Isso assume que 'turma_encarregado' é uma matrícula que existe na tabela 'users'
    const query = `
            SELECT DISTINCT t.turma_encarregado, u.nome as nome_encarregado
            FROM turmas t
            LEFT JOIN users u ON t.turma_encarregado = u.matricula
            ORDER BY t.turma_encarregado ASC
        `;
    const [rows] = await promisePool.query(query);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar turmas/encarregados:", err);
    res.status(500).json({ message: "Erro ao buscar dados das turmas." });
  }
});

// NOVO: Rota para buscar empregados de uma turma específica
router.get(
  "/api/avulsos/turmas/:turma_encarregado_id/empregados",
  autenticar,
  async (req, res) => {
    const { turma_encarregado_id } = req.params;
    if (!turma_encarregado_id) {
      return res
        .status(400)
        .json({ message: "ID da turma do encarregado é obrigatório." });
    }
    try {
      const [rows] = await promisePool.query(
        "SELECT matricula, nome, cargo FROM turmas WHERE turma_encarregado = ? ORDER BY nome ASC",
        [turma_encarregado_id]
      );
      res.json(rows);
    } catch (err) {
      console.error(
        `Erro ao buscar empregados para turma ${turma_encarregado_id}:`,
        err
      );
      res.status(500).json({ message: "Erro ao buscar empregados da turma." });
    }
  }
);

// Rota para lidar com a submissão do formulário de horas extras (POST)
// (O código desta rota permanece o mesmo que na resposta anterior, mas certifique-se que os campos
// matricula, nomeEmpregado, setor são corretamente obtidos do req.body, que agora são preenchidos pelo modal)
router.post(
  "/api/avulsos/autorizacao-horas-extras",
  autenticar,
  async (req, res) => {
    const {
      matricula,
      nomeEmpregado,
      setor,
      mesAno,
      dataSolicitacao,
      detalhes,
    } = req.body;
    const matriculaUsuarioLogado = req.user.matricula;

    if (
      !matricula ||
      !nomeEmpregado ||
      !setor ||
      !mesAno ||
      !dataSolicitacao ||
      !detalhes ||
      !Array.isArray(detalhes) ||
      detalhes.length === 0
    ) {
      return res
        .status(400)
        .json({
          message:
            "Dados incompletos ou inválidos. Certifique-se de que um empregado foi selecionado e todos os campos obrigatórios estão preenchidos.",
        });
    }

    // Validação adicional para os detalhes
    for (const detalhe of detalhes) {
      if (
        !detalhe.dia ||
        !detalhe.inicioRealizado ||
        !detalhe.terminoRealizado ||
        !detalhe.motivo ||
        !detalhe.qtdeHoras
      ) {
        return res
          .status(400)
          .json({
            message:
              "Todos os campos obrigatórios para cada detalhe de hora extra (Dia, Início/Fim Realizado, Quantidade, Motivo) devem ser preenchidos.",
          });
      }
      // Converta qtdeHoras para número para evitar problemas
      detalhe.qtdeHoras = parseFloat(detalhe.qtdeHoras);
      if (isNaN(detalhe.qtdeHoras) || detalhe.qtdeHoras <= 0) {
        // Permite 0 se for intencional, mas geralmente > 0
        // return res.status(400).json({ message: 'A quantidade de horas deve ser um número positivo.' });
      }
    }

    let connection;
    try {
      connection = await promisePool.getConnection();
      await connection.beginTransaction();

      const [resultAutorizacao] = await connection.query(
        `INSERT INTO autorizacoes_horas_extras (matricula_empregado, nome_empregado, setor_empregado, mes_referencia, data_solicitacao, status, matricula_solicitante)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          matricula,
          nomeEmpregado,
          setor,
          mesAno,
          dataSolicitacao,
          "Pendente Aprovação",
          matriculaUsuarioLogado,
        ]
      );
      const autorizacaoId = resultAutorizacao.insertId;

      for (const detalhe of detalhes) {
        await connection.query(
          `INSERT INTO detalhes_horas_extras (autorizacao_id, dia, hora_inicio_prevista, hora_termino_prevista, hora_inicio_realizada, hora_termino_realizada, quantidade_horas, motivo, autorizado_previamente, pagar, compensar, visto_gerente)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            autorizacaoId,
            detalhe.dia,
            detalhe.inicioPrevisto || null,
            detalhe.terminoPrevisto || null,
            detalhe.inicioRealizado,
            detalhe.terminoRealizado,
            detalhe.qtdeHoras, // Já é float
            detalhe.motivo,
            detalhe.autorizadoPreviamente,
            !!detalhe.pagar,
            !!detalhe.compensar,
            detalhe.vistoGerente || null,
          ]
        );
      }

      await registrarAuditoria(
        matriculaUsuarioLogado,
        "SOLICITACAO_HORA_EXTRA",
        `Solicitação de H.E. para ${nomeEmpregado} (ID: ${autorizacaoId}) referente a ${mesAno}`,
        connection
      );

      await connection.commit();
      res
        .status(201)
        .json({
          message: "Solicitação de horas extras enviada com sucesso!",
          id: autorizacaoId,
        });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("Erro ao salvar solicitação de horas extras:", error);
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
      res.status(500).json({ message: userMessage, details: error.message }); // Para dev, pode ser útil error.message
    } finally {
      if (connection) connection.release();
    }
  }
);

module.exports = router;
