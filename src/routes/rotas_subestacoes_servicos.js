const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs").promises;
const {
  promisePool,
  upload,
  projectRootDir,
  uploadsSubestacoesDir,
} = require("../init");
const { autenticar, registrarAuditoria } = require("../auth");

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
    res
      .status(403)
      .json({ message: "Acesso negado para gerenciar página de serviços." });
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
    res.status(403).json({ message: "Acesso negado para modificar serviços." });
  }
};

async function verificarServicoExiste(req, res, next) {
  const { servicoId } = req.params;
  if (isNaN(parseInt(servicoId, 10))) {
    return res
      .status(400)
      .json({ message: `ID do serviço inválido: ${servicoId}` });
  }
  try {
    const [servicoRows] = await promisePool.query(
      "SELECT id, status, data_conclusao, observacoes_conclusao, processo, encarregado_designado_id FROM servicos_subestacoes WHERE id = ?",
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
    console.error("Erro ao verificar existência do serviço:", error);
    res.status(500).json({ message: "Erro interno ao verificar serviço." });
  }
}

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

router.get(
  "/registrar-servico-subestacao",
  autenticar,
  podeModificarServicos,
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/registrar-servico-subestacao.html"
      )
    );
  }
);

router.get(
  "/servicos/:servicoId/detalhes-pagina",
  autenticar,
  podeGerenciarPaginaServicos,
  async (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/servico-detalhes-pagina.html"
      )
    );
  }
);

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
      console.error("Erro ao buscar usuários responsáveis (API):", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar usuários responsáveis." });
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
    console.error("Erro ao buscar encarregados (API):", error);
    res.status(500).json({ message: "Erro ao buscar encarregados." });
  }
});

