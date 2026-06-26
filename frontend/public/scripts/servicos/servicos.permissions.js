(function (global) {
  const base = global.ModuloNivelPermissions;
  if (!base) return;

  global.ServicosPermissions = {
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
    podeAnexarPosterior: base.podeAnexarPosterior,
    podeDeletarAnexo: base.podeDeletarAnexo,
    podeReativarServico: base.podeReativar,
    podeRegistrarServico: base.podeRegistrar,
    podeOperacaoBasica: base.podeOperacaoBasica,
  };
})(typeof window !== "undefined" ? window : globalThis);
