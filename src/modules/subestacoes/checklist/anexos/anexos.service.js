const { promisePool, uploadsSubestacoesDir } = require("../../../../init");
const path = require("path");
const fs = require("fs").promises;
const crypto = require("crypto");
const { projectRootDir } = require("../../../../shared/path.helper");

async function moverAnexo(
  anexo,
  inspecaoId,
  destinoSubpasta,
  connection,
  options = {}
) {
  const tempFilePath = path.join(
    uploadsSubestacoesDir,
    "temp",
    anexo.tempFileName
  );
  const inspecaoRootDir = path.join(
    uploadsSubestacoesDir,
    "checklist",
    `checklist_${String(inspecaoId)}`
  );
  const destinoDir = path.join(inspecaoRootDir, destinoSubpasta);
  await fs.mkdir(destinoDir, { recursive: true });

  const nomeUnico = `${Date.now()}_${
    options.prefixo || ""
  }_${anexo.originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const caminhoDestinoFinal = path.join(destinoDir, nomeUnico);

  await fs.rename(tempFilePath, caminhoDestinoFinal);

  const caminhoRelativo = `checklist/checklist_${inspecaoId}/${destinoSubpasta}/${nomeUnico}`;
  await connection.query(
    `INSERT INTO inspecoes_anexos (inspecao_id, item_resposta_id, item_especificacao_id, registro_id, item_avulso_id, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      inspecaoId,
      options.item_resposta_id || null,
      options.item_especificacao_id || null,
      options.registro_id || null,
      options.item_avulso_id || null,
      anexo.originalName,
      `/upload_arquivos_subestacoes/${caminhoRelativo}`,
      null,
      null,
      options.categoria_anexo,
    ]
  );
  return caminhoDestinoFinal;
}

async function salvarUploadTemporario(file) {
  if (!file) {
    throw new Error("Nenhum arquivo enviado.");
  }
  const tempDir = path.join(uploadsSubestacoesDir, "temp");
  await fs.mkdir(tempDir, { recursive: true });
  const tempFileName = `${crypto.randomUUID()}${path.extname(
    file.originalname
  )}`;
  const tempFilePath = path.join(tempDir, tempFileName);
  await fs.rename(file.path, tempFilePath);
  return { tempFileName, originalName: file.originalname };
}

