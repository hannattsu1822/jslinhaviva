const { promisePool } = require("../infrastructure/database");

const CARGOS_FIBRA_VISAO_TOTAL = new Set([
  "TÉCNICO",
  "ENGENHEIRO",
  "GERENTE",
  "ADM",
  "ADMIN",
  "INSPETOR",
]);

function extrairServicoIdDoIdentificador(identificador) {
  const part = String(identificador || "").split("_")[0];
  const id = parseInt(part, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function usuarioTemAcessoServicoGestao(user, servicoId) {
  if (!user?.matricula) return false;
  if (user.nivel >= 5) return true;

  const id = parseInt(servicoId, 10);
  if (!Number.isFinite(id) || id <= 0) return false;

  const [rows] = await promisePool.query(
    `SELECT 1 FROM servicos_responsaveis
     WHERE servico_id = ? AND responsavel_matricula = ?
     LIMIT 1`,
    [id, user.matricula]
  );
  return rows.length > 0;
}

async function assertAcessoServicoGestao(user, servicoId) {
  const permitido = await usuarioTemAcessoServicoGestao(user, servicoId);
  if (!permitido) {
    const err = new Error("Acesso negado a este serviço.");
    err.statusCode = 403;
    throw err;
  }
}

async function usuarioTemAcessoServicoFibra(user, servicoId) {
  if (!user?.matricula) return false;

  const cargo = (user.cargo || "").toUpperCase();
  if (CARGOS_FIBRA_VISAO_TOTAL.has(cargo) || user.nivel >= 5) {
    return true;
  }

  const id = parseInt(servicoId, 10);
  if (!Number.isFinite(id) || id <= 0) return false;

  const [rows] = await promisePool.query(
    `SELECT 1 FROM servicos_fibra_optica
     WHERE id = ? AND encarregado_matricula = ?
     LIMIT 1`,
    [id, user.matricula]
  );
  return rows.length > 0;
}

async function assertAcessoServicoFibra(user, servicoId) {
  const permitido = await usuarioTemAcessoServicoFibra(user, servicoId);
  if (!permitido) {
    const err = new Error("Acesso negado a este serviço de fibra.");
    err.statusCode = 403;
    throw err;
  }
}

module.exports = {
  CARGOS_FIBRA_VISAO_TOTAL,
  extrairServicoIdDoIdentificador,
  usuarioTemAcessoServicoGestao,
  assertAcessoServicoGestao,
  usuarioTemAcessoServicoFibra,
  assertAcessoServicoFibra,
};
