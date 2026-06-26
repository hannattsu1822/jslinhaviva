const base = require("../../shared/moduloNivel.permissions");

module.exports = {
  ...base,
  NIVEL_ADMIN_REDE: base.NIVEL_ADMIN,
  podeAcessarModuloRede: base.podeAcessarModulo,
  podeVerTodasInspecoes: base.podeVerTodos,
  podeEditarInspecao: base.podeEditar,
  podeExcluirInspecao: base.podeExcluir,
  podeRegistrarInspecao: base.podeRegistrar,
  podeGerenciarCodigos: base.podeEditar,
  podeAtribuirResponsaveis: base.podeGerenciarEquipe,
  podeReativarInspecao: base.podeReativar,
  podeFinalizarInspecao: base.podeOperacaoBasica,
};
