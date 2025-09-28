const express = require("express");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const { promisePool, upload } = require("../init");
const { autenticar, verificarNivel, registrarAuditoria } = require("../auth");

const router = express.Router();

function limparArquivosTemporarios(files) {
  if (files && files.length > 0) {
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

router.get(
  "/registro_ordem_servico",
  autenticar,
  verificarNivel(4),
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "../../public/pages/servicos/registro_ordem_servico.html"
      )
    );
  }
);

router.get(
  "/detalhes_ordem_servico",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "../../public/pages/servicos/detalhes_ordem_servico.html"
      )
    );
  }
);

router.get(
  "/api/codigos-defeito",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const connection = await promisePool.getConnection();
    try {
      const [rows] = await connection.query(
        "SELECT id, codigo, ponto_defeito, descricao FROM codigos_defeito ORDER BY ponto_defeito, codigo"
      );
      res.status(200).json(rows);
    } catch (err) {
      console.error("Erro ao buscar códigos de defeito:", err);
      res.status(500).json({ message: "Erro ao buscar códigos de defeito!" });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.post(
  "/api/ordens-servico",
  autenticar,
  verificarNivel(4),
  upload.array("anexos", 10),
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
        maps,
        ordem_obra,
        descricao_geral,
        observacoes_gerais,
        itens,
      } = req.body;

      if (!data_prevista_execucao || !subestacao || !desligamento || !itens) {
        limparArquivosTemporarios(req.files);
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message:
            "Campos obrigatórios faltando: data, subestação, desligamento ou itens.",
        });
      }

      const parsedItens = JSON.parse(itens);
      if (!Array.isArray(parsedItens) || parsedItens.length === 0) {
        limparArquivosTemporarios(req.files);
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Pelo menos um item de serviço deve ser fornecido.",
        });
      }

      const [resultOS] = await connection.query(
        `INSERT INTO ordens_servico (
          processo, tipo, data_prevista_execucao, desligamento, hora_inicio, hora_fim, 
          subestacao, alimentador, chave_montante, maps, ordem_obra, 
          descricao_geral, observacoes_gerais, criado_por_matricula, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo')`,
        [
          processo || null,
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
          descricao_geral || null,
          observacoes_gerais || null,
          req.user.matricula,
        ]
      );
      const ordemServicoId = resultOS.insertId;

      if (tipo_processo === "Emergencial") {
        const processoEmergencial = `EMERGENCIAL-${ordemServicoId}`;
        await connection.query(
          "UPDATE ordens_servico SET processo = ? WHERE id = ?",
          [processoEmergencial, ordemServicoId]
        );
      }

      for (const item of parsedItens) {
        if (!item.codigo) {
          throw new Error("Cada item deve ter um código de defeito.");
        }
        const [codigoRow] = await connection.query(
          "SELECT id FROM codigos_defeito WHERE codigo = ?",
          [item.codigo]
        );
        if (codigoRow.length === 0) {
          throw new Error(`Código de defeito '${item.codigo}' não encontrado.`);
        }
        const codigoDefeitoId = codigoRow[0].id;

        await connection.query(
          `INSERT INTO ordem_servico_itens 
            (ordem_servico_id, codigo_defeito_id, responsavel_matricula, observacoes) 
           VALUES (?, ?, 'pendente', ?)`,
          [ordemServicoId, codigoDefeitoId, item.observacoes || null]
        );
      }

      if (req.files && req.files.length > 0) {
        const anoExecucao = new Date(data_prevista_execucao).getFullYear();
        const nomeDaPasta = `OS_${ordemServicoId}_${anoExecucao}`;
        const diretorioDaOS = path.join(
          __dirname,
          "../../upload_arquivos",
          nomeDaPasta
        );
        if (!fs.existsSync(diretorioDaOS)) {
          fs.mkdirSync(diretorioDaOS, { recursive: true });
        }

        for (const file of req.files) {
          const novoNomeArquivo = `anexo_registro_${Date.now()}${path.extname(
            file.originalname
          )}`;
          const caminhoCompleto = path.join(diretorioDaOS, novoNomeArquivo);
          await fsPromises.rename(file.path, caminhoCompleto);

          const tipoAnexo = file.mimetype.startsWith("image/")
            ? "imagem"
            : "documento";
          const caminhoServidor = `/api/upload_arquivos/${nomeDaPasta}/${novoNomeArquivo}`;

          await connection.query(
            `INSERT INTO ordem_servico_anexos 
              (ordem_servico_id, nome_original, caminho_servidor, tamanho, tipo_anexo) 
             VALUES (?, ?, ?, ?, ?)`,
            [
              ordemServicoId,
              file.originalname,
              caminhoServidor,
              file.size,
              tipoAnexo,
            ]
          );
        }
      }

      await connection.commit();
      await registrarAuditoria(
        req.user.matricula,
        "Registro de Ordem de Serviço",
        `Nova OS registrada com ID: ${ordemServicoId}`
      );

      res.status(201).json({
        success: true,
        message: "Ordem de Serviço registrada com sucesso!",
        id: ordemServicoId,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao registrar Ordem de Serviço:", error);
      limparArquivosTemporarios(req.files);
      res.status(500).json({
        success: false,
        message: "Erro interno ao registrar a Ordem de Serviço.",
        error: error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.put(
  "/api/ordens-servico/:id",
  autenticar,
  verificarNivel(5),
  upload.array("anexos", 5),
  async (req, res) => {
    const { id } = req.params;
    const {
      processo,
      subestacao,
      alimentador,
      chave_montante,
      desligamento,
      hora_inicio,
      hora_fim,
      ordem_obra,
      maps,
      descricao_geral,
      observacoes_gerais,
    } = req.body;

    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        `UPDATE ordens_servico SET
          processo = ?, subestacao = ?, alimentador = ?, chave_montante = ?,
          desligamento = ?, hora_inicio = ?, hora_fim = ?, ordem_obra = ?,
          maps = ?, descricao_geral = ?, observacoes_gerais = ?
        WHERE id = ?`,
        [
          processo,
          subestacao,
          alimentador,
          chave_montante,
          desligamento,
          desligamento === "SIM" ? hora_inicio : null,
          desligamento === "SIM" ? hora_fim : null,
          ordem_obra,
          maps,
          descricao_geral,
          observacoes_gerais,
          id,
        ]
      );

      if (req.files && req.files.length > 0) {
      }

      await connection.commit();
      await registrarAuditoria(
        req.user.matricula,
        "Edição de Ordem de Serviço",
        `OS ID ${id} foi atualizada.`
      );
      res.json({
        success: true,
        message: "Ordem de Serviço atualizada com sucesso!",
        redirect: `/detalhes_ordem_servico?id=${id}`,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao atualizar Ordem de Serviço:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao atualizar Ordem de Serviço.",
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.get(
  "/api/ordens-servico/:id",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { id } = req.params;
    const { matricula, nivel } = req.user;
    const connection = await promisePool.getConnection();

    try {
      const [osRows] = await connection.query(
        `SELECT os.*, u.nome as criado_por_nome 
             FROM ordens_servico os 
             LEFT JOIN users u ON os.criado_por_matricula = u.matricula 
             WHERE os.id = ?`,
        [id]
      );

      if (osRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Ordem de Serviço não encontrada.",
        });
      }

      let itensQuery = `
            SELECT 
                osi.id as item_id, osi.status, osi.observacoes, osi.data_conclusao_item,
                osi.responsavel_matricula, u.nome as responsavel_nome,
                cd.codigo, cd.ponto_defeito, cd.descricao
            FROM ordem_servico_itens osi
            JOIN codigos_defeito cd ON osi.codigo_defeito_id = cd.id
            LEFT JOIN users u ON osi.responsavel_matricula = u.matricula
            WHERE osi.ordem_servico_id = ?
        `;
      const queryParams = [id];

      if (nivel < 5) {
        itensQuery += ` AND osi.responsavel_matricula = ?`;
        queryParams.push(matricula);
      }

      const [itens] = await connection.query(itensQuery, queryParams);

      const [anexosPrincipais] = await connection.query(
        "SELECT * FROM ordem_servico_anexos WHERE ordem_servico_id = ?",
        [id]
      );

      const [anexosDosItens] = await connection.query(
        `
        SELECT osia.* 
        FROM ordem_servico_item_anexos osia
        JOIN ordem_servico_itens osi ON osia.item_id = osi.id
        WHERE osi.ordem_servico_id = ?`,
        [id]
      );

      const todosAnexos = [...anexosPrincipais, ...anexosDosItens];

      const resultado = { ...osRows[0], itens, anexos: todosAnexos };
      res.status(200).json({ success: true, data: resultado });
    } catch (error) {
      console.error("Erro ao buscar detalhes da OS:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar detalhes da Ordem de Serviço.",
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.get(
  "/api/ordens-servico/:id/itens",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { id } = req.params;
    const connection = await promisePool.getConnection();
    try {
      const [itens] = await connection.query(
        `SELECT 
                osi.id as item_id,
                cd.codigo,
                cd.descricao,
                osi.responsavel_matricula
             FROM ordem_servico_itens osi
             JOIN codigos_defeito cd ON osi.codigo_defeito_id = cd.id
             WHERE osi.ordem_servico_id = ?`,
        [id]
      );
      res.status(200).json(itens);
    } catch (error) {
      console.error("Erro ao buscar todos os itens da OS:", error);
      res
        .status(500)
        .json({ success: false, message: "Erro ao buscar itens da OS." });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.patch(
  "/api/ordens-servico/:id/atribuir",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { id: ordemServicoId } = req.params;
    const { atribuicoes } = req.body;

    if (!Array.isArray(atribuicoes) || atribuicoes.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Nenhuma atribuição fornecida." });
    }

    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();

      for (const atribuicao of atribuicoes) {
        const { itemId, responsavel_matricula } = atribuicao;
        if (!itemId || !responsavel_matricula) {
          throw new Error(
            "Dados de atribuição inválidos. 'itemId' e 'responsavel_matricula' são obrigatórios."
          );
        }

        const [result] = await connection.query(
          "UPDATE ordem_servico_itens SET responsavel_matricula = ? WHERE id = ? AND ordem_servico_id = ?",
          [responsavel_matricula, itemId, ordemServicoId]
        );

        if (result.affectedRows === 0) {
          console.warn(
            `Nenhum item atualizado para itemId: ${itemId} na OS: ${ordemServicoId}. Pode já ter sido atribuído.`
          );
        }
      }

      await connection.commit();
      await registrarAuditoria(
        req.user.matricula,
        "Atribuição de Responsáveis",
        `Responsáveis atribuídos para ${atribuicoes.length} item(ns) da OS ID: ${ordemServicoId}`
      );

      res.status(200).json({
        success: true,
        message: "Responsáveis atribuídos com sucesso!",
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao atribuir responsáveis:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao atribuir responsáveis.",
        error: error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.get(
  "/api/ordens-servico/:id/meus-itens",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { id: ordemServicoId } = req.params;
    const { matricula } = req.user;

    const connection = await promisePool.getConnection();
    try {
      const [itens] = await connection.query(
        `SELECT 
                osi.id as item_id,
                cd.codigo,
                cd.descricao,
                osi.status
             FROM ordem_servico_itens osi
             JOIN codigos_defeito cd ON osi.codigo_defeito_id = cd.id
             WHERE osi.ordem_servico_id = ? AND osi.responsavel_matricula = ? AND osi.status = 'pendente'`,
        [ordemServicoId, matricula]
      );
      res.status(200).json(itens);
    } catch (error) {
      console.error("Erro ao buscar meus itens:", error);
      res
        .status(500)
        .json({ success: false, message: "Erro ao buscar itens do usuário." });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.get(
  "/api/ordens-servico/:id/todos-itens-pendentes",
  autenticar,
  verificarNivel(5),
  async (req, res) => {
    const { id: ordemServicoId } = req.params;
    const connection = await promisePool.getConnection();
    try {
      const [itens] = await connection.query(
        `SELECT 
                osi.id as item_id,
                cd.codigo,
                cd.descricao,
                osi.status,
                osi.responsavel_matricula,
                u.nome as responsavel_nome
             FROM ordem_servico_itens osi
             JOIN codigos_defeito cd ON osi.codigo_defeito_id = cd.id
             LEFT JOIN users u ON osi.responsavel_matricula = u.matricula
             WHERE osi.ordem_servico_id = ? AND osi.status = 'pendente'`,
        [ordemServicoId]
      );
      res.status(200).json(itens);
    } catch (error) {
      console.error("Erro ao buscar todos os itens pendentes:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar todos os itens pendentes.",
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.patch(
  "/api/ordens-servico/:id/finalizar-itens",
  autenticar,
  verificarNivel(3),
  upload.any(),
  async (req, res) => {
    const { id: ordemServicoId } = req.params;
    const finalizacoes = JSON.parse(req.body.finalizacoes);

    if (!Array.isArray(finalizacoes) || finalizacoes.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Nenhuma finalização fornecida." });
    }

    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();

      const [osRows] = await connection.query(
        "SELECT data_prevista_execucao FROM ordens_servico WHERE id = ?",
        [ordemServicoId]
      );
      if (osRows.length === 0) {
        throw new Error("Ordem de Serviço não encontrada.");
      }
      const anoExecucao = new Date(
        osRows[0].data_prevista_execucao
      ).getFullYear();
      const nomeDaPasta = `OS_${ordemServicoId}_${anoExecucao}`;
      const diretorioDaOS = path.join(
        __dirname,
        "../../upload_arquivos",
        nomeDaPasta
      );
      if (!fs.existsSync(diretorioDaOS)) {
        fs.mkdirSync(diretorioDaOS, { recursive: true });
      }

      for (const finalizacao of finalizacoes) {
        const { itemId, status, observacoes } = finalizacao;
        if (
          !itemId ||
          !status ||
          (status === "finalizacao_impossibilitada" && !observacoes)
        ) {
          throw new Error(
            "Dados de finalização inválidos. Itens com 'Finalização Impossibilitada' exigem observação."
          );
        }
        await connection.query(
          "UPDATE ordem_servico_itens SET status = ?, observacoes = ?, data_conclusao_item = NOW() WHERE id = ? AND ordem_servico_id = ?",
          [status, observacoes || null, itemId, ordemServicoId]
        );

        const anexosDoItem = req.files.filter(
          (file) => file.fieldname === `anexos_item_${itemId}`
        );
        for (const file of anexosDoItem) {
          const novoNomeArquivo = `anexo_item_${itemId}_${Date.now()}${path.extname(
            file.originalname
          )}`;
          const caminhoCompleto = path.join(diretorioDaOS, novoNomeArquivo);
          await fsPromises.rename(file.path, caminhoCompleto);
          const tipoAnexo = file.mimetype.startsWith("image/")
            ? "imagem_conclusao"
            : "documento_conclusao";
          const caminhoServidor = `/api/upload_arquivos/${nomeDaPasta}/${novoNomeArquivo}`;
          await connection.query(
            `INSERT INTO ordem_servico_item_anexos (item_id, nome_original, caminho_servidor, tamanho, tipo_anexo) VALUES (?, ?, ?, ?, ?)`,
            [itemId, file.originalname, caminhoServidor, file.size, tipoAnexo]
          );
        }
      }

      const [itensRestantes] = await connection.query(
        "SELECT COUNT(*) as total FROM ordem_servico_itens WHERE ordem_servico_id = ? AND status IN ('pendente', 'em_andamento')",
        [ordemServicoId]
      );

      if (itensRestantes[0].total === 0) {
        const [statusItens] = await connection.query(
          "SELECT status FROM ordem_servico_itens WHERE ordem_servico_id = ?",
          [ordemServicoId]
        );
        const algumImpossibilitado = statusItens.some(
          (item) => item.status === "finalizacao_impossibilitada"
        );
        const statusFinalOS = algumImpossibilitado
          ? "nao_concluido"
          : "concluido";

        await connection.query(
          "UPDATE ordens_servico SET status = ?, data_conclusao = NOW(), concluido_por_matricula = ? WHERE id = ?",
          [statusFinalOS, req.user.matricula, ordemServicoId]
        );
      }

      await connection.commit();
      await registrarAuditoria(
        req.user.matricula,
        "Finalização de Itens",
        `${finalizacoes.length} item(ns) da OS ID: ${ordemServicoId} foram finalizados.`
      );
      res
        .status(200)
        .json({ success: true, message: "Itens finalizados com sucesso!" });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao finalizar itens:", error);
      limparArquivosTemporarios(req.files);
      res.status(500).json({
        success: false,
        message: "Erro ao finalizar itens.",
        error: error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.delete(
  "/api/ordens-servico/:id",
  autenticar,
  verificarNivel(5),
  async (req, res) => {
    const { id } = req.params;
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();
      const [osRows] = await connection.query(
        "SELECT processo FROM ordens_servico WHERE id = ?",
        [id]
      );
      if (osRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: "Ordem de Serviço não encontrada.",
        });
      }

      await connection.query(
        "DELETE FROM ordem_servico_anexos WHERE ordem_servico_id = ?",
        [id]
      );
      await connection.query(
        "DELETE FROM ordem_servico_itens WHERE ordem_servico_id = ?",
        [id]
      );
      await connection.query("DELETE FROM ordens_servico WHERE id = ?", [id]);

      await connection.commit();
      await registrarAuditoria(
        req.user.matricula,
        "Exclusão de Ordem de Serviço",
        `Ordem de Serviço ID ${id} (Processo: ${osRows[0].processo}) foi excluída.`
      );
      res.json({
        success: true,
        message: "Ordem de Serviço excluída com sucesso.",
      });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao excluir Ordem de Serviço:", error);
      res
        .status(500)
        .json({ success: false, message: "Erro ao excluir Ordem de Serviço." });
    } finally {
      if (connection) connection.release();
    }
  }
);

module.exports = router;
