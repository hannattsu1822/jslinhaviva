// src/routes/rotas_gestao_servicos.js
const express = require("express");
const path = require("path");
const fs = require("fs"); // Necessário para manipulação de arquivos em anexos
const { promisePool, upload } = require("../init"); // Ajuste o caminho se init.js estiver em src/
const {
  autenticar,
  verificarPermissaoPorCargo,
  registrarAuditoria,
} = require("../auth"); // Ajuste o caminho

const router = express.Router();

// Funções auxiliares (movidas para cá para manter o módulo coeso)
function limparArquivosTemporarios(files) {
  if (files) {
    files.forEach((file) => {
      if (file && file.path && fs.existsSync(file.path)) {
        // Adicionada verificação de file.path
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

// HTML Pages for Gestão de Serviços Module
router.get("/gestao-servicos", autenticar, (req, res) => {
  // verificarPermissaoPorCargo pode ser adicionado se necessário
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/gestao_servico.html")
  );
});

router.get("/registro_servicos", autenticar, (req, res) => {
  // verificarPermissaoPorCargo pode ser adicionado
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/registro_servicos.html")
  );
});

router.get("/servicos_ativos", autenticar, (req, res) => {
  // verificarPermissaoPorCargo pode ser adicionado
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/servicos_ativos.html")
  );
});

router.get("/servicos_concluidos", autenticar, (req, res) => {
  // verificarPermissaoPorCargo pode ser adicionado
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/servicos_concluidos.html")
  );
});

router.get("/detalhes_servico", autenticar, (req, res) => {
  // verificarPermissaoPorCargo pode ser adicionado
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/detalhes_servico.html")
  );
});

router.get("/servicos_atribuidos", autenticar, (req, res) => {
  // verificarPermissaoPorCargo pode ser adicionado
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/servicos_atribuidos.html")
  );
});

router.get("/editar_servico", autenticar, (req, res) => {
  // verificarPermissaoPorCargo pode ser adicionado
  res.sendFile(
    path.join(__dirname, "../../public/pages/servicos/editar_servico.html")
  );
});

// API Routes for Gestão de Serviços Module

