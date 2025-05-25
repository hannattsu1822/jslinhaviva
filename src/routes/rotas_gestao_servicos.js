const express = require("express");
const path = require("path");
const fs = require("fs");
const { promisePool, upload } = require("../init");
const {
  autenticar,
  verificarPermissaoPorCargo,
  registrarAuditoria,
} = require("../auth");

const { chromium } = require("playwright");
const definicoesAPR = require("../shared/apr_definitions.js");

const router = express.Router();

function limparArquivosTemporarios(files) {
  if (files) {
    files.forEach((file) => {
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
      } = req.body;

      if (!data_prevista_execucao || !subestacao || !desligamento) {
        limparArquivosTemporarios(req.files);
        return res.status(400).json({
          success: false,
          message:
            "Campos obrigatórios faltando: data_prevista_execucao, subestacao ou desligamento",
        });
      }
      if (desligamento === "SIM" && (!hora_inicio || !hora_fim)) {
        limparArquivosTemporarios(req.files);
        return res.status(400).json({
          success: false,
          message:
            "Para desligamentos, hora_inicio e hora_fim são obrigatórios",
        });
      }

      let processoFinal;
      let insertedId;

      if (tipo_processo === "Emergencial") {
        const [result] = await connection.query(
          `INSERT INTO processos (tipo, data_prevista_execucao, desligamento, hora_inicio, hora_fim, subestacao, alimentador, chave_montante, responsavel_matricula, maps, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo')`,
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
          ]
        );
        insertedId = result.insertId;
        processoFinal = `EMERGENCIAL-${insertedId}`;
        await connection.query(
          "UPDATE processos SET processo = ? WHERE id = ?",
          [processoFinal, insertedId]
        );
      } else {
        if (
          !processo ||
          typeof processo !== "string" ||
          processo.trim() === ""
        ) {
          limparArquivosTemporarios(req.files);
          return res.status(400).json({
            success: false,
            message:
              "Para serviços normais, o número do processo é obrigatório",
          });
        }
        processoFinal = processo.trim();
        const [result] = await connection.query(
          `INSERT INTO processos (processo, tipo, data_prevista_execucao, desligamento, hora_inicio, hora_fim, subestacao, alimentador, chave_montante, responsavel_matricula, maps, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo')`,
          [
            processoFinal,
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
          ]
        );
        insertedId = result.insertId;
      }

      const anexosInfo = [];
      if (req.files && req.files.length > 0) {
        const processoDir = path.join(
          __dirname,
          "../../upload_arquivos",
          processoFinal.replace(/\//g, "-")
        );
        if (!fs.existsSync(processoDir))
          fs.mkdirSync(processoDir, { recursive: true });

        for (const file of req.files) {
          const extensao = path.extname(file.originalname).toLowerCase();
          const novoNome = `anexo_${Date.now()}${extensao}`;
          const novoPath = path.join(processoDir, novoNome);

          await fs.promises.rename(file.path, novoPath);

          const tipoAnexo = [".jpg", ".jpeg", ".png"].includes(extensao)
            ? "imagem"
            : "documento";

          await connection.query(
            `INSERT INTO processos_anexos (processo_id, nome_original, caminho_servidor, tamanho, tipo_anexo) VALUES (?, ?, ?, ?, ?)`,
            [
              insertedId,
              file.originalname,
              `/api/upload_arquivos/${processoFinal.replace(
                /\//g,
                "-"
              )}/${novoNome}`,
              file.size,
              tipoAnexo,
            ]
          );
          anexosInfo.push({
            nomeOriginal: file.originalname,
            caminho: `/api/upload_arquivos/${processoFinal.replace(
              /\//g,
              "-"
            )}/${novoNome}`,
          });
        }
      }
      await connection.commit();
      if (req.user?.matricula)
        await registrarAuditoria(
          req.user.matricula,
          "Registro de Serviço",
          `Serviço ${tipo_processo} registrado: ${processoFinal}`
        );
      res.status(201).json({
        success: true,
        processo: processoFinal,
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
      connection.release();
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
                p.observacoes_conclusao, u.nome as responsavel_nome,
                CASE 
                    WHEN p.tipo = 'Emergencial' THEN 'Emergencial'
                    ELSE 'Normal'
                END as tipo_processo,
                EXISTS(SELECT 1 FROM apr_cabecalho ac WHERE ac.processo_fk_id = p.id) AS tem_apr
            FROM processos p
            LEFT JOIN users u ON p.responsavel_matricula = u.matricula
        `;
    const params = [];
    if (status) {
      query += " WHERE p.status = ?";
      params.push(status);
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
      `
            SELECT 
                p.id, p.processo, p.tipo, p.data_prevista_execucao, p.data_conclusao, 
                p.desligamento, p.hora_inicio, p.hora_fim, p.subestacao, 
                p.alimentador, p.chave_montante, p.responsavel_matricula, 
                p.maps, p.status, p.observacoes_conclusao, 
                u.nome as responsavel_nome
            FROM processos p
            LEFT JOIN users u ON p.responsavel_matricula = u.matricula
            WHERE p.id = ?
        `,
      [id]
    );

    if (servicoRows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Serviço não encontrado" });
    }

    const [anexos] = await connection.query(
      `
            SELECT id, nome_original as nomeOriginal, caminho_servidor as caminho, 
                   tamanho, tipo_anexo as tipo, 
                   DATE_FORMAT(data_upload, '%d/%m/%Y %H:%i') as dataUpload 
            FROM processos_anexos 
            WHERE processo_id = ? 
            ORDER BY data_upload DESC
        `,
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
    connection.release();
  }
});

router.put(
  "/api/servicos/:id",
  autenticar,
  upload.array("anexos", 5),
  async (req, res) => {
    const { id } = req.params;
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();
      const {
        subestacao,
        alimentador,
        chave_montante,
        desligamento,
        hora_inicio,
        hora_fim,
        maps,
        responsavel_matricula,
      } = req.body;

      if (!subestacao) {
        limparArquivosTemporarios(req.files);
        await connection.rollback();
        return res
          .status(400)
          .json({ success: false, message: "Subestação é obrigatória" });
      }
      if (desligamento === "SIM" && (!hora_inicio || !hora_fim)) {
        limparArquivosTemporarios(req.files);
        await connection.rollback();
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
        return res.status(400).json({
          success: false,
          message: "Por favor, insira um link válido do Google Maps",
        });
      }

      await connection.query(
        `UPDATE processos SET subestacao = ?, alimentador = ?, chave_montante = ?, desligamento = ?, 
             hora_inicio = ?, hora_fim = ?, maps = ?, responsavel_matricula = ? WHERE id = ?`,
        [
          subestacao,
          alimentador || null,
          chave_montante || null,
          desligamento,
          desligamento === "SIM" ? hora_inicio : null,
          desligamento === "SIM" ? hora_fim : null,
          maps || null,
          responsavel_matricula || "pendente",
          id,
        ]
      );

      if (req.files && req.files.length > 0) {
        const [processoRow] = await connection.query(
          "SELECT processo FROM processos WHERE id = ?",
          [id]
        );
        if (processoRow.length === 0) {
          limparArquivosTemporarios(req.files);
          await connection.rollback();
          return res.status(404).json({
            success: false,
            message: "Processo não encontrado para adicionar anexos.",
          });
        }
        const processoNome = processoRow[0].processo.replace(/\//g, "-");
        const uploadDir = path.join(
          __dirname,
          "../../upload_arquivos",
          processoNome
        );
        if (!fs.existsSync(uploadDir))
          fs.mkdirSync(uploadDir, { recursive: true });

        for (const file of req.files) {
          const extensao = path.extname(file.originalname).toLowerCase();
          const novoNome = `anexo_edit_${Date.now()}${extensao}`;
          const novoPath = path.join(uploadDir, novoNome);
          await fs.promises.rename(file.path, novoPath);
          const tipoAnexo = [".jpg", ".jpeg", ".png"].includes(extensao)
            ? "imagem"
            : "documento";
          await connection.query(
            `INSERT INTO processos_anexos (processo_id, nome_original, caminho_servidor, tamanho, tipo_anexo) VALUES (?, ?, ?, ?, ?)`,
            [
              id,
              file.originalname,
              `/api/upload_arquivos/${processoNome}/${novoNome}`,
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
        `Serviço ${id} editado`
      );
      res.json({
        success: true,
        message: "Serviço atualizado com sucesso!",
        redirect: "/servicos_ativos",
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
      connection.release();
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
      return res
        .status(403)
        .json({ success: false, message: "Acesso negado para exclusão." });
    }
    const [servico] = await connection.query(
      "SELECT processo FROM processos WHERE id = ?",
      [id]
    );
    if (servico.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Serviço não encontrado" });
    }
    await connection.query(
      "DELETE FROM processos_anexos WHERE processo_id = ?",
      [id]
    );
    await connection.query("DELETE FROM processos WHERE id = ?", [id]);
    await connection.commit();
    await registrarAuditoria(
      user.matricula,
      "Exclusão de Serviço",
      `Serviço excluído - ID: ${id}, Processo: ${servico[0].processo}`
    );
    res.json({ success: true, message: "Serviço excluído com sucesso" });
  } catch (error) {
    await connection.rollback();
    console.error("Erro ao excluir serviço:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao excluir serviço",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    connection.release();
  }
});

router.post(
  "/api/servicos/:id/concluir",
  autenticar,
  upload.array("fotos_conclusao", 5),
  async (req, res) => {
    const { id: requestId } = req.params;
    const connection = await promisePool.getConnection();
    let filePaths = [];
    try {
      await connection.beginTransaction();

      const { observacoes, dataConclusao, horaConclusao } = req.body;
      const matricula = req.user?.matricula;

      if (!matricula) {
        limparArquivosTemporarios(req.files);
        return res.status(400).json({
          success: false,
          message: "Matrícula do responsável não encontrada",
        });
      }
      if (!dataConclusao || !horaConclusao) {
        limparArquivosTemporarios(req.files);
        return res.status(400).json({
          success: false,
          message: "Data e Hora de Conclusão são obrigatórias.",
        });
      }
      const dataHoraConclusao = `${dataConclusao} ${horaConclusao}:00`;

      const [servicoExistente] = await connection.query(
        "SELECT id, processo FROM processos WHERE id = ?",
        [requestId]
      );
      if (servicoExistente.length === 0) {
        limparArquivosTemporarios(req.files);
        return res
          .status(404)
          .json({ success: false, message: "Serviço não encontrado" });
      }

      const [result] = await connection.query(
        `UPDATE processos SET status = 'concluido', data_conclusao = ?, observacoes_conclusao = ?, responsavel_matricula = ? WHERE id = ?`,
        [dataHoraConclusao, observacoes || null, matricula, requestId]
      );

      if (result.affectedRows === 0) {
        throw new Error("Nenhum serviço foi atualizado");
      }

      if (req.files && req.files.length > 0) {
        const processoDir = path.join(
          __dirname,
          "../../upload_arquivos",
          servicoExistente[0].processo.replace(/\//g, "-")
        );
        if (!fs.existsSync(processoDir)) {
          fs.mkdirSync(processoDir, { recursive: true });
        }

        for (const file of req.files) {
          const fileExt = path.extname(file.originalname).toLowerCase();
          const newFilename = `conclusao_${Date.now()}${fileExt}`;
          const newPath = path.join(processoDir, newFilename);

          await fs.promises.rename(file.path, newPath);
          filePaths.push(newPath);

          const isImage = [".jpg", ".jpeg", ".png"].includes(fileExt);
          const tipoAnexo = isImage ? "foto_conclusao" : "documento";

          await connection.query(
            `INSERT INTO processos_anexos (processo_id, nome_original, caminho_servidor, tipo_anexo, tamanho) VALUES (?, ?, ?, ?, ?)`,
            [
              requestId,
              file.originalname,
              `/api/upload_arquivos/${servicoExistente[0].processo.replace(
                /\//g,
                "-"
              )}/${newFilename}`,
              tipoAnexo,
              file.size,
            ]
          );
        }
      }
      await connection.commit();
      await registrarAuditoria(
        matricula,
        "Conclusão de Serviço",
        `Serviço ${requestId} (${servicoExistente[0].processo}) concluído em ${dataHoraConclusao}`
      );
      res.status(200).json({
        success: true,
        message: "Serviço concluído com sucesso",
        data_conclusao: dataHoraConclusao,
        fotos: req.files?.length || 0,
      });
    } catch (error) {
      await connection.rollback();
      filePaths.forEach((filePath) => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (e) {
          console.error(`Erro ao limpar arquivo ${filePath} após falha:`, e);
        }
      });
      limparArquivosTemporarios(req.files);
      res.status(500).json({
        success: false,
        message: "Erro interno ao concluir serviço",
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
  try {
    const [result] = await promisePool.query(
      'UPDATE processos SET status = "ativo", data_conclusao = NULL, observacoes_conclusao = NULL WHERE id = ?',
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
  }
});

router.get("/api/upload_arquivos/:processo/:filename", (req, res) => {
  const { processo, filename } = req.params;
  const filePath = path.join(
    __dirname,
    "../../upload_arquivos",
    processo.replace(/\//g, "-"),
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
      if (fs.existsSync(caminhoFisico)) fs.unlinkSync(caminhoFisico);
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
      connection.release();
    }
  }
);

router.get("/api/servicos/contador", autenticar, async (req, res) => {
  try {
    const { status } = req.query;
    let query = "SELECT COUNT(*) as total FROM processos";
    const params = [];
    if (status) {
      query += " WHERE status = ?";
      params.push(status);
    }
    const [result] = await promisePool.query(query, params);
    res.json({ total: result[0].total });
  } catch (error) {
    console.error("Erro ao contar serviços:", error);
    res.status(500).json({ message: "Erro ao contar serviços" });
  }
});

router.get("/api/encarregados", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT DISTINCT matricula, nome FROM users WHERE cargo IN ('Encarregado', 'Gerente', 'ADMIN', 'Engenheiro', 'Técnico') ORDER BY nome"
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar encarregados:", err);
    res.status(500).json({ message: "Erro ao buscar encarregados!" });
  }
});

router.get("/api/subestacoes", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      'SELECT DISTINCT subestacao as nome FROM processos WHERE subestacao IS NOT NULL AND subestacao != "" ORDER BY subestacao'
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar subestações:", err);
    res.status(500).json({ message: "Erro ao buscar subestações!" });
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
  try {
    const [result] = await promisePool.query(
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
  }
});

router.get("/apr-servico-form", autenticar, (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/apr_formulario.html")
  );
});

router.get("/api/encarregados-turma", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT DISTINCT u.matricula, u.nome FROM users u WHERE u.cargo = 'Encarregado' ORDER BY u.nome ASC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar encarregados de turma:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Erro ao buscar encarregados de turma",
      });
  }
});

router.get(
  "/api/turmas/:matriculaEncarregado/funcionarios",
  autenticar,
  async (req, res) => {
    const { matriculaEncarregado } = req.params;
    try {
      const [rows] = await promisePool.query(
        "SELECT matricula, nome, cargo FROM turmas WHERE turma_encarregado = ? ORDER BY nome ASC",
        [matriculaEncarregado]
      );
      res.json(rows);
    } catch (error) {
      console.error("Erro ao buscar funcionários da turma:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Erro ao buscar funcionários da turma",
        });
    }
  }
);

router.get(
  "/api/usuarios-para-responsavel-apr",
  autenticar,
  async (req, res) => {
    try {
      const cargosPermitidos = [
        "Técnico",
        "Engenheiro",
        "ADM",
        "ADMIN",
        "Gerente",
      ];
      const placeholders = cargosPermitidos.map(() => "?").join(",");
      const [rows] = await promisePool.query(
        `SELECT matricula, nome, cargo FROM users WHERE cargo IN (${placeholders}) ORDER BY nome ASC`,
        cargosPermitidos
      );
      res.json(rows);
    } catch (error) {
      console.error("Erro ao buscar usuários para responsável APR:", error);
      res
        .status(500)
        .json({ success: false, message: "Erro ao buscar usuários" });
    }
  }
);

router.get("/api/apr-lista-servicos", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT COD, `DESCRIÇÃO` as descricao, UND FROM apr_services ORDER BY COD"
    );
    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar lista de serviços APR:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Erro ao buscar lista de serviços APR",
      });
  }
});

router.get("/api/apr-lista-materiais", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT COD, `DESCRIÇÃO` as descricao FROM apr_materials ORDER BY COD"
    );
    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar lista de materiais APR:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Erro ao buscar lista de materiais APR",
      });
  }
});

router.get(
  "/api/servicos/:servicoId/apr-dados",
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
      const [cabecalhoRows] = await connection.query(
        "SELECT * FROM apr_cabecalho WHERE processo_fk_id = ? ORDER BY data_modificacao DESC LIMIT 1",
        [servicoId]
      );

      if (cabecalhoRows.length === 0) {
        return res
          .status(200)
          .json({
            success: false,
            message: "Nenhuma APR encontrada para este serviço.",
          });
      }
      const cabecalho = cabecalhoRows[0];
      const aprId = cabecalho.id;

      const [empregadosRows] = await connection.query(
        "SELECT empregado_matricula, empregado_nome FROM apr_empregados_participantes WHERE apr_id = ?",
        [aprId]
      );
      const [medidasRows] = await connection.query(
        "SELECT medida_chave FROM apr_medidas_controle_aplicadas WHERE apr_id = ?",
        [aprId]
      );
      const [atividadesRows] = await connection.query(
        "SELECT descricao, codigo_bd, quantidade, unidade FROM apr_atividades_executadas WHERE apr_id = ?",
        [aprId]
      );
      const [materiaisRows] = await connection.query(
        "SELECT descricao, codigo_bd, quantidade FROM apr_materiais_utilizados WHERE apr_id = ?",
        [aprId]
      );

      const dadosAprCompletos = {
        ...cabecalho,
        apr_empregados_lista: empregadosRows,
        apr_medidas_controle_selecionadas: medidasRows.map(
          (m) => m.medida_chave
        ),
        apr_atividades_executadas_lista: atividadesRows,
        apr_materiais_utilizados_lista: materiaisRows,
      };

      res.json({ success: true, data: dadosAprCompletos });
    } catch (error) {
      console.error("Erro ao buscar dados da APR:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Erro interno ao buscar dados da APR.",
        });
    } finally {
      connection.release();
    }
  }
);

router.post(
  "/api/servicos/:servicoId/apr-dados",
  autenticar,
  async (req, res) => {
    const { servicoId } = req.params;
    const dadosForm = req.body;
    const userId = req.user.id;
    const userMatricula = req.user.matricula;

    if (isNaN(parseInt(servicoId))) {
      return res
        .status(400)
        .json({ success: false, message: "ID do Serviço inválido." });
    }

    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();

      const {
        apr_data,
        turma_encarregado_matricula,
        responsavel_apr_matricula,
        apr_local_real_servico,
        km_saida,
        km_chegada,
        alimentador_apr,
        subestacao_apr,
        chave_montante_apr,
        hora_receb_cod,
        operador_cod_receb,
        hora_devol_cod,
        operador_cod_devol,
        apr_horas_paradas_das,
        apr_horas_paradas_as,
        apr_motivo_parada,
        apr_motivo_parada_outros_text,
        apr_motivo_parada_outros_check,
        apr_natureza_servico,
        arc_riscos_identificados,
        arc_observacoes,
        comentarios_gerais,
        processo_numero_original_servico,
        apr_empregados_lista = [],
        apr_atividades_executadas_lista = [],
        apr_materiais_utilizados_lista = [],
        ...demaisCampos
      } = dadosForm;

      let paradaMotivosString = null;
      if (Array.isArray(apr_motivo_parada)) {
        paradaMotivosString = apr_motivo_parada.join(", ");
      } else if (typeof apr_motivo_parada === "string" && apr_motivo_parada) {
        paradaMotivosString = apr_motivo_parada;
      }
      if (apr_motivo_parada_outros_check && apr_motivo_parada_outros_text) {
        paradaMotivosString =
          (paradaMotivosString ? paradaMotivosString + ", " : "") +
          `Outros: ${apr_motivo_parada_outros_text}`;
      }

      const cabecalhoData = {
        processo_fk_id: parseInt(servicoId),
        processo_numero_informado: processo_numero_original_servico || null,
        turma_encarregado_matricula: turma_encarregado_matricula || null,
        responsavel_apr_matricula: responsavel_apr_matricula,
        data_apr: apr_data,
        local_servico: apr_local_real_servico,
        km_saida: km_saida || null,
        km_chegada: km_chegada || null,
        alimentador: alimentador_apr,
        subestacao: subestacao_apr,
        chave_montante: chave_montante_apr,
        hora_receb_cod: hora_receb_cod || null,
        operador_cod_receb: operador_cod_receb,
        hora_devol_cod: hora_devol_cod || null,
        operador_cod_devol: operador_cod_devol,
        parada_inicio: apr_horas_paradas_das || null,
        parada_fim: apr_horas_paradas_as || null,
        parada_motivos: paradaMotivosString,
        natureza_servico: apr_natureza_servico,
        riscos_gerais: arc_riscos_identificados,
        arc_obs: arc_observacoes,
        arc_informados: demaisCampos["arc_informados"],
        arc_capacitados: demaisCampos["arc_capacitados"],
        arc_bem_fisica_mental: demaisCampos["arc_bem_fisica_mental"],
        arc_participaram_planejamento:
          demaisCampos["arc_participaram_planejamento"],
        arc_possui_epis: demaisCampos["arc_possui_epis"],
        arc_epis_condicoes: demaisCampos["arc_epis_condicoes"],
        arc_possui_epcs: demaisCampos["arc_possui_epcs"],
        arc_epcs_condicoes: demaisCampos["arc_epcs_condicoes"],
        arc_autorizacao_cod: demaisCampos["arc_autorizacao_cod"],
        arc_comunicacao_cod: demaisCampos["arc_comunicacao_cod"],
        arc_viatura_condicoes: demaisCampos["arc_viatura_condicoes"],
        arc_sinalizacao_area: demaisCampos["arc_sinalizacao_area"],
        arc_desligamento_equipamentos:
          demaisCampos["arc_desligamento_equipamentos"],
        arc_teste_tensao: demaisCampos["arc_teste_tensao"],
        arc_aterramento_temporario: demaisCampos["arc_aterramento_temporario"],
        arc_teste_pontalete: demaisCampos["arc_teste_pontalete"],
        arc_iluminacao_auxiliar: demaisCampos["arc_iluminacao_auxiliar"],
        arc_uso_escadas: demaisCampos["arc_uso_escadas"],
        riscos_especificos_texto:
          demaisCampos.risco_outros_check &&
          demaisCampos.riscos_especificos_texto
            ? demaisCampos.riscos_especificos_texto
            : null,
        comentarios_gerais: comentarios_gerais,
        user_id_criacao: userId,
      };

      const [existingApr] = await connection.query(
        "SELECT id FROM apr_cabecalho WHERE processo_fk_id = ?",
        [servicoId]
      );

      let aprId;
      let acao = "";

      if (existingApr.length > 0) {
        aprId = existingApr[0].id;
        await connection.query("UPDATE apr_cabecalho SET ? WHERE id = ?", [
          cabecalhoData,
          aprId,
        ]);
        acao = "Atualização de APR";

        await connection.query(
          "DELETE FROM apr_empregados_participantes WHERE apr_id = ?",
          [aprId]
        );
        await connection.query(
          "DELETE FROM apr_medidas_controle_aplicadas WHERE apr_id = ?",
          [aprId]
        );
        await connection.query(
          "DELETE FROM apr_atividades_executadas WHERE apr_id = ?",
          [aprId]
        );
        await connection.query(
          "DELETE FROM apr_materiais_utilizados WHERE apr_id = ?",
          [aprId]
        );
      } else {
        const [result] = await connection.query(
          "INSERT INTO apr_cabecalho SET ?",
          cabecalhoData
        );
        aprId = result.insertId;
        acao = "Criação de APR";
      }

      if (apr_empregados_lista && apr_empregados_lista.length > 0) {
        for (const emp of apr_empregados_lista) {
          if (emp.matricula || emp.nome) {
            await connection.query(
              "INSERT INTO apr_empregados_participantes (apr_id, empregado_matricula, empregado_nome) VALUES (?, ?, ?)",
              [aprId, emp.matricula || "N/A", emp.nome || "N/A"]
            );
          }
        }
      }

      const chavesMedidasRiscosParaSalvar = [];
      for (const key in demaisCampos) {
        if (
          demaisCampos.hasOwnProperty(key) &&
          (demaisCampos[key] === true || demaisCampos[key] === "true")
        ) {
          if (
            key.startsWith("medida_") ||
            (key.startsWith("risco_") && key !== "risco_outros_check")
          ) {
            chavesMedidasRiscosParaSalvar.push(key);
          }
        }
      }
      if (
        demaisCampos.risco_outros_check === true &&
        cabecalhoData.riscos_especificos_texto &&
        cabecalhoData.riscos_especificos_texto.trim() !== ""
      ) {
        chavesMedidasRiscosParaSalvar.push("risco_outros_detalhado");
      }

      for (const medidaChave of chavesMedidasRiscosParaSalvar) {
        await connection.query(
          "INSERT INTO apr_medidas_controle_aplicadas (apr_id, medida_chave) VALUES (?, ?)",
          [aprId, medidaChave.substring(0, 100)]
        );
      }

      if (
        apr_atividades_executadas_lista &&
        apr_atividades_executadas_lista.length > 0
      ) {
        for (const atividade of apr_atividades_executadas_lista) {
          if (atividade.descricao) {
            await connection.query(
              "INSERT INTO apr_atividades_executadas (apr_id, descricao, codigo_bd, quantidade, unidade) VALUES (?, ?, ?, ?, ?)",
              [
                aprId,
                atividade.descricao,
                atividade.codigo || null,
                atividade.quantidade || null,
                atividade.unidade || null,
              ]
            );
          }
        }
      }

      if (
        apr_materiais_utilizados_lista &&
        apr_materiais_utilizados_lista.length > 0
      ) {
        for (const material of apr_materiais_utilizados_lista) {
          if (material.descricao) {
            await connection.query(
              "INSERT INTO apr_materiais_utilizados (apr_id, descricao, codigo_bd, quantidade) VALUES (?, ?, ?, ?)",
              [
                aprId,
                material.descricao,
                material.codigo || null,
                material.quantidade || null,
              ]
            );
          }
        }
      }

      await connection.commit();
      await registrarAuditoria(
        userMatricula,
        acao,
        `APR ID: ${aprId} para o Serviço ID: ${servicoId}`
      );
      res
        .status(201)
        .json({
          success: true,
          message: "APR salva com sucesso!",
          aprId: aprId,
        });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao salvar APR:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Erro interno ao salvar APR: " + error.message,
        });
    } finally {
      connection.release();
    }
  }
);

router.get("/api/servicos/:servicoId/apr/pdf", autenticar, async (req, res) => {
  const { servicoId } = req.params;
  if (isNaN(parseInt(servicoId))) {
    return res
      .status(400)
      .json({ success: false, message: "ID do Serviço inválido." });
  }

  let browser = null;
  const connection = await promisePool.getConnection();
  try {
    const [servicoBaseRows] = await connection.query(
      "SELECT * FROM processos WHERE id = ?",
      [servicoId]
    );
    if (servicoBaseRows.length === 0) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Serviço base não encontrado para gerar PDF da APR.",
        });
    }
    const servicoBase = servicoBaseRows[0];

    const [cabecalhoRows] = await connection.query(
      "SELECT apr_c.*, u_resp.nome as nome_responsavel_apr, u_enc.nome as nome_turma_encarregado FROM apr_cabecalho apr_c LEFT JOIN users u_resp ON apr_c.responsavel_apr_matricula = u_resp.matricula LEFT JOIN users u_enc ON apr_c.turma_encarregado_matricula = u_enc.matricula WHERE apr_c.processo_fk_id = ? ORDER BY apr_c.data_modificacao DESC LIMIT 1",
      [servicoId]
    );

    if (cabecalhoRows.length === 0) {
      return res
        .status(404)
        .json({
          success: false,
          message:
            "Nenhuma APR preenchida encontrada para este serviço para gerar PDF.",
        });
    }
    const cabecalho = cabecalhoRows[0];
    const aprId = cabecalho.id;

    const [empregadosRows] = await connection.query(
      "SELECT empregado_matricula, empregado_nome FROM apr_empregados_participantes WHERE apr_id = ? ORDER BY empregado_nome",
      [aprId]
    );
    const [medidasRows] = await connection.query(
      "SELECT medida_chave FROM apr_medidas_controle_aplicadas WHERE apr_id = ?",
      [aprId]
    );
    const [atividadesRows] = await connection.query(
      "SELECT descricao, codigo_bd, quantidade, unidade FROM apr_atividades_executadas WHERE apr_id = ?",
      [aprId]
    );
    const [materiaisRows] = await connection.query(
      "SELECT descricao, codigo_bd, quantidade FROM apr_materiais_utilizados WHERE apr_id = ?",
      [aprId]
    );

    const htmlParaPdf = await construirHTMLParaAPR(
      servicoBase,
      cabecalho,
      empregadosRows,
      medidasRows.map((m) => m.medida_chave),
      atividadesRows,
      materiaisRows,
      definicoesAPR,
      req
    );

    browser = await chromium.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
    const page = await browser.newPage();

    await page.setContent(htmlParaPdf, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "25mm", right: "10mm", bottom: "25mm", left: "10mm" },
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-family: Arial, sans-serif; font-size: 9px; color: #555; width: 100%; text-align: center; padding-top: 10mm;">APR - Serviço ${
        servicoBase.processo || servicoId
      }</div>`,
      footerTemplate: `<div style="font-family: Arial, sans-serif; font-size: 9px; color: #555; width: 100%; text-align: center; padding-bottom: 10mm;">Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>`,
      timeout: 60000,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="APR_Servico_${
        servicoBase.processo || servicoId
      }.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Erro ao gerar PDF da APR:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({
          success: false,
          message: "Erro interno ao gerar PDF da APR: " + error.message,
        });
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    if (connection) {
      connection.release();
    }
  }
});

async function construirHTMLParaAPR(
  servicoBase,
  cabecalho,
  participantes,
  medidasAplicadasChaves,
  atividades,
  materiais,
  defAPR,
  req
) {
  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return String(dateStr);
      return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
    } catch (e) {
      return String(dateStr);
    }
  };
  const formatTime = (timeStr) => {
    if (!timeStr || typeof timeStr !== "string") return "N/A";
    return String(timeStr).substring(0, 5);
  };
  const escapeHtml = (unsafe) => {
    if (unsafe === null || typeof unsafe === "undefined") return "";
    return String(unsafe).replace(/[&<"']/g, function (m) {
      switch (m) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case '"':
          return "&quot;";
        default:
          return "&#039;";
      }
    });
  };

  const logoPath = path.join(
    req.app.get("publicDir") || path.join(__dirname, "../../public"),
    "img/logo_azul.png"
  );
  let logoBase64 = "";
  if (fs.existsSync(logoPath)) {
    logoBase64 = fs.readFileSync(logoPath, "base64");
  }

  let html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>APR - Serviço ${escapeHtml(
              servicoBase.processo || servicoBase.id
            )}</title>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 9pt; margin: 0; padding: 0; color: #333; line-height: 1.4; }
                .page-container { padding: 0mm; width: 100%; margin:auto; }
                .header-pdf { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #4a90e2; padding-bottom:10px;}
                .header-pdf img { max-height: 45px; margin-bottom: 8px; }
                .header-pdf h2 { font-size: 18px; margin: 5px 0; color: #2a5298; font-weight: bold;}
                .section { margin-bottom: 12px; border: 1px solid #dee2e6; padding: 10px; border-radius: 5px; background-color: #fff; }
                .section-title { font-weight: bold; font-size: 12px; margin-bottom: 8px; background-color: #f0f4f8; padding: 6px 10px; border-left: 4px solid #4a90e2; color: #1e3c72; border-radius: 3px 3px 0 0; margin: -10px -10px 8px -10px; }
                table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top:8px; margin-bottom:10px; font-size:8.5px; }
                th, td { border: 1px solid #ddd; padding: 5px; text-align: left; vertical-align: top; }
                th { background-color: #f8f9fa; font-weight:bold; color: #343a40; }
                .label { font-weight: bold; color: #555;}
                .value { margin-left: 5px; color: #222; }
                .checkbox-display { display: inline-block; width: 11px; height: 11px; border: 1px solid #333; margin-right: 6px; text-align: center; vertical-align: middle; line-height:11px; font-size:9px; background-color: #fff; }
                .checked::after { content: "X"; font-weight:bold; color: #333;}
                .grid-container { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px; margin-bottom: 6px;}
                .grid-item p, .full-width p { margin: 3px 0; padding: 1px 0; line-height: 1.5;}
                ul { list-style: none; padding-left: 0; margin-top: 4px; margin-bottom: 4px;}
                li { margin-bottom: 3px; display: flex; align-items: flex-start; }
                li .checkbox-display { margin-top: 1px; flex-shrink: 0; }
                li span { margin-left: 5px; }
                .text-block { white-space: pre-wrap; border: 1px solid #e0e0e0; padding: 6px; min-height: 20px; background-color: #f9f9f9; margin-top: 4px; border-radius: 3px; }
                @page { size: A4; margin: 20mm 10mm 20mm 10mm; }
            </style>
        </head>
        <body>
            <div class="page-container">
                <div class="header-pdf">
                    ${
                      logoBase64
                        ? `<img src="data:image/png;base64,${logoBase64}" alt="Logo">`
                        : ""
                    }
                    <h2>ANÁLISE PRELIMINAR DE RISCO (APR)</h2>
                </div>
                <p><span class="label">Serviço (Processo):</span> <span class="value">${escapeHtml(
                  servicoBase.processo || "N/A"
                )}</span></p>
                <p><span class="label">Data da APR:</span> <span class="value">${formatDate(
                  cabecalho.data_apr
                )}</span></p>
                <p><span class="label">Turma (Encarregado):</span> <span class="value">${escapeHtml(
                  cabecalho.nome_turma_encarregado ||
                    cabecalho.turma_encarregado_matricula ||
                    "N/A"
                )}</span></p>
                <p><span class="label">Responsável pela APR:</span> <span class="value">${escapeHtml(
                  cabecalho.nome_responsavel_apr ||
                    cabecalho.responsavel_apr_matricula ||
                    "N/A"
                )}</span></p>
                <p><span class="label">Local Específico do Serviço:</span> <span class="value">${escapeHtml(
                  cabecalho.local_servico || "N/A"
                )}</span></p>
                <div class="grid-container">
                    <div class="grid-item"><p><span class="label">KM Saída:</span> <span class="value">${escapeHtml(
                      cabecalho.km_saida || "N/A"
                    )}</span></p></div>
                    <div class="grid-item"><p><span class="label">KM Chegada:</span> <span class="value">${escapeHtml(
                      cabecalho.km_chegada || "N/A"
                    )}</span></p></div>
                    <div class="grid-item"><p><span class="label">Alimentador (APR):</span> <span class="value">${escapeHtml(
                      cabecalho.alimentador || "N/A"
                    )}</span></p></div>
                    <div class="grid-item"><p><span class="label">Subestação (APR):</span> <span class="value">${escapeHtml(
                      cabecalho.subestacao || "N/A"
                    )}</span></p></div>
                    <div class="grid-item"><p><span class="label">Chave Montante (APR):</span> <span class="value">${escapeHtml(
                      cabecalho.chave_montante || "N/A"
                    )}</span></p></div>
                </div>
                 <div class="grid-container">
                    <div class="grid-item"><p><span class="label">Hora Receb. COD:</span> <span class="value">${formatTime(
                      cabecalho.hora_receb_cod
                    )}</span></p></div>
                    <div class="grid-item"><p><span class="label">Operador COD Receb.:</span> <span class="value">${escapeHtml(
                      cabecalho.operador_cod_receb || "N/A"
                    )}</span></p></div>
                    <div class="grid-item"><p><span class="label">Hora Devol. COD:</span> <span class="value">${formatTime(
                      cabecalho.hora_devol_cod
                    )}</span></p></div>
                    <div class="grid-item"><p><span class="label">Operador COD Devol.:</span> <span class="value">${escapeHtml(
                      cabecalho.operador_cod_devol || "N/A"
                    )}</span></p></div>
                </div>
            
                <div class="section">
                    <div class="section-title">Horas Paradas</div>
                    <p><span class="label">Período:</span> Das <span class="value">${
                      formatTime(cabecalho.parada_inicio) || "__:__"
                    }</span> às <span class="value">${
    formatTime(cabecalho.parada_fim) || "__:__"
  }</span></p>
                    <p><span class="label">Motivos:</span></p> <div class="text-block">${escapeHtml(
                      cabecalho.parada_motivos || "Nenhum"
                    )}</div>
                </div>

                <div class="section">
                    <div class="section-title">Natureza do Serviço (para APR)</div>
                    <p><span class="value">${escapeHtml(
                      cabecalho.natureza_servico || "Não especificado"
                    )}</span></p>
                </div>

                <div class="section">
                    <div class="section-title">Análise de Risco em Campo (ARC)</div>
                    <p><span class="label">Riscos Gerais Identificados:</span></p>
                    <div class="text-block">${escapeHtml(
                      cabecalho.riscos_gerais ||
                        "Nenhum risco geral identificado."
                    )}</div>
                    
                    <h4 style="font-size:10.5px; margin-top:10px; margin-bottom:5px;">Perguntas da ARC:</h4>
                    <table style="margin-bottom:10px;">`;
  defAPR.perguntasARC.forEach((pergunta) => {
    const valor = cabecalho[pergunta.chave];
    let displayValor = "N/R";
    if (valor === "sim") displayValor = "Sim";
    if (valor === "nao") displayValor = "Não";
    if (valor === "na") displayValor = "NA";
    html += `<tr><td style="width:85%;">${escapeHtml(
      pergunta.texto
    )}</td> <td style="text-align:center; width:15%;"><strong>${escapeHtml(
      displayValor
    )}</strong></td></tr>`;
  });
  html += `</table>

                    <h4 style="font-size:10.5px; margin-top:10px; margin-bottom:5px;">Riscos Específicos Aplicados:</h4>
                    <ul>`;
  defAPR.riscosEspecificos.forEach((riscoDef) => {
    const isChecked = medidasAplicadasChaves.includes(riscoDef.chave);
    html += `<li><span class="checkbox-display ${
      isChecked ? "checked" : ""
    }"></span> <span>${escapeHtml(riscoDef.texto)}</span></li>`;
  });
  if (
    medidasAplicadasChaves.includes("risco_outros_detalhado") &&
    cabecalho.riscos_especificos_texto
  ) {
    html += `<li><span class="checkbox-display checked"></span> <span>Outros: ${escapeHtml(
      cabecalho.riscos_especificos_texto
    )}</span></li>`;
  } else if (cabecalho.riscos_especificos_texto) {
    html += `<li><span class="checkbox-display"></span> <span>Outros: ${escapeHtml(
      cabecalho.riscos_especificos_texto
    )}</span></li>`;
  }
  html += `</ul>
                    <p><span class="label">Observações da ARC:</span></p>
                    <div class="text-block">${escapeHtml(
                      cabecalho.arc_obs || "Nenhuma observação."
                    )}</div>
                </div>

                <div class="section">
                    <div class="section-title">Relação dos Empregados Participantes</div>`;
  if (participantes && participantes.length > 0) {
    html += `<ul>`;
    participantes.forEach((emp) => {
      html += `<li>${escapeHtml(emp.empregado_matricula)} - ${escapeHtml(
        emp.empregado_nome
      )}</li>`;
    });
    html += `</ul>`;
  } else {
    html += `<p>Nenhum participante registrado.</p>`;
  }
  html += `</div>

                <div class="section">
                    <div class="section-title">Medidas de Controle Adotadas</div>
                     <ul>`;
  defAPR.medidasControle.forEach((medidaDef) => {
    const isChecked = medidasAplicadasChaves.includes(medidaDef.chave);
    html += `<li><span class="checkbox-display ${
      isChecked ? "checked" : ""
    }"></span> <span>${escapeHtml(medidaDef.texto)}</span></li>`;
  });
  html += `</ul>
                </div>

                <div class="section">
                    <div class="section-title">Atividades Realizadas</div>`;
  if (atividades && atividades.length > 0) {
    html += `<table><thead><tr><th>Código</th><th>Descrição</th><th>Qtd</th><th>Und</th></tr></thead><tbody>`;
    atividades.forEach((atv) => {
      html += `<tr><td>${escapeHtml(
        atv.codigo_bd || "N/A"
      )}</td><td>${escapeHtml(atv.descricao)}</td><td>${escapeHtml(
        atv.quantidade || "-"
      )}</td><td>${escapeHtml(atv.unidade || "-")}</td></tr>`;
    });
    html += `</tbody></table>`;
  } else {
    html += `<p>Nenhuma atividade registrada.</p>`;
  }
  html += `</div>

                <div class="section">
                    <div class="section-title">Material Gasto</div>`;
  if (materiais && materiais.length > 0) {
    html += `<table><thead><tr><th>Código</th><th>Descrição</th><th>Qtd</th></tr></thead><tbody>`;
    materiais.forEach((mat) => {
      html += `<tr><td>${escapeHtml(
        mat.codigo_bd || "N/A"
      )}</td><td>${escapeHtml(mat.descricao)}</td><td>${escapeHtml(
        mat.quantidade || "-"
      )}</td></tr>`;
    });
    html += `</tbody></table>`;
  } else {
    html += `<p>Nenhum material registrado.</p>`;
  }
  html += `</div>
                
                <div class="section">
                    <div class="section-title">Comentários / Observações Finais</div>
                    <div class="text-block">${escapeHtml(
                      cabecalho.comentarios_gerais || "Nenhum comentário."
                    )}</div>
                </div>
                <div style="font-size:8px; color: #777; text-align: right; margin-top: 15px;">APR Gerada por: ${escapeHtml(
                  req.user.nome
                )} (${escapeHtml(
    req.user.matricula
  )}) em ${new Date().toLocaleString("pt-BR", {
    timeZone: "America/Maceio",
  })}</div>
            </div> 
        </body>
        </html>`;
  return html;
}

module.exports = router;
