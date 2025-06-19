const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs").promises;
const {
  promisePool,
  upload,
  projectRootDir,
  uploadsSubestacoesDir,
} = require("../init"); // Ajuste o caminho conforme necessário
const { autenticar, registrarAuditoria } = require("../auth"); // Ajuste o caminho conforme necessário

// Middlewares de Permissão (Idealmente, centralizar no futuro)
const podeGerenciarPaginaServicos = (req, res, next) => {
  const cargosPermitidos = [
    "ADMIN",
    "Engenheiro",
    "Encarregado",
    "Técnico",
    "ADM",
    "Gerente",
    "Inspetor",
    "Estagiário",
  ];
  if (req.user && cargosPermitidos.includes(req.user.cargo)) {
    next();
  } else {
    res.status(403).json({ message: "Acesso negado." });
  }
};

const podeModificarServicos = (req, res, next) => {
  const cargosPermitidos = [
    "ADMIN",
    "Engenheiro",
    "Encarregado",
    "Técnico",
    "ADM",
    "Gerente",
  ];
  if (req.user && cargosPermitidos.includes(req.user.cargo)) {
    next();
  } else {
    res.status(403).json({ message: "Acesso negado." });
  }
};

// Função de Verificação (Idealmente, centralizar no futuro)
async function verificarServicoExiste(req, res, next) {
  const { servicoId } = req.params;
  if (isNaN(parseInt(servicoId, 10))) {
    return res
      .status(400)
      .json({ message: `ID do serviço inválido: ${servicoId}` });
  }
  try {
    const [servicoRows] = await promisePool.query(
      "SELECT id, status, data_conclusao, observacoes_conclusao, processo FROM servicos_subestacoes WHERE id = ?",
      [servicoId]
    );
    if (servicoRows.length === 0) {
      return res
        .status(404)
        .json({ message: `Serviço com ID ${servicoId} não encontrado.` });
    }
    req.servico = servicoRows[0];
    next();
  } catch (error) {
    console.error("Erro ao verificar serviço:", error);
    res.status(500).json({ message: "Erro interno ao verificar serviço." });
  }
}

// Rota para Página HTML de Serviços
router.get(
  "/pagina-servicos-subestacoes",
  autenticar,
  podeGerenciarPaginaServicos,
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/servicos-subestacoes-servicos.html"
      )
    );
  }
);

// Rotas API Auxiliares para Serviços
router.get(
  "/usuarios-responsaveis-para-servicos",
  autenticar,
  async (req, res) => {
    try {
      const cargosRelevantes = [
        "Técnico",
        "Engenheiro",
        "Gerente",
        "ADMIN",
        "ADM",
        "Inspetor",
      ];
      const placeholders = cargosRelevantes.map(() => "?").join(",");
      const query = `SELECT DISTINCT id, nome FROM users WHERE cargo IN (${placeholders}) ORDER BY nome ASC`;
      const [rows] = await promisePool.query(query, cargosRelevantes);
      res.json(rows);
    } catch (error) {
      console.error("Erro ao buscar usuários responsáveis:", error);
      res
        .status(500)
        .json({ message: "Erro interno ao buscar usuários responsáveis." });
    }
  }
);

router.get("/usuarios-encarregados", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT id, nome FROM users WHERE cargo = 'Encarregado' ORDER BY nome ASC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar encarregados:", error);
    res.status(500).json({ message: "Erro interno ao buscar encarregados." });
  }
});

