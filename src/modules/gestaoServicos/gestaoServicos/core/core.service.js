const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const { promisePool } = require("../../../init");
const { projectRootDir } = require("../../../shared/path.helper");
const {
  determinarNomePastaParaServicoExistente,
} = require("../utils/servico.helpers");
const { formatarTamanhoArquivo } = require("../utils/file.helpers");

async function criarServico(servicoData, files) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const {
      processo,
      tipo_processo = "Normal",
      data_prevista_execucao,
      desligamento,
      hora_inicio = null,
      hora_fim = null,
      subestacao,
      alimentador,
      chave_montante,
      maps,
      ordem_obra,
      descricao_servico,
      observacoes,
    } = servicoData;

    if (!data_prevista_execucao || !subestacao || !desligamento) {
      throw new Error(
        "Campos obrigatórios faltando: data_prevista_execucao, subestacao ou desligamento"
      );
    }
    if (desligamento === "SIM" && (!hora_inicio || !hora_fim)) {
      throw new Error(
        "Para desligamentos, hora_inicio e hora_fim são obrigatórios"
      );
    }

    let processoParaAuditoria = processo ? processo.trim() : null;
    let insertedId;

    if (tipo_processo === "Emergencial") {
      const [result] = await connection.query(
        `INSERT INTO processos (tipo, data_prevista_execucao, desligamento, hora_inicio, hora_fim, subestacao, alimentador, chave_montante, maps, ordem_obra, descricao_servico, observacoes, status, status_geral) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo', 'ativo')`,
        [
          tipo_processo,
          data_prevista_execucao,
          desligamento,
          desligamento === "SIM" ? hora_inicio : null,
          desligamento === "SIM" ? hora_fim : null,
          subestacao,
          alimentador || null,
          chave_montante || null,
          maps || null,
          ordem_obra || null,
          descricao_servico || null,
          observacoes || null,
        ]
      );
      insertedId = result.insertId;
      processoParaAuditoria = `EMERGENCIAL-${insertedId}`;
      await connection.query("UPDATE processos SET processo = ? WHERE id = ?", [
        processoParaAuditoria,
        insertedId,
      ]);
    } else {
      if (!processo || typeof processo !== "string" || processo.trim() === "") {
        throw new Error(
          "Para serviços normais, o número do processo é obrigatório"
        );
      }
      processoParaAuditoria = processo.trim();
      const [result] = await connection.query(
        `INSERT INTO processos (processo, tipo, data_prevista_execucao, desligamento, hora_inicio, hora_fim, subestacao, alimentador, chave_montante, maps, ordem_obra, descricao_servico, observacoes, status, status_geral) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo', 'ativo')`,
        [
          processoParaAuditoria,
          tipo_processo,
          data_prevista_execucao,
          desligamento,
          desligamento === "SIM" ? hora_inicio : null,
          desligamento === "SIM" ? hora_fim : null,
          subestacao,
          alimentador || null,
          chave_montante || null,
          maps || null,
          ordem_obra || null,
          descricao_servico || null,
          observacoes || null,
        ]
      );
      insertedId = result.insertId;
    }

    const anoExecucao = new Date(data_prevista_execucao).getFullYear();
    const nomeDaPastaParaAnexos = `${insertedId}_${anoExecucao}`;

    const anexosInfo = [];
    if (files && files.length > 0) {
      const diretorioDoProcesso = path.join(
        projectRootDir,
        "upload_arquivos",
        nomeDaPastaParaAnexos
      );
      if (!fs.existsSync(diretorioDoProcesso)) {
        fs.mkdirSync(diretorioDoProcesso, { recursive: true });
      }

      for (const file of files) {
        const extensao = path.extname(file.originalname).toLowerCase();
        const novoNomeArquivo = `anexo_${Date.now()}${extensao}`;
        const caminhoCompletoNovoArquivo = path.join(
          diretorioDoProcesso,
          novoNomeArquivo
        );
        await fsPromises.rename(file.path, caminhoCompletoNovoArquivo);
        const tipoAnexo = [".jpg", ".jpeg", ".png"].includes(extensao)
          ? "imagem"
          : "documento";
        const caminhoServidorParaSalvar = `/api/upload_arquivos/${nomeDaPastaParaAnexos}/${novoNomeArquivo}`;

        await connection.query(
          `INSERT INTO processos_anexos (processo_id, nome_original, caminho_servidor, tamanho, tipo_anexo) VALUES (?, ?, ?, ?, ?)`,
          [
            insertedId,
            file.originalname,
            caminhoServidorParaSalvar,
            file.size,
            tipoAnexo,
          ]
        );
        anexosInfo.push({
          nomeOriginal: file.originalname,
          caminho: caminhoServidorParaSalvar,
        });
      }
    }
    await connection.commit();
    return {
      processo: processoParaAuditoria || String(insertedId),
      id: insertedId,
      tipo: tipo_processo,
      anexos: anexosInfo,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function listarServicos(status, user) {
  let query = `
    SELECT 
        p.id, p.processo, p.data_prevista_execucao, p.desligamento, 
        p.subestacao, p.alimentador, p.chave_montante, 
        p.maps, p.status_geral as status, p.data_conclusao, 
        p.observacoes_conclusao, p.motivo_nao_conclusao,
        p.ordem_obra,
        CASE 
            WHEN p.tipo = 'Emergencial' THEN 'Emergencial'
            ELSE 'Normal'
        END as tipo_processo,
        COALESCE(resp.nomes_responsaveis, u_legado.nome) as nomes_responsaveis,
        resp.total_responsaveis,
        resp.concluidos_responsaveis,
        (SELECT pa.caminho_servidor FROM processos_anexos pa WHERE pa.processo_id = p.id AND pa.tipo_anexo = 'APR_DOCUMENTO' ORDER BY pa.id DESC LIMIT 1) as caminho_apr_anexo,
        (SELECT pa.nome_original FROM processos_anexos pa WHERE pa.processo_id = p.id AND pa.tipo_anexo = 'APR_DOCUMENTO' ORDER BY pa.id DESC LIMIT 1) as nome_original_apr_anexo
    FROM processos p
    LEFT JOIN (
        SELECT 
            sr.servico_id,
            GROUP_CONCAT(u.nome SEPARATOR ', ') as nomes_responsaveis,
            COUNT(sr.id) as total_responsaveis,
            SUM(CASE WHEN sr.status_individual = 'concluido' THEN 1 ELSE 0 END) as concluidos_responsaveis
        FROM servicos_responsaveis sr
        JOIN users u ON sr.responsavel_matricula = u.matricula
        GROUP BY sr.servico_id
    ) as resp ON p.id = resp.servico_id
    LEFT JOIN users u_legado ON p.responsavel_matricula = u_legado.matricula
  `;
  const params = [];
  let whereClauses = [];

  if (status) {
    if (status === "ativo") {
      whereClauses.push("p.status_geral IN ('ativo', 'em_progresso')");
    } else if (status === "concluido") {
      whereClauses.push("p.status_geral IN ('concluido', 'nao_concluido')");
    } else {
      whereClauses.push("p.status_geral = ?");
      params.push(status);
    }
  }

  if (user && user.nivel < 5) {
    whereClauses.push(
      "EXISTS (SELECT 1 FROM servicos_responsaveis sr_filter WHERE sr_filter.servico_id = p.id AND sr_filter.responsavel_matricula = ?)"
    );
    params.push(user.matricula);
  }

  if (whereClauses.length > 0) {
    query += " WHERE " + whereClauses.join(" AND ");
  }

  query += " ORDER BY p.id ASC";
  const [servicos] = await promisePool.query(query, params);
  return servicos;
}

async function obterDetalhesServico(id) {
  const connection = await promisePool.getConnection();
  try {
    const [servicoRows] = await connection.query(
      `SELECT p.*, p.status_geral as status FROM processos p WHERE p.id = ?`,
      [id]
    );

    if (servicoRows.length === 0) {
      throw new Error("Serviço não encontrado");
    }

    const [anexos] = await connection.query(
      `SELECT id, nome_original as nomeOriginal, caminho_servidor as caminho, tamanho, tipo_anexo as tipo, DATE_FORMAT(data_upload, '%d/%m/%Y %H:%i') as dataUpload 
       FROM processos_anexos WHERE processo_id = ? ORDER BY data_upload DESC`,
      [id]
    );

    const [responsaveis] = await connection.query(
      `SELECT sr.responsavel_matricula, u.nome, sr.status_individual, sr.data_conclusao_individual, sr.observacoes_individuais, sr.motivo_nao_conclusao_individual
       FROM servicos_responsaveis sr
       JOIN users u ON sr.responsavel_matricula = u.matricula
       WHERE sr.servico_id = ?`,
      [id]
    );

    const resultado = {
      ...servicoRows[0],
      anexos: anexos.map((anexo) => ({
        ...anexo,
        tamanho: formatarTamanhoArquivo(anexo.tamanho),
      })),
      responsaveis: responsaveis,
    };
    return resultado;
  } finally {
    if (connection) connection.release();
  }
}

async function atualizarServico(servicoId, servicoData, files) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const {
      processo,
      subestacao,
      alimentador,
      chave_montante,
      desligamento,
      hora_inicio,
      hora_fim,
      maps,
      ordem_obra,
      descricao_servico,
      observacoes,
    } = servicoData;

    if (!processo || processo.trim() === "") {
      throw new Error("O número do processo é obrigatório.");
    }
    if (!subestacao) {
      throw new Error("Subestação é obrigatória");
    }
    if (desligamento === "SIM" && (!hora_inicio || !hora_fim)) {
      throw new Error("Horários são obrigatórios para desligamentos");
    }
    if (
      maps &&
      !/^(https?:\/\/)?(www\.)?(google\.[a-z]+\/maps\/|maps\.google\.[a-z]+\/|goo\.gl\/maps\/|maps\.app\.goo\.gl\/)/i.test(
        maps
      )
    ) {
      throw new Error("Por favor, insira um link válido do Google Maps");
    }

    await connection.query(
      `UPDATE processos SET processo = ?, subestacao = ?, alimentador = ?, chave_montante = ?, desligamento = ?, 
           hora_inicio = ?, hora_fim = ?, maps = ?, ordem_obra = ?,
           descricao_servico = ?, observacoes = ? WHERE id = ?`,
      [
        processo.trim(),
        subestacao,
        alimentador || null,
        chave_montante || null,
        desligamento,
        desligamento === "SIM" ? hora_inicio : null,
        desligamento === "SIM" ? hora_fim : null,
        maps || null,
        ordem_obra || null,
        descricao_servico || null,
        observacoes || null,
        servicoId,
      ]
    );

    if (files && files.length > 0) {
      const nomeDaPastaParaAnexos =
        await determinarNomePastaParaServicoExistente(connection, servicoId);

      const diretorioDoProcesso = path.join(
        projectRootDir,
        "upload_arquivos",
        nomeDaPastaParaAnexos
      );
      if (!fs.existsSync(diretorioDoProcesso)) {
        fs.mkdirSync(diretorioDoProcesso, { recursive: true });
      }

      for (const file of files) {
        const extensao = path.extname(file.originalname).toLowerCase();
        const novoNomeArquivo = `anexo_edit_${Date.now()}${extensao}`;
        const caminhoCompletoNovoArquivo = path.join(
          diretorioDoProcesso,
          novoNomeArquivo
        );
        await fsPromises.rename(file.path, caminhoCompletoNovoArquivo);
        const tipoAnexo = [".jpg", ".jpeg", ".png"].includes(extensao)
          ? "imagem"
          : "documento";
        const caminhoServidorParaSalvar = `/api/upload_arquivos/${nomeDaPastaParaAnexos}/${novoNomeArquivo}`;
        await connection.query(
          `INSERT INTO processos_anexos (processo_id, nome_original, caminho_servidor, tamanho, tipo_anexo) VALUES (?, ?, ?, ?, ?)`,
          [
            servicoId,
            file.originalname,
            caminhoServidorParaSalvar,
            file.size,
            tipoAnexo,
          ]
        );
      }
    }
    await connection.commit();
    return { processo: processo.trim() };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function deletarServico(servicoId) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();

    const [servicoRows] = await connection.query(
      "SELECT id, processo, data_prevista_execucao FROM processos WHERE id = ?",
      [servicoId]
    );
    if (servicoRows.length === 0) {
      throw new Error("Serviço não encontrado");
    }
    const servico = servicoRows[0];
    const nomeProcessoOriginalParaAuditoria = servico.processo;

    let nomeDaPastaParaExcluir;
    try {
      nomeDaPastaParaExcluir = await determinarNomePastaParaServicoExistente(
        connection,
        servicoId
      );
    } catch (e) {
      console.warn(
        `Não foi possível determinar o nome da pasta para o serviço ID ${servicoId} durante a exclusão. A exclusão de arquivos/pasta pode não ocorrer. Erro: ${e.message}`
      );
      nomeDaPastaParaExcluir = null;
    }

    await connection.query(
      "DELETE FROM processos_anexos WHERE processo_id = ?",
      [servicoId]
    );
    await connection.query("DELETE FROM processos WHERE id = ?", [servicoId]);

    if (nomeDaPastaParaExcluir) {
      const diretorioDoProcesso = path.join(
        projectRootDir,
        "upload_arquivos",
        nomeDaPastaParaExcluir
      );
      if (fs.existsSync(diretorioDoProcesso)) {
        await fsPromises.rm(diretorioDoProcesso, {
          recursive: true,
          force: true,
        });
      }
    }

    await connection.commit();
    return { nomeProcessoOriginal: nomeProcessoOriginalParaAuditoria };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  criarServico,
  listarServicos,
  obterDetalhesServico,
  atualizarServico,
  deletarServico,
};
