const {
  temControleTotal,
  podeOperacaoBasica,
  podeAcessarModulo,
} = require("./fibra.permissions");

function buildPermissoesFibra(user) {
  return {
    podeGerenciar: temControleTotal(user),
    podeOperar: podeOperacaoBasica(user),
    podeAcessar: podeAcessarModulo(user),
  };
}

module.exports = { buildPermissoesFibra };