// Rotas API para Serviços de Subestações (CRUD)
router.post(
  "/api/servicos-subestacoes",
  autenticar,
  podeModificarServicos,
  upload.array("anexosServico", 5),
  async (req, res) => {
    const {
      subestacao_id,
      processo,
      motivo,
      alimentador,
      equipamento_id,
      data_prevista,
      horario_inicio,
      horario_fim,
      responsavel_id,
      status,
      data_conclusao,
      observacoes_conclusao,
      encarregado_designado_id,
    } = req.body;
    const arquivos = req.files;

    if (
      !subestacao_id ||
      !processo ||
      !motivo ||
      !data_prevista ||
      !horario_inicio ||
      !horario_fim ||
      !responsavel_id
    ) {
      if (arquivos && arquivos.length > 0) {
        for (const file of arquivos) {
          try {
            await fs.unlink(file.path);
          } catch (e) {}
        }
      }
      return res.status(400).json({ message: "Campos obrigatórios faltando." });
    }

    if (status === "CONCLUIDO" && !data_conclusao) {
      if (arquivos && arquivos.length > 0) {
        for (const file of arquivos) {
          try {
            await fs.unlink(file.path);
          } catch (e) {}
        }
      }
      return res.status(400).json({
        message: "Data de conclusão é obrigatória para serviços concluídos.",
      });
    }

    const connection = await promisePool.getConnection();
    let novoServicoId;
    let arquivosMovidosComSucesso = [];

    try {
      await connection.beginTransaction();
      const equipamentoIdFinal =
        equipamento_id &&
        equipamento_id !== "" &&
        !isNaN(parseInt(equipamento_id))
          ? parseInt(equipamento_id)
          : null;
      const dataConclusaoFinal = status === "CONCLUIDO" ? data_conclusao : null;
      const observacoesConclusaoFinal =
        status === "CONCLUIDO" ? observacoes_conclusao : null;
      const encarregadoIdFinal =
        encarregado_designado_id && !isNaN(parseInt(encarregado_designado_id))
          ? parseInt(encarregado_designado_id)
          : null;

      const [resultServico] = await connection.query(
        `INSERT INTO servicos_subestacoes (subestacao_id, processo, motivo, alimentador, equipamento_id, data_prevista, horario_inicio, horario_fim, responsavel_id, status, data_conclusao, observacoes_conclusao, encarregado_designado_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          parseInt(subestacao_id),
          processo,
          motivo,
          alimentador,
          equipamentoIdFinal,
          data_prevista,
          horario_inicio,
          horario_fim,
          parseInt(responsavel_id),
          status || "PROGRAMADO",
          dataConclusaoFinal,
          observacoesConclusaoFinal,
          encarregadoIdFinal,
        ]
      );
      novoServicoId = resultServico.insertId;

      let anexosSalvosInfo = [];
      if (arquivos && arquivos.length > 0) {
        const servicoUploadDir = path.join(
          uploadsSubestacoesDir,
          "servicos",
          `servico_${String(novoServicoId)}`
        );
        await fs.mkdir(servicoUploadDir, { recursive: true });

        for (const file of arquivos) {
          const nomeUnicoArquivo = `${Date.now()}_${file.originalname.replace(
            /[^a-zA-Z0-9.\-_]/g,
            "_"
          )}`;
          const caminhoDestino = path.join(servicoUploadDir, nomeUnicoArquivo);
          await fs.rename(file.path, caminhoDestino);
          arquivosMovidosComSucesso.push(caminhoDestino);

          const caminhoRelativoServidor = `servicos/servico_${novoServicoId}/${nomeUnicoArquivo}`;
          let categoriaAnexoFinal = "DOCUMENTO_REGISTRO";

          const [resultAnexo] = await connection.query(
            `INSERT INTO servicos_subestacoes_anexos (id_servico, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              novoServicoId,
              file.originalname,
              `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
              file.mimetype,
              file.size,
              categoriaAnexoFinal,
            ]
          );
          anexosSalvosInfo.push({
            id: resultAnexo.insertId,
            nome_original: file.originalname,
            caminho_servidor: `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
          });
        }
      }

      await connection.commit();
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "CREATE_SERVICO_SUBESTACAO",
          `Serviço de Subestação ID ${novoServicoId} criado. Processo: ${processo}`,
          connection
        );
      }
      res.status(201).json({
        id: novoServicoId,
        message: "Serviço de subestação registrado com sucesso!",
        anexos: anexosSalvosInfo,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao criar serviço de subestação:", error);
      for (const caminho of arquivosMovidosComSucesso) {
        try {
          await fs.unlink(caminho);
        } catch (e) {}
      }
      if (arquivos && arquivos.length > 0) {
        for (const file of arquivos) {
          if (
            file.path &&
            (file.path.includes("temp") || file.path.includes("upload_"))
          ) {
            try {
              await fs.access(file.path);
              await fs.unlink(file.path);
            } catch (e) {}
          }
        }
      }
      if (
        error.code === "ER_DUP_ENTRY" &&
        error.sqlMessage &&
        error.sqlMessage.includes("processo")
      ) {
        return res.status(409).json({
          message:
            "Erro ao criar serviço: Número de Processo/OS já cadastrado.",
        });
      }
      res.status(500).json({
        message: "Erro interno ao criar serviço de subestação.",
        detalhes: error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.put(
  "/api/servicos-subestacoes/:servicoId",
  autenticar,
  podeModificarServicos,
  upload.array("anexosServico", 5),
  async (req, res) => {
    const { servicoId } = req.params;
    if (isNaN(parseInt(servicoId, 10))) {
      return res
        .status(400)
        .json({ message: `ID do serviço inválido: ${servicoId}` });
    }

    const {
      subestacao_id,
      processo,
      motivo,
      alimentador,
      equipamento_id,
      data_prevista,
      horario_inicio,
      horario_fim,
      responsavel_id,
      status,
      data_conclusao,
      observacoes_conclusao,
      encarregado_designado_id,
    } = req.body;
    const arquivosNovos = req.files;

    if (
      !subestacao_id ||
      !processo ||
      !motivo ||
      !data_prevista ||
      !horario_inicio ||
      !horario_fim ||
      !responsavel_id
    ) {
      if (arquivosNovos && arquivosNovos.length > 0) {
        for (const file of arquivosNovos) {
          try {
            await fs.unlink(file.path);
          } catch (e) {}
        }
      }
      return res.status(400).json({ message: "Campos obrigatórios faltando." });
    }

    if (status === "CONCLUIDO" && !data_conclusao) {
      if (arquivosNovos && arquivosNovos.length > 0) {
        for (const file of arquivosNovos) {
          try {
            await fs.unlink(file.path);
          } catch (e) {}
        }
      }
      return res.status(400).json({
        message: "Data de conclusão é obrigatória para serviços concluídos.",
      });
    }

    const connection = await promisePool.getConnection();
    let arquivosMovidosComSucesso = [];

    try {
      await connection.beginTransaction();
      const equipamentoIdFinal =
        equipamento_id &&
        equipamento_id !== "" &&
        !isNaN(parseInt(equipamento_id))
          ? parseInt(equipamento_id)
          : null;
      const dataConclusaoFinal = status === "CONCLUIDO" ? data_conclusao : null;
      const observacoesConclusaoFinal =
        status === "CONCLUIDO" ? observacoes_conclusao : null;
      const encarregadoIdFinal =
        encarregado_designado_id && !isNaN(parseInt(encarregado_designado_id))
          ? parseInt(encarregado_designado_id)
          : null;

      const [updateResult] = await connection.query(
        `UPDATE servicos_subestacoes SET subestacao_id = ?, processo = ?, motivo = ?, alimentador = ?, equipamento_id = ?, data_prevista = ?, horario_inicio = ?, horario_fim = ?, responsavel_id = ?, status = ?, data_conclusao = ?, observacoes_conclusao = ?, encarregado_designado_id = ? WHERE id = ?`,
        [
          parseInt(subestacao_id),
          processo,
          motivo,
          alimentador,
          equipamentoIdFinal,
          data_prevista,
          horario_inicio,
          horario_fim,
          parseInt(responsavel_id),
          status,
          dataConclusaoFinal,
          observacoesConclusaoFinal,
          encarregadoIdFinal,
          servicoId,
        ]
      );
      // Não é necessário lançar erro se affectedRows for 0, pois pode não haver alteração de dados.

      let anexosSalvosInfo = [];
      if (arquivosNovos && arquivosNovos.length > 0) {
        const servicoUploadDir = path.join(
          uploadsSubestacoesDir,
          "servicos",
          `servico_${String(servicoId)}`
        );
        await fs.mkdir(servicoUploadDir, { recursive: true });

        for (const file of arquivosNovos) {
          const nomeUnicoArquivo = `${Date.now()}_${file.originalname.replace(
            /[^a-zA-Z0-9.\-_]/g,
            "_"
          )}`;
          const caminhoDestino = path.join(servicoUploadDir, nomeUnicoArquivo);
          await fs.rename(file.path, caminhoDestino);
          arquivosMovidosComSucesso.push(caminhoDestino);

          const caminhoRelativoServidor = `servicos/servico_${servicoId}/${nomeUnicoArquivo}`;
          const categoriaAnexoFinal = "DOCUMENTO_REGISTRO";

          const [resultAnexo] = await connection.query(
            `INSERT INTO servicos_subestacoes_anexos (id_servico, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              servicoId,
              file.originalname,
              `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
              file.mimetype,
              file.size,
              categoriaAnexoFinal,
            ]
          );
          anexosSalvosInfo.push({
            id: resultAnexo.insertId,
            nome_original: file.originalname,
            caminho_servidor: `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
          });
        }
      }

      await connection.commit();
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "UPDATE_SERVICO_SUBESTACAO",
          `Serviço de Subestação ID ${servicoId} atualizado. Processo: ${processo}`,
          connection
        );
      }
      res.json({
        id: servicoId,
        message: "Serviço de subestação atualizado com sucesso!",
        anexosAdicionados: anexosSalvosInfo,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao atualizar serviço de subestação:", error);
      for (const caminho of arquivosMovidosComSucesso) {
        try {
          await fs.unlink(caminho);
        } catch (e) {}
      }
      if (arquivosNovos && arquivosNovos.length > 0) {
        for (const file of arquivosNovos) {
          if (
            file.path &&
            (file.path.includes("temp") || file.path.includes("upload_"))
          ) {
            try {
              await fs.access(file.path);
              await fs.unlink(file.path);
            } catch (e) {}
          }
        }
      }
      if (
        error.code === "ER_DUP_ENTRY" &&
        error.sqlMessage &&
        error.sqlMessage.includes("processo")
      ) {
        return res.status(409).json({
          message:
            "Erro ao atualizar serviço: Número de Processo/OS já cadastrado para outro serviço.",
        });
      }
      res.status(500).json({
        message: "Erro interno ao atualizar serviço de subestação.",
        detalhes: error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.delete(
  "/api/servicos-subestacoes/:servicoId",
  autenticar,
  podeModificarServicos,
  async (req, res) => {
    const { servicoId } = req.params;
    if (isNaN(parseInt(servicoId, 10))) {
      return res
        .status(400)
        .json({ message: `ID do serviço inválido: ${servicoId}` });
    }

    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();

      const [anexos] = await connection.query(
        "SELECT caminho_servidor FROM servicos_subestacoes_anexos WHERE id_servico = ?",
        [servicoId]
      );
      await connection.query(
        "DELETE FROM servicos_subestacoes_anexos WHERE id_servico = ?",
        [servicoId]
      );
      const [result] = await connection.query(
        "DELETE FROM servicos_subestacoes WHERE id = ?",
        [servicoId]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({ message: `Serviço com ID ${servicoId} não encontrado.` });
      }

      if (anexos.length > 0) {
        const servicoUploadDir = path.join(
          uploadsSubestacoesDir,
          "servicos",
          `servico_${String(servicoId)}`
        );
        for (const anexo of anexos) {
          const caminhoRelativoNoServidor = anexo.caminho_servidor.replace(
            /^\/upload_arquivos_subestacoes\//,
            ""
          );
          const caminhoCompleto = path.join(
            uploadsSubestacoesDir,
            caminhoRelativoNoServidor
          );
          try {
            await fs.access(caminhoCompleto);
            await fs.unlink(caminhoCompleto);
          } catch (err) {
            if (err.code !== "ENOENT") {
              console.warn(
                `Falha ao excluir anexo ${caminhoCompleto} do serviço ${servicoId}: ${err.message}`
              );
            }
          }
        }
        try {
          await fs.rm(servicoUploadDir, { recursive: true, force: true });
        } catch (err) {
          if (err.code !== "ENOENT") {
            console.warn(
              `Falha ao remover diretório de anexos do serviço ${servicoId} (${servicoUploadDir}): ${err.message}`
            );
          }
        }
      }

      await connection.commit();
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "DELETE_SERVICO_SUBESTACAO",
          `Serviço de Subestação ID ${servicoId} e seus anexos foram excluídos.`,
          connection
        );
      }
      res.json({
        message: `Serviço ID ${servicoId} e seus anexos foram excluídos com sucesso.`,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao excluir serviço de subestação:", error);
      res.status(500).json({
        message: "Erro interno ao excluir serviço de subestação.",
        detalhes: error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.get(
  "/api/servicos-subestacoes",
  autenticar,
  podeGerenciarPaginaServicos,
  async (req, res) => {
    try {
      let query = ` SELECT ss.id, ss.processo, ss.motivo, ss.alimentador, DATE_FORMAT(ss.data_prevista, '%Y-%m-%d') as data_prevista, ss.horario_inicio, ss.horario_fim, ss.status, DATE_FORMAT(ss.data_conclusao, '%Y-%m-%d') as data_conclusao, s.sigla as subestacao_sigla, s.nome as subestacao_nome, u.nome as responsavel_nome, e.tag as equipamento_tag, ss.subestacao_id, ss.responsavel_id, ss.equipamento_id, ud.nome as encarregado_designado_nome, ss.encarregado_designado_id FROM servicos_subestacoes ss JOIN subestacoes s ON ss.subestacao_id = s.Id JOIN users u ON ss.responsavel_id = u.id LEFT JOIN infra_equip e ON ss.equipamento_id = e.id LEFT JOIN users ud ON ss.encarregado_designado_id = ud.id WHERE 1=1 `;
      const params = [];

      if (req.query.subestacao_id) {
        query += " AND ss.subestacao_id = ?";
        params.push(req.query.subestacao_id);
      }
      if (req.query.status) {
        query += " AND ss.status = ?";
        params.push(req.query.status);
      }
      if (req.query.processo) {
        query += " AND ss.processo LIKE ?";
        params.push(`%${req.query.processo}%`);
      }
      if (req.query.data_prevista_de) {
        query += " AND ss.data_prevista >= ?";
        params.push(req.query.data_prevista_de);
      }
      if (req.query.data_prevista_ate) {
        query += " AND ss.data_prevista <= ?";
        params.push(req.query.data_prevista_ate);
      }
      query += " ORDER BY ss.data_prevista DESC, ss.id DESC";

      const [rows] = await promisePool.query(query, params);
      res.json(rows);
    } catch (error) {
      console.error("Erro ao listar serviços de subestação:", error);
      res.status(500).json({
        message: "Erro interno ao listar serviços de subestação.",
        detalhes: error.message,
      });
    }
  }
);

router.get(
  "/api/servicos-subestacoes/:servicoId",
  autenticar,
  podeGerenciarPaginaServicos,
  async (req, res) => {
    const { servicoId } = req.params;
    if (isNaN(parseInt(servicoId, 10))) {
      return res
        .status(400)
        .json({ message: `ID do serviço inválido: ${servicoId}` });
    }
    try {
      const [servicoRows] = await promisePool.query(
        `SELECT ss.id, ss.processo, ss.motivo, ss.alimentador, DATE_FORMAT(ss.data_prevista, '%Y-%m-%d') as data_prevista, ss.horario_inicio, ss.horario_fim, ss.status, DATE_FORMAT(ss.data_conclusao, '%Y-%m-%d') as data_conclusao, ss.observacoes_conclusao, s.Id as subestacao_id, s.sigla as subestacao_sigla, s.nome as subestacao_nome, u.id as responsavel_id, u.nome as responsavel_nome, e.id as equipamento_id, e.tag as equipamento_tag, ss.encarregado_designado_id, ud.nome as encarregado_designado_nome FROM servicos_subestacoes ss JOIN subestacoes s ON ss.subestacao_id = s.Id JOIN users u ON ss.responsavel_id = u.id LEFT JOIN infra_equip e ON ss.equipamento_id = e.id LEFT JOIN users ud ON ss.encarregado_designado_id = ud.id WHERE ss.id = ?`,
        [servicoId]
      );

      if (servicoRows.length === 0) {
        return res
          .status(404)
          .json({ message: `Serviço com ID ${servicoId} não encontrado.` });
      }
      const servico = servicoRows[0];
      const [anexosRows] = await promisePool.query(
        `SELECT id, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo FROM servicos_subestacoes_anexos WHERE id_servico = ?`,
        [servicoId]
      );
      servico.anexos = anexosRows;
      res.json(servico);
    } catch (error) {
      console.error("Erro ao buscar detalhes do serviço:", error);
      res.status(500).json({
        message: "Erro interno ao buscar detalhes do serviço.",
        detalhes: error.message,
      });
    }
  }
);

router.put(
  "/api/servicos-subestacoes/:servicoId/concluir",
  autenticar,
  podeModificarServicos,
  verificarServicoExiste,
  upload.array("anexos_conclusao_servico", 5),
  async (req, res) => {
    const { servicoId } = req.params;
    const {
      data_conclusao_manual,
      hora_conclusao_manual,
      observacoes_conclusao_manual,
    } = req.body;
    const arquivosConclusao = req.files;
    const { servico } = req;

    if (servico.status === "CONCLUIDO" || servico.status === "CANCELADO") {
      if (arquivosConclusao && arquivosConclusao.length > 0) {
        for (const file of arquivosConclusao) {
          try {
            await fs.unlink(file.path);
          } catch (e) {}
        }
      }
      return res.status(400).json({
        message: `Serviço (Processo: ${servico.processo}) já está no status ${servico.status}.`,
      });
    }

    if (!data_conclusao_manual) {
      if (arquivosConclusao && arquivosConclusao.length > 0) {
        for (const file of arquivosConclusao) {
          try {
            await fs.unlink(file.path);
          } catch (e) {}
        }
      }
      return res
        .status(400)
        .json({ message: "Data de conclusão é obrigatória." });
    }

    const connection = await promisePool.getConnection();
    let arquivosMovidosComSucesso = [];
    try {
      await connection.beginTransaction();
      let dataConclusaoFinal = data_conclusao_manual;
      let observacoesFinais =
        observacoes_conclusao_manual || servico.observacoes_conclusao || "";
      let horarioConclusaoFinal = hora_conclusao_manual || null;

      if (!dataConclusaoFinal) {
        dataConclusaoFinal = new Date().toISOString().split("T")[0];
      }

      let updateQuery =
        "UPDATE servicos_subestacoes SET status = 'CONCLUIDO', data_conclusao = ?, observacoes_conclusao = ?";
      const updateParams = [dataConclusaoFinal, observacoesFinais];

      if (horarioConclusaoFinal) {
        updateQuery += ", horario_fim = IFNULL(horario_fim, ?)";
        updateParams.push(horarioConclusaoFinal);
      } else {
        const now = new Date();
        const horaAtualFormatada = now.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        updateQuery += ", horario_fim = IFNULL(horario_fim, ?)";
        updateParams.push(horaAtualFormatada);
      }
      updateQuery += " WHERE id = ?";
      updateParams.push(servicoId);

      await connection.query(updateQuery, updateParams);

      let anexosSalvosConclusaoInfo = [];
      if (arquivosConclusao && arquivosConclusao.length > 0) {
        const servicoUploadDirConclusao = path.join(
          uploadsSubestacoesDir,
          "servicos",
          `servico_${String(servicoId)}`,
          "conclusao"
        );
        await fs.mkdir(servicoUploadDirConclusao, { recursive: true });

        for (const file of arquivosConclusao) {
          const nomeUnicoArquivo = `${Date.now()}_${file.originalname.replace(
            /[^a-zA-Z0-9.\-_]/g,
            "_"
          )}`;
          const caminhoDestino = path.join(
            servicoUploadDirConclusao,
            nomeUnicoArquivo
          );
          await fs.rename(file.path, caminhoDestino);
          arquivosMovidosComSucesso.push(caminhoDestino);

          const caminhoRelativoServidor = `servicos/servico_${servicoId}/conclusao/${nomeUnicoArquivo}`;
          const [resultAnexo] = await connection.query(
            `INSERT INTO servicos_subestacoes_anexos (id_servico, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo, descricao_anexo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              servicoId,
              file.originalname,
              `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
              file.mimetype,
              file.size,
              "ANEXO_CONCLUSAO",
              "Anexo de conclusão",
            ]
          );
          anexosSalvosConclusaoInfo.push({
            id: resultAnexo.insertId,
            nome_original: file.originalname,
            caminho_servidor: `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
          });
        }
      }

      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "CONCLUDE_SERVICO_SUBESTACAO",
          `Serviço de Subestação ID ${servicoId} (Processo: ${servico.processo}) marcado como CONCLUÍDO. Data: ${dataConclusaoFinal}. Anexos Conclusão: ${anexosSalvosConclusaoInfo.length}`,
          connection
        );
      }

      await connection.commit();
      res.json({
        message: `Serviço (Processo: ${servico.processo}) concluído com sucesso!`,
        anexosConclusao: anexosSalvosConclusaoInfo,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao concluir o serviço:", error);
      if (arquivosConclusao && arquivosConclusao.length > 0) {
        for (const file of arquivosConclusao) {
          if (
            file.path &&
            (file.path.includes("temp") || file.path.includes("upload_"))
          ) {
            try {
              await fs.access(file.path);
              await fs.unlink(file.path);
            } catch (e) {}
          }
        }
      }
      for (const caminho of arquivosMovidosComSucesso) {
        try {
          await fs.unlink(caminho);
        } catch (e) {}
      }
      res.status(500).json({
        message: "Erro interno ao concluir o serviço.",
        detalhes: error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.put(
  "/api/servicos-subestacoes/:servicoId/reabrir",
  autenticar,
  podeModificarServicos,
  verificarServicoExiste,
  async (req, res) => {
    const { servicoId } = req.params;
    const { servico } = req;

    if (servico.status !== "CONCLUIDO" && servico.status !== "CANCELADO") {
      return res.status(400).json({
        message: `Serviço (Processo: ${servico.processo}) no status ${servico.status} não pode ser reaberto.`,
      });
    }

    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        "UPDATE servicos_subestacoes SET status = 'EM_ANDAMENTO', data_conclusao = NULL, observacoes_conclusao = NULL WHERE id = ?",
        [servicoId]
      );

      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "REOPEN_SERVICO_SUBESTACAO",
          `Serviço de Subestação ID ${servicoId} (Processo: ${servico.processo}) reaberto.`,
          connection
        );
      }

      await connection.commit();
      res.json({
        message: `Serviço (Processo: ${servico.processo}) reaberto com sucesso! Novo status: EM ANDAMENTO.`,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao reabrir o serviço:", error);
      res.status(500).json({
        message: "Erro interno ao reabrir o serviço.",
        detalhes: error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.put(
  "/api/servicos-subestacoes/:servicoId/designar-encarregado",
  autenticar,
  podeModificarServicos,
  verificarServicoExiste,
  async (req, res) => {
    const { servicoId } = req.params;
    const { encarregado_designado_id } = req.body;
    const { servico } = req;

    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();
      const encarregadoFinalId =
        encarregado_designado_id && !isNaN(parseInt(encarregado_designado_id))
          ? parseInt(encarregado_designado_id)
          : null;

      await connection.query(
        "UPDATE servicos_subestacoes SET encarregado_designado_id = ? WHERE id = ?",
        [encarregadoFinalId, servicoId]
      );

      if (req.user && req.user.matricula) {
        let nomeEncarregado = "Ninguém";
        if (encarregadoFinalId) {
          const [encarregado] = await connection.query(
            "SELECT nome FROM users WHERE id = ?",
            [encarregadoFinalId]
          );
          nomeEncarregado =
            encarregado.length > 0
              ? encarregado[0].nome
              : `ID ${encarregadoFinalId}`;
        }
        const acao = encarregadoFinalId
          ? "DESIGNATE_ENCARREGADO_SERVICO"
          : "UNDESIGNATE_ENCARREGADO_SERVICO";
        const detalheAcao = encarregadoFinalId
          ? `designado para Encarregado: ${nomeEncarregado}`
          : "encarregado desvinculado";
        await registrarAuditoria(
          req.user.matricula,
          acao,
          `Serviço ID ${servicoId} (Proc: ${servico.processo}) ${detalheAcao}.`,
          connection
        );
      }

      await connection.commit();
      const mensagem = encarregadoFinalId
        ? `Serviço (Processo: ${servico.processo}) designado com sucesso!`
        : `Encarregado desvinculado do serviço (Processo: ${servico.processo}) com sucesso!`;
      res.json({ message: mensagem });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao designar/desvincular encarregado:", error);
      res.status(500).json({
        message: "Erro interno ao designar/desvincular encarregado.",
        detalhes: error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

module.exports = router;
