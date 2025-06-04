const express = require("express");
const path = require("path");
const { promisePool } = require("../init");
const { autenticar } = require("../auth");

const router = express.Router();

function adicionarFiltrosGlobais(
  queryBase,
  params,
  queryParams,
  aplicarFiltroStatusPadrao = true
) {
  let query = queryBase;
  const condicoes = [];
  let whereClauseExists = query.toUpperCase().includes(" WHERE ");

  if (queryParams.inicio && queryParams.fim) {
    condicoes.push("DATE(p.data_conclusao) BETWEEN ? AND ?");
    params.push(queryParams.inicio, queryParams.fim);
  } else if (queryParams.inicio) {
    condicoes.push("DATE(p.data_conclusao) >= ?");
    params.push(queryParams.inicio);
  } else if (queryParams.fim) {
    condicoes.push("DATE(p.data_conclusao) <= ?");
    params.push(queryParams.fim);
  }

  if (aplicarFiltroStatusPadrao) {
    if (queryParams.status_final) {
      if (queryParams.status_final === "finalizado") {
        condicoes.push("p.status IN ('concluido', 'nao_concluido')");
      } else if (
        queryParams.status_final === "concluido" ||
        queryParams.status_final === "nao_concluido"
      ) {
        condicoes.push("p.status = ?");
        params.push(queryParams.status_final);
      }
    } else {
      condicoes.push("p.status IN ('concluido', 'nao_concluido')");
    }
  }

  if (condicoes.length > 0) {
    if (whereClauseExists) {
      query += " AND " + condicoes.join(" AND ");
    } else {
      query += " WHERE " + condicoes.join(" AND ");
    }
  }
  return query;
}

router.get(
  "/api/relatorios/servicos-por-encarregado",
  autenticar,
  async (req, res) => {
    try {
      const params = [];
      let sql = `
            SELECT u.nome as responsavel_nome, p.responsavel_matricula, COUNT(p.id) as total_servicos
            FROM processos p
            JOIN users u ON p.responsavel_matricula = u.matricula
        `;

      sql = adicionarFiltrosGlobais(sql, params, req.query);

      if (req.query.responsavel_matricula) {
        sql +=
          (sql.toUpperCase().includes(" WHERE ") ? " AND " : " WHERE ") +
          "p.responsavel_matricula = ?";
        params.push(req.query.responsavel_matricula);
      }

      sql +=
        " GROUP BY p.responsavel_matricula, u.nome ORDER BY total_servicos DESC";

      const [rows] = await promisePool.query(sql, params);
      res.json(rows);
    } catch (error) {
      console.error(
        "Erro ao buscar relatório de serviços por encarregado:",
        error
      );
      res.status(500).json({ message: "Erro ao buscar dados do relatório." });
    }
  }
);

router.get(
  "/api/relatorios/servicos-por-desligamento",
  autenticar,
  async (req, res) => {
    try {
      const params = [];
      let sql = `
            SELECT p.desligamento, COUNT(p.id) as total_servicos
            FROM processos p
        `;
      sql = adicionarFiltrosGlobais(sql, params, req.query);
      if (req.query.responsavel_matricula) {
        sql +=
          (sql.toUpperCase().includes(" WHERE ") ? " AND " : " WHERE ") +
          "p.responsavel_matricula = ?";
        params.push(req.query.responsavel_matricula);
      }
      sql += " GROUP BY p.desligamento";

      const [rows] = await promisePool.query(sql, params);
      res.json(rows);
    } catch (error) {
      console.error(
        "Erro ao buscar relatório de serviços por desligamento:",
        error
      );
      res.status(500).json({ message: "Erro ao buscar dados do relatório." });
    }
  }
);

router.get(
  "/api/relatorios/servicos-concluidos-por-mes",
  autenticar,
  async (req, res) => {
    try {
      const ano = req.query.ano || new Date().getFullYear();
      const params = [];

      let sqlBase = `
            SELECT MONTH(p.data_conclusao) as mes, COUNT(p.id) as total_servicos
            FROM processos p
        `;

      let whereConditions =
        "p.status = 'concluido' AND YEAR(p.data_conclusao) = ?";
      params.push(ano);

      if (req.query.responsavel_matricula) {
        whereConditions += " AND p.responsavel_matricula = ?";
        params.push(req.query.responsavel_matricula);
      }

      const sql =
        sqlBase +
        " WHERE " +
        whereConditions +
        " GROUP BY MONTH(p.data_conclusao) ORDER BY mes ASC";

      const [rows] = await promisePool.query(sql, params);
      res.json(rows);
    } catch (error) {
      console.error(
        "Erro ao buscar relatório de serviços concluídos por mês:",
        error
      );
      res.status(500).json({ message: "Erro ao buscar dados do relatório." });
    }
  }
);

router.get(
  "/api/relatorios/status-finalizacao",
  autenticar,
  async (req, res) => {
    try {
      const params = [];
      let sql = `
            SELECT p.status, COUNT(p.id) as total_servicos
            FROM processos p
        `;
      sql = adicionarFiltrosGlobais(sql, params, req.query);
      if (req.query.responsavel_matricula) {
        sql +=
          (sql.toUpperCase().includes(" WHERE ") ? " AND " : " WHERE ") +
          "p.responsavel_matricula = ?";
        params.push(req.query.responsavel_matricula);
      }
      sql += " GROUP BY p.status";

      const [rows] = await promisePool.query(sql, params);
      res.json(rows);
    } catch (error) {
      console.error(
        "Erro ao buscar relatório de status de finalização:",
        error
      );
      res.status(500).json({ message: "Erro ao buscar dados do relatório." });
    }
  }
);

router.get("/relatorios-servicos", autenticar, (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/relatorios_servicos.html")
  );
});

module.exports = router;
