const {
  NIVEL_ACESSO_MIN,
  obterNivel,
  temControleTotal,
  ehCargoConstrucaoAcompanhamento,
} = require("../../shared/moduloNivel.permissions");

function podeAcessarModuloConstrucao(user) {
  if (!user) return false;
  if (obterNivel(user) < NIVEL_ACESSO_MIN) return false;
  return temControleTotal(user) || ehCargoConstrucaoAcompanhamento(user);
}

module.exports = {
  NIVEL_ACESSO_MIN,
  podeAcessarModuloConstrucao,
  ehCargoConstrucaoAcompanhamento,
  temControleTotal,
};
