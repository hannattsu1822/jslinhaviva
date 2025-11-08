const { promisePool, uploadsSubestacoesDir } = require("../../../../init");
const path = require("path");
const fsPromises = require("fs").promises;

async function atualizarEncarregados(servicoId, atualizacoes) {
  if (!Array.isArray(atualizacoes) || atualizacoes.length === 0) {
    throw new Error(
      "Nenhuma atualização de encarregado fornecida ou formato inválido."
    );
  }
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const [servicoInfo] = await connection.query(
      "SELECT processo FROM servicos_subestacoes WHERE id = ?",
      [servicoId]
    );
    if (servicoInfo.length === 0) {
      throw new Error(`Serviço com ID ${servicoId} não encontrado.`);
    }

    let logDetalhes = [
      `Serviço Proc: ${servicoInfo[0].processo}, Itens atualizados (Encarregados):`,
    ];
    for (const atualizacao of atualizacoes) {
      const itemEscopoId = parseInt(atualizacao.item_escopo_id, 10);
      const novoEncarregadoId = atualizacao.novo_encarregado_item_id
        ? parseInt(atualizacao.novo_encarregado_item_id, 10)
        : null;
      if (isNaN(itemEscopoId)) continue;

      const [itemCheck] = await connection.query(
        "SELECT servico_id FROM servico_itens_escopo WHERE id = ?",
        [itemEscopoId]
      );
      if (
        itemCheck.length === 0 ||
        itemCheck[0].servico_id !== parseInt(servicoId, 10)
      )
        continue;

      await connection.query(
        "UPDATE servico_itens_escopo SET encarregado_item_id = ? WHERE id = ?",
        [novoEncarregadoId, itemEscopoId]
      );
      logDetalhes.push(
        `- ItemID ${itemEscopoId} -> EncID ${novoEncarregadoId || "Nenhum"}`
      );
    }

    await connection.commit();
    return { logDetalhes: logDetalhes.join(" "), connection };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function concluirItem(itemEscopoId, dadosConclusao, arquivos) {
  const { data_conclusao, observacoes_conclusao, status_item } = dadosConclusao;
  if (isNaN(parseInt(itemEscopoId))) {
    throw new Error("ID do item de escopo inválido.");
  }
  if (!data_conclusao) {
    throw new Error("A data de conclusão é obrigatória.");
  }
  if (!status_item) {
    throw new Error("O status da conclusão é obrigatório.");
  }

  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const [itemRows] = await connection.query(
      "SELECT servico_id FROM servico_itens_escopo WHERE id = ?",
      [itemEscopoId]
    );
    if (itemRows.length === 0) {
      throw new Error("Item de escopo não encontrado.");
    }
    const { servico_id } = itemRows[0];

    await connection.query(
      "UPDATE servico_itens_escopo SET status_item_escopo = ?, data_conclusao_item = ?, observacoes_conclusao_item = ? WHERE id = ?",
      [status_item, data_conclusao, observacoes_conclusao || null, itemEscopoId]
    );

    if (arquivos && arquivos.length > 0) {
      const itemAnexoDir = path.join(
        uploadsSubestacoesDir,
        "servicos",
        `servico_${String(servico_id)}`,
        "itens_conclusao"
      );
      await fsPromises.mkdir(itemAnexoDir, { recursive: true });

      for (const file of arquivos) {
        const nomeUnicoArq = `${Date.now()}_ITEM${itemEscopoId}_${file.originalname.replace(
          /[^a-zA-Z0-9.\\-_]/g,
          "_"
        )}`;
        const finalPath = path.join(itemAnexoDir, nomeUnicoArq);
        
        // MODIFICAÇÃO: Substituído fsPromises.rename por copyFile + unlink para robustez
        await fsPromises.copyFile(file.path, finalPath);
        await fsPromises.unlink(file.path);

        const caminhoRelServ = `servicos/servico_${servico_id}/itens_conclusao/${nomeUnicoArq}`;
        await connection.query(
          `INSERT INTO servico_item_escopo_anexos (item_escopo_id, nome_original, caminho_servidor, tipo_mime, tamanho) VALUES (?,?,?,?,?)`,
          [
            itemEscopoId,
            file.originalname,
            `/upload_arquivos_subestacoes/${caminhoRelServ}`,
            file.mimetype,
            file.size,
          ]
        );
      }
    }

    const [progressoRows] = await connection.query(
      `SELECT (SELECT COUNT(*) FROM servico_itens_escopo WHERE servico_id = ?) as total, (SELECT COUNT(*) FROM servico_itens_escopo WHERE servico_id = ? AND status_item_escopo != 'PENDENTE' AND status_item_escopo != 'EM_ANDAMENTO') as tratados`,
      [servico_id, servico_id]
    );

    if (
      progressoRows.length > 0 &&
      progressoRows[0].total > 0 &&
      progressoRows[0].total === progressoRows[0].tratados
    ) {
      const [todosItens] = await connection.query(
        "SELECT status_item_escopo FROM servico_itens_escopo WHERE servico_id = ?",
        [servico_id]
      );
      const temPendenciaOuNaoConcluido = todosItens.some(
        (item) =>
          item.status_item_escopo === "CONCLUIDO_COM_PENDENCIA" ||
          item.status_item_escopo === "NAO_CONCLUIDO"
      );
      const statusFinalServico = temPendenciaOuNaoConcluido
        ? "CONCLUIDO_COM_PENDENCIA"
        : "CONCLUIDO";
      const horaConclusao = new Date().toLocaleTimeString("pt-BR", {
        hour12: false,
      });
      await connection.query(
        "UPDATE servicos_subestacoes SET status = ?, data_conclusao = ?, horario_fim = ? WHERE id = ?",
        [
          statusFinalServico,
          new Date().toISOString().split("T")[0],
          horaConclusao,
          servico_id,
        ]
      );
    } else {
      const [servicoStatusRows] = await connection.query(
        "SELECT status FROM servicos_subestacoes WHERE id = ?",
        [servico_id]
      );
      if (
        servicoStatusRows.length > 0 &&
        servicoStatusRows[0].status === "PROGRAMADO"
      ) {
        await connection.query(
          "UPDATE servicos_subestacoes SET status = 'EM_ANDAMENTO' WHERE id = ?",
          [servico_id]
        );
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  atualizarEncarregados,
  concluirItem,
};
