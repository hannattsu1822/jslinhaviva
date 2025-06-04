const express = require("express");
const path = require("path"); // Adicione esta linha se ainda não estiver lá
const { promisePool } = require("../init");
const { autenticar } = require("../auth");

const router = express.Router();

// Helper para adicionar filtros de período e responsável às queries
function adicionarFiltros(queryBase, params, queryParams) {
  let query = queryBase;
  const condicoes = [];

  if (queryParams.inicio && queryParams.fim) {
    condicoes.push("DATE(p.data_conclusao) BETWEEN ? AND ?"); // Usar DATE() para ignorar a parte da hora
    params.push(queryParams.inicio, queryParams.fim);
  } else if (queryParams.inicio) {
    condicoes.push("DATE(p.data_conclusao) >= ?");
    params.push(queryParams.inicio);
  } else if (queryParams.fim) {
    condicoes.push("DATE(p.data_conclusao) <= ?");
    params.push(queryParams.fim);
  }

  if (queryParams.responsavel_matricula) {
    condicoes.push("p.responsavel_matricula = ?");
    params.push(queryParams.responsavel_matricula);
  }

  if (queryParams.status_final) {
    if (queryParams.status_final === "finalizado") {
      // 'finalizado' significa ambos
      condicoes.push("p.status IN ('concluido', 'nao_concluido')");
    } else if (
      queryParams.status_final === "concluido" ||
      queryParams.status_final === "nao_concluido"
    ) {
      condicoes.push("p.status = ?");
      params.push(queryParams.status_final);
    }
  } else {
    // Default para 'concluido' e 'nao_concluido' se nenhum status específico for pedido
    condicoes.push("p.status IN ('concluido', 'nao_concluido')");
  }

  if (condicoes.length > 0) {
    query += " WHERE " + condicoes.join(" AND ");
  }
  return query;
}

// Rota para Serviços por Encarregado
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

      sql = adicionarFiltros(sql, params, req.query);
      // Para "serviços por encarregado", o status default deve ser finalizado
      if (
        !req.query.status_final &&
        !sql.includes("p.status IN ('concluido', 'nao_concluido')") &&
        !sql.includes("p.status = ?")
      ) {
        if (sql.includes("WHERE")) {
          sql += " AND p.status IN ('concluido', 'nao_concluido')";
        } else {
          sql += " WHERE p.status IN ('concluido', 'nao_concluido')";
        }
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

// Rota para Serviços por Desligamento
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
      sql = adicionarFiltros(sql, params, req.query);
      if (
        !req.query.status_final &&
        !sql.includes("p.status IN ('concluido', 'nao_concluido')") &&
        !sql.includes("p.status = ?")
      ) {
        if (sql.includes("WHERE")) {
          sql += " AND p.status IN ('concluido', 'nao_concluido')";
        } else {
          sql += " WHERE p.status IN ('concluido', 'nao_concluido')";
        }
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

// Rota para Serviços por Mês (para um ano específico, considera apenas concluídos com data_conclusao)
router.get(
  "/api/relatorios/servicos-concluidos-por-mes",
  autenticar,
  async (req, res) => {
    try {
      const ano = req.query.ano || new Date().getFullYear(); // Default para o ano atual
      const params = [ano];
      let sql = `
            SELECT MONTH(p.data_conclusao) as mes, COUNT(p.id) as total_servicos
            FROM processos p
            WHERE p.status = 'concluido' AND YEAR(p.data_conclusao) = ?
        `;

      // Adiciona outros filtros (exceto status e data, já tratados)
      const queryParamsSemStatusData = { ...req.query };
      delete queryParamsSemStatusData.status_final;
      delete queryParamsSemStatusData.inicio;
      delete queryParamsSemStatusData.fim;
      delete queryParamsSemStatusData.ano;

      // Temporariamente remover o ano dos params para não duplicar na func. adicionarFiltros
      const paramsBase = [];
      const sqlBase = `
            SELECT MONTH(p.data_conclusao) as mes, COUNT(p.id) as total_servicos
            FROM processos p
        `;
      let whereConditions =
        "p.status = 'concluido' AND YEAR(p.data_conclusao) = ?";

      const condicoesAdicionais = [];
      if (queryParamsSemStatusData.responsavel_matricula) {
        condicoesAdicionais.push("p.responsavel_matricula = ?");
        paramsBase.push(queryParamsSemStatusData.responsavel_matricula);
      }

      if (condicoesAdicionais.length > 0) {
        whereConditions += " AND " + condicoesAdicionais.join(" AND ");
      }

      sql =
        sqlBase +
        " WHERE " +
        whereConditions +
        " GROUP BY MONTH(p.data_conclusao) ORDER BY mes ASC";
      const finalParams = [ano, ...paramsBase];

      const [rows] = await promisePool.query(sql, finalParams);
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

// Rota para Status de Finalização
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
      // Para este gráfico, o filtro de status é o mais importante e já é p.status IN ('concluido', 'nao_concluido')
      // pela lógica do adicionarFiltros se nenhum status específico for passado
      sql = adicionarFiltros(sql, params, req.query);
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
    path.join(__dirname, "../../public/pages/servicos/relatorios_servicos.html") // Ajuste o caminho aqui
  );
});

module.exports = router;
