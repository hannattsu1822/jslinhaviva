// src/shared/apr_definitions.js
const definicoesAPR = {
  perguntasARC: [
    {
      chave: "arc_informados",
      texto:
        "Todos os componentes da equipe estão informados sobre o serviço a ser realizado?",
    },
    {
      chave: "arc_capacitados",
      texto:
        "Todos os componentes da equipe estão capacitados para realizar a tarefa?",
    },
    {
      chave: "arc_bem_fisica_mental",
      texto: "Todos os componentes da turma estão bem física e mentalmente?",
    },
    {
      chave: "arc_participaram_planejamento",
      texto:
        "Todos os componentes da turma participaram do planejamento e avaliação do serviço?",
    },
    {
      chave: "arc_possui_epis",
      texto:
        "Todos os componentes da equipe possuem os EPIs para a execução do serviço?",
    },
    {
      chave: "arc_epis_condicoes",
      texto: "Os EPIs estão em perfeitas condições de uso?",
    },
    {
      chave: "arc_possui_epcs",
      texto: "A equipe possui os EPCs para a realização do serviço?",
    },
    {
      chave: "arc_epcs_condicoes",
      texto: "Os EPCs estão em perfeitas condições de uso?",
    },
    {
      chave: "arc_autorizacao_cod",
      texto: "O serviço requer autorização do COD?",
    },
    {
      chave: "arc_comunicacao_cod",
      texto: "A equipe possui meio de comunicação fluente com o COD?",
    },
    {
      chave: "arc_viatura_condicoes",
      texto: "A viatura está em boas condições de uso?",
    },
    {
      chave: "arc_sinalizacao_area",
      texto: "O serviço requer a sinalização e isolamento da área de trabalho?",
    },
    {
      chave: "arc_desligamento_equipamentos",
      texto: "O serviço requer o desligamento e/ou bloqueio de equipamentos?",
    },
    {
      chave: "arc_teste_tensao",
      texto: "O serviço requer teste de ausência de tensão?",
    },
    {
      chave: "arc_aterramento_temporario",
      texto: "O serviço requer uso de aterramento temporário?",
    },
    {
      chave: "arc_teste_pontalete",
      texto: "O serviço requer teste de pontalete?",
    },
    {
      chave: "arc_iluminacao_auxiliar",
      texto: "O serviço requer o uso de iluminação auxiliar (refletor)?",
    },
    { chave: "arc_uso_escadas", texto: "O serviço requer o uso de escadas?" },
  ],
  riscosEspecificos: [
    { chave: "risco_queda", texto: "Queda" },
    { chave: "risco_ruidos", texto: "Rudos" },
    { chave: "risco_explosao", texto: "Exploso" },
    { chave: "risco_chuva", texto: "Chuva" },
    { chave: "risco_arco_voltaico", texto: "Arco voltaico" },
    { chave: "risco_choque_eletrico", texto: "Choque eltrico" },
    { chave: "risco_cruzamento_circuitos", texto: "Cruzamento de circuitos" },
    { chave: "risco_projecao_objetos", texto: "Projeo/ impacto de objetos" },
    { chave: "risco_animais_peconhentos", texto: "Animais peonhentos" },
    { chave: "risco_atropelamento", texto: "Atropelamento" },
    { chave: "risco_dificil_posicionamento", texto: "Difcil posicionamento" },
  ],
  medidasControle: [
    {
      chave: "medida_delimitar_sinalizar",
      texto:
        "Delimitar e sinalizar a área de trabalho com cones, fitas ou correntes de isolamento e placas",
    },
    {
      chave: "medida_cuidado_sky",
      texto:
        "Ao subir e descer do sky, tenha o cuidado e retire as sucatas que podem estar no caminho",
    },
    {
      chave: "medida_escada_apoiada",
      texto:
        "Ao subir e descer da escada tenha certeza de que a mesma está apoiada e bem amarrada",
    },
    {
      chave: "medida_cinto_paraquedista",
      texto:
        "Dois da equipe devem utilizar o cinto paraquedista ao realizar serviços no Sky ou na escada",
    },
    {
      chave: "medida_subir_descer_atencao",
      texto:
        "Subir e descer do sky ou escada com atenção e firmeza utilizando os EPIs necessários",
    },
    {
      chave: "medida_posicionar_cesto",
      texto:
        "Posicionar-se sobre o cesto para executar as manobras, não inclinar-se demais para fora dele",
    },
    {
      chave: "medida_cobrir_condutores_terra",
      texto:
        "Quando o eletricista estiver entre os condutores, cobrir os condutores e o terra",
    },
    {
      chave: "medida_evitar_forcar_coberturas",
      texto:
        "Ao colocar as coberturas nos condutores, evitar forçá-los ou balançá-los",
    },
    {
      chave: "medida_verificar_condicoes_postes",
      texto:
        "No momento em que estiver tensionando o condutor ou fazendo emendas, verificar as condies dos poste, o esforo mecnico e as estruturas adjacentes",
    },
    {
      chave: "medida_utilizar_epi_epc_adequados",
      texto: "Utilizar os EPIs e EPCs de maneira adequada",
    },
    { chave: "medida_aterrar_veiculo", texto: "Aterrar devidamente o veículo" },
  ],
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = definicoesAPR;
}
