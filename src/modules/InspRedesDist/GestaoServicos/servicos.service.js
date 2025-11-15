const { promisePool } = require("../../../init");
const path = require("path");
const fs = require("fs");
const { projectRootDir } = require("../../../shared/path.helper");

async function obterResponsaveis() {
  const sql = `
    SELECT matricula, nome 
    FROM users 
    WHERE cargo IN ('Inspetor', 'Técnico', 'Encarregado', 'Engenheiro', 'ADMIN', 'ADM') 
    ORDER BY nome ASC
  `;
  const [responsaveis] = await promisePool.query(sql);
  return responsaveis;
}

async function salvarAnexosGerais(idServico, files, connection) {
  const baseUploadDir = path.join(
    projectRootDir,
    "upload_InspDistRedes",
    "anexos_gerais"
  );
  const servicoUploadDir = path.join(baseUploadDir, String(idServico));
  fs.mkdirSync(servicoUploadDir, { recursive: true });

  for (const file of files) {
    const novoNome = `anexo_geral_${Date.now()}${path.extname(
      file.originalname
    )}`;
    const novoPath = path.join(servicoUploadDir, novoNome);
    fs.renameSync(file.path, novoPath);

    const caminhoServidor = `/upload_InspDistRedes/anexos_gerais/${idServico}/${novoNome}`;
    await connection.query(
      `INSERT INTO redes_servicos_anexos_gerais (id_servico, caminho_arquivo, nome_original, tipo_arquivo) VALUES (?, ?, ?, ?)`,
      [idServico, caminhoServidor, file.originalname, file.mimetype]
    );
  }
}

async function listarServicos() {
  const sql = `
    SELECT 
      s.id, s.processo, s.data_servico, s.tipo_ordem, s.alimentador, s.subestacao, s.status,
      criador.nome as nome_criador,
      IFNULL(
        (SELECT GROUP_CONCAT(executor.nome SEPARATOR ', ') 
         FROM redes_servicos_responsaveis rsr
         JOIN users executor ON rsr.responsavel_matricula = executor.matricula
         WHERE rsr.id_servico = s.id), 
        'Pendente'
      ) as responsaveis_execucao,
      (SELECT COUNT(*) FROM redes_servicos_pontos WHERE id_servico = s.id) as total_pontos
    FROM redes_servicos_info s
    LEFT JOIN users criador ON s.criador_matricula = criador.matricula
    WHERE s.status != 'Finalizado'
    ORDER BY s.data_servico DESC, s.id DESC
  `;
  const [servicos] = await promisePool.query(sql);
  return servicos;
}

async function listarServicosConcluidos() {
  const sql = `
    SELECT 
      s.id, s.processo, s.data_servico, s.tipo_ordem, s.alimentador, s.subestacao, s.status,
      criador.nome as nome_criador,
      IFNULL(
        (SELECT GROUP_CONCAT(executor.nome SEPARATOR ', ') 
         FROM redes_servicos_responsaveis rsr
         JOIN users executor ON rsr.responsavel_matricula = executor.matricula
         WHERE rsr.id_servico = s.id), 
        'Pendente'
      ) as responsaveis_execucao,
      (SELECT COUNT(*) FROM redes_servicos_pontos WHERE id_servico = s.id) as total_pontos
    FROM redes_servicos_info s
    LEFT JOIN users criador ON s.criador_matricula = criador.matricula
    WHERE s.status = 'Finalizado'
    ORDER BY s.data_finalizacao DESC, s.id DESC
  `;
  const [servicos] = await promisePool.query(sql);
  return servicos;
}

