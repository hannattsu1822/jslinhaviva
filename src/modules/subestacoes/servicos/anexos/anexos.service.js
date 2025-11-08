const { promisePool, uploadsSubestacoesDir } = require("../../../../init");
const path = require("path");
const fs = require("fs").promises;

async function anexarPosterior(servicoId, descricao, arquivos) {
  if (!arquivos || arquivos.length === 0) {
    throw new Error("Nenhum arquivo enviado.");
  }
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const servicoUploadDir = path.join(
      uploadsSubestacoesDir,
      "servicos",
      `servico_${String(servicoId)}`
    );
    await fs.mkdir(servicoUploadDir, { recursive: true });

    for (const file of arquivos) {
      const nomeUnicoArquivo = `${Date.now()}_POST_${file.originalname.replace(
        /[^a-zA-Z0-9.\-_]/g,
        "_"
      )}`;
      const caminhoDestino = path.join(servicoUploadDir, nomeUnicoArquivo);

      // MODIFICAÇÃO: Substituído fs.rename por copyFile + unlink para robustez
      await fs.copyFile(file.path, caminhoDestino);
      await fs.unlink(file.path);

      const caminhoRelativoServidor = `servicos/servico_${servicoId}/${nomeUnicoArquivo}`;
      await connection.query(
        `INSERT INTO servicos_subestacoes_anexos (id_servico, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo, descricao_anexo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          servicoId,
          file.originalname,
          `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
          file.mimetype,
          file.size,
          "ANEXO_POSTERIOR",
          descricao || "Anexo posterior",
        ]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function anexarAPR(servicoId, arquivos) {
  if (!arquivos || arquivos.length === 0) {
    throw new Error("Nenhum arquivo de APR enviado.");
  }
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const servicoUploadDir = path.join(
      uploadsSubestacoesDir,
      "servicos",
      `servico_${String(servicoId)}`
    );
    await fs.mkdir(servicoUploadDir, { recursive: true });

    for (const file of arquivos) {
      const nomeUnicoArquivo = `${Date.now()}_APR_${file.originalname.replace(
        /[^a-zA-Z0-9.\-_]/g,
        "_"
      )}`;
      const caminhoDestino = path.join(servicoUploadDir, nomeUnicoArquivo);

      // MODIFICAÇÃO: Substituído fs.rename por copyFile + unlink para robustez
      await fs.copyFile(file.path, caminhoDestino);
      await fs.unlink(file.path);

      const caminhoRelativoServidor = `servicos/servico_${servicoId}/${nomeUnicoArquivo}`;
      await connection.query(
        `INSERT INTO servicos_subestacoes_anexos (id_servico, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          servicoId,
          file.originalname,
          `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
          file.mimetype,
          file.size,
          "APR",
        ]
      );
    }
    await connection.commit();
    return { connection };
  } catch (error) {
    await connection.rollback();
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
      "SELECT caminho_servidor, nome_original FROM servicos_subestacoes_anexos WHERE id = ?",
      [anexoId]
    );
    if (anexoRows.length === 0) {
      throw new Error("Anexo não encontrado.");
    }
    const anexo = anexoRows[0];
    if (anexo.caminho_servidor) {
      const prefixoUpload = "/upload_arquivos_subestacoes/";
      const caminhoRelativo = anexo.caminho_servidor.startsWith(prefixoUpload)
        ? anexo.caminho_servidor.substring(prefixoUpload.length)
        : anexo.caminho_servidor;

      const fullPath = path.join(uploadsSubestacoesDir, caminhoRelativo);

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
    await connection.query(
      "DELETE FROM servicos_subestacoes_anexos WHERE id = ?",
      [anexoId]
    );
    await connection.commit();
    return { nomeOriginal: anexo.nome_original, connection };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  anexarPosterior,
  anexarAPR,
  excluirAnexo,
};
