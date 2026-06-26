const base = require("../../shared/moduloNivel.permissions");

module.exports = {
  ...base,
  NIVEL_ADMIN_FIBRA: base.NIVEL_ADMIN,
  podeAcessarModuloFibra: base.podeAcessarModulo,
  podeVerTodosServicosFibra: base.podeVerTodos,
  podeEditarServicoFibra: base.podeEditar,
  podeExcluirServicoFibra: base.podeExcluir,
  podeRegistrarServicoFibra: base.podeRegistrar,
  podeGerenciarPontosFibra: base.podeEditar,
  podeColetarPontosFibra: base.podeEditar,
  podeVisualizarMapaFibra: base.podeEditar,
  podeAnexarAPRFibra: base.podeAnexarAPR,
  podeReabrirServicoFibra: base.podeReativar,
  podeFinalizarServicoFibra: base.podeOperacaoBasica,
};
