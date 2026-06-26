const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const { promisePool } = require("../../../infrastructure/database");
const { projectRootDir } = require("../../../shared/path.helper");
const {
  determinarNomePastaParaServicoExistente,
} = require("../utils/servico.helpers");
const { assertAcessoServicoGestao } = require("../../../shared/accessControl.helper");

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

async function anexarPosteriores(servicoId, files, user) {
  if (!files || files.length === 0) {
    throw new Error("Nenhum arquivo enviado.");
  }
  if (files.length > 5) {
    throw new Error("Máximo de 5 arquivos por envio.");
  }

  await assertAcessoServicoGestao(user, servicoId);

  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();

    const [servicoRows] = await connection.query(
      "SELECT status_geral FROM processos WHERE id = ?",
      [servicoId]
    );
    if (servicoRows.length === 0) {
      throw new Error("Serviço não encontrado.");
    }
    const status = servicoRows[0].status_geral;
    if (status !== "concluido" && status !== "nao_concluido") {
      throw new Error(
        "Anexos posteriores só podem ser adicionados em serviços finalizados."
      );
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

    const anexosSalvos = [];
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error(`O arquivo ${file.originalname} excede o limite de 10MB.`);
      }

      const extensao = path.extname(file.originalname).toLowerCase();
      const novoNomeArquivo = `anexo_posterior_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}${extensao}`;
      const caminhoCompleto = path.join(diretorioDoProcesso, novoNomeArquivo);

      if (!fs.existsSync(file.path)) {
        throw new Error(
          "Erro no processamento do arquivo, arquivo temporário não encontrado."
        );
      }
      await fsPromises.rename(file.path, caminhoCompleto);

      const tipoAnexo = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(
        extensao
      )
        ? "imagem"
        : "documento";
      const caminhoServidor = `/api/upload_arquivos/${nomeDaPastaParaAnexos}/${novoNomeArquivo}`;

      await connection.query(
        `INSERT INTO processos_anexos (processo_id, nome_original, caminho_servidor, tamanho, tipo_anexo) VALUES (?, ?, ?, ?, ?)`,
        [servicoId, file.originalname, caminhoServidor, file.size, tipoAnexo]
      );

      anexosSalvos.push({
        nomeOriginal: file.originalname,
        caminho: caminhoServidor,
      });
    }

    await connection.commit();
    return anexosSalvos;
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
  anexarPosteriores,
  deletarAnexo,
};