async function obterServicoCompletoPorId(id) {
  const servicoSql = `
    SELECT s.*, u.nome as nome_criador
    FROM redes_servicos_info s
    LEFT JOIN users u ON s.criador_matricula = u.matricula
    WHERE s.id = ?
  `;
  const [servicoRows] = await promisePool.query(servicoSql, [id]);
  if (servicoRows.length === 0) {
    throw new Error("Serviço de inspeção não encontrado.");
  }
  const servico = servicoRows[0];

  const responsaveisSql = `
    SELECT u.matricula, u.nome 
    FROM redes_servicos_responsaveis rsr
    JOIN users u ON rsr.responsavel_matricula = u.matricula
    WHERE rsr.id_servico = ?
  `;
  const [responsaveis] = await promisePool.query(responsaveisSql, [id]);
  servico.responsaveis_execucao = responsaveis;

  const anexosGeraisSql = `SELECT id, caminho_arquivo, nome_original FROM redes_servicos_anexos_gerais WHERE id_servico = ?`;
  const [anexosGerais] = await promisePool.query(anexosGeraisSql, [id]);
  servico.anexos_gerais = anexosGerais;

  const pontosSql = `
    SELECT 
      p.id, p.id_servico, p.id_code_tag, p.numeracao_equipamento, p.coordenada_x, p.coordenada_y, p.observacoes,
      t.tag_code, t.descricao as descricao_tag,
      c.ponto_defeito
    FROM redes_servicos_pontos p
    JOIN redes_code_tags t ON p.id_code_tag = t.id
    JOIN redes_code_types c ON t.id_ponto_defeito = c.id
    WHERE p.id_servico = ?
    ORDER BY p.id ASC
  `;
  const [pontos] = await promisePool.query(pontosSql, [id]);

  if (pontos.length > 0) {
    const pontoIds = pontos.map((p) => p.id);
    const anexosPontosSql = `
      SELECT id, id_ponto, caminho_arquivo, nome_original, tipo_arquivo 
      FROM redes_servicos_anexos 
      WHERE id_ponto IN (?)
    `;
    const [anexosPontos] = await promisePool.query(anexosPontosSql, [pontoIds]);
    pontos.forEach((ponto) => {
      ponto.anexos = anexosPontos.filter(
        (anexo) => anexo.id_ponto === ponto.id
      );
    });
  }

  servico.pontos = pontos;
  return servico;
}

