const { promisePool } = require("../infrastructure/database");
const {
  temControleTotal,
  ehCargoConstrucaoAcompanhamento,
} = require("../shared/moduloNivel.permissions");

function normalizarOrigem(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

async function servicoEhOrigemConstrucao(servicoId) {
  const id = parseInt(servicoId, 10);
  if (!Number.isFinite(id) || id <= 0) return false;

  const [rows] = await promisePool.query(
    `SELECT origem FROM processos WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!rows.length) return false;
  return normalizarOrigem(rows[0].origem).includes("construcao");
}

async function usuarioTemAcessoServicoGestao(user, servicoId) {
  if (!user?.matricula) return false;
  if (temControleTotal(user)) return true;

  const id = parseInt(servicoId, 10);
  if (!Number.isFinite(id) || id <= 0) return false;

  if (ehCargoConstrucaoAcompanhamento(user)) {
    return servicoEhOrigemConstrucao(id);
  }

  const [rows] = await promisePool.query(
    `SELECT 1 FROM servicos_responsaveis
     WHERE servico_id = ? AND responsavel_matricula = ?
     LIMIT 1`,
    [id, user.matricula]
  );
  return rows.length > 0;
}

async function usuarioTemAcessoVisualizacaoAnexosServico(user, servicoId) {
  if (await usuarioTemAcessoServicoGestao(user, servicoId)) return true;

  const {
    podeAcessarModuloConstrucao,
  } = require("../modules/construcaoAcompanhamento/construcao.permissions");

  if (!podeAcessarModuloConstrucao(user)) return false;
  return servicoEhOrigemConstrucao(servicoId);
}

async function assertAcessoVisualizacaoAnexosServico(user, servicoId) {
  const permitido = await usuarioTemAcessoVisualizacaoAnexosServico(user, servicoId);
  if (!permitido) {
    const err = new Error("Acesso negado a este serviço.");
    err.statusCode = 403;
    throw err;
  }
}

async function assertAcessoServicoGestao(user, servicoId) {
  const permitido = await usuarioTemAcessoServicoGestao(user, servicoId);
  if (!permitido) {
    const err = new Error("Acesso negado a este serviço.");
    err.statusCode = 403;
    throw err;
  }
}

function extrairServicoIdDoIdentificador(identificador) {
  const part = String(identificador || "").split("_")[0];
  const id = parseInt(part, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function usuarioTemAcessoServicoFibra(user, servicoId) {
  if (!user?.matricula) return false;
  if (temControleTotal(user)) return true;

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

async function usuarioTemAcessoServicoRede(user, servicoId) {
  if (!user?.matricula) return false;
  if (temControleTotal(user)) return true;

  const id = parseInt(servicoId, 10);
  if (!Number.isFinite(id) || id <= 0) return false;

  const [rows] = await promisePool.query(
    `SELECT 1 FROM redes_servicos_responsaveis
     WHERE id_servico = ? AND responsavel_matricula = ?
     LIMIT 1`,
    [id, user.matricula]
  );
  return rows.length > 0;
}

async function assertAcessoServicoRede(user, servicoId) {
  const permitido = await usuarioTemAcessoServicoRede(user, servicoId);
  if (!permitido) {
    const err = new Error("Acesso negado a esta inspeção de rede.");
    err.statusCode = 403;
    throw err;
  }
}

const { obterNivel } = require("../shared/moduloNivel.permissions");

const NIVEL_GESTOR = 4;

function isGestorOuSuperior(user) {
  return obterNivel(user) >= NIVEL_GESTOR;
}

function assertAcessoRecursoProprio(
  user,
  matriculaRecurso,
  mensagem = "Acesso negado a este recurso."
) {
  if (isGestorOuSuperior(user)) return;
  if (!user?.matricula || user.matricula !== matriculaRecurso) {
    const err = new Error(mensagem);
    err.statusCode = 403;
    throw err;
  }
}

module.exports = {
  extrairServicoIdDoIdentificador,
  usuarioTemAcessoServicoGestao,
  assertAcessoServicoGestao,
  usuarioTemAcessoVisualizacaoAnexosServico,
  assertAcessoVisualizacaoAnexosServico,
  usuarioTemAcessoServicoFibra,
  assertAcessoServicoFibra,
  usuarioTemAcessoServicoRede,
  assertAcessoServicoRede,
  isGestorOuSuperior,
  assertAcessoRecursoProprio,
};
