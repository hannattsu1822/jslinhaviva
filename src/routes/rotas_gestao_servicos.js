const express = require("express");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const { PDFDocument } = require("pdf-lib");
const { promisePool, upload } = require("../init");
const { autenticar, registrarAuditoria } = require("../auth");

const router = express.Router();

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

router.get("/gestao-servicos", autenticar, (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/gestao_servico.html")
  );
});

router.get("/registro_servicos", autenticar, (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/registro_servicos.html")
  );
});

router.get("/servicos_ativos", autenticar, (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/servicos_ativos.html")
  );
});

router.get("/servicos_concluidos", autenticar, (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/servicos_concluidos.html")
  );
});

router.get("/detalhes_servico", autenticar, (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/detalhes_servico.html")
  );
});

router.get("/servicos_atribuidos", autenticar, (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/servicos_atribuidos.html")
  );
});

router.get("/editar_servico", autenticar, (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/editar_servico.html")
  );
});

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

router.post(
  "/api/servicos",
  autenticar,
  upload.array("anexos", 5),
  async (req, res) => {
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
      } = req.body;

      if (!data_prevista_execucao || !subestacao || !desligamento) {
        limparArquivosTemporarios(req.files);
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message:
            "Campos obrigatórios faltando: data_prevista_execucao, subestacao ou desligamento",
        });
      }
      if (desligamento === "SIM" && (!hora_inicio || !hora_fim)) {
        limparArquivosTemporarios(req.files);
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message:
            "Para desligamentos, hora_inicio e hora_fim são obrigatórios",
        });
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
        await connection.query(
          "UPDATE processos SET processo = ? WHERE id = ?",
          [processoParaAuditoria, insertedId]
        );
      } else {
        if (
          !processo ||
          typeof processo !== "string" ||
          processo.trim() === ""
        ) {
          limparArquivosTemporarios(req.files);
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            message:
              "Para serviços normais, o número do processo é obrigatório",
          });
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
      if (req.files && req.files.length > 0) {
        const diretorioDoProcesso = path.join(
          __dirname,
          "../../upload_arquivos",
          nomeDaPastaParaAnexos
        );
        if (!fs.existsSync(diretorioDoProcesso)) {
          fs.mkdirSync(diretorioDoProcesso, { recursive: true });
        }

        for (const file of req.files) {
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
      if (req.user?.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "Registro de Serviço",
          `Serviço ${tipo_processo} registrado: ${
            processoParaAuditoria || `ID ${insertedId}`
          }`
        );
      }
      res.status(201).json({
        success: true,
        processo: processoParaAuditoria || String(insertedId),
        id: insertedId,
        tipo: tipo_processo,
        anexos: anexosInfo,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao registrar serviço:", error);
      limparArquivosTemporarios(req.files);
      res.status(500).json({
        success: false,
        message: "Erro interno ao registrar serviço",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.get("/api/servicos", autenticar, async (req, res) => {
  try {
    const { status } = req.query;
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
    if (status) {
      if (status === "concluido") {
        query += " WHERE p.status IN ('concluido', 'nao_concluido')";
      } else {
        query += " WHERE p.status = ?";
        params.push(status);
      }
    }
    query += " ORDER BY p.data_prevista_execucao ASC, p.id DESC";
    const [servicos] = await promisePool.query(query, params);
    res.status(200).json(servicos);
  } catch (error) {
    console.error("Erro ao buscar serviços:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao buscar serviços",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

router.get("/api/servicos/:id", autenticar, async (req, res) => {
  const connection = await promisePool.getConnection();
  try {
    const { id } = req.params;
    const [servicoRows] = await connection.query(
      `SELECT p.*, u.nome as responsavel_nome FROM processos p LEFT JOIN users u ON p.responsavel_matricula = u.matricula WHERE p.id = ?`,
      [id]
    );

    if (servicoRows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Serviço não encontrado" });
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
    res.status(200).json({ success: true, data: resultado });
  } catch (error) {
    console.error("Erro ao buscar detalhes do serviço:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao buscar detalhes do serviço",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    if (connection) connection.release();
  }
});

router.put(
  "/api/servicos/:id",
  autenticar,
  upload.array("anexos", 5),
  async (req, res) => {
    const { id: servicoId } = req.params;
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
      } = req.body;

      if (!processo || processo.trim() === "") {
        limparArquivosTemporarios(req.files);
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: "O número do processo é obrigatório.",
        });
      }

      if (!subestacao) {
        limparArquivosTemporarios(req.files);
        await connection.rollback();
        connection.release();
        return res
          .status(400)
          .json({ success: false, message: "Subestação é obrigatória" });
      }
      if (desligamento === "SIM" && (!hora_inicio || !hora_fim)) {
        limparArquivosTemporarios(req.files);
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: "Horários são obrigatórios para desligamentos",
        });
      }
      if (
        maps &&
        !/^(https?:\/\/)?(www\.)?(google\.[a-z]+\/maps\/|maps\.google\.[a-z]+\/|goo\.gl\/maps\/|maps\.app\.goo\.gl\/)/i.test(
          maps
        )
      ) {
        limparArquivosTemporarios(req.files);
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: "Por favor, insira um link válido do Google Maps",
        });
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

      if (req.files && req.files.length > 0) {
        const nomeDaPastaParaAnexos =
          await determinarNomePastaParaServicoExistente(connection, servicoId);

        const diretorioDoProcesso = path.join(
          __dirname,
          "../../upload_arquivos",
          nomeDaPastaParaAnexos
        );
        if (!fs.existsSync(diretorioDoProcesso)) {
          fs.mkdirSync(diretorioDoProcesso, { recursive: true });
        }

        for (const file of req.files) {
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
      await registrarAuditoria(
        req.user.matricula,
        "Edição de Serviço",
        `Serviço ${servicoId} editado. Processo alterado para: ${processo.trim()}`
      );
      res.json({
        success: true,
        message: "Serviço atualizado com sucesso!",
        redirect: `/detalhes_servico?id=${servicoId}`,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao atualizar serviço:", error);
      limparArquivosTemporarios(req.files);
      res.status(500).json({
        success: false,
        message: "Erro ao atualizar serviço",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.post(
  "/api/servicos/:servicoId/upload-apr",
  autenticar,
  upload.single("apr_file"),
  async (req, res) => {
    const { servicoId } = req.params;
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();

      if (!req.file) {
        await connection.rollback();
        connection.release();
        return res
          .status(400)
          .json({ success: false, message: "Nenhum arquivo de APR enviado." });
      }

      const nomeDaPastaParaAnexos =
        await determinarNomePastaParaServicoExistente(connection, servicoId);
      const diretorioDoProcesso = path.join(
        __dirname,
        "../../upload_arquivos",
        nomeDaPastaParaAnexos
      );

      if (!fs.existsSync(diretorioDoProcesso)) {
        fs.mkdirSync(diretorioDoProcesso, { recursive: true });
      }

      const file = req.file;
      const extensao = path.extname(file.originalname).toLowerCase();
      const novoNomeArquivoAPR = `APR_${servicoId}_${Date.now()}${extensao}`;
      const caminhoCompletoNovoArquivoAPR = path.join(
        diretorioDoProcesso,
        novoNomeArquivoAPR
      );

      if (!fs.existsSync(file.path)) {
        await connection.rollback();
        connection.release();
        console.error(`Arquivo temporário não encontrado: ${file.path}`);
        return res.status(500).json({
          success: false,
          message:
            "Erro no processamento do arquivo, arquivo temporário não encontrado.",
        });
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
      await registrarAuditoria(
        req.user.matricula,
        "Upload de APR",
        `APR anexada ao Serviço ID: ${servicoId}`
      );
      res.json({
        success: true,
        message: "APR anexada com sucesso!",
        caminho_apr_anexo: caminhoServidorParaSalvarAPR,
        nome_original_apr_anexo: file.originalname,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro detalhado ao fazer upload da APR:", error);
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        limparArquivosTemporarios(req.file);
      }
      res.status(500).json({
        success: false,
        message: `Erro interno ao fazer upload da APR: ${error.message}`,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.delete("/api/servicos/:id", autenticar, async (req, res) => {
  const connection = await promisePool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const user = req.user;
    const cargosPermitidos = [
      "ADMIN",
      "Gerente",
      "Supervisor",
      "Engenheiro",
      "Técnico",
      "Inspetor",
    ];
    if (!cargosPermitidos.includes(user.cargo)) {
      await connection.rollback();
      connection.release();
      return res
        .status(403)
        .json({ success: false, message: "Acesso negado para exclusão." });
    }

    const [servicoRows] = await connection.query(
      "SELECT id, processo, data_prevista_execucao FROM processos WHERE id = ?",
      [id]
    );
    if (servicoRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res
        .status(404)
        .json({ success: false, message: "Serviço não encontrado" });
    }
    const servico = servicoRows[0];
    const nomeProcessoOriginalParaAuditoria = servico.processo;

    let nomeDaPastaParaExcluir;
    try {
      nomeDaPastaParaExcluir = await determinarNomePastaParaServicoExistente(
        connection,
        id
      );
    } catch (e) {
      console.warn(
        `Não foi possível determinar o nome da pasta para o serviço ID ${id} durante a exclusão. A exclusão de arquivos/pasta pode não ocorrer. Erro: ${e.message}`
      );
      nomeDaPastaParaExcluir = null;
    }

    await connection.query(
      "DELETE FROM processos_anexos WHERE processo_id = ?",
      [id]
    );
    await connection.query("DELETE FROM processos WHERE id = ?", [id]);

    if (nomeDaPastaParaExcluir) {
      const diretorioDoProcesso = path.join(
        __dirname,
        "../../upload_arquivos",
        nomeDaPastaParaExcluir
      );
      if (fs.existsSync(diretorioDoProcesso)) {
        try {
          await fsPromises.rm(diretorioDoProcesso, {
            recursive: true,
            force: true,
          });
        } catch (errPasta) {
          console.error(
            `Erro ao excluir pasta ${diretorioDoProcesso}:`,
            errPasta
          );
        }
      }
    }

    await connection.commit();
    await registrarAuditoria(
      user.matricula,
      "Exclusão de Serviço",
      `Serviço excluído - ID: ${id}, Processo: ${nomeProcessoOriginalParaAuditoria}`
    );
    res.json({
      success: true,
      message: "Serviço e seus anexos/pasta foram excluídos com sucesso",
    });
  } catch (error) {
    await connection.rollback();
    console.error("Erro ao excluir serviço:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao excluir serviço",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    if (connection) connection.release();
  }
});

router.post(
  "/api/servicos/:id/concluir",
  autenticar,
  upload.array("fotos_conclusao", 5),
  async (req, res) => {
    const { id: servicoId } = req.params;
    const connection = await promisePool.getConnection();
    let filePathsParaLimpeza = req.files ? req.files.map((f) => f.path) : [];

    try {
      await connection.beginTransaction();
      const {
        observacoes,
        dataConclusao,
        horaConclusao,
        status_final,
        motivo_nao_conclusao,
      } = req.body;
      const matricula = req.user?.matricula;

      if (!matricula) {
        limparArquivosTemporarios(req.files);
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: "Matrícula do responsável não encontrada",
        });
      }

      if (status_final !== "concluido" && status_final !== "nao_concluido") {
        limparArquivosTemporarios(req.files);
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: "Status final inválido fornecido.",
        });
      }

      const [servicoExistenteRows] = await connection.query(
        "SELECT id, processo FROM processos WHERE id = ?",
        [servicoId]
      );
      if (servicoExistenteRows.length === 0) {
        limparArquivosTemporarios(req.files);
        await connection.rollback();
        connection.release();
        return res
          .status(404)
          .json({ success: false, message: "Serviço não encontrado" });
      }
      const servicoExistente = servicoExistenteRows[0];
      let auditMessage = "";
      let dataHoraConclusaoParaSalvar = null;
      let observacoesParaSalvar = observacoes || null;
      let motivoNaoConclusaoParaSalvar = null;

      // Lógica unificada para dataConclusao e horaConclusao
      if (!dataConclusao || !horaConclusao) {
        limparArquivosTemporarios(req.files);
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: "Data e Hora de Conclusão são obrigatórias.",
        });
      }
      dataHoraConclusaoParaSalvar = `${dataConclusao} ${horaConclusao}:00`;

      if (status_final === "concluido") {
        auditMessage = `Serviço ${servicoId} (${servicoExistente.processo}) concluído em ${dataHoraConclusaoParaSalvar}`;
      } else {
        // status_final === "nao_concluido"
        if (!motivo_nao_conclusao || motivo_nao_conclusao.trim() === "") {
          limparArquivosTemporarios(req.files);
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            message: "Motivo da não conclusão é obrigatório.",
          });
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

      if (req.files && req.files.length > 0) {
        const nomeDaPastaParaAnexos =
          await determinarNomePastaParaServicoExistente(connection, servicoId);
        const diretorioDoProcesso = path.join(
          __dirname,
          "../../upload_arquivos",
          nomeDaPastaParaAnexos
        );
        if (!fs.existsSync(diretorioDoProcesso)) {
          fs.mkdirSync(diretorioDoProcesso, { recursive: true });
        }

        let processedFilePaths = [];
        for (const file of req.files) {
          const fileExt = path.extname(file.originalname).toLowerCase();
          const newFilename = `${
            status_final === "concluido"
              ? "conclusao"
              : "nao_conclusao_registro"
          }_${Date.now()}${fileExt}`;
          const novoPathCompleto = path.join(diretorioDoProcesso, newFilename);

          await fsPromises.rename(file.path, novoPathCompleto);
          processedFilePaths.push(file.path);

          const tipoAnexo =
            status_final === "concluido"
              ? "foto_conclusao"
              : "foto_nao_conclusao";
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
        }
        filePathsParaLimpeza = filePathsParaLimpeza.filter(
          (p) => !processedFilePaths.includes(p)
        );
      }

      await connection.commit();
      limparArquivosTemporarios(filePathsParaLimpeza);

      await registrarAuditoria(
        matricula,
        status_final === "concluido"
          ? "Conclusão de Serviço"
          : "Não Conclusão de Serviço",
        auditMessage
      );
      res.status(200).json({
        success: true,
        message: `Serviço marcado como ${
          status_final === "concluido" ? "Concluído" : "Não Concluído"
        } com sucesso`,
      });
    } catch (error) {
      await connection.rollback();
      limparArquivosTemporarios(req.files);
      console.error("Erro ao finalizar/não concluir serviço:", error);
      res.status(500).json({
        success: false,
        message: "Erro interno ao processar serviço",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : error.code === "WARN_DATA_TRUNCATED"
            ? "Tipo de anexo inválido."
            : undefined,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.patch("/api/servicos/:id/reativar", autenticar, async (req, res) => {
  const connection = await promisePool.getConnection();
  try {
    const [result] = await connection.query(
      'UPDATE processos SET status = "ativo", data_conclusao = NULL, observacoes_conclusao = NULL, motivo_nao_conclusao = NULL WHERE id = ?',
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Serviço não encontrado" });
    }
    await registrarAuditoria(
      req.user.matricula,
      "Reativação de Serviço",
      `Serviço ${req.params.id} retornado para ativo.`
    );
    res.json({ message: "Serviço reativado com sucesso" });
  } catch (error) {
    console.error("Erro ao reativar serviço:", error);
    res.status(500).json({ message: "Erro ao reativar serviço" });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/api/upload_arquivos/:identificador/:filename", (req, res) => {
  const { identificador, filename } = req.params;
  const filePath = path.join(
    __dirname,
    "../../upload_arquivos",
    identificador,
    filename
  );

  if (!fs.existsSync(filePath)) {
    return res
      .status(404)
      .json({ success: false, message: "Arquivo não encontrado" });
  }
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".pdf": "application/pdf",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
  };
  res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
  if (req.query.download === "true") {
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  }
  fs.createReadStream(filePath).pipe(res);
});

router.delete(
  "/api/servicos/:servicoId/anexos/:anexoId",
  autenticar,
  async (req, res) => {
    const { servicoId, anexoId } = req.params;
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();
      const [anexo] = await connection.query(
        `SELECT caminho_servidor, nome_original FROM processos_anexos WHERE id = ? AND processo_id = ?`,
        [anexoId, servicoId]
      );
      if (anexo.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: "Anexo não encontrado ou não pertence a este serviço",
        });
      }
      const caminhoRelativo = anexo[0].caminho_servidor.replace(
        "/api/upload_arquivos/",
        ""
      );
      const caminhoFisico = path.join(
        __dirname,
        "../../upload_arquivos",
        caminhoRelativo
      );
      if (fs.existsSync(caminhoFisico)) await fsPromises.unlink(caminhoFisico);
      await connection.query("DELETE FROM processos_anexos WHERE id = ?", [
        anexoId,
      ]);
      await connection.commit();
      await registrarAuditoria(
        req.user.matricula,
        "Remoção de Anexo",
        `Anexo ${anexo[0].nome_original} removido do Serviço ID: ${servicoId}`
      );
      res.json({ success: true, message: "Anexo removido com sucesso" });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao remover anexo:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao remover anexo",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.get("/api/servicos/contador", autenticar, async (req, res) => {
  const connection = await promisePool.getConnection();
  try {
    const { status } = req.query;
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
    const [result] = await connection.query(query, params);
    res.json({ total: result[0].total });
  } catch (error) {
    console.error("Erro ao contar serviços:", error);
    res.status(500).json({ message: "Erro ao contar serviços" });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/api/encarregados", autenticar, async (req, res) => {
  const connection = await promisePool.getConnection();
  try {
    const [rows] = await connection.query(
      "SELECT DISTINCT matricula, nome FROM users WHERE cargo IN ('Encarregado', 'Engenheiro', 'Técnico', 'ADM', 'ADMIN', 'Inspetor') ORDER BY nome"
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar encarregados:", err);
    res.status(500).json({ message: "Erro ao buscar encarregados!" });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/api/subestacoes", autenticar, async (req, res) => {
  const connection = await promisePool.getConnection();
  try {
    const [rows] = await connection.query(
      'SELECT DISTINCT subestacao as nome FROM processos WHERE subestacao IS NOT NULL AND subestacao != "" ORDER BY subestacao'
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar subestações:", err);
    res.status(500).json({ message: "Erro ao buscar subestações!" });
  } finally {
    if (connection) connection.release();
  }
});

router.patch("/api/servicos/:id/responsavel", autenticar, async (req, res) => {
  const { id } = req.params;
  const { responsavel_matricula } = req.body;
  if (!responsavel_matricula) {
    return res.status(400).json({
      success: false,
      message: "Matrícula do responsável é obrigatória.",
    });
  }
  const connection = await promisePool.getConnection();
  try {
    const [result] = await connection.query(
      "UPDATE processos SET responsavel_matricula = ? WHERE id = ?",
      [responsavel_matricula, id]
    );
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Serviço não encontrado." });
    }
    await registrarAuditoria(
      req.user.matricula,
      "Atribuição de Responsável",
      `Serviço ID ${id} atribuído a ${responsavel_matricula}`
    );
    res.json({ success: true, message: "Responsável atualizado com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar responsável:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao atualizar responsável",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    if (connection) connection.release();
  }
});

router.get(
  "/api/servicos/:servicoId/consolidar-pdfs",
  autenticar,
  async (req, res) => {
    const { servicoId } = req.params;
    if (isNaN(parseInt(servicoId))) {
      return res
        .status(400)
        .json({ success: false, message: "ID do Serviço inválido." });
    }

    const connection = await promisePool.getConnection();
    try {
      const [servico] = await connection.query(
        "SELECT processo FROM processos WHERE id = ?",
        [servicoId]
      );
      if (servico.length === 0) {
        connection.release();
        return res
          .status(404)
          .json({ success: false, message: "Serviço não encontrado." });
      }
      const nomeProcesso = servico[0].processo || `servico_${servicoId}`;

      const [anexos] = await connection.query(
        "SELECT caminho_servidor, nome_original FROM processos_anexos WHERE processo_id = ? AND (LOWER(nome_original) LIKE '%.pdf' OR LOWER(caminho_servidor) LIKE '%.pdf')",
        [servicoId]
      );

      if (anexos.length === 0) {
        connection.release();
        return res.status(404).json({
          success: false,
          message: "Nenhum anexo PDF encontrado para este serviço.",
        });
      }

      const mergedPdfDoc = await PDFDocument.create();
      let pdfsMergedCount = 0;

      for (const anexo of anexos) {
        const partesCaminho = anexo.caminho_servidor.split("/");
        const nomePasta = partesCaminho[partesCaminho.length - 2];
        const nomeArquivo = partesCaminho[partesCaminho.length - 1];
        const caminhoFisico = path.join(
          __dirname,
          "../../upload_arquivos",
          nomePasta,
          nomeArquivo
        );

        try {
          if (fs.existsSync(caminhoFisico)) {
            const pdfBytes = await fsPromises.readFile(caminhoFisico);
            const pdfDoc = await PDFDocument.load(pdfBytes, {
              ignoreEncryption: true,
            });
            const copiedPages = await mergedPdfDoc.copyPages(
              pdfDoc,
              pdfDoc.getPageIndices()
            );
            copiedPages.forEach((page) => mergedPdfDoc.addPage(page));
            pdfsMergedCount++;
          } else {
            console.warn(
              `Arquivo PDF não encontrado no caminho físico: ${caminhoFisico} para o anexo ${anexo.nome_original}`
            );
          }
        } catch (pdfError) {
          console.error(
            `Erro ao processar o PDF ${anexo.nome_original} (caminho: ${caminhoFisico}): ${pdfError.message}. Este arquivo será ignorado.`
          );
        }
      }

      if (pdfsMergedCount === 0) {
        connection.release();
        return res.status(404).json({
          success: false,
          message: "Nenhum PDF válido pôde ser processado ou encontrado.",
        });
      }

      const mergedPdfBytes = await mergedPdfDoc.save();

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="consolidado_${nomeProcesso.replace(
          /\//g,
          "-"
        )}_${servicoId}.pdf"`
      );
      res.send(Buffer.from(mergedPdfBytes));
    } catch (error) {
      console.error("Erro ao consolidar PDFs:", error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Erro interno ao consolidar PDFs.",
          error: error.message,
        });
      }
    } finally {
      if (connection) connection.release();
    }
  }
);

module.exports = router;
