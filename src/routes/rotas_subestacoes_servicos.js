const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const {
  promisePool,
  upload,
  projectRootDir,
  uploadsSubestacoesDir,
} = require("../init");
const { autenticar, verificarNivel, registrarAuditoria } = require("../auth");

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
    res.status(500).json({ message: "Erro interno ao verificar serviço." });
  }
}

router.get(
  "/pagina-servicos-subestacoes",
  autenticar,
  verificarNivel(3),
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
  "/pagina-servicos-concluidos",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/servicos-concluidos.html"
      )
    );
  }
);

router.get(
  "/registrar-servico-subestacao",
  autenticar,
  verificarNivel(3),
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
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/servico-detalhes-pagina.html"
      )
    );
  }
);

router.get(
  "/servicos/:servicoId/detalhes-concluido",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/servico-concluido-detalhes.html"
      )
    );
  }
);

router.get(
  "/usuarios-responsaveis-para-servicos",
  autenticar,
  verificarNivel(3),
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
      res
        .status(500)
        .json({ message: "Erro ao buscar usuários responsáveis." });
    }
  }
);

router.get(
  "/usuarios-encarregados-e-inspetores",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    try {
      const cargosParaEncarregados = ["Encarregado", "Inspetor", "Técnico"];
      const placeholders = cargosParaEncarregados.map(() => "?").join(",");
      const query = `SELECT id, nome FROM users WHERE cargo IN (${placeholders}) ORDER BY nome ASC`;
      const [rows] = await promisePool.query(query, cargosParaEncarregados);
      res.json(rows);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Erro ao buscar encarregados e inspetores." });
    }
  }
);

router.get(
  "/api/catalogo-defeitos-servicos",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    try {
      const [rows] = await promisePool.query(
        "SELECT id, codigo, ponto_defeito, descricao, categoria_principal FROM catalogo_defeitos_servicos ORDER BY codigo ASC"
      );
      res.json(rows);
    } catch (error) {
      res.status(500).json({
        message: "Erro ao buscar catálogo de defeitos.",
        detalhes: error.message,
      });
    }
  }
);