async function criarServico(dadosServico, files) {
  const {
    processo,
    data_servico,
    tipo_ordem,
    subestacao,
    alimentador,
    chave_montante,
    criador_matricula,
    descricao,
  } = dadosServico;
  if (!processo || !data_servico || !tipo_ordem || !criador_matricula) {
    throw new Error(
      "Campos obrigatórios (Processo, Data Prevista, Tipo de Ordem, Criador) não foram preenchidos."
    );
  }
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const servicoSql = `
      INSERT INTO redes_servicos_info 
      (processo, data_servico, tipo_ordem, subestacao, alimentador, chave_montante, criador_matricula, descricao) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const servicoValues = [
      processo,
      data_servico,
      tipo_ordem,
      subestacao,
      alimentador,
      chave_montante,
      criador_matricula,
      descricao,
    ];
    const [result] = await connection.query(servicoSql, servicoValues);
    const novoServicoId = result.insertId;
    if (files && files.length > 0) {
      await salvarAnexosGerais(novoServicoId, files, connection);
    }
    await connection.commit();
    return { id: novoServicoId };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function adicionarAnexosGerais(idServico, files) {
  if (!files || files.length === 0) {
    throw new Error("Nenhum arquivo foi enviado.");
  }
  const [servicoRows] = await promisePool.query(
    "SELECT id FROM redes_servicos_info WHERE id = ?",
    [idServico]
  );
  if (servicoRows.length === 0) {
    throw new Error("Serviço de inspeção não encontrado.");
  }

  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    await salvarAnexosGerais(idServico, files, connection);
    await connection.commit();
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function atualizarServico(id, dadosServico) {
  const {
    processo,
    data_servico,
    tipo_ordem,
    subestacao,
    alimentador,
    chave_montante,
    criador_matricula,
    descricao,
  } = dadosServico;
  if (!processo || !data_servico || !tipo_ordem || !criador_matricula) {
    throw new Error(
      "Campos obrigatórios (Processo, Data, Tipo de Ordem, Criador) não foram preenchidos."
    );
  }
  const sql = `
    UPDATE redes_servicos_info SET
    processo = ?, data_servico = ?, tipo_ordem = ?, subestacao = ?, alimentador = ?, 
    chave_montante = ?, criador_matricula = ?, descricao = ?
    WHERE id = ?
  `;
  const values = [
    processo,
    data_servico,
    tipo_ordem,
    subestacao,
    alimentador,
    chave_montante,
    criador_matricula,
    descricao,
    id,
  ];
  const [result] = await promisePool.query(sql, values);
  if (result.affectedRows === 0) {
    throw new Error("Serviço de inspeção não encontrado para atualização.");
  }
  return { id };
}

async function deletarServico(id) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const dirGeral = path.join(
      projectRootDir,
      "upload_InspDistRedes",
      "anexos_gerais",
      String(id)
    );
    if (fs.existsSync(dirGeral)) {
      fs.rmSync(dirGeral, { recursive: true, force: true });
    }
    const dirPontos = path.join(
      projectRootDir,
      "upload_InspDistRedes",
      "anexos_pontos",
      String(id)
    );
    if (fs.existsSync(dirPontos)) {
      fs.rmSync(dirPontos, { recursive: true, force: true });
    }
    const [result] = await connection.query(
      "DELETE FROM redes_servicos_info WHERE id = ?",
      [id]
    );
    if (result.affectedRows === 0) {
      throw new Error("Serviço de inspeção não encontrado para exclusão.");
    }
    await connection.commit();
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function atribuirResponsaveis(idServico, responsaveisMatriculas) {
  if (!responsaveisMatriculas || !Array.isArray(responsaveisMatriculas)) {
    throw new Error("A lista de responsáveis é inválida.");
  }
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      "DELETE FROM redes_servicos_responsaveis WHERE id_servico = ?",
      [idServico]
    );
    if (responsaveisMatriculas.length > 0) {
      const responsaveisValues = responsaveisMatriculas.map((matricula) => [
        idServico,
        matricula,
      ]);
      await connection.query(
        "INSERT INTO redes_servicos_responsaveis (id_servico, responsavel_matricula) VALUES ?",
        [responsaveisValues]
      );
    }
    await connection.commit();
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function _adicionarPontoLogic(idServico, dadosPonto, connection) {
  const {
    id_code_tag,
    numeracao_equipamento,
    coordenada_x,
    coordenada_y,
    observacoes,
  } = dadosPonto;
  if (!id_code_tag || !coordenada_x || !coordenada_y) {
    throw new Error(
      "Campos obrigatórios (Tag do Defeito, Coordenada X, Coordenada Y) não foram preenchidos."
    );
  }
  const sql = `
    INSERT INTO redes_servicos_pontos (id_servico, id_code_tag, numeracao_equipamento, coordenada_x, coordenada_y, observacoes) 
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const [result] = await connection.query(sql, [
    idServico,
    id_code_tag,
    numeracao_equipamento,
    coordenada_x,
    coordenada_y,
    observacoes,
  ]);
  return { id: result.insertId };
}

async function _atualizarPontoLogic(idPonto, dadosPonto, connection) {
  const {
    id_code_tag,
    numeracao_equipamento,
    coordenada_x,
    coordenada_y,
    observacoes,
  } = dadosPonto;
  if (!id_code_tag || !coordenada_x || !coordenada_y) {
    throw new Error(
      "Campos obrigatórios (Tag do Defeito, Coordenada X, Coordenada Y) não foram preenchidos."
    );
  }
  const sql = `
    UPDATE redes_servicos_pontos SET 
    id_code_tag = ?, numeracao_equipamento = ?, coordenada_x = ?, coordenada_y = ?, observacoes = ? 
    WHERE id = ?
  `;
  const [result] = await connection.query(sql, [
    id_code_tag,
    numeracao_equipamento,
    coordenada_x,
    coordenada_y,
    observacoes,
    idPonto,
  ]);
  if (result.affectedRows === 0) {
    throw new Error(
      `Ponto de inspeção com ID ${idPonto} não encontrado para atualização.`
    );
  }
  return { id: idPonto };
}

