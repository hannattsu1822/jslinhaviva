const { promisePool } = require("../../init");

function adicionarFiltrosComuns(
  baseQuery,
  params,
  queryParams,
  options = { omitStatus: false, omitDate: false, omitResponsible: false }
) {
  let query = baseQuery;
  const condicoes = [];
  let whereClauseAdicionada = query.toUpperCase().includes(" WHERE ");

  if (!options.omitDate) {
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
  }

  if (!options.omitResponsible && queryParams.responsavel_matricula) {
    condicoes.push("p.responsavel_matricula = ?");
    params.push(queryParams.responsavel_matricula);
  }

  if (!options.omitStatus) {
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
    query += whereClauseAdicionada
      ? " AND " + condicoes.join(" AND ")
      : " WHERE " + condicoes.join(" AND ");
  }
  return query;
}

async function relatorioServicosPorEncarregado(queryParams) {
  const params = [];
  let sql = `
        SELECT u.nome as responsavel_nome, p.responsavel_matricula, COUNT(p.id) as total_servicos
        FROM processos p
        JOIN users u ON p.responsavel_matricula = u.matricula
    `;
  sql = adicionarFiltrosComuns(sql, params, queryParams, {
    omitResponsible: !!queryParams.responsavel_matricula ? false : true,
  });
  sql +=
    " GROUP BY p.responsavel_matricula, u.nome ORDER BY total_servicos DESC";
  const [rows] = await promisePool.query(sql, params);
  return rows;
}

async function relatorioServicosPorDesligamento(queryParams) {
  const params = [];
  let sql = `SELECT p.desligamento, COUNT(p.id) as total_servicos FROM processos p`;
  sql = adicionarFiltrosComuns(sql, params, queryParams);
  sql += " GROUP BY p.desligamento";
  const [rows] = await promisePool.query(sql, params);
  return rows;
}

async function relatorioServicosConcluidosPorMes(queryParams) {
  const ano = queryParams.ano || new Date().getFullYear();
  const params = [];
  let sqlBase = `SELECT MONTH(p.data_conclusao) as mes, COUNT(p.id) as total_servicos FROM processos p`;
  let whereConditions = "p.status = 'concluido' AND YEAR(p.data_conclusao) = ?";
  params.push(ano);

  if (queryParams.responsavel_matricula) {
    whereConditions += " AND p.responsavel_matricula = ?";
    params.push(queryParams.responsavel_matricula);
  }
  const sql =
    sqlBase +
    " WHERE " +
    whereConditions +
    " GROUP BY MONTH(p.data_conclusao) ORDER BY mes ASC";
  const [rows] = await promisePool.query(sql, params);
  return rows;
}

async function relatorioStatusFinalizacao(queryParams) {
  const params = [];
  let sql = `SELECT p.status, COUNT(p.id) as total_servicos FROM processos p`;
  sql = adicionarFiltrosComuns(sql, params, queryParams);
  sql += " GROUP BY p.status";
  const [rows] = await promisePool.query(sql, params);
  return rows;
}

async function obterDispositivosLogbox() {
  const [devices] = await promisePool.query(
    "SELECT serial_number, local_tag FROM dispositivos_logbox ORDER BY local_tag ASC"
  );
  return devices;
}

module.exports = {
  relatorioServicosPorEncarregado,
  relatorioServicosPorDesligamento,
  relatorioServicosConcluidosPorMes,
  relatorioStatusFinalizacao,
  obterDispositivosLogbox,
};
