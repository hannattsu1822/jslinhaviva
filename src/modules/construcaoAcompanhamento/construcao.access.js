const { promisePool } = require("../../infrastructure/database");
const {
  podeAcessarModuloConstrucao,
} = require("./construcao.permissions");

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

async function assertAcessoModuloConstrucao(user) {
  if (!podeAcessarModuloConstrucao(user)) {
    const err = new Error("Acesso negado ao módulo de acompanhamento de construção.");
    err.statusCode = 403;
    throw err;
  }
}

async function assertAcessoLeituraServicoConstrucao(user, servicoId) {
  await assertAcessoModuloConstrucao(user);

  const ehConstrucao = await servicoEhOrigemConstrucao(servicoId);
  if (!ehConstrucao) {
    const err = new Error("Serviço não pertence à origem Construção.");
    err.statusCode = 403;
    throw err;
  }
}

module.exports = {
  servicoEhOrigemConstrucao,
  assertAcessoModuloConstrucao,
  assertAcessoLeituraServicoConstrucao,
};
