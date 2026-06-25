const { promisePool } = require("../../../init");

async function contarServicos(status) {
  let query = "SELECT COUNT(*) as total FROM processos";
  const params = [];

  if (status) {
    if (status === "concluido") {
      query += " WHERE status IN ('concluido', 'nao_concluido')";
    } else {
      query += " WHERE status = ?";
      params.push(status);
    }
  }

  const [result] = await promisePool.query(query, params);
  return result[0];
}

async function listarEncarregados() {
  const [rows] = await promisePool.query(
    "SELECT DISTINCT matricula, nome FROM users WHERE cargo IN ('Encarregado', 'Engenheiro', 'Técnico', 'ADM', 'ADMIN', 'Inspetor') ORDER BY nome",
  );
  return rows;
}

async function listarSubestacoes() {
  const [rows] = await promisePool.query(
    'SELECT DISTINCT subestacao AS nome FROM processos WHERE subestacao IS NOT NULL AND subestacao != "" ORDER BY subestacao',
  );
  return rows;
}

async function listarServicosPorOrigem(origem) {
  console.log(`[BACKEND] Buscando serviços com origem: "${origem}"`);
  console.log(`[BACKEND] Tipo da variável origem:`, typeof origem);
  console.log(`[BACKEND] Length da origem:`, origem.length);
  console.log(`[BACKEND] Bytes da origem:`, Buffer.from(origem, "utf8"));

  const query = `
    SELECT
      p.id,
      p.processo,
      p.alimentador,
      p.data_prevista_execucao,
      p.desligamento,
      p.created_at,
      p.status_geral AS status,
      p.motivo_nao_conclusao,
      p.data_conclusao,
      COALESCE(resp.nomes_responsaveis, u_legado.nome) AS nomes_responsaveis
    FROM processos p
    LEFT JOIN (
      SELECT
        sr.servico_id,
        GROUP_CONCAT(u.nome SEPARATOR ', ') AS nomes_responsaveis
      FROM servicos_responsaveis sr
      JOIN users u ON sr.responsavel_matricula = u.matricula
      GROUP BY sr.servico_id
    ) AS resp ON p.id = resp.servico_id
    LEFT JOIN users u_legado ON p.responsavel_matricula = u_legado.matricula
    WHERE p.origem = ?
    ORDER BY p.id ASC;
  `;

  const [servicos] = await promisePool.query(query, [origem]);
  console.log(`[BACKEND] Total de serviços encontrados: ${servicos.length}`);

  if (servicos.length > 0) {
    console.log(`[BACKEND] Primeiro serviço:`, servicos[0]);
  }

  return servicos;
}

module.exports = {
  contarServicos,
  listarEncarregados,
  listarSubestacoes,
  listarServicosPorOrigem,
};