// Rota POST /api/servicos para criar novo serviço
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
        ); // Ajustado para sair de routes/ e src/
        if (!fs.existsSync(processoDir))
          fs.mkdirSync(processoDir, { recursive: true });

        for (const file of req.files) {
          const extensao = path.extname(file.originalname).toLowerCase();
          const novoNome = `anexo_${Date.now()}${extensao}`;
          const novoPath = path.join(processoDir, novoNome);

          await fs.promises.rename(file.path, novoPath); // fs.promises.rename

          const tipoAnexo = [".jpg", ".jpeg", ".png"].includes(extensao)
            ? "imagem"
            : "documento"; // Simplificado

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

// Rota GET /api/servicos para listar serviços com filtros
router.get("/api/servicos", autenticar, async (req, res) => {
  try {
    const { status } = req.query; // Pode adicionar mais filtros como subestacao, responsavel, datas etc.
    let query = `
            SELECT 
                p.id, p.processo, p.data_prevista_execucao, p.desligamento, 
                p.subestacao, p.alimentador, p.chave_montante, 
                p.responsavel_matricula, p.maps, p.status, p.data_conclusao, 
                p.observacoes_conclusao, u.nome as responsavel_nome, /* Nomeado para responsavel_nome */
                CASE 
                    WHEN p.tipo = 'Emergencial' THEN 'Emergencial' /* Usando p.tipo que parece ser o correto */
                    ELSE 'Normal'
                END as tipo_processo
            FROM processos p
            LEFT JOIN users u ON p.responsavel_matricula = u.matricula
        `;
    const params = [];
    if (status) {
      query += " WHERE p.status = ?";
      params.push(status);
    }
    query += " ORDER BY p.data_prevista_execucao ASC, p.id DESC"; // Ordenação
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

// Rota GET /api/servicos/:id para detalhes de um serviço
router.get("/api/servicos/:id", autenticar, async (req, res) => {
  const connection = await promisePool.getConnection();
  try {
    const { id } = req.params;
    const [servicoRows] = await connection.query(
      // Renomeado para servicoRows para evitar conflito de nome
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

// Rota PUT /api/servicos/:id para editar serviço
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
        ); // Renomeado para processoRow
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

// Rota para excluir serviço
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

// Rota para concluir serviço com imagem
router.post(
  "/api/servicos/:id/concluir",
  autenticar,
  upload.array("fotos_conclusao", 5),
  async (req, res) => {
    const { id: requestId } = req.params; // Pega o id no início para usar no log do finally
    const connection = await promisePool.getConnection();
    let filePaths = [];
    try {
      await connection.beginTransaction();
      // const { id } = req.params; // Já pegamos como requestId

      const { observacoes, dataConclusao, horaConclusao } = req.body;

      console.log(`[CONCLUIR SERVIÇO - ID: ${requestId}] Iniciando conclusão.`);
      console.log(
        `[CONCLUIR SERVIÇO - ID: ${requestId}] Data recebida do frontend: ${dataConclusao}, Hora recebida: ${horaConclusao}`
      );
      console.log(
        `[CONCLUIR SERVIÇO - ID: ${requestId}] Observações recebidas: ${observacoes}`
      );

      const matricula = req.user?.matricula;

      if (!matricula) {
        limparArquivosTemporarios(req.files);
        console.error(
          `[CONCLUIR SERVIÇO - ID: ${requestId}] Erro: Matrícula do responsável não encontrada.`
        );
        return res.status(400).json({
          success: false,
          message: "Matrícula do responsável não encontrada",
        });
      }
      if (!dataConclusao || !horaConclusao) {
        limparArquivosTemporarios(req.files);
        console.error(
          `[CONCLUIR SERVIÇO - ID: ${requestId}] Erro: Data e Hora de Conclusão são obrigatórias. Data: ${dataConclusao}, Hora: ${horaConclusao}`
        );
        return res.status(400).json({
          success: false,
          message: "Data e Hora de Conclusão são obrigatórias.",
        });
      }
      const dataHoraConclusao = `${dataConclusao} ${horaConclusao}:00`;
      console.log(
        `[CONCLUIR SERVIÇO - ID: ${requestId}] DataHora formatada para DB: ${dataHoraConclusao}`
      );

      const [servicoExistente] = await connection.query(
        "SELECT id, processo FROM processos WHERE id = ?",
        [requestId] // Usar requestId
      );
      if (servicoExistente.length === 0) {
        limparArquivosTemporarios(req.files);
        console.error(
          `[CONCLUIR SERVIÇO - ID: ${requestId}] Erro: Serviço não encontrado.`
        );
        return res
          .status(404)
          .json({ success: false, message: "Serviço não encontrado" });
      }
      console.log(
        `[CONCLUIR SERVIÇO - ID: ${requestId}] Processo do serviço existente: ${servicoExistente[0].processo}`
      );

      const [result] = await connection.query(
        `UPDATE processos SET status = 'concluido', data_conclusao = ?, observacoes_conclusao = ?, responsavel_matricula = ? WHERE id = ?`,
        [dataHoraConclusao, observacoes || null, matricula, requestId] // Usar requestId
      );
      console.log(
        `[CONCLUIR SERVIÇO - ID: ${requestId}] Resultado do UPDATE (affectedRows): ${result.affectedRows}`
      );

      if (result.affectedRows === 0) {
        console.error(
          `[CONCLUIR SERVIÇO - ID: ${requestId}] Erro: Nenhum serviço foi atualizado pelo UPDATE.`
        );
        throw new Error("Nenhum serviço foi atualizado");
      }

      if (req.files && req.files.length > 0) {
        console.log(
          `[CONCLUIR SERVIÇO - ID: ${requestId}] Processando ${req.files.length} arquivo(s) de conclusão.`
        );
        const processoDir = path.join(
          __dirname,
          "../../upload_arquivos",
          servicoExistente[0].processo.replace(/\//g, "-")
        );
        if (!fs.existsSync(processoDir)) {
          console.log(
            `[CONCLUIR SERVIÇO - ID: ${requestId}] Criando diretório para anexos: ${processoDir}`
          );
          fs.mkdirSync(processoDir, { recursive: true });
        }

        for (const file of req.files) {
          const fileExt = path.extname(file.originalname).toLowerCase();
          const newFilename = `conclusao_${Date.now()}${fileExt}`;
          const newPath = path.join(processoDir, newFilename);

          console.log(
            `[CONCLUIR SERVIÇO - ID: ${requestId}] Movendo arquivo ${file.originalname} para ${newPath}`
          );
          await fs.promises.rename(file.path, newPath);
          filePaths.push(newPath);

          const isImage = [".jpg", ".jpeg", ".png"].includes(fileExt);
          const tipoAnexo = isImage ? "foto_conclusao" : "documento";

          console.log(
            `[CONCLUIR SERVIÇO - ID: ${requestId}] Inserindo anexo no DB: ${newFilename}, Tipo: ${tipoAnexo}`
          );
          await connection.query(
            `INSERT INTO processos_anexos (processo_id, nome_original, caminho_servidor, tipo_anexo, tamanho) VALUES (?, ?, ?, ?, ?)`,
            [
              requestId, // Usar requestId
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
      console.log(
        `[CONCLUIR SERVIÇO - ID: ${requestId}] Transação commitada com sucesso.`
      );
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
      console.error(
        `[CONCLUIR SERVIÇO - ID: ${requestId}] Erro na transação, rollback executado:`,
        error
      ); // Usar requestId
      filePaths.forEach((filePath) => {
        try {
          if (fs.existsSync(filePath)) {
            console.log(
              `[CONCLUIR SERVIÇO - ID: ${requestId}] Limpando arquivo movido após falha: ${filePath}`
            ); // Usar requestId
            fs.unlinkSync(filePath);
          }
        } catch (e) {
          console.error(
            `[CONCLUIR SERVIÇO - ID: ${requestId}] Erro ao limpar arquivo ${filePath} após falha:`,
            e
          ); // Usar requestId
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
      // Log corrigido para usar requestId que está no escopo ou simplesmente não usar o ID aqui.
      console.log(
        `[CONCLUIR SERVIÇO - ID: ${requestId}] Conexão com DB liberada.`
      );
    }
  }
);

// Rota para reativar serviço
router.patch("/api/servicos/:id/reativar", autenticar, async (req, res) => {
  try {
    const [result] = await promisePool.query(
      'UPDATE processos SET status = "ativo", data_conclusao = NULL, observacoes_conclusao = NULL WHERE id = ?', // Limpa observações também
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

// Rota para download/visualização de anexos
router.get("/api/upload_arquivos/:processo/:filename", (req, res) => {
  const { processo, filename } = req.params;
  // Path ajustado para sair de 'routes' e 'src'
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
    ".pdf": "application/pdf" /* Adicione outros tipos se necessário */,
  };
  res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
  if (req.query.download === "true") {
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  }
  fs.createReadStream(filePath).pipe(res);
});

// Rota DELETE para remover anexo
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
      ); // Ajustado
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

// Rota para contador de serviços
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

// Rota para obter encarregados (usada em Serviços para atribuição)
router.get("/api/encarregados", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT DISTINCT matricula, nome FROM users WHERE cargo IN ('Encarregado', 'Gerente', 'ADMIN', 'Engenheiro', 'Técnico') ORDER BY nome" // Incluindo mais cargos que podem ser responsáveis
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar encarregados:", err);
    res.status(500).json({ message: "Erro ao buscar encarregados!" });
  }
});

// Rota para obter subestações (usada como filtro em Serviços)
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

// Rota para PATCH de responsável do serviço (se você tinha uma específica apenas para isso)
router.patch("/api/servicos/:id/responsavel", autenticar, async (req, res) => {
  // Caminho mais específico
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

module.exports = router;