router.get("/api/catalogo-defeitos-servicos", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT id, codigo, ponto_defeito, descricao, categoria_principal FROM catalogo_defeitos_servicos ORDER BY codigo ASC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar catálogo de defeitos (API):", error);
    res
      .status(500)
      .json({
        message: "Erro ao buscar catálogo de defeitos.",
        detalhes: error.message,
      });
  }
});

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
      inspecao_ids_vinculadas,
      mapeamento_defeitos,
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
        arquivos.forEach((f) => {
          if (f.path) fs.unlink(f.path).catch(() => {});
        });
      }
      return res.status(400).json({ message: "Campos obrigatórios faltando." });
    }
    if (status === "CONCLUIDO" && !data_conclusao) {
      if (arquivos && arquivos.length > 0) {
        arquivos.forEach((f) => {
          if (f.path) fs.unlink(f.path).catch(() => {});
        });
      }
      return res
        .status(400)
        .json({
          message:
            "Data de conclusão obrigatória para serviços com status CONCLUÍDO.",
        });
    }

    let parsedInspecaoIds = [];
    if (inspecao_ids_vinculadas) {
      try {
        parsedInspecaoIds = JSON.parse(inspecao_ids_vinculadas);
        if (
          !Array.isArray(parsedInspecaoIds) ||
          !parsedInspecaoIds.every((id) => Number.isInteger(Number(id)))
        ) {
          throw new Error("Formato inválido para IDs de inspeção vinculadas.");
        }
      } catch (e) {
        return res
          .status(400)
          .json({
            message: "Erro ao processar IDs de inspeção vinculadas.",
            detalhes: e.message,
          });
      }
    }
    let parsedMapeamentoDefeitos = [];
    if (mapeamento_defeitos) {
      try {
        parsedMapeamentoDefeitos = JSON.parse(mapeamento_defeitos);
        if (!Array.isArray(parsedMapeamentoDefeitos)) {
          throw new Error("Formato inválido para mapeamento_defeitos.");
        }
      } catch (e) {
        return res
          .status(400)
          .json({
            message: "Erro ao processar mapeamento de defeitos.",
            detalhes: e.message,
          });
      }
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
        encarregado_designado_id &&
        encarregado_designado_id !== "" &&
        !isNaN(parseInt(encarregado_designado_id))
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

      if (parsedInspecaoIds.length > 0) {
        const vinculosValues = parsedInspecaoIds.map((inspecaoId) => [
          novoServicoId,
          parseInt(inspecaoId),
        ]);
        await connection.query(
          "INSERT INTO servicos_inspecoes_vinculadas (servico_id, inspecao_id) VALUES ?",
          [vinculosValues]
        );
      }
      if (parsedMapeamentoDefeitos.length > 0) {
        const defeitosValues = parsedMapeamentoDefeitos.map((defeito) => [
          novoServicoId,
          parseInt(defeito.inspecao_item_id),
          parseInt(defeito.catalogo_defeito_id),
          defeito.observacao_especifica_servico || null,
        ]);
        await connection.query(
          "INSERT INTO servico_item_inspecao_defeito (servico_id, inspecao_item_id, catalogo_defeito_id, observacao_especifica_servico) VALUES ?",
          [defeitosValues]
        );
      }

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
          `Serviço ID ${novoServicoId} (Proc: ${processo}) criado. Insp: ${parsedInspecaoIds.length}, Defs: ${parsedMapeamentoDefeitos.length}`,
          connection
        );
      }
      res
        .status(201)
        .json({
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
      res
        .status(500)
        .json({
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
    if (isNaN(parseInt(servicoId)))
      return res.status(400).json({ message: `ID inválido: ${servicoId}` });
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
      inspecao_ids_vinculadas,
      mapeamento_defeitos,
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
        arquivosNovos.forEach((f) => {
          if (f.path) fs.unlink(f.path).catch(() => {});
        });
      }
      return res.status(400).json({ message: "Campos obrigatórios faltando." });
    }
    if (status === "CONCLUIDO" && !data_conclusao) {
      if (arquivosNovos && arquivosNovos.length > 0) {
        arquivosNovos.forEach((f) => {
          if (f.path) fs.unlink(f.path).catch(() => {});
        });
      }
      return res
        .status(400)
        .json({ message: "Data de conclusão obrigatória para CONCLUÍDO." });
    }

    let parsedInspecaoIds = [],
      parsedMapeamentoDefeitos = [];
    if (inspecao_ids_vinculadas)
      try {
        parsedInspecaoIds = JSON.parse(inspecao_ids_vinculadas);
        if (
          !Array.isArray(parsedInspecaoIds) ||
          !parsedInspecaoIds.every((id) => Number.isInteger(Number(id)))
        )
          throw new Error("Formato inválido IDs inspeção");
      } catch (e) {
        return res
          .status(400)
          .json({
            message: "Erro ao processar IDs de inspeção.",
            detalhes: e.message,
          });
      }
    if (mapeamento_defeitos)
      try {
        parsedMapeamentoDefeitos = JSON.parse(mapeamento_defeitos);
        if (!Array.isArray(parsedMapeamentoDefeitos))
          throw new Error("Formato inválido mapeamento defeitos");
      } catch (e) {
        return res
          .status(400)
          .json({
            message: "Erro ao processar mapeamento de defeitos.",
            detalhes: e.message,
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
        encarregado_designado_id &&
        encarregado_designado_id !== "" &&
        !isNaN(parseInt(encarregado_designado_id))
          ? parseInt(encarregado_designado_id)
          : null;

      await connection.query(
        `UPDATE servicos_subestacoes SET subestacao_id=?,processo=?,motivo=?,alimentador=?,equipamento_id=?,data_prevista=?,horario_inicio=?,horario_fim=?,responsavel_id=?,status=?,data_conclusao=?,observacoes_conclusao=?,encarregado_designado_id=? WHERE id=?`,
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

      await connection.query(
        "DELETE FROM servicos_inspecoes_vinculadas WHERE servico_id = ?",
        [servicoId]
      );
      await connection.query(
        "DELETE FROM servico_item_inspecao_defeito WHERE servico_id = ?",
        [servicoId]
      );

      if (parsedInspecaoIds.length > 0) {
        const vinculosValues = parsedInspecaoIds.map((inspecaoId) => [
          servicoId,
          parseInt(inspecaoId),
        ]);
        await connection.query(
          "INSERT INTO servicos_inspecoes_vinculadas (servico_id, inspecao_id) VALUES ?",
          [vinculosValues]
        );
      }
      if (parsedMapeamentoDefeitos.length > 0) {
        const defeitosValues = parsedMapeamentoDefeitos.map((defeito) => [
          servicoId,
          parseInt(defeito.inspecao_item_id),
          parseInt(defeito.catalogo_defeito_id),
          defeito.observacao_especifica_servico || null,
        ]);
        await connection.query(
          "INSERT INTO servico_item_inspecao_defeito (servico_id, inspecao_item_id, catalogo_defeito_id, observacao_especifica_servico) VALUES ?",
          [defeitosValues]
        );
      }

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
          const [resultAnexo] = await connection.query(
            `INSERT INTO servicos_subestacoes_anexos (id_servico,nome_original,caminho_servidor,tipo_mime,tamanho,categoria_anexo) VALUES (?,?,?,?,?,?)`,
            [
              servicoId,
              file.originalname,
              `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
              file.mimetype,
              file.size,
              "DOCUMENTO_REGISTRO",
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
      if (req.user && req.user.matricula)
        await registrarAuditoria(
          req.user.matricula,
          "UPDATE_SERVICO_SUBESTACAO",
          `Serviço ID ${servicoId} (Proc: ${processo}) atualizado.`,
          connection
        );
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
        arquivosNovos.forEach((f) => {
          if (
            f.path &&
            (f.path.includes("temp") || f.path.includes("upload_"))
          ) {
            try {
              fs.accessSync(f.path);
              fs.unlinkSync(f.path);
            } catch (e) {}
          }
        });
      }
      res
        .status(500)
        .json({
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
    if (isNaN(parseInt(servicoId)))
      return res.status(400).json({ message: `ID inválido: ${servicoId}` });
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        "DELETE FROM servicos_inspecoes_vinculadas WHERE servico_id = ?",
        [servicoId]
      );
      await connection.query(
        "DELETE FROM servico_item_inspecao_defeito WHERE servico_id = ?",
        [servicoId]
      );
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
          .json({ message: `Serviço ${servicoId} não encontrado.` });
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
            if (err.code !== "ENOENT")
              console.warn(
                `Falha ao excluir anexo ${caminhoCompleto} do serviço ${servicoId}: ${err.message}`
              );
          }
        }
        try {
          await fs.rm(servicoUploadDir, { recursive: true, force: true });
        } catch (err) {
          if (err.code !== "ENOENT")
            console.warn(
              `Falha ao remover diretório de anexos do serviço ${servicoId} (${servicoUploadDir}): ${err.message}`
            );
        }
      }
      await connection.commit();
      if (req.user && req.user.matricula)
        await registrarAuditoria(
          req.user.matricula,
          "DELETE_SERVICO_SUBESTACAO",
          `Serviço ID ${servicoId} e dados associados foram excluídos.`,
          connection
        );
      res.json({
        message: `Serviço ID ${servicoId} e seus dados associados foram excluídos com sucesso.`,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao excluir serviço de subestação:", error);
      res
        .status(500)
        .json({
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
      let query = `
        SELECT 
          ss.id, ss.processo, ss.motivo, ss.alimentador, 
          DATE_FORMAT(ss.data_prevista, '%Y-%m-%d') as data_prevista, 
          ss.horario_inicio, ss.horario_fim, ss.status, 
          DATE_FORMAT(ss.data_conclusao, '%Y-%m-%d') as data_conclusao, 
          s.sigla as subestacao_sigla, s.nome as subestacao_nome, 
          u.nome as responsavel_nome, e.tag as equipamento_tag, 
          ss.subestacao_id, ss.responsavel_id, ss.equipamento_id, 
          ud.nome as encarregado_designado_nome, ss.encarregado_designado_id 
        FROM servicos_subestacoes ss 
        JOIN subestacoes s ON ss.subestacao_id = s.Id 
        JOIN users u ON ss.responsavel_id = u.id 
        LEFT JOIN infra_equip e ON ss.equipamento_id = e.id 
        LEFT JOIN users ud ON ss.encarregado_designado_id = ud.id 
        WHERE 1=1`;

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

      const cargosComVisaoTotal = ["ADMIN", "Gerente", "Engenheiro", "ADM"]; // Exemplo de cargos que podem ver tudo, ajuste conforme necessário
      if (
        req.user &&
        req.user.cargo === "Encarregado" &&
        !cargosComVisaoTotal.includes(req.user.cargo)
      ) {
        query += " AND ss.encarregado_designado_id = ?";
        params.push(req.user.id);
      }

      query += " ORDER BY ss.data_prevista DESC, ss.id DESC";
      const [rows] = await promisePool.query(query, params);
      res.json(rows);
    } catch (err) {
      console.error("Erro ao listar serviços (API):", err);
      res
        .status(500)
        .json({ message: "Erro ao listar serviços.", detalhes: err.message });
    }
  }
);

router.get(
  "/api/servicos-subestacoes/:servicoId",
  autenticar,
  podeGerenciarPaginaServicos,
  async (req, res) => {
    const { servicoId } = req.params;
    if (isNaN(parseInt(servicoId)))
      return res.status(400).json({ message: `ID inválido: ${servicoId}` });
    try {
      const [servicoRows] = await promisePool.query(
        `SELECT ss.id,ss.processo,ss.motivo,ss.alimentador,DATE_FORMAT(ss.data_prevista,'%Y-%m-%d') as data_prevista,ss.horario_inicio,ss.horario_fim,ss.status,DATE_FORMAT(ss.data_conclusao,'%Y-%m-%d') as data_conclusao,ss.observacoes_conclusao,s.Id as subestacao_id,s.sigla as subestacao_sigla,s.nome as subestacao_nome,u.id as responsavel_id,u.nome as responsavel_nome,e.id as equipamento_id,e.tag as equipamento_tag,ss.encarregado_designado_id,ud.nome as encarregado_designado_nome FROM servicos_subestacoes ss JOIN subestacoes s ON ss.subestacao_id = s.Id JOIN users u ON ss.responsavel_id = u.id LEFT JOIN infra_equip e ON ss.equipamento_id = e.id LEFT JOIN users ud ON ss.encarregado_designado_id = ud.id WHERE ss.id = ?`,
        [servicoId]
      );
      if (servicoRows.length === 0)
        return res
          .status(404)
          .json({ message: `Serviço ${servicoId} não encontrado.` });
      const servico = servicoRows[0];

      const cargosComVisaoTotal = [
        "ADMIN",
        "Gerente",
        "Engenheiro",
        "ADM",
        "Inspetor",
        "Técnico",
      ];
      if (
        req.user &&
        req.user.cargo === "Encarregado" &&
        servico.encarregado_designado_id !== req.user.id &&
        !cargosComVisaoTotal.includes(req.user.cargo)
      ) {
        return res
          .status(403)
          .json({
            message:
              "Acesso negado. Este serviço não está designado a você ou você não tem permissão para visualizá-lo.",
          });
      }

      const [anexosRows] = await promisePool.query(
        `SELECT id,nome_original,caminho_servidor,tipo_mime,tamanho,categoria_anexo FROM servicos_subestacoes_anexos WHERE id_servico = ? ORDER BY id DESC`,
        [servicoId]
      );
      servico.anexos = anexosRows;

      const [inspecoesVinculadasRows] = await promisePool.query(
        `SELECT i.id as inspecao_id,i.formulario_inspecao_num,DATE_FORMAT(i.data_avaliacao,'%d/%m/%Y') as data_avaliacao_fmt, s.sigla as subestacao_sigla FROM servicos_inspecoes_vinculadas siv JOIN inspecoes_subestacoes i ON siv.inspecao_id = i.id JOIN subestacoes s ON i.subestacao_id = s.Id WHERE siv.servico_id = ? ORDER BY i.data_avaliacao DESC, i.id DESC`,
        [servicoId]
      );
      servico.inspecoes_vinculadas = [];

      for (const inspV of inspecoesVinculadasRows) {
        const [anexosItensInsp] = await promisePool.query(
          `SELECT isa.caminho_servidor, isa.nome_original, isa.item_num_associado 
               FROM inspecoes_subestacoes_anexos isa 
               WHERE isa.inspecao_id = ? AND isa.categoria_anexo = 'FOTO_EVIDENCIA_ITEM' 
               ORDER BY isa.id ASC`,
          [inspV.inspecao_id]
        );
        inspV.anexos_itens_inspecao = anexosItensInsp;
        servico.inspecoes_vinculadas.push(inspV);
      }

      const [mapeamentoDefeitosRows] = await promisePool.query(
        `SELECT siid.inspecao_item_id,siid.catalogo_defeito_id,siid.observacao_especifica_servico,cd.codigo as defeito_codigo,cd.descricao as defeito_descricao,isi.item_num as inspecao_item_num,isi.descricao_item_original as inspecao_item_descricao, ins.id as inspecao_id, ins.formulario_inspecao_num as inspecao_formulario_num FROM servico_item_inspecao_defeito siid JOIN catalogo_defeitos_servicos cd ON siid.catalogo_defeito_id = cd.id JOIN inspecoes_subestacoes_itens isi ON siid.inspecao_item_id = isi.id JOIN inspecoes_subestacoes ins ON isi.inspecao_id = ins.id WHERE siid.servico_id = ? ORDER BY ins.data_avaliacao DESC, ins.id DESC, isi.item_num ASC`,
        [servicoId]
      );
      servico.mapeamento_defeitos_existentes = mapeamentoDefeitosRows;
      res.json(servico);
    } catch (err) {
      console.error("Erro ao buscar detalhes do serviço (API):", err);
      res
        .status(500)
        .json({
          message: "Erro ao buscar detalhes do serviço.",
          detalhes: err.message,
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
        arquivosConclusao.forEach((f) => {
          if (f.path) fs.unlink(f.path).catch(() => {});
        });
      }
      return res
        .status(400)
        .json({
          message: `Serviço (Processo: ${servico.processo}) já está no status ${servico.status}.`,
        });
    }
    if (!data_conclusao_manual) {
      if (arquivosConclusao && arquivosConclusao.length > 0) {
        arquivosConclusao.forEach((f) => {
          if (f.path) fs.unlink(f.path).catch(() => {});
        });
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
      if (!dataConclusaoFinal)
        dataConclusaoFinal = new Date().toISOString().split("T")[0];

      let updateQuery =
        "UPDATE servicos_subestacoes SET status = 'CONCLUIDO', data_conclusao = ?, observacoes_conclusao = ?";
      const updateParams = [dataConclusaoFinal, observacoesFinais];
      if (horarioConclusaoFinal) {
        updateQuery += ", horario_fim = IFNULL(horario_fim, ?)";
        updateParams.push(horarioConclusaoFinal);
      } else {
        const horaAtualFormatada = new Date().toLocaleTimeString("pt-BR", {
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
            `INSERT INTO servicos_subestacoes_anexos (id_servico, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo, descricao_anexo) VALUES (?,?,?,?,?,?,?)`,
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
          `Serviço ID ${servicoId} (Proc: ${servico.processo}) CONCLUÍDO. Data: ${dataConclusaoFinal}. Anexos: ${anexosSalvosConclusaoInfo.length}`,
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
        arquivosConclusao.forEach((f) => {
          if (
            f.path &&
            (f.path.includes("temp") || f.path.includes("upload_"))
          ) {
            try {
              fs.accessSync(f.path);
              fs.unlinkSync(f.path);
            } catch (e) {}
          }
        });
      }
      for (const caminho of arquivosMovidosComSucesso) {
        try {
          await fs.unlink(caminho);
        } catch (e) {}
      }
      res
        .status(500)
        .json({
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
      return res
        .status(400)
        .json({
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
          `Serviço ID ${servicoId} (Proc: ${servico.processo}) reaberto.`,
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
      res
        .status(500)
        .json({
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
        encarregado_designado_id &&
        encarregado_designado_id !== "" &&
        !isNaN(parseInt(encarregado_designado_id))
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
      res
        .status(500)
        .json({
          message: "Erro interno ao designar/desvincular encarregado.",
          detalhes: error.message,
        });
    } finally {
      if (connection) connection.release();
    }
  }
);

module.exports = router;
