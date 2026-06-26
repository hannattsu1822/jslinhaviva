/**
 * Permissões padrão por nível — usado em Serviços, Subestações, Fibra e Redes.
 *
 * Nível 7+: controle total
 * Nível 2–4: operações básicas (nos registros atribuídos ao usuário)
 */

const NIVEL_ADMIN = 7;
const NIVEL_BASICO_MAX = 4;
const NIVEL_ACESSO_MIN = 2;

function obterNivel(user) {
  return user?.nivel ?? 0;
}

function temControleTotal(user) {
  return obterNivel(user) >= NIVEL_ADMIN;
}

function temNivelBasico(user) {
  const nivel = obterNivel(user);
  return nivel >= NIVEL_ACESSO_MIN && nivel <= NIVEL_BASICO_MAX;
}

function podeAcessarModulo(user) {
  return obterNivel(user) >= NIVEL_ACESSO_MIN;
}

function podeOperacaoBasica(user) {
  return temNivelBasico(user) || temControleTotal(user);
}

module.exports = {
  NIVEL_ADMIN,
  NIVEL_BASICO_MAX,
  NIVEL_ACESSO_MIN,
  obterNivel,
  temControleTotal,
  temNivelBasico,
  podeAcessarModulo,
  podeOperacaoBasica,
  podeVerTodos: temControleTotal,
  podeEditar: temControleTotal,
  podeExcluir: temControleTotal,
  podeGerenciarEquipe: temControleTotal,
  podeAnexarAPR: temControleTotal,
  podeDeletarAnexo: temControleTotal,
  podeReativar: temControleTotal,
  podeRegistrar: temControleTotal,
  podeForcarConclusao: temControleTotal,
  podeConcluirAdministrativo: temControleTotal,
};
