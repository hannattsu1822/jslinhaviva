const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;

async function determinarNomePastaParaServicoExistente(connection, servicoId) {
  if (isNaN(parseInt(servicoId))) {
    throw new Error(
      `ID do Serviço inválido fornecido para determinar pasta: ${servicoId}`
    );
  }
  const [servicoInfo] = await connection.query(
    "SELECT id, processo, data_prevista_execucao FROM processos WHERE id = ?",
    [servicoId]
  );
  if (servicoInfo.length === 0) {
    throw new Error(
      `Serviço com ID ${servicoId} não encontrado para determinar pasta de anexos.`
    );
  }
  const { id, processo, data_prevista_execucao } = servicoInfo[0];

  const [primeiroAnexoExistente] = await connection.query(
    "SELECT caminho_servidor FROM processos_anexos WHERE processo_id = ? ORDER BY id ASC LIMIT 1",
    [servicoId]
  );

  if (
    primeiroAnexoExistente.length > 0 &&
    primeiroAnexoExistente[0].caminho_servidor
  ) {
    const caminho = primeiroAnexoExistente[0].caminho_servidor;
    const partes = caminho.split("/");
    if (partes.length >= 3) {
      return partes[partes.length - 2];
    }
  }

  const nomeOriginalDoProcesso = processo;
  if (
    nomeOriginalDoProcesso &&
    (nomeOriginalDoProcesso.includes("/") ||
      (nomeOriginalDoProcesso.startsWith("EMERGENCIAL-") &&
        String(id) !==
          nomeOriginalDoProcesso
            .replace(/\//g, "-")
            .replace(`EMERGENCIAL-`, "")))
  ) {
    return nomeOriginalDoProcesso.replace(/\//g, "-");
  } else {
    if (!data_prevista_execucao) {
      throw new Error(
        `Data prevista de execução não encontrada para o serviço ID ${id}, necessário para nomear a pasta.`
      );
    }
    const anoExecucao = new Date(data_prevista_execucao).getFullYear();
    if (isNaN(anoExecucao)) {
      throw new Error(
        `Ano de execução inválido derivado de data_prevista_execucao: ${data_prevista_execucao}`
      );
    }
    return `${id}_${anoExecucao}`;
  }
}

module.exports = {
  determinarNomePastaParaServicoExistente,
};