async function anexarEscritorio(inspecaoId, anexos) {
  if (!anexos || !Array.isArray(anexos) || anexos.length === 0) {
    throw new Error("Nenhum anexo informado.");
  }
  const connection = await promisePool.getConnection();
  let arquivosMovidosComSucesso = [];
  try {
    await connection.beginTransaction();
    let anexosSalvosInfo = [];
    for (const anexo of anexos) {
      const caminhoMovido = await moverAnexo(
        anexo,
        inspecaoId,
        "anexos_escritorio",
        connection,
        { prefixo: "ESCRITORIO", categoria_anexo: "ESCRITORIO" }
      );
      arquivosMovidosComSucesso.push(caminhoMovido);
      anexosSalvosInfo.push({
        nome_original: anexo.originalName,
        caminho_servidor: caminhoMovido,
      });
    }
    await connection.commit();
    return {
      connection,
      anexosSalvosInfo,
      arquivosMovidos: arquivosMovidosComSucesso,
    };
  } catch (error) {
    await connection.rollback();
    for (const caminho of arquivosMovidosComSucesso) {
      try {
        await fs.unlink(caminho);
      } catch (e) {}
    }
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function anexarTermografia(
  inspecaoId,
  itemChecklistId,
  item_especificacao_id,
  anexos
) {
  if (isNaN(itemChecklistId) || itemChecklistId <= 0) {
    throw new Error("ID do item inválido.");
  }
  if (!anexos || anexos.length === 0) {
    throw new Error("Nenhum anexo enviado.");
  }
  const connection = await promisePool.getConnection();
  let arquivosMovidosComSucesso = [];
  try {
    await connection.beginTransaction();
    const [respostaCheck] = await connection.query(
      `SELECT id FROM inspecoes_itens_respostas WHERE inspecao_id = ? AND item_checklist_id = ?`,
      [inspecaoId, itemChecklistId]
    );
    if (respostaCheck.length === 0) {
      throw new Error(
        `Resposta para o item ${itemChecklistId} não encontrada na inspeção ${inspecaoId}.`
      );
    }
    const itemRespostaId = respostaCheck[0].id;
    const especificacaoIdFinal = item_especificacao_id
      ? parseInt(item_especificacao_id, 10)
      : null;

    let anexosSalvosInfo = [];
    for (const anexo of anexos) {
      const caminhoMovido = await moverAnexo(
        anexo,
        inspecaoId,
        `respostas_itens/resposta_${itemRespostaId}/termografia`,
        connection,
        {
          prefixo: "TERMO",
          categoria_anexo: "ITEM_TERMOGRAFIA",
          item_resposta_id: itemRespostaId,
          item_especificacao_id: especificacaoIdFinal,
        }
      );
      arquivosMovidosComSucesso.push(caminhoMovido);
      anexosSalvosInfo.push({
        nome_original: anexo.originalName,
        caminho_servidor: caminhoMovido,
      });
    }
    await connection.commit();
    return {
      connection,
      anexosSalvosInfo,
      arquivosMovidos: arquivosMovidosComSucesso,
    };
  } catch (error) {
    await connection.rollback();
    for (const caminho of arquivosMovidosComSucesso) {
      try {
        await fs.unlink(caminho);
      } catch (e) {}
    }
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function anexarAPR(inspecaoId, arquivos) {
  if (!arquivos || arquivos.length === 0) {
    throw new Error("Nenhum arquivo de APR enviado.");
  }
  const connection = await promisePool.getConnection();
  let arquivosMovidosComSucesso = [];
  try {
    await connection.beginTransaction();
    const inspecaoUploadDir = path.join(
      uploadsSubestacoesDir,
      "checklist",
      `checklist_${String(inspecaoId)}`,
      "apr_anexos"
    );
    await fs.mkdir(inspecaoUploadDir, { recursive: true });

    for (const file of arquivos) {
      const nomeUnicoArquivo = `${Date.now()}_APR_${file.originalname.replace(
        /[^a-zA-Z0-9.\-_]/g,
        "_"
      )}`;
      const caminhoDestino = path.join(inspecaoUploadDir, nomeUnicoArquivo);
      await fs.rename(file.path, caminhoDestino);
      arquivosMovidosComSucesso.push(caminhoDestino);
      const caminhoRelativoServidor = `checklist/checklist_${inspecaoId}/apr_anexos/${nomeUnicoArquivo}`;
      await connection.query(
        `INSERT INTO inspecoes_anexos (inspecao_id, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          inspecaoId,
          file.originalname,
          `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
          file.mimetype,
          file.size,
          "INSPECAO_APR",
        ]
      );
    }
    await connection.commit();
    return { connection, arquivosMovidos: arquivosMovidosComSucesso };
  } catch (error) {
    await connection.rollback();
    for (const caminho of arquivosMovidosComSucesso) {
      try {
        await fs.unlink(caminho);
      } catch (e) {}
    }
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function excluirAnexo(anexoId) {
  if (isNaN(parseInt(anexoId, 10))) {
    throw new Error("ID do anexo inválido.");
  }
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const [anexoRows] = await connection.query(
      "SELECT id, caminho_servidor, nome_original, inspecao_id FROM inspecoes_anexos WHERE id = ?",
      [anexoId]
    );
    if (anexoRows.length === 0) {
      throw new Error("Anexo não encontrado.");
    }
    const anexo = anexoRows[0];
    if (anexo.caminho_servidor) {
      const fullPath = path.join(
        projectRootDir,
        "public",
        anexo.caminho_servidor
      );
      try {
        await fs.unlink(fullPath);
      } catch (err) {
        if (err.code !== "ENOENT") {
          console.warn(
            `Falha ao deletar arquivo físico do anexo ${anexoId}: ${fullPath}`
          );
        }
      }
    }
    await connection.query("DELETE FROM inspecoes_anexos WHERE id = ?", [
      anexoId,
    ]);
    await connection.commit();
    return { anexo, connection };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  salvarUploadTemporario,
  anexarEscritorio,
  anexarTermografia,
  anexarAPR,
  excluirAnexo,
};