async function _deletarPontoLogic(idPonto, connection) {
  const [pontoRows] = await connection.query(
    "SELECT id_servico FROM redes_servicos_pontos WHERE id = ?",
    [idPonto]
  );
  if (pontoRows.length === 0) {
    console.warn(
      `Tentativa de deletar ponto ID ${idPonto} que não foi encontrado.`
    );
    return;
  }
  const idServico = pontoRows[0].id_servico;
  const pontoDir = path.join(
    projectRootDir,
    "upload_InspDistRedes",
    "anexos_pontos",
    String(idServico),
    String(idPonto)
  );
  if (fs.existsSync(pontoDir)) {
    fs.rmSync(pontoDir, { recursive: true, force: true });
  }
  await connection.query("DELETE FROM redes_servicos_pontos WHERE id = ?", [
    idPonto,
  ]);
}

async function _obterPontoCompletoPorId(idPonto, connection) {
  const pontoSql = `
    SELECT
      p.id, p.id_servico, p.id_code_tag, p.numeracao_equipamento, p.coordenada_x, p.coordenada_y, p.observacoes,
      t.tag_code, t.descricao as descricao_tag,
      c.ponto_defeito
    FROM redes_servicos_pontos p
    JOIN redes_code_tags t ON p.id_code_tag = t.id
    JOIN redes_code_types c ON t.id_ponto_defeito = c.id
    WHERE p.id = ?
  `;
  const [pontoRows] = await connection.query(pontoSql, [idPonto]);
  if (pontoRows.length === 0) {
    return null;
  }
  const ponto = pontoRows[0];

  const anexosSql = `
    SELECT id, id_ponto, caminho_arquivo, nome_original, tipo_arquivo
    FROM redes_servicos_anexos
    WHERE id_ponto = ?
  `;
  const [anexos] = await connection.query(anexosSql, [idPonto]);
  ponto.anexos = anexos;

  return ponto;
}

async function obterPontoCompletoPorId(idPonto) {
  const connection = await promisePool.getConnection();
  try {
    const ponto = await _obterPontoCompletoPorId(idPonto, connection);
    if (!ponto) {
      throw new Error("Ponto de inspeção não encontrado.");
    }
    return ponto;
  } finally {
    if (connection) connection.release();
  }
}

async function adicionarPonto(idServico, dadosPonto) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const { id: novoPontoId } = await _adicionarPontoLogic(
      idServico,
      dadosPonto,
      connection
    );
    const pontoCompleto = await _obterPontoCompletoPorId(
      novoPontoId,
      connection
    );
    await connection.commit();
    return pontoCompleto;
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function atualizarPonto(idPonto, dadosPonto) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    await _atualizarPontoLogic(idPonto, dadosPonto, connection);
    const pontoCompleto = await _obterPontoCompletoPorId(idPonto, connection);
    await connection.commit();
    return pontoCompleto;
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function deletarPonto(idPonto) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    await _deletarPontoLogic(idPonto, connection);
    await connection.commit();
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function sincronizarPontos(
  idServico,
  { pontosParaCriar = [], pontosParaAtualizar = [], pontosParaDeletar = [] }
) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const idMap = {};
    for (const pontoId of pontosParaDeletar) {
      await _deletarPontoLogic(pontoId, connection);
    }
    for (const ponto of pontosParaAtualizar) {
      await _atualizarPontoLogic(ponto.id, ponto.dados, connection);
    }
    for (const ponto of pontosParaCriar) {
      const novoPonto = await _adicionarPontoLogic(
        idServico,
        ponto.dados,
        connection
      );
      idMap[ponto.tempId] = novoPonto.id;
    }
    await connection.commit();
    return { success: true, idMap };
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Erro na sincronização em lote:", error);
    throw new Error("Falha ao sincronizar os pontos com o servidor.");
  } finally {
    if (connection) connection.release();
  }
}

