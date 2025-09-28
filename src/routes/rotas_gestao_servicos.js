const express = require("express");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const { PDFDocument } = require("pdf-lib");
const playwright = require("playwright");
const { promisePool, upload } = require("../init");
const { autenticar, verificarNivel, registrarAuditoria } = require("../auth");

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

router.get("/gestao-servicos", autenticar, verificarNivel(2), (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/gestao_servico.html")
  );
});

router.get("/registro_servicos", autenticar, verificarNivel(4), (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/registro_servicos.html")
  );
});

router.get("/servicos_ativos", autenticar, verificarNivel(3), (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/servicos_ativos.html")
  );
});

router.get(
  "/servicos_concluidos",
  autenticar,
  verificarNivel(2),
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "../../public/pages/servicos/servicos_concluidos.html"
      )
    );
  }
);

router.get("/detalhes_servico", autenticar, verificarNivel(2), (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/detalhes_servico.html")
  );
});

router.get(
  "/servicos_atribuidos",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "../../public/pages/servicos/servicos_atribuidos.html"
      )
    );
  }
);

router.get("/editar_servico", autenticar, verificarNivel(4), (req, res) => {
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
  verificarNivel(4),
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

router.get("/api/servicos", autenticar, verificarNivel(2), async (req, res) => {
  try {
    const { status } = req.query;
    const userLevel = req.user.nivel;

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

router.get(
  "/api/servicos/:id",
  autenticar,
  verificarNivel(2),
  async (req, res) => {
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
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.put(
  "/api/servicos/:id",
  autenticar,
  verificarNivel(4),
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
  verificarNivel(3),
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

router.delete(
  "/api/servicos/:id",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();
      const { id } = req.params;
      const user = req.user;

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
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.post(
  "/api/servicos/:id/concluir",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { id: servicoId } = req.params;
    const connection = await promisePool.getConnection();

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
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: "Matrícula do responsável não encontrada",
        });
      }

      if (status_final !== "concluido" && status_final !== "nao_concluido") {
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

      if (!dataConclusao || !horaConclusao) {
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
        if (!motivo_nao_conclusao || motivo_nao_conclusao.trim() === "") {
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

      await connection.commit();

      await registrarAuditoria(
        matricula,
        status_final === "concluido"
          ? "Conclusão de Serviço"
          : "Não Conclusão de Serviço",
        auditMessage
      );
      res.status(200).json({
        success: true,
        message: `Informações do serviço marcadas como ${
          status_final === "concluido" ? "Concluído" : "Não Concluído"
        } com sucesso.`,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao finalizar/não concluir serviço (info):", error);
      res.status(500).json({
        success: false,
        message: "Erro interno ao processar informações do serviço",
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

router.post(
  "/api/servicos/:servicoId/upload-foto-conclusao",
  autenticar,
  verificarNivel(3),
  upload.single("foto_conclusao"),
  async (req, res) => {
    const { servicoId } = req.params;
    const { status_final } = req.body;
    const connection = await promisePool.getConnection();

    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "Nenhum arquivo enviado." });
      }

      await connection.beginTransaction();

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

      res.status(201).json({
        success: true,
        message: `Arquivo ${file.originalname} enviado com sucesso.`,
      });
    } catch (error) {
      await connection.rollback();
      limparArquivosTemporarios(req.file);
      console.error("Erro ao fazer upload de foto de conclusão:", error);
      res.status(500).json({
        success: false,
        message: "Erro interno ao processar o upload do arquivo.",
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.patch(
  "/api/servicos/:id/reativar",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
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
  }
);

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
  verificarNivel(4),
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

router.get(
  "/api/servicos/contador",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
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
  }
);

router.get(
  "/api/encarregados",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
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
  }
);

router.get(
  "/api/subestacoes",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
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
  }
);

router.patch(
  "/api/servicos/:id/responsavel",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
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
      res.json({
        success: true,
        message: "Responsável atualizado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao atualizar responsável:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao atualizar responsável",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

async function processarImagensParaBase64(imagens, basePath) {
  const imagensProcessadas = await Promise.all(
    imagens.map(async (img) => {
      if (!img.caminho) return null;
      const caminhoRelativo = img.caminho.replace("/api/upload_arquivos/", "");
      const caminhoFisico = path.join(
        basePath,
        "../../upload_arquivos",
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
    __dirname,
    "../../public/pages/templates/relatorio_servico.html"
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
    imagensRegistro,
    __dirname
  );
  const imagensFinalizacaoBase64 = await processarImagensParaBase64(
    imagensFinalizacao,
    __dirname
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

router.get(
  "/api/servicos/:id/consolidar-pdfs",
  autenticar,
  verificarNivel(2),
  async (req, res) => {
    const { id: servicoId } = req.params;
    const connection = await promisePool.getConnection();
    let browser;

    try {
      const [servicoRows] = await connection.query(
        `SELECT p.*, u.nome as responsavel_nome FROM processos p LEFT JOIN users u ON p.responsavel_matricula = u.matricula WHERE p.id = ?`,
        [servicoId]
      );
      if (servicoRows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Serviço não encontrado" });
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
            __dirname,
            "../../upload_arquivos",
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

        const nomeArquivo = `relatorio_servico_${(
          servicoData.processo || servicoId
        ).replace(/\//g, "-")}.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${nomeArquivo}"`
        );
        return res.send(Buffer.from(finalPdfBytes));
      }

      const nomeArquivo = `relatorio_servico_${(
        servicoData.processo || servicoId
      ).replace(/\//g, "-")}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${nomeArquivo}"`
      );
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Erro ao gerar relatório PDF:", error);
      if (browser) await browser.close();
      res.status(500).json({
        success: false,
        message: "Erro interno ao gerar o relatório PDF.",
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

module.exports = router;
