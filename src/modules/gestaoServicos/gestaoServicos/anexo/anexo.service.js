const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const { promisePool } = require("../../../init");
const { projectRootDir } = require("../../../shared/path.helper");
const {
  determinarNomePastaParaServicoExistente,
} = require("../utils/servico.helpers");

async function anexarAPR(servicoId, file) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();

    if (!file) {
      throw new Error("Nenhum arquivo de APR enviado.");
    }

    const nomeDaPastaParaAnexos = await determinarNomePastaParaServicoExistente(
      connection,
      servicoId
    );
    const diretorioDoProcesso = path.join(
      projectRootDir,
      "upload_arquivos",
      nomeDaPastaParaAnexos
    );

    if (!fs.existsSync(diretorioDoProcesso)) {
      fs.mkdirSync(diretorioDoProcesso, { recursive: true });
    }

    const extensao = path.extname(file.originalname).toLowerCase();
    const novoNomeArquivoAPR = `APR_${servicoId}_${Date.now()}${extensao}`;
    const caminhoCompletoNovoArquivoAPR = path.join(
      diretorioDoProcesso,
      novoNomeArquivoAPR
    );

    if (!fs.existsSync(file.path)) {
      throw new Error(
        "Erro no processamento do arquivo, arquivo temporário não encontrado."
      );
    }
    await fsPromises.rename(file.path, caminhoCompletoNovoArquivoAPR);

    const caminhoServidorParaSalvarAPR = `/api/upload_arquivos/${nomeDaPastaParaAnexos}/${novoNomeArquivoAPR}`;

    await connection.query(
      "DELETE FROM processos_anexos WHERE processo_id = ? AND tipo_anexo = 'APR_DOCUMENTO'",
      [servicoId]
    );

    const [insertResult] = await connection.query(
      `INSERT INTO processos_anexos (processo_id, nome_original, caminho_servidor, tamanho, tipo_anexo) VALUES (?, ?, ?, ?, 'APR_DOCUMENTO')`,
      [servicoId, file.originalname, caminhoServidorParaSalvarAPR, file.size]
    );

    if (insertResult.affectedRows === 0) {
      throw new Error(
        "Falha ao inserir o registro do anexo APR no banco de dados."
      );
    }

    await connection.commit();
    return {
      caminho_apr_anexo: caminhoServidorParaSalvarAPR,
      nome_original_apr_anexo: file.originalname,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function uploadFotoConclusao(servicoId, status_final, file) {
  const connection = await promisePool.getConnection();
  try {
    if (!file) {
      throw new Error("Nenhum arquivo enviado.");
    }

    await connection.beginTransaction();

    const nomeDaPastaParaAnexos = await determinarNomePastaParaServicoExistente(
      connection,
      servicoId
    );
    const diretorioDoProcesso = path.join(
      projectRootDir,
      "upload_arquivos",
      nomeDaPastaParaAnexos
    );
    if (!fs.existsSync(diretorioDoProcesso)) {
      fs.mkdirSync(diretorioDoProcesso, { recursive: true });
    }

    const fileExt = path.extname(file.originalname).toLowerCase();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const newFilename = `${
      status_final === "concluido" ? "conclusao" : "nao_conclusao_registro"
    }_${Date.now()}_${randomSuffix}${fileExt}`;
    const novoPathCompleto = path.join(diretorioDoProcesso, newFilename);

    await fsPromises.rename(file.path, novoPathCompleto);

    const tipoAnexo =
      status_final === "concluido" ? "foto_conclusao" : "foto_nao_conclusao";
    await connection.query(
      `INSERT INTO processos_anexos (processo_id, nome_original, caminho_servidor, tipo_anexo, tamanho) VALUES (?, ?, ?, ?, ?)`,
      [
        servicoId,
        file.originalname,
        `/api/upload_arquivos/${nomeDaPastaParaAnexos}/${newFilename}`,
        tipoAnexo,
        file.size,
      ]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function deletarAnexo(servicoId, anexoId) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const [anexo] = await connection.query(
      `SELECT caminho_servidor, nome_original FROM processos_anexos WHERE id = ? AND processo_id = ?`,
      [anexoId, servicoId]
    );
    if (anexo.length === 0) {
      throw new Error("Anexo não encontrado ou não pertence a este serviço");
    }
    const caminhoRelativo = anexo[0].caminho_servidor.replace(
      "/api/upload_arquivos/",
      ""
    );
    const caminhoFisico = path.join(
      projectRootDir,
      "upload_arquivos",
      caminhoRelativo
    );
    if (fs.existsSync(caminhoFisico)) await fsPromises.unlink(caminhoFisico);
    await connection.query("DELETE FROM processos_anexos WHERE id = ?", [
      anexoId,
    ]);
    await connection.commit();
    return { nomeOriginal: anexo[0].nome_original };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  anexarAPR,
  uploadFotoConclusao,
  deletarAnexo,
};