router.post(
  "/api/servicos-subestacoes",
  autenticar,
  verificarNivel(3),
  upload.any(),
  async (req, res) => {
    const {
      subestacao_id,
      processo,
      motivo,
      data_prevista,
      horario_inicio,
      horario_fim,
      responsavel_id,
      status,
      prioridade,
      data_conclusao,
      observacoes_conclusao,
      inspecao_ids_vinculadas,
      itens_escopo,
      tipo_ordem,
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
      if (arquivos?.length)
        arquivos.forEach((f) => {
          if (f.path) fs.unlink(f.path).catch(() => {});
        });
      return res.status(400).json({ message: "Campos obrigatórios faltando." });
    }
    if (status === "CONCLUIDO" && !data_conclusao) {
      if (arquivos?.length)
        arquivos.forEach((f) => {
          if (f.path) fs.unlink(f.path).catch(() => {});
        });
      return res.status(400).json({
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
        if (arquivos?.length)
          arquivos.forEach((f) => {
            if (f.path) fs.unlink(f.path).catch(() => {});
          });
        return res.status(400).json({
          message: "Erro ao processar IDs de inspeção vinculadas.",
          detalhes: e.message,
        });
      }
    }
    let parsedItensEscopo = [];
    if (itens_escopo) {
      try {
        parsedItensEscopo = JSON.parse(itens_escopo);
        if (!Array.isArray(parsedItensEscopo))
          throw new Error("Formato inválido para itens_escopo.");
        for (const item of parsedItensEscopo) {
          if (!item.descricao_item_servico && !item.catalogo_defeito_id) {
            throw new Error(
              "Cada item de escopo deve ter uma descrição ou um código de defeito do catálogo."
            );
          }
        }
      } catch (e) {
        if (arquivos?.length)
          arquivos.forEach((f) => {
            if (f.path) fs.unlink(f.path).catch(() => {});
          });
        return res.status(400).json({
          message: "Erro ao processar itens de escopo do serviço.",
          detalhes: e.message,
        });
      }
    }

    const connection = await promisePool.getConnection();
    let novoServicoId;
    let arquivosMovidosComSucesso = [];

    try {
      await connection.beginTransaction();
      const dataConclusaoFinal = status === "CONCLUIDO" ? data_conclusao : null;
      const observacoesConclusaoFinal =
        status === "CONCLUIDO" ? observacoes_conclusao : null;

      const [resultServico] = await connection.query(
        `INSERT INTO servicos_subestacoes (subestacao_id, processo, motivo, data_prevista, horario_inicio, horario_fim, responsavel_id, status, prioridade, data_conclusao, observacoes_conclusao, tipo_ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          parseInt(subestacao_id),
          processo,
          motivo,
          data_prevista,
          horario_inicio,
          horario_fim,
          parseInt(responsavel_id),
          status || "PROGRAMADO",
          prioridade || "MEDIA",
          dataConclusaoFinal,
          observacoesConclusaoFinal,
          tipo_ordem || null,
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

      const itemDbIdMap = new Map();
      for (const itemEscopo of parsedItensEscopo) {
        const catalogoDefeitoIdFinal =
          itemEscopo.catalogo_defeito_id &&
          !isNaN(parseInt(itemEscopo.catalogo_defeito_id))
            ? parseInt(itemEscopo.catalogo_defeito_id)
            : null;
        const inspecaoItemIdFinal =
          itemEscopo.inspecao_item_id &&
          !isNaN(parseInt(itemEscopo.inspecao_item_id))
            ? parseInt(itemEscopo.inspecao_item_id)
            : null;
        const encarregadoItemIdFinal =
          itemEscopo.encarregado_item_id &&
          itemEscopo.encarregado_item_id !== "" &&
          !isNaN(parseInt(itemEscopo.encarregado_item_id))
            ? parseInt(itemEscopo.encarregado_item_id)
            : null;
        const statusItemEscopoFinal =
          itemEscopo.status_item_escopo || "PENDENTE";
        const catalogoEquipamentoId = itemEscopo.catalogo_equipamento_id
          ? parseInt(itemEscopo.catalogo_equipamento_id)
          : null;
        const tagEquipamentoAlvo = itemEscopo.tag_equipamento_alvo || null;

        const [resultItem] = await connection.query(
          `INSERT INTO servico_itens_escopo (servico_id, catalogo_defeito_id, inspecao_item_id, descricao_item_servico, observacao_especifica_servico, encarregado_item_id, status_item_escopo, tag_equipamento_alvo, catalogo_equipamento_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            novoServicoId,
            catalogoDefeitoIdFinal,
            inspecaoItemIdFinal,
            itemEscopo.descricao_item_servico,
            itemEscopo.observacao_especifica_servico || null,
            encarregadoItemIdFinal,
            statusItemEscopoFinal,
            tagEquipamentoAlvo,
            catalogoEquipamentoId,
          ]
        );
        const novoItemEscopoId = resultItem.insertId;
        if (itemEscopo.temp_id) {
          itemDbIdMap.set(itemEscopo.temp_id, novoItemEscopoId);
        }

        if (itemEscopo.inspecao_item_id) {
          let queryAnexos = `SELECT nome_original, caminho_servidor, tipo_mime, tamanho FROM inspecoes_anexos WHERE item_resposta_id = ?`;
          const paramsAnexos = [itemEscopo.inspecao_item_id];

          if (itemEscopo.inspecao_especificacao_id) {
            queryAnexos += ` AND item_especificacao_id = ?`;
            paramsAnexos.push(itemEscopo.inspecao_especificacao_id);
          } else {
            queryAnexos += ` AND item_especificacao_id IS NULL`;
          }

          const [anexosDaInspecao] = await connection.query(
            queryAnexos,
            paramsAnexos
          );

          for (const anexo of anexosDaInspecao) {
            await connection.query(
              `INSERT INTO servico_item_escopo_anexos (item_escopo_id, nome_original, caminho_servidor, tipo_mime, tamanho) VALUES (?, ?, ?, ?, ?)`,
              [
                novoItemEscopoId,
                anexo.nome_original,
                anexo.caminho_servidor,
                anexo.tipo_mime,
                anexo.tamanho,
              ]
            );
          }
        }
      }

      const servicoUploadDir = path.join(
        uploadsSubestacoesDir,
        "servicos",
        `servico_${String(novoServicoId)}`
      );
      await fsPromises.mkdir(servicoUploadDir, { recursive: true });

      for (const file of arquivos) {
        const nomeUnicoArquivo = `${Date.now()}_${file.originalname.replace(
          /[^a-zA-Z0-9.\-_]/g,
          "_"
        )}`;
        const caminhoDestino = path.join(servicoUploadDir, nomeUnicoArquivo);
        await fsPromises.rename(file.path, caminhoDestino);
        arquivosMovidosComSucesso.push(caminhoDestino);
        const caminhoRelativoServidor = `servicos/servico_${novoServicoId}/${nomeUnicoArquivo}`;

        if (file.fieldname.startsWith("item_anexo__")) {
          const tempId = file.fieldname.split("__")[1];
          const itemEscopoId = itemDbIdMap.get(tempId);
          if (itemEscopoId) {
            await connection.query(
              `INSERT INTO servico_item_escopo_anexos (item_escopo_id, nome_original, caminho_servidor, tipo_mime, tamanho) VALUES (?, ?, ?, ?, ?)`,
              [
                itemEscopoId,
                file.originalname,
                `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
                file.mimetype,
                file.size,
              ]
            );
          }
        } else {
          await connection.query(
            `INSERT INTO servicos_subestacoes_anexos (id_servico, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              novoServicoId,
              file.originalname,
              `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
              file.mimetype,
              file.size,
              "DOCUMENTO_REGISTRO",
            ]
          );
        }
      }

      await connection.commit();
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "CREATE_SERVICO_SUBESTACAO",
          `Serviço ID ${novoServicoId} (Proc: ${processo}) criado.`,
          connection
        );
      }
      res.status(201).json({
        id: novoServicoId,
        message: "Serviço registrado com sucesso!",
      });
    } catch (error) {
      await connection.rollback();
      for (const caminho of arquivosMovidosComSucesso) {
        try {
          await fsPromises.unlink(caminho);
        } catch (e) {}
      }
      if (arquivos?.length)
        arquivos.forEach((f) => {
          if (f.path?.includes("temp") || f.path?.includes("upload_")) {
            try {
              if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
            } catch (e) {}
          }
        });
      res.status(500).json({
        message: "Erro interno ao criar serviço.",
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
  verificarNivel(3),
  upload.any(),
  async (req, res) => {
    const { servicoId } = req.params;
    const {
      subestacao_id,
      processo,
      motivo,
      data_prevista,
      horario_inicio,
      horario_fim,
      responsavel_id,
      status,
      prioridade,
      tipo_ordem,
      itensParaDeletar,
      anexosParaDeletar,
      novosItens,
    } = req.body;
    const novosArquivos = req.files;

    if (isNaN(parseInt(servicoId))) {
      return res.status(400).json({ message: `ID inválido: ${servicoId}` });
    }

    const connection = await promisePool.getConnection();
    let arquivosMovidosComSucesso = [];

    try {
      await connection.beginTransaction();

      const parsedItensParaDeletar = JSON.parse(itensParaDeletar || "[]");
      if (parsedItensParaDeletar.length > 0) {
        await connection.query(
          "DELETE FROM servico_item_escopo_anexos WHERE item_escopo_id IN (?)",
          [parsedItensParaDeletar]
        );
        await connection.query(
          "DELETE FROM servico_itens_escopo WHERE id IN (?)",
          [parsedItensParaDeletar]
        );
      }

      const parsedAnexosParaDeletar = JSON.parse(anexosParaDeletar || "[]");
      if (parsedAnexosParaDeletar.length > 0) {
        const [anexosGeraisDb] = await connection.query(
          "SELECT id, caminho_servidor FROM servicos_subestacoes_anexos WHERE id IN (?)",
          [parsedAnexosParaDeletar]
        );
        const [anexosItensDb] = await connection.query(
          "SELECT id, caminho_servidor FROM servico_item_escopo_anexos WHERE id IN (?)",
          [parsedAnexosParaDeletar]
        );

        const todosAnexosParaDeletar = [...anexosGeraisDb, ...anexosItensDb];

        for (const anexo of todosAnexosParaDeletar) {
          if (anexo.caminho_servidor) {
            const fullPath = path.join(
              projectRootDir,
              "public",
              anexo.caminho_servidor
            );
            fsPromises.unlink(fullPath).catch((err) =>
              console.warn(`Falha ao deletar arquivo físico: ${fullPath}`)
            );
          }
        }

        if (anexosGeraisDb.length > 0) {
          await connection.query(
            "DELETE FROM servicos_subestacoes_anexos WHERE id IN (?)",
            [parsedAnexosParaDeletar]
          );
        }
        if (anexosItensDb.length > 0) {
          await connection.query(
            "DELETE FROM servico_item_escopo_anexos WHERE id IN (?)",
            [parsedAnexosParaDeletar]
          );
        }
      }

      await connection.query(
        `UPDATE servicos_subestacoes SET
          subestacao_id = ?, processo = ?, motivo = ?, data_prevista = ?,
          horario_inicio = ?, horario_fim = ?, responsavel_id = ?,
          status = ?, prioridade = ?, tipo_ordem = ?
        WHERE id = ?`,
        [
          subestacao_id,
          processo,
          motivo,
          data_prevista,
          horario_inicio,
          horario_fim,
          responsavel_id,
          status,
          prioridade,
          tipo_ordem,
          servicoId,
        ]
      );

      const parsedNovosItens = JSON.parse(novosItens || "[]");
      const itemTempIdMap = new Map();
      for (const item of parsedNovosItens) {
        const [result] = await connection.query(
          `INSERT INTO servico_itens_escopo (servico_id, descricao_item_servico, tag_equipamento_alvo, catalogo_defeito_id, catalogo_equipamento_id, status_item_escopo) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            servicoId,
            item.descricao_item_servico,
            item.tag_equipamento_alvo,
            item.catalogo_defeito_id,
            item.catalogo_equipamento_id,
            "PENDENTE",
          ]
        );
        itemTempIdMap.set(item.temp_id, result.insertId);
      }

      const servicoUploadDir = path.join(
        uploadsSubestacoesDir,
        "servicos",
        `servico_${String(servicoId)}`
      );
      await fsPromises.mkdir(servicoUploadDir, { recursive: true });

      for (const file of novosArquivos) {
        const nomeUnicoArquivo = `${Date.now()}_${file.originalname.replace(
          /[^a-zA-Z0-9.\-_]/g,
          "_"
        )}`;
        const caminhoDestino = path.join(servicoUploadDir, nomeUnicoArquivo);
        await fsPromises.rename(file.path, caminhoDestino);
        arquivosMovidosComSucesso.push(caminhoDestino);
        const caminhoRelativoServidor = `servicos/servico_${servicoId}/${nomeUnicoArquivo}`;

        const fieldParts = file.fieldname.split("_");
        const parentId = fieldParts.slice(1).join("_");

        if (parentId === "geral") {
          await connection.query(
            `INSERT INTO servicos_subestacoes_anexos (id_servico, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              servicoId,
              file.originalname,
              `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
              file.mimetype,
              file.size,
              "DOCUMENTO_GERAL",
            ]
          );
        } else {
          const itemEscopoId = itemTempIdMap.get(parentId) || parentId;
          await connection.query(
            `INSERT INTO servico_item_escopo_anexos (item_escopo_id, nome_original, caminho_servidor, tipo_mime, tamanho) VALUES (?, ?, ?, ?, ?)`,
            [
              itemEscopoId,
              file.originalname,
              `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
              file.mimetype,
              file.size,
            ]
          );
        }
      }

      await connection.commit();
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "UPDATE_SERVICO_SUBESTACAO_FULL",
          `Serviço ID ${servicoId} (Proc: ${processo}) atualizado com itens e anexos.`
        );
      }
      res.json({ message: "Serviço atualizado com sucesso!" });
    } catch (error) {
      await connection.rollback();
      for (const caminho of arquivosMovidosComSucesso) {
        try {
          await fsPromises.unlink(caminho);
        } catch (e) {}
      }
      res.status(500).json({
        message: "Erro interno ao atualizar serviço.",
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
  verificarNivel(3),
  async (req, res) => {
    const { servicoId } = req.params;
    if (isNaN(parseInt(servicoId)))
      return res.status(400).json({ message: `ID inválido: ${servicoId}` });
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();

      const [itensEscopoParaDeletar] = await connection.query(
        "SELECT id FROM servico_itens_escopo WHERE servico_id = ?",
        [servicoId]
      );
      if (itensEscopoParaDeletar.length > 0) {
        const idsItensEscopo = itensEscopoParaDeletar.map((item) => item.id);
        await connection.query(
          "DELETE FROM servico_item_escopo_anexos WHERE item_escopo_id IN (?)",
          [idsItensEscopo]
        );
      }

      await connection.query(
        "DELETE FROM servico_itens_escopo WHERE servico_id = ?",
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

      const servicoUploadDir = path.join(
        uploadsSubestacoesDir,
        "servicos",
        `servico_${String(servicoId)}`
      );
      await fsPromises
        .rm(servicoUploadDir, { recursive: true, force: true })
        .catch((err) => {
          if (err.code !== "ENOENT")
            console.warn(
              `Falha ao remover diretório de anexos do serviço ${servicoId}: ${err.message}`
            );
        });

      await connection.commit();
      if (req.user && req.user.matricula)
        await registrarAuditoria(
          req.user.matricula,
          "DELETE_SERVICO_SUBESTACAO",
          `Serviço ID ${servicoId} e dados associados foram excluídos.`,
          connection
        );
      res.json({
        message: `Serviço ID ${servicoId} e seus dados associados excluídos com sucesso.`,
      });
    } catch (error) {
      await connection.rollback();
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
  verificarNivel(3),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const offset = (page - 1) * limit;

      let whereClauses = "WHERE 1=1";
      const params = [];
      const countParams = [];

      if (req.query.status) {
        if (req.query.status === "CONCLUIDO") {
          whereClauses +=
            " AND ss.status IN ('CONCLUIDO', 'CONCLUIDO_COM_RESSALVAS', 'CONCLUIDO_COM_PENDENCIA')";
        } else {
          whereClauses += " AND ss.status = ?";
          params.push(req.query.status);
        }
      } else {
        whereClauses +=
          " AND ss.status NOT IN ('CONCLUIDO', 'CANCELADO', 'CONCLUIDO_COM_RESSALVAS', 'CONCLUIDO_COM_PENDENCIA')";
      }

      if (req.query.subestacao_id) {
        whereClauses += " AND ss.subestacao_id = ?";
        params.push(req.query.subestacao_id);
      }
      if (req.query.processo) {
        whereClauses += " AND ss.processo LIKE ?";
        params.push(`%${req.query.processo}%`);
      }
      if (req.query.data_prevista_de) {
        whereClauses += " AND ss.data_prevista >= ?";
        params.push(req.query.data_prevista_de);
      }
      if (req.query.data_prevista_ate) {
        whereClauses += " AND ss.data_prevista <= ?";
        params.push(req.query.data_prevista_ate);
      }
      if (req.query.data_conclusao_de) {
        whereClauses += " AND ss.data_conclusao >= ?";
        params.push(req.query.data_conclusao_de);
      }
      if (req.query.data_conclusao_ate) {
        whereClauses += " AND ss.data_conclusao <= ?";
        params.push(req.query.data_conclusao_ate);
      }

      const cargosComVisaoTotal = ["ADMIN", "Gerente", "Engenheiro", "ADM"];
      if (
        req.user &&
        (req.user.cargo === "Encarregado" || req.user.cargo === "Inspetor") &&
        !cargosComVisaoTotal.includes(req.user.cargo)
      ) {
        whereClauses +=
          " AND EXISTS (SELECT 1 FROM servico_itens_escopo sie_filter WHERE sie_filter.servico_id = ss.id AND sie_filter.encarregado_item_id = ?)";
        params.push(req.user.id);
      }

      countParams.push(...params);

      const orderByClause =
        "ORDER BY FIELD(ss.prioridade, 'GRAVE', 'ALTA', 'MEDIA', 'BAIXA'), ss.data_prevista ASC, ss.id DESC";
      const limitOffsetClause = "LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const dataQuery = `
          SELECT
            ss.id, ss.processo, ss.motivo, ss.tipo_ordem, ss.prioridade,
            DATE_FORMAT(ss.data_prevista, '%Y-%m-%d') as data_prevista,
            ss.horario_inicio, ss.horario_fim, ss.status,
            DATE_FORMAT(ss.data_conclusao, '%Y-%m-%d') as data_conclusao,
            s.sigla as subestacao_sigla, s.nome as subestacao_nome,
            u.nome as responsavel_nome,
            (SELECT GROUP_CONCAT(DISTINCT u2.nome ORDER BY u2.nome SEPARATOR ', ')
              FROM servico_itens_escopo sie_enc
              LEFT JOIN users u2 ON sie_enc.encarregado_item_id = u2.id
              WHERE sie_enc.servico_id = ss.id AND sie_enc.encarregado_item_id IS NOT NULL) as encarregados_itens_nomes,
            (SELECT COUNT(*) FROM servico_itens_escopo sie_total WHERE sie_total.servico_id = ss.id) as total_itens,
            (SELECT COUNT(*) FROM servico_itens_escopo sie_conc WHERE sie_conc.servico_id = ss.id AND sie_conc.status_item_escopo LIKE 'CONCLUIDO%') as itens_concluidos,
            (SELECT COUNT(*) FROM servicos_subestacoes_anexos WHERE id_servico = ss.id AND categoria_anexo = 'APR') as apr_count,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', id, 'caminho_servidor', caminho_servidor, 'nome_original', nome_original)) FROM servicos_subestacoes_anexos WHERE id_servico = ss.id AND categoria_anexo = 'APR') as apr_anexos
          FROM servicos_subestacoes ss
          JOIN subestacoes s ON ss.subestacao_id = s.Id
          JOIN users u ON ss.responsavel_id = u.id
          ${whereClauses}
          ${orderByClause}
          ${limitOffsetClause}`;

      const countQuery = `
          SELECT COUNT(ss.id) as total
          FROM servicos_subestacoes ss
          JOIN subestacoes s ON ss.subestacao_id = s.Id
          JOIN users u ON ss.responsavel_id = u.id
          ${whereClauses}`;

      const [rows] = await promisePool.query(dataQuery, params);
      const [countRows] = await promisePool.query(countQuery, countParams);
      const totalItems = countRows[0].total;

      res.json({
        data: rows,
        total: totalItems,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalItems / limit),
      });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Erro ao listar serviços.", detalhes: err.message });
    }
  }
);

router.get(
  "/api/servicos-subestacoes/:servicoId",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { servicoId } = req.params;
    if (isNaN(parseInt(servicoId)))
      return res.status(400).json({ message: `ID inválido: ${servicoId}` });
    try {
      const [servicoRows] = await promisePool.query(
        `SELECT ss.id,ss.processo,ss.motivo,ss.tipo_ordem,ss.prioridade, DATE_FORMAT(ss.data_prevista,'%Y-%m-%d') as data_prevista,ss.horario_inicio,ss.horario_fim,ss.status,DATE_FORMAT(ss.data_conclusao,'%Y-%m-%d') as data_conclusao,ss.observacoes_conclusao,s.Id as subestacao_id,s.sigla as subestacao_sigla,s.nome as subestacao_nome,u.id as responsavel_id,u.nome as responsavel_nome FROM servicos_subestacoes ss JOIN subestacoes s ON ss.subestacao_id = s.Id JOIN users u ON ss.responsavel_id = u.id WHERE ss.id = ?`,
        [servicoId]
      );
      if (servicoRows.length === 0)
        return res
          .status(404)
          .json({ message: `Serviço ${servicoId} não encontrado.` });
      const servico = servicoRows[0];

      const [anexosRows] = await promisePool.query(
        `SELECT id,nome_original,caminho_servidor,tipo_mime,tamanho,categoria_anexo FROM servicos_subestacoes_anexos WHERE id_servico = ? ORDER BY id DESC`,
        [servicoId]
      );
      servico.anexos = anexosRows;

      const [itensEscopoRows] = await promisePool.query(
        `SELECT
              sie.id as item_escopo_id,
              sie.catalogo_defeito_id,
              sie.inspecao_item_id,
              sie.descricao_item_servico,
              sie.observacao_especifica_servico,
              sie.encarregado_item_id,
              usr_enc.nome as encarregado_item_nome,
              sie.status_item_escopo,
              sie.data_conclusao_item,
              sie.observacoes_conclusao_item,
              sie.tag_equipamento_alvo,
              sie.catalogo_equipamento_id,
              cat_equip.nome as catalogo_equipamento_nome,
              cat_equip.codigo as catalogo_equipamento_codigo,
              cd.codigo as defeito_codigo,
              cd.descricao as defeito_descricao,
              iir.inspecao_id as origem_inspecao_id,
              ins.formulario_inspecao_num as origem_inspecao_formulario_num,
              (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', anexo.id, 'nome_original', anexo.nome_original, 'caminho_servidor', anexo.caminho_servidor, 'tipo_mime', anexo.tipo_mime)) FROM servico_item_escopo_anexos anexo WHERE anexo.item_escopo_id = sie.id) as anexos
          FROM servico_itens_escopo sie
          LEFT JOIN catalogo_defeitos_servicos cd ON sie.catalogo_defeito_id = cd.id
          LEFT JOIN users usr_enc ON sie.encarregado_item_id = usr_enc.id
          LEFT JOIN catalogo_equipamentos cat_equip ON sie.catalogo_equipamento_id = cat_equip.id
          LEFT JOIN inspecoes_itens_respostas iir ON sie.inspecao_item_id = iir.id
          LEFT JOIN inspecoes_subestacoes ins ON iir.inspecao_id = ins.id
          WHERE sie.servico_id = ?
          GROUP BY sie.id
          ORDER BY sie.id ASC`,
        [servicoId]
      );

      servico.itens_escopo = itensEscopoRows.map((item) => {
        item.anexos = item.anexos ? JSON.parse(item.anexos) : [];
        return item;
      });

      res.json(servico);
    } catch (err) {
      res.status(500).json({
        message: "Erro ao buscar detalhes do serviço.",
        detalhes: err.message,
      });
    }
  }
);

router.put(
  "/api/servicos-subestacoes/:servicoId/reabrir",
  autenticar,
  verificarNivel(3),
  verificarServicoExiste,
  async (req, res) => {
    const { servicoId } = req.params;
    const { servico } = req;

    const statusPermitidosParaReabertura = [
      "CONCLUIDO",
      "CANCELADO",
      "CONCLUIDO_COM_PENDENCIA",
      "CONCLUIDO_COM_RESSALVAS",
    ];
    if (!statusPermitidosParaReabertura.includes(servico.status)) {
      return res.status(400).json({
        message: `Serviço (Processo: ${servico.processo}) com status ${servico.status} não pode ser reaberto.`,
      });
    }

    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        "UPDATE servicos_subestacoes SET status = 'EM_ANDAMENTO', data_conclusao = NULL, observacoes_conclusao = NULL WHERE id = ?",
        [servicoId]
      );

      await connection.query(
        `UPDATE servico_itens_escopo 
         SET status_item_escopo = 'PENDENTE', data_conclusao_item = NULL, observacoes_conclusao_item = NULL 
         WHERE servico_id = ? AND status_item_escopo IN ('CONCLUIDO_COM_PENDENCIA', 'NAO_CONCLUIDO', 'CONCLUIDO_COM_RESSALVAS')`,
        [servicoId]
      );

      if (req.user?.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "REOPEN_SERVICO_SUBESTACAO",
          `Serviço ${servicoId} (Proc: ${servico.processo}) reaberto.`,
          connection
        );
      }
      await connection.commit();
      res.json({
        message: `Serviço (Processo: ${servico.processo}) reaberto! Status: EM ANDAMENTO.`,
      });
    } catch (error) {
      await connection.rollback();
      res
        .status(500)
        .json({ message: "Erro interno ao reabrir.", detalhes: error.message });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.put(
  "/api/servicos/:servicoId/atualizar-encarregados-itens",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { servicoId } = req.params;
    const { atualizacoes_encarregados } = req.body;

    if (isNaN(parseInt(servicoId, 10))) {
      return res.status(400).json({ message: "ID do serviço inválido." });
    }
    if (
      !Array.isArray(atualizacoes_encarregados) ||
      atualizacoes_encarregados.length === 0
    ) {
      return res.status(400).json({
        message:
          "Nenhuma atualização de encarregado fornecida ou formato inválido.",
      });
    }

    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();

      const [servicoInfo] = await promisePool.query(
        "SELECT processo FROM servicos_subestacoes WHERE id = ?",
        [servicoId]
      );
      if (servicoInfo.length === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({ message: `Serviço com ID ${servicoId} não encontrado.` });
      }
      const processoServico = servicoInfo[0].processo;

      let logDetalhes = [
        `Serviço Proc: ${processoServico}, Itens atualizados (Encarregados):`,
      ];

      for (const atualizacao of atualizacoes_encarregados) {
        const itemEscopoId = parseInt(atualizacao.item_escopo_id, 10);
        const novoEncarregadoId = atualizacao.novo_encarregado_item_id
          ? parseInt(atualizacao.novo_encarregado_item_id, 10)
          : null;

        if (isNaN(itemEscopoId)) {
          continue;
        }

        const [itemCheck] = await connection.query(
          "SELECT servico_id FROM servico_itens_escopo WHERE id = ?",
          [itemEscopoId]
        );
        if (
          itemCheck.length === 0 ||
          itemCheck[0].servico_id !== parseInt(servicoId, 10)
        ) {
          continue;
        }

        await connection.query(
          "UPDATE servico_itens_escopo SET encarregado_item_id = ? WHERE id = ?",
          [novoEncarregadoId, itemEscopoId]
        );
        logDetalhes.push(
          `- ItemID ${itemEscopoId} -> EncID ${novoEncarregadoId || "Nenhum"}`
        );
      }

      if (req.user?.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "UPDATE_ENCARREGADOS_ITENS_SERVICO",
          logDetalhes.join(" "),
          connection
        );
      }

      await connection.commit();
      res.json({ message: "Encarregados dos itens atualizados com sucesso." });
    } catch (error) {
      await connection.rollback();
      res.status(500).json({
        message: "Erro interno ao atualizar encarregados dos itens.",
        detalhes: error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.post(
  "/api/servicos/:servicoId/anexar-posterior",
  autenticar,
  verificarNivel(3),
  upload.array("anexosServico", 5),
  async (req, res) => {
    const { servicoId } = req.params;
    const { descricao_anexo } = req.body;
    const arquivos = req.files;

    if (!arquivos || arquivos.length === 0) {
      return res.status(400).json({ message: "Nenhum arquivo enviado." });
    }

    const connection = await promisePool.getConnection();
    let arquivosMovidosComSucesso = [];
    try {
      await connection.beginTransaction();

      const servicoUploadDir = path.join(
        uploadsSubestacoesDir,
        "servicos",
        `servico_${String(servicoId)}`
      );
      await fsPromises.mkdir(servicoUploadDir, { recursive: true });

      for (const file of arquivos) {
        const nomeUnicoArquivo = `${Date.now()}_POST_${file.originalname.replace(
          /[^a-zA-Z0-9.\-_]/g,
          "_"
        )}`;
        const caminhoDestino = path.join(servicoUploadDir, nomeUnicoArquivo);
        await fsPromises.rename(file.path, caminhoDestino);
        arquivosMovidosComSucesso.push(caminhoDestino);

        const caminhoRelativoServidor = `servicos/servico_${servicoId}/${nomeUnicoArquivo}`;
        await connection.query(
          `INSERT INTO servicos_subestacoes_anexos (id_servico, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo, descricao_anexo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            servicoId,
            file.originalname,
            `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
            file.mimetype,
            file.size,
            "ANEXO_POSTERIOR",
            descricao_anexo || "Anexo posterior",
          ]
        );
      }

      await connection.commit();
      res.status(201).json({ message: "Anexos adicionados com sucesso!" });
    } catch (error) {
      await connection.rollback();
      for (const caminho of arquivosMovidosComSucesso) {
        try {
          await fsPromises.unlink(caminho);
        } catch (e) {}
      }
      res.status(500).json({
        message: "Erro ao adicionar anexos.",
        detalhes: error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.post(
  "/api/servicos/:servicoId/anexar-apr",
  autenticar,
  verificarNivel(3),
  verificarServicoExiste,
  upload.array("anexosAPR", 5),
  async (req, res) => {
    const { servicoId } = req.params;
    const arquivos = req.files;

    if (!arquivos || arquivos.length === 0) {
      return res
        .status(400)
        .json({ message: "Nenhum arquivo de APR enviado." });
    }

    const connection = await promisePool.getConnection();
    let arquivosMovidosComSucesso = [];
    try {
      await connection.beginTransaction();

      const servicoUploadDir = path.join(
        uploadsSubestacoesDir,
        "servicos",
        `servico_${String(servicoId)}`
      );
      await fsPromises.mkdir(servicoUploadDir, { recursive: true });

      for (const file of arquivos) {
        const nomeUnicoArquivo = `${Date.now()}_APR_${file.originalname.replace(
          /[^a-zA-Z0-9.\-_]/g,
          "_"
        )}`;
        const caminhoDestino = path.join(servicoUploadDir, nomeUnicoArquivo);
        await fsPromises.rename(file.path, caminhoDestino);
        arquivosMovidosComSucesso.push(caminhoDestino);

        const caminhoRelativoServidor = `servicos/servico_${servicoId}/${nomeUnicoArquivo}`;
        await connection.query(
          `INSERT INTO servicos_subestacoes_anexos (id_servico, nome_original, caminho_servidor, tipo_mime, tamanho, categoria_anexo) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            servicoId,
            file.originalname,
            `/upload_arquivos_subestacoes/${caminhoRelativoServidor}`,
            file.mimetype,
            file.size,
            "APR",
          ]
        );
      }

      await connection.commit();
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "UPLOAD_APR_SERVICO",
          `APR(s) anexada(s) ao Serviço ID ${servicoId}.`
        );
      }
      res.status(201).json({ message: "APR(s) anexada(s) com sucesso!" });
    } catch (error) {
      await connection.rollback();
      for (const caminho of arquivosMovidosComSucesso) {
        try {
          await fsPromises.unlink(caminho);
        } catch (e) {}
      }
      res.status(500).json({
        message: "Erro ao anexar APR.",
        detalhes: error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.delete(
  "/api/servicos/anexos/:anexoId",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { anexoId } = req.params;
    if (isNaN(parseInt(anexoId, 10))) {
      return res.status(400).json({ message: "ID do anexo inválido." });
    }

    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();

      const [anexoRows] = await connection.query(
        "SELECT caminho_servidor, nome_original FROM servicos_subestacoes_anexos WHERE id = ?",
        [anexoId]
      );

      if (anexoRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: "Anexo não encontrado." });
      }

      const anexo = anexoRows[0];
      if (anexo.caminho_servidor) {
        const fullPath = path.join(
          projectRootDir,
          "public",
          anexo.caminho_servidor
        );
        try {
          await fsPromises.unlink(fullPath);
        } catch (err) {
          if (err.code !== "ENOENT") {
            console.warn(
              `Falha ao deletar arquivo físico do anexo ${anexoId}: ${fullPath}`
            );
          }
        }
      }

      await connection.query(
        "DELETE FROM servicos_subestacoes_anexos WHERE id = ?",
        [anexoId]
      );

      await connection.commit();

      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "DELETE_ANEXO_SERVICO",
          `Anexo ID ${anexoId} (Nome: ${anexo.nome_original}) foi excluído.`
        );
      }

      res.json({ message: "Anexo excluído com sucesso." });
    } catch (error) {
      await connection.rollback();
      res.status(500).json({
        message: "Erro interno ao excluir o anexo.",
        detalhes: error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.put(
  "/api/servicos/item/:itemEscopoId/concluir",
  autenticar,
  verificarNivel(3),
  upload.array("anexos_conclusao_item", 5),
  async (req, res) => {
    const { itemEscopoId } = req.params;
    const { data_conclusao, observacoes_conclusao, status_item } = req.body;
    const arquivosConclusao = req.files;

    if (!itemEscopoId || isNaN(parseInt(itemEscopoId))) {
      return res
        .status(400)
        .json({ message: "ID do item de escopo inválido." });
    }
    if (!data_conclusao) {
      return res
        .status(400)
        .json({ message: "A data de conclusão é obrigatória." });
    }
    if (!status_item) {
      return res
        .status(400)
        .json({ message: "O status da conclusão é obrigatório." });
    }

    const connection = await promisePool.getConnection();
    let arquivosMovidosComSucesso = [];
    try {
      await connection.beginTransaction();

      const [itemRows] = await connection.query(
        "SELECT servico_id FROM servico_itens_escopo WHERE id = ?",
        [itemEscopoId]
      );

      if (itemRows.length === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({ message: "Item de escopo não encontrado." });
      }

      const { servico_id } = itemRows[0];

      await connection.query(
        "UPDATE servico_itens_escopo SET status_item_escopo = ?, data_conclusao_item = ?, observacoes_conclusao_item = ? WHERE id = ?",
        [
          status_item,
          data_conclusao,
          observacoes_conclusao || null,
          itemEscopoId,
        ]
      );

      if (arquivosConclusao && arquivosConclusao.length > 0) {
        const itemAnexoDir = path.join(
          uploadsSubestacoesDir,
          "servicos",
          `servico_${String(servico_id)}`,
          "itens_conclusao"
        );
        await fsPromises.mkdir(itemAnexoDir, { recursive: true });

        for (const file of arquivosConclusao) {
          const nomeUnicoArq = `${Date.now()}_ITEM${itemEscopoId}_${file.originalname.replace(
            /[^a-zA-Z0-9.\\-_]/g,
            "_"
          )}`;
          const finalPath = path.join(itemAnexoDir, nomeUnicoArq);
          await fsPromises.rename(file.path, finalPath);
          arquivosMovidosComSucesso.push(finalPath);

          const caminhoRelServ = `servicos/servico_${servico_id}/itens_conclusao/${nomeUnicoArq}`;
          await connection.query(
            `INSERT INTO servico_item_escopo_anexos (item_escopo_id, nome_original, caminho_servidor, tipo_mime, tamanho) VALUES (?,?,?,?,?)`,
            [
              itemEscopoId,
              file.originalname,
              `/upload_arquivos_subestacoes/${caminhoRelServ}`,
              file.mimetype,
              file.size,
            ]
          );
        }
      }

      const [progressoRows] = await connection.query(
        `SELECT
          (SELECT COUNT(*) FROM servico_itens_escopo WHERE servico_id = ?) as total,
          (SELECT COUNT(*) FROM servico_itens_escopo WHERE servico_id = ? AND status_item_escopo != 'PENDENTE' AND status_item_escopo != 'EM_ANDAMENTO') as tratados`,
        [servico_id, servico_id]
      );

      if (
        progressoRows.length > 0 &&
        progressoRows[0].total > 0 &&
        progressoRows[0].total === progressoRows[0].tratados
      ) {
        const [todosItens] = await connection.query(
          "SELECT status_item_escopo FROM servico_itens_escopo WHERE servico_id = ?",
          [servico_id]
        );

        const temPendenciaOuNaoConcluido = todosItens.some(
          (item) =>
            item.status_item_escopo === "CONCLUIDO_COM_PENDENCIA" ||
            item.status_item_escopo === "NAO_CONCLUIDO"
        );

        const statusFinalServico = temPendenciaOuNaoConcluido
          ? "CONCLUIDO_COM_PENDENCIA"
          : "CONCLUIDO";

        const horaConclusao = new Date().toLocaleTimeString("pt-BR", {
          hour12: false,
        });

        await connection.query(
          "UPDATE servicos_subestacoes SET status = ?, data_conclusao = ?, horario_fim = ? WHERE id = ?",
          [
            statusFinalServico,
            new Date().toISOString().split("T")[0],
            horaConclusao,
            servico_id,
          ]
        );
      } else {
        const [servicoStatusRows] = await connection.query(
          "SELECT status FROM servicos_subestacoes WHERE id = ?",
          [servico_id]
        );
        if (
          servicoStatusRows.length > 0 &&
          servicoStatusRows[0].status === "PROGRAMADO"
        ) {
          await connection.query(
            "UPDATE servicos_subestacoes SET status = 'EM_ANDAMENTO' WHERE id = ?",
            [servico_id]
          );
        }
      }

      await connection.commit();
      res.json({ message: "Status do item atualizado com sucesso!" });
    } catch (error) {
      await connection.rollback();
      for (const p of arquivosMovidosComSucesso) {
        try {
          if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch (e) {}
      }
      res.status(500).json({
        message: "Erro interno ao atualizar o status do item.",
        detalhes: error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

const playwright = require("playwright");

async function processarImagensParaCaminhoLocal(imagens) {
    return imagens
        .map((img) => {
            if (!img.caminho_servidor) return null;
            const caminhoRelativo = img.caminho_servidor.replace("/upload_arquivos_subestacoes/", "");
            const caminhoFisico = path.join(uploadsSubestacoesDir, caminhoRelativo);

            if (fs.existsSync(caminhoFisico)) {
                return {
                    src: `file://${caminhoFisico}`,
                    nome: img.nome_original,
                };
            }
            return null;
        })
        .filter(Boolean);
}

function gerarGaleriaHtml(imagens) {
  if (!imagens || imagens.length === 0) {
    return '<p class="no-content">Nenhuma imagem encontrada.</p>';
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
        </div>`;
    });
    galleryHtml += "</div></div>";
  }
  return galleryHtml;
}

async function preencherTemplateHtmlServicoSubestacao(servicoData) {
  const templatePath = path.join(
    projectRootDir,
    "public/pages/templates/relatorio_servico_subestacao.html"
  );
  let templateHtml = await fsPromises.readFile(templatePath, "utf-8");

  const formatarData = (dataStr) => {
    if (!dataStr) return "N/A";
    const dataObj = new Date(dataStr);
    return isNaN(dataObj.getTime())
      ? "Data inválida"
      : new Date(dataObj.getTime() + dataObj.getTimezoneOffset() * 60000).toLocaleDateString("pt-BR");
  };
  
  const formatarHora = (horaStr) => {
      if (!horaStr || typeof horaStr !== 'string') return "N/A";
      return horaStr.substring(0,5);
  }

  let itensEscopoHtml = "";
  if (servicoData.itens_escopo && servicoData.itens_escopo.length > 0) {
    for (const item of servicoData.itens_escopo) {
      const statusTexto = (item.status_item_escopo || "PENDENTE").replace(/_/g, " ");
      const statusClasse = (item.status_item_escopo || "pendente").toLowerCase();
      const imagensItemLocal = await processarImagensParaCaminhoLocal(item.anexos || []);
      const galeriaItemHtml = gerarGaleriaHtml(imagensItemLocal);

      itensEscopoHtml += `
        <div class="item-card">
          <p class="item-card-header">${item.descricao_item_servico}</p>
          <div class="item-card-details">
            <p><strong>TAG:</strong> ${item.tag_equipamento_alvo || "N/A"} | <strong>Encarregado:</strong> ${item.encarregado_item_nome || "N/A"} | <strong>Status:</strong> <span class="status-badge status-${statusClasse}">${statusTexto}</span></p>
            ${item.observacoes_conclusao_item ? `<p><strong>Obs. Conclusão:</strong> ${item.observacoes_conclusao_item}</p>` : ''}
            ${galeriaItemHtml}
          </div>
        </div>
      `;
    }
  } else {
    itensEscopoHtml = '<p class="no-content">Nenhum item de escopo detalhado para este serviço.</p>';
  }

  const anexosGerais = servicoData.anexos || [];
  const galeriaAnexosGerais = gerarGaleriaHtml(await processarImagensParaCaminhoLocal(anexosGerais));
  
  const statusFinalTexto = (servicoData.status || "N/A").replace(/_/g, " ");
  const statusFinalClasse = (servicoData.status || "desconhecido").toLowerCase();

  const dadosParaTemplate = {
    processo: servicoData.processo || "N/A",
    subestacao_nome: servicoData.subestacao_nome,
    subestacao_sigla: servicoData.subestacao_sigla,
    tipo_ordem: servicoData.tipo_ordem || "N/A",
    prioridade: servicoData.prioridade || "N/A",
    responsavel_nome: servicoData.responsavel_nome || "N/A",
    data_prevista: formatarData(servicoData.data_prevista),
    horario_previsto: `${formatarHora(servicoData.horario_inicio)} às ${formatarHora(servicoData.horario_fim)}`,
    motivo: servicoData.motivo || "Nenhum.",
    itens_escopo_html: itensEscopoHtml,
    status_final_classe: `status-${statusFinalClasse}`,
    status_final_texto: statusFinalTexto,
    data_conclusao: formatarData(servicoData.data_conclusao),
    horario_fim: formatarHora(servicoData.horario_fim),
    observacoes_conclusao: servicoData.observacoes_conclusao || "Nenhuma.",
    galeria_anexos_gerais: galeriaAnexosGerais,
    data_geracao: new Date().toLocaleString("pt-BR"),
  };

  for (const key in dadosParaTemplate) {
    const regex = new RegExp(`{{${key}}}`, "g");
    templateHtml = templateHtml.replace(regex, dadosParaTemplate[key]);
  }

  return templateHtml;
}

router.get(
  "/api/servicos-subestacoes/:id/relatorio-pdf",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { id: servicoId } = req.params;
    const connection = await promisePool.getConnection();
    let browser;

    try {
      const [servicoRows] = await connection.query(
        `SELECT ss.*, s.sigla as subestacao_sigla, s.nome as subestacao_nome, u.nome as responsavel_nome 
         FROM servicos_subestacoes ss 
         JOIN subestacoes s ON ss.subestacao_id = s.Id 
         JOIN users u ON ss.responsavel_id = u.id 
         WHERE ss.id = ?`,
        [servicoId]
      );
      if (servicoRows.length === 0) {
        return res.status(404).json({ success: false, message: "Serviço não encontrado" });
      }
      const servicoData = servicoRows[0];

      const [anexosGerais] = await connection.query(
        `SELECT * FROM servicos_subestacoes_anexos WHERE id_servico = ?`,
        [servicoId]
      );
      
      const [itensEscopo] = await connection.query(
        `SELECT sie.*, u.nome as encarregado_item_nome 
         FROM servico_itens_escopo sie 
         LEFT JOIN users u ON sie.encarregado_item_id = u.id 
         WHERE sie.servico_id = ?`,
        [servicoId]
      );

      for(const item of itensEscopo) {
          const [anexosItem] = await connection.query(
              `SELECT * FROM servico_item_escopo_anexos WHERE item_escopo_id = ?`,
              [item.id]
          );
          item.anexos = anexosItem;
      }

      servicoData.anexos = anexosGerais;
      servicoData.itens_escopo = itensEscopo;

      const htmlContent = await preencherTemplateHtmlServicoSubestacao(servicoData);

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

      const nomeArquivo = `relatorio_servico_${(servicoData.processo || servicoId).replace(/\//g, "-")}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${nomeArquivo}"`);
      res.send(pdfBuffer);

    } catch (error) {
      console.error("Erro ao gerar relatório de serviço de subestação PDF:", error);
      if (browser) await browser.close();
      res.status(500).json({
        success: false,
        message: "Erro interno ao gerar o relatório PDF.",
        error: error.message
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

module.exports = router;
