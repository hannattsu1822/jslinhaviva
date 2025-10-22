const { promisePool } = require("../../../../init");

async function obterDetalhesParaServico(inspecao_ids) {
  if (!Array.isArray(inspecao_ids) || inspecao_ids.length === 0) {
    throw new Error("A lista de IDs de inspeção é obrigatória.");
  }

  const placeholders = inspecao_ids.map(() => "?").join(",");
  const [inspecoes] = await promisePool.query(
    `SELECT i.id, i.formulario_inspecao_num, s.sigla as subestacao_sigla
         FROM inspecoes_subestacoes i
         JOIN subestacoes s ON i.subestacao_id = s.Id
         WHERE i.id IN (${placeholders})`,
    inspecao_ids
  );

  for (const inspecao of inspecoes) {
    const [itensAnormais] = await promisePool.query(
      `SELECT
                r.id as resposta_id,
                ci.descricao_item,
                r.observacao_item,
                (SELECT JSON_ARRAYAGG(JSON_OBJECT('caminho_servidor', a.caminho_servidor, 'nome_original', a.nome_original))
                 FROM inspecoes_anexos a
                 WHERE a.item_resposta_id = r.id AND a.item_especificacao_id IS NULL) as anexos_gerais,
                (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', esp.id, 'descricao_equipamento', esp.descricao_equipamento, 'observacao', esp.observacao, 'anexos',
                    (SELECT JSON_ARRAYAGG(JSON_OBJECT('caminho_servidor', an.caminho_servidor, 'nome_original', an.nome_original))
                     FROM inspecoes_anexos an WHERE an.item_especificacao_id = esp.id)
                ))
                 FROM inspecoes_item_especificacoes esp WHERE esp.item_resposta_id = r.id) as especificacoes
             FROM inspecoes_itens_respostas r
             JOIN checklist_itens ci ON r.item_checklist_id = ci.id
             WHERE r.inspecao_id = ? AND r.avaliacao = 'A'`,
      [inspecao.id]
    );

    inspecao.itens_anormais = itensAnormais.map((item) => {
      const parseJsonArray = (jsonStringOrObject) => {
        if (!jsonStringOrObject) return [];
        if (Array.isArray(jsonStringOrObject)) return jsonStringOrObject;
        try {
          return JSON.parse(jsonStringOrObject);
        } catch (e) {
          return [];
        }
      };

      item.anexos_gerais = parseJsonArray(item.anexos_gerais);
      item.especificacoes = parseJsonArray(item.especificacoes);

      if (item.especificacoes) {
        item.especificacoes.forEach((esp) => {
          esp.anexos = parseJsonArray(esp.anexos);
        });
      }

      return item;
    });
  }

  return inspecoes;
}

module.exports = {
  obterDetalhesParaServico,
};