async function adicionarAnexos(idPonto, idServico, files) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const baseUploadDir = path.join(
      projectRootDir,
      "upload_InspDistRedes",
      "anexos_pontos"
    );
    const servicoUploadDir = path.join(baseUploadDir, String(idServico));
    const pontoUploadDir = path.join(servicoUploadDir, String(idPonto));
    fs.mkdirSync(pontoUploadDir, { recursive: true });
    for (const file of files) {
      const novoNome = `anexo_ponto_${Date.now()}${path.extname(
        file.originalname
      )}`;
      const novoPath = path.join(pontoUploadDir, novoNome);
      fs.renameSync(file.path, novoPath);
      const caminhoServidor = `/upload_InspDistRedes/anexos_pontos/${idServico}/${idPonto}/${novoNome}`;
      await connection.query(
        `INSERT INTO redes_servicos_anexos (id_ponto, caminho_arquivo, nome_original, tipo_arquivo) VALUES (?, ?, ?, ?)`,
        [idPonto, caminhoServidor, file.originalname, file.mimetype]
      );
    }
    await connection.commit();
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function deletarAnexo(idAnexo) {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const [anexoRows] = await connection.query(
      "SELECT caminho_arquivo FROM redes_servicos_anexos WHERE id = ?",
      [idAnexo]
    );
    if (anexoRows.length === 0) {
      throw new Error("Anexo não encontrado.");
    }
    const anexo = anexoRows[0];
    const caminhoCompleto = path.join(
      projectRootDir,
      anexo.caminho_arquivo.substring(1)
    );
    if (fs.existsSync(caminhoCompleto)) {
      fs.unlinkSync(caminhoCompleto);
    }
    await connection.query("DELETE FROM redes_servicos_anexos WHERE id = ?", [
      idAnexo,
    ]);
    await connection.commit();
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function finalizarServico(id, dataFinalizacao) {
  if (!dataFinalizacao) {
    throw new Error("A data de finalização é obrigatória.");
  }

  let formattedDate = dataFinalizacao.replace("T", " ").slice(0, 19);

  const sql = `
    UPDATE redes_servicos_info 
    SET status = 'Finalizado', data_finalizacao = ? 
    WHERE id = ? AND status != 'Finalizado'
  `;
  const [result] = await promisePool.query(sql, [formattedDate, id]);

  if (result.affectedRows === 0) {
    throw new Error("Serviço de inspeção não encontrado ou já finalizado.");
  }
  return { id };
}

async function reativarServico(id) {
  const sql = `
    UPDATE redes_servicos_info 
    SET status = 'Pendente', data_finalizacao = NULL 
    WHERE id = ? AND status = 'Finalizado'
  `;
  const [result] = await promisePool.query(sql, [id]);
  if (result.affectedRows === 0) {
    throw new Error(
      "Serviço de inspeção não encontrado ou não está finalizado."
    );
  }
  return { id };
}

module.exports = {
  obterResponsaveis,
  listarServicos,
  listarServicosConcluidos,
  obterServicoCompletoPorId,
  obterPontoCompletoPorId,
  criarServico,
  adicionarAnexosGerais,
  atualizarServico,
  deletarServico,
  atribuirResponsaveis,
  adicionarPonto,
  atualizarPonto,
  deletarPonto,
  adicionarAnexos,
  deletarAnexo,
  sincronizarPontos,
  finalizarServico,
  reativarServico,
};
