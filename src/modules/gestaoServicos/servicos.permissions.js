const base = require("../../shared/moduloNivel.permissions");

module.exports = {
  ...base,
  NIVEL_ADMIN_SERVICOS: base.NIVEL_ADMIN,
  podeAcessarModuloServicos: base.podeAcessarModulo,
  podeVerTodosServicos: base.podeVerTodos,
  podeEditarServico: base.podeEditar,
  podeExcluirServico: base.podeExcluir,
  podeForcarConclusao: base.podeForcarConclusao,
  podeConcluirAdministrativo: base.podeConcluirAdministrativo,
  podeGerenciarEquipe: base.podeGerenciarEquipe,
  podeAnexarAPR: base.podeAnexarAPR,
  podeDeletarAnexo: base.podeDeletarAnexo,
  podeReativarServico: base.podeReativar,
  podeRegistrarServico: base.podeRegistrar,
};
