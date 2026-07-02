const { promisePool } = require("../../../infrastructure/database");
const { formatarTamanhoArquivo } = require("../../gestaoServicos/utils/file.helpers");

const ORIGEM_CONSTRUCAO = "Construção";

const BASE_SELECT = `
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
`;

async function listarAtivos() {
  const [rows] = await promisePool.query(
    `${BASE_SELECT}
      AND p.status_geral IN ('ativo', 'em_progresso')
      AND EXISTS (
        SELECT 1
        FROM servicos_responsaveis sr
        WHERE sr.servico_id = p.id
      )
     ORDER BY p.id DESC`,
    [ORIGEM_CONSTRUCAO]
  );
  return rows;
}

async function listarConcluidos() {
  const [rows] = await promisePool.query(
    `${BASE_SELECT} AND p.status_geral IN ('concluido', 'nao_concluido') ORDER BY p.data_conclusao DESC, p.id DESC`,
    [ORIGEM_CONSTRUCAO]
  );
  return rows;
}

async function obterDetalhes(servicoId) {
  const connection = await promisePool.getConnection();
  try {
    const [servicoRows] = await connection.query(
      `SELECT p.*, p.status_geral AS status FROM processos p WHERE p.id = ? AND p.origem = ?`,
      [servicoId, ORIGEM_CONSTRUCAO]
    );

    if (servicoRows.length === 0) {
      const err = new Error("Serviço não encontrado");
      err.statusCode = 404;
      throw err;
    }

    const [anexos] = await connection.query(
      `SELECT id, nome_original AS nomeOriginal, caminho_servidor AS caminho, tamanho, tipo_anexo AS tipo,
              DATE_FORMAT(data_upload, '%d/%m/%Y %H:%i') AS dataUpload
       FROM processos_anexos WHERE processo_id = ? ORDER BY data_upload DESC`,
      [servicoId]
    );

    const [responsaveis] = await connection.query(
      `SELECT sr.responsavel_matricula, u.nome, sr.status_individual, sr.data_conclusao_individual,
              sr.observacoes_individuais, sr.motivo_nao_conclusao_individual
       FROM servicos_responsaveis sr
       JOIN users u ON sr.responsavel_matricula = u.matricula
       WHERE sr.servico_id = ?`,
      [servicoId]
    );

    return {
      ...servicoRows[0],
      anexos: anexos.map((anexo) => ({
        ...anexo,
        tamanho: formatarTamanhoArquivo(anexo.tamanho),
      })),
      responsaveis,
    };
  } finally {
    connection.release();
  }
}

module.exports = {
  listarAtivos,
  listarConcluidos,
  obterDetalhes,
};
