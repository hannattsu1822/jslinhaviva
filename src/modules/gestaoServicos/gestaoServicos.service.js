const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const { PDFDocument } = require("pdf-lib");
const playwright = require("playwright");
const { promisePool } = require("../../init");
const { projectRootDir } = require("../../shared/path.helper");
const webpush = require('../../push-config');

function limparArquivosTemporarios(files) {
  if (files) {
    (Array.isArray(files) ? files : [files]).forEach((file) => {
      if (file && file.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {
          console.error("Erro ao limpar arquivo temp:", file.path, e);
        }
      }
    });
  }
}

function formatarTamanhoArquivo(bytes) {
  if (bytes === 0 || !bytes) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

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
      responsavel_matricula = "pendente",
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
        `INSERT INTO processos (tipo, data_prevista_execucao, desligamento, hora_inicio, hora_fim, subestacao, alimentador, chave_montante, responsavel_matricula, maps, ordem_obra, descricao_servico, observacoes, status) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo')`,
        [
          tipo_processo,
          data_prevista_execucao,
          desligamento,
          desligamento === "SIM" ? hora_inicio : null,
          desligamento === "SIM" ? hora_fim : null,
          subestacao,
          alimentador || null,
          chave_montante || null,
          responsavel_matricula,
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
        `INSERT INTO processos (processo, tipo, data_prevista_execucao, desligamento, hora_inicio, hora_fim, subestacao, alimentador, chave_montante, responsavel_matricula, maps, ordem_obra, descricao_servico, observacoes, status) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo')`,
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
          responsavel_matricula,
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

async function listarServicos(status, userLevel) {
  let query = `
        SELECT 
            p.id, p.processo, p.data_prevista_execucao, p.desligamento, 
            p.subestacao, p.alimentador, p.chave_montante, 
            p.responsavel_matricula, p.maps, p.status, p.data_conclusao, 
            p.observacoes_conclusao, p.motivo_nao_conclusao, u.nome as responsavel_nome,
            p.ordem_obra,
            CASE 
                WHEN p.tipo = 'Emergencial' THEN 'Emergencial'
                ELSE 'Normal'
            END as tipo_processo,
            (SELECT pa.caminho_servidor FROM processos_anexos pa WHERE pa.processo_id = p.id AND pa.tipo_anexo = 'APR_DOCUMENTO' ORDER BY pa.id DESC LIMIT 1) as caminho_apr_anexo,
            (SELECT pa.nome_original FROM processos_anexos pa WHERE pa.processo_id = p.id AND pa.tipo_anexo = 'APR_DOCUMENTO' ORDER BY pa.id DESC LIMIT 1) as nome_original_apr_anexo
        FROM processos p
        LEFT JOIN users u ON p.responsavel_matricula = u.matricula
    `;
  const params = [];
  let whereClauses = [];

  if (status) {
    if (status === "concluido") {
      whereClauses.push("p.status IN ('concluido', 'nao_concluido')");
    } else {
      whereClauses.push("p.status = ?");
      params.push(status);
    }
  }

  if (userLevel <= 2) {
    whereClauses.push("p.ordem_obra IN ('ODI', 'ODS')");
  }

  if (whereClauses.length > 0) {
    query += " WHERE " + whereClauses.join(" AND ");
  }

  query += " ORDER BY p.data_prevista_execucao ASC, p.id DESC";
  const [servicos] = await promisePool.query(query, params);
  return servicos;
}

async function obterDetalhesServico(id) {
  const connection = await promisePool.getConnection();
  try {
    const [servicoRows] = await connection.query(
      `SELECT p.*, u.nome as responsavel_nome FROM processos p LEFT JOIN users u ON p.responsavel_matricula = u.matricula WHERE p.id = ?`,
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

    const resultado = {
      ...servicoRows[0],
      anexos: anexos.map((anexo) => ({
        ...anexo,
        tamanho: formatarTamanhoArquivo(anexo.tamanho),
      })),
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
      responsavel_matricula,
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
           hora_inicio = ?, hora_fim = ?, maps = ?, responsavel_matricula = ?, ordem_obra = ?,
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
        responsavel_matricula || "pendente",
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

async function concluirServico(servicoId, conclusaoData, matricula) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const {
      observacoes,
      dataConclusao,
      horaConclusao,
      status_final,
      motivo_nao_conclusao,
    } = conclusaoData;

    if (!matricula) {
      throw new Error("Matrícula do responsável não encontrada");
    }
    if (status_final !== "concluido" && status_final !== "nao_concluido") {
      throw new Error("Status final inválido fornecido.");
    }

    const [servicoExistenteRows] = await connection.query(
      "SELECT id, processo FROM processos WHERE id = ?",
      [servicoId]
    );
    if (servicoExistenteRows.length === 0) {
      throw new Error("Serviço não encontrado");
    }
    const servicoExistente = servicoExistenteRows[0];
    let auditMessage = "";
    let dataHoraConclusaoParaSalvar = null;
    let observacoesParaSalvar = observacoes || null;
    let motivoNaoConclusaoParaSalvar = null;

    if (!dataConclusao || !horaConclusao) {
      throw new Error("Data e Hora de Conclusão são obrigatórias.");
    }
    dataHoraConclusaoParaSalvar = `${dataConclusao} ${horaConclusao}:00`;

    if (status_final === "concluido") {
      auditMessage = `Serviço ${servicoId} (${servicoExistente.processo}) concluído em ${dataHoraConclusaoParaSalvar}`;
    } else {
      if (!motivo_nao_conclusao || motivo_nao_conclusao.trim() === "") {
        throw new Error("Motivo da não conclusão é obrigatório.");
      }
      motivoNaoConclusaoParaSalvar = motivo_nao_conclusao.trim();
      auditMessage = `Serviço ${servicoId} (${servicoExistente.processo}) marcado como Não Concluído. Motivo: ${motivoNaoConclusaoParaSalvar}`;
    }

    await connection.query(
      `UPDATE processos SET 
        status = ?, 
        data_conclusao = ?, 
        observacoes_conclusao = ?, 
        motivo_nao_conclusao = ?,
        responsavel_matricula = ? 
       WHERE id = ?`,
      [
        status_final,
        dataHoraConclusaoParaSalvar,
        observacoesParaSalvar,
        motivoNaoConclusaoParaSalvar,
        matricula,
        servicoId,
      ]
    );

    await connection.commit();
    return { auditMessage, status_final };
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

async function reativarServico(servicoId) {
  const [result] = await promisePool.query(
    'UPDATE processos SET status = "ativo", data_conclusao = NULL, observacoes_conclusao = NULL, motivo_nao_conclusao = NULL WHERE id = ?',
    [servicoId]
  );
  if (result.affectedRows === 0) {
    throw new Error("Serviço não encontrado");
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

async function contarServicos(status) {
  let query = "SELECT COUNT(*) as total FROM processos";
  const params = [];
  if (status) {
    if (status === "concluido") {
      query += " WHERE status IN ('concluido', 'nao_concluido')";
    } else {
      query += " WHERE status = ?";
      params.push(status);
    }
  }
  const [result] = await promisePool.query(query, params);
  return result[0];
}

async function listarEncarregados() {
  const [rows] = await promisePool.query(
    "SELECT DISTINCT matricula, nome FROM users WHERE cargo IN ('Encarregado', 'Engenheiro', 'Técnico', 'ADM', 'ADMIN', 'Inspetor') ORDER BY nome"
  );
  return rows;
}

async function listarSubestacoes() {
  const [rows] = await promisePool.query(
    'SELECT DISTINCT subestacao as nome FROM processos WHERE subestacao IS NOT NULL AND subestacao != "" ORDER BY subestacao'
  );
  return rows;
}

async function atribuirResponsavel(servicoId, responsavel_matricula) {
  if (!responsavel_matricula) {
    throw new Error("Matrícula do responsável é obrigatória.");
  }
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();

    const [updateResult] = await connection.query(
      "UPDATE processos SET responsavel_matricula = ? WHERE id = ?",
      [responsavel_matricula, servicoId]
    );

    if (updateResult.affectedRows === 0) {
      throw new Error("Serviço não encontrado.");
    }

    const [userInfo] = await connection.query(
      "SELECT push_subscription FROM users WHERE matricula = ?",
      [responsavel_matricula]
    );

    const subscriptionString = userInfo[0]?.push_subscription;

    if (subscriptionString) {
      console.log(`[PUSH] Encontrada inscrição para a matrícula ${responsavel_matricula}. Tentando enviar notificação.`);
      
      // --- A CORREÇÃO ESTÁ AQUI ---
      const subscription = JSON.parse(subscriptionString);
      // -----------------------------

      const [servicoInfo] = await connection.query(
        "SELECT processo FROM processos WHERE id = ?",
        [servicoId]
      );
      const nomeProcesso = servicoInfo[0]?.processo || `ID ${servicoId}`;

      const payload = JSON.stringify({
        title: 'Novo Serviço Atribuído!',
        body: `O serviço '${nomeProcesso}' foi atribuído a você.`
      });

      try {
        await webpush.sendNotification(subscription, payload);
        console.log(`[PUSH] SUCESSO: Notificação (Web Push) enviada para ${responsavel_matricula}.`);
      } catch (error) {
        console.error(`[PUSH] FALHA ao enviar notificação para ${responsavel_matricula}.`);
        console.error("[PUSH] Detalhes do Erro:", error);

        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log('[PUSH] Inscrição expirada ou inválida. Removendo do banco de dados.');
          await connection.query('UPDATE users SET push_subscription = NULL WHERE matricula = ?', [responsavel_matricula]);
        }
      }
    } else {
      console.log(`[PUSH] Nenhuma inscrição encontrada para a matrícula ${responsavel_matricula}. Nenhuma notificação foi enviada.`);
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (!error.statusCode) {
        throw error;
    }
  } finally {
    if (connection) connection.release();
  }
}

async function processarImagensParaBase64(imagens, basePath) {
  const imagensProcessadas = await Promise.all(
    imagens.map(async (img) => {
      if (!img.caminho) return null;
      const caminhoRelativo = img.caminho.replace("/api/upload_arquivos/", "");
      const caminhoFisico = path.join(
        projectRootDir,
        "upload_arquivos",
        caminhoRelativo
      );

      if (fs.existsSync(caminhoFisico)) {
        try {
          const buffer = await fsPromises.readFile(caminhoFisico);
          const ext = path.extname(img.nomeOriginal).substring(1);
          return {
            src: `data:image/${ext};base64,${buffer.toString("base64")}`,
            nome: img.nomeOriginal,
          };
        } catch (e) {
          console.error(`Erro ao ler o arquivo de imagem: ${caminhoFisico}`, e);
          return null;
        }
      }
      return null;
    })
  );
  return imagensProcessadas.filter(Boolean);
}

function gerarGaleriaHtml(imagens) {
  if (!imagens || imagens.length === 0) {
    return '<p class="no-content">Nenhuma imagem encontrada para esta seção.</p>';
  }

  let galleryHtml = "";
  for (let i = 0; i < imagens.length; i += 4) {
    const chunk = imagens.slice(i, i + 4);
    galleryHtml += '<div class="photo-grid-container">';
    galleryHtml += '<div class="photo-grid-4">';
    chunk.forEach((img) => {
      galleryHtml += `
                <div class="gallery-item">
                    <img src="${img.src}" alt="${img.nome}">
                    <p class="caption">${img.nome}</p>
                </div>
            `;
    });
    galleryHtml += "</div></div>";
  }
  return galleryHtml;
}

async function preencherTemplateHtml(servicoData) {
  const templatePath = path.join(
    projectRootDir,
    "public/pages/templates/relatorio_servico.html"
  );
  let templateHtml = await fsPromises.readFile(templatePath, "utf-8");

  const formatarData = (dataStr, comHora = false) => {
    if (!dataStr) return "N/A";
    const options = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "UTC",
    };
    if (comHora) {
      options.hour = "2-digit";
      options.minute = "2-digit";
    }
    const dataObj = new Date(dataStr);
    if (isNaN(dataObj.getTime())) return "Data inválida";
    return dataObj.toLocaleDateString("pt-BR", options);
  };

  const imagensRegistro = servicoData.anexos.filter(
    (anexo) => anexo.tipo === "imagem"
  );
  const imagensFinalizacao = servicoData.anexos.filter((anexo) =>
    ["foto_conclusao", "foto_nao_conclusao"].includes(anexo.tipo)
  );
  const anexosPDF = servicoData.anexos.filter(
    (anexo) => anexo.caminho && anexo.caminho.toLowerCase().endsWith(".pdf")
  );

  const imagensRegistroBase64 = await processarImagensParaBase64(
    imagensRegistro
  );
  const imagensFinalizacaoBase64 = await processarImagensParaBase64(
    imagensFinalizacao
  );

  const galeriaRegistroHtml = gerarGaleriaHtml(imagensRegistroBase64);
  const galeriaFinalizacaoHtml = gerarGaleriaHtml(imagensFinalizacaoBase64);

  const listaAnexosPdfHtml =
    anexosPDF.length > 0
      ? `<ul>${anexosPDF
          .map((pdf) => `<li>${pdf.nomeOriginal} (Tipo: ${pdf.tipo})</li>`)
          .join("")}</ul>`
      : '<p class="no-content">Nenhum documento PDF foi anexado a este serviço.</p>';

  const dadosParaTemplate = {
    processo: servicoData.processo || "N/A",
    id: servicoData.id,
    tipo: servicoData.tipo || "N/A",
    data_prevista_execucao: formatarData(servicoData.data_prevista_execucao),
    subestacao: servicoData.subestacao || "N/A",
    alimentador: servicoData.alimentador || "N/A",
    chave_montante: servicoData.chave_montante || "N/A",
    desligamento: `${servicoData.desligamento || "N/A"} ${
      servicoData.desligamento === "SIM"
        ? `(${servicoData.hora_inicio || ""} - ${servicoData.hora_fim || ""})`
        : ""
    }`,
    descricao_servico: servicoData.descricao_servico || "Nenhuma.",
    observacoes: servicoData.observacoes || "Nenhuma.",
    status_final_classe:
      servicoData.status === "concluido"
        ? "status-concluido"
        : "status-nao-concluido",
    status_final_texto:
      servicoData.status === "concluido" ? "Concluído" : "Não Concluído",
    data_finalizacao: formatarData(servicoData.data_conclusao, true),
    responsavel_finalizacao: `${servicoData.responsavel_nome || "N/A"} (${
      servicoData.responsavel_matricula || "N/A"
    })`,
    motivo_nao_conclusao_html:
      servicoData.status === "nao_concluido"
        ? `<div class="grid-item full-width"><strong>Motivo da Não Conclusão</strong><div class="text-area">${
            servicoData.motivo_nao_conclusao || "Nenhum."
          }</div></div>`
        : "",
    observacoes_conclusao: servicoData.observacoes_conclusao || "Nenhuma.",
    galeria_registro: galeriaRegistroHtml,
    galeria_finalizacao: galeriaFinalizacaoHtml,
    lista_anexos_pdf: listaAnexosPdfHtml,
    data_geracao: new Date().toLocaleString("pt-BR"),
  };

  for (const key in dadosParaTemplate) {
    const regex = new RegExp(`{{${key}}}`, "g");
    templateHtml = templateHtml.replace(regex, dadosParaTemplate[key]);
  }

  return templateHtml;
}

async function gerarPdfConsolidado(servicoId) {
  const connection = await promisePool.getConnection();
  let browser;
  try {
    const [servicoRows] = await connection.query(
      `SELECT p.*, u.nome as responsavel_nome FROM processos p LEFT JOIN users u ON p.responsavel_matricula = u.matricula WHERE p.id = ?`,
      [servicoId]
    );
    if (servicoRows.length === 0) {
      throw new Error("Serviço não encontrado");
    }
    const [anexos] = await connection.query(
      `SELECT id, nome_original as nomeOriginal, caminho_servidor as caminho, tipo_anexo as tipo FROM processos_anexos WHERE processo_id = ?`,
      [servicoId]
    );
    const servicoData = { ...servicoRows[0], anexos };

    const htmlContent = await preencherTemplateHtml(servicoData);

    browser = await playwright.chromium.launch();
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "10mm", bottom: "20mm", left: "10mm" },
    });
    await browser.close();
    browser = null;

    const pdfsAnexos = anexos.filter(
      (anexo) => anexo.caminho && anexo.caminho.toLowerCase().endsWith(".pdf")
    );

    if (pdfsAnexos.length > 0) {
      const mergedPdfDoc = await PDFDocument.load(pdfBuffer);

      for (const anexo of pdfsAnexos) {
        const caminhoRelativo = anexo.caminho.replace(
          "/api/upload_arquivos/",
          ""
        );
        const caminhoFisico = path.join(
          projectRootDir,
          "upload_arquivos",
          caminhoRelativo
        );

        if (fs.existsSync(caminhoFisico)) {
          const anexoPdfBytes = await fsPromises.readFile(caminhoFisico);
          try {
            const anexoPdfDoc = await PDFDocument.load(anexoPdfBytes, {
              ignoreEncryption: true,
            });
            const copiedPages = await mergedPdfDoc.copyPages(
              anexoPdfDoc,
              anexoPdfDoc.getPageIndices()
            );
            copiedPages.forEach((page) => mergedPdfDoc.addPage(page));
          } catch (pdfError) {
            console.error(
              `Falha ao processar o anexo PDF ${anexo.nomeOriginal}: ${pdfError.message}. Anexo ignorado.`
            );
          }
        }
      }
      const finalPdfBytes = await mergedPdfDoc.save();
      return {
        nomeArquivo: `relatorio_servico_${(
          servicoData.processo || servicoId
        ).replace(/\//g, "-")}.pdf`,
        buffer: Buffer.from(finalPdfBytes),
      };
    }

    return {
      nomeArquivo: `relatorio_servico_${(
        servicoData.processo || servicoId
      ).replace(/\//g, "-")}.pdf`,
      buffer: pdfBuffer,
    };
  } catch (error) {
    if (browser) await browser.close();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  limparArquivosTemporarios,
  criarServico,
  listarServicos,
  obterDetalhesServico,
  atualizarServico,
  anexarAPR,
  deletarServico,
  concluirServico,
  uploadFotoConclusao,
  reativarServico,
  deletarAnexo,
  contarServicos,
  listarEncarregados,
  listarSubestacoes,
  atribuirResponsavel,
  gerarPdfConsolidado,
};

