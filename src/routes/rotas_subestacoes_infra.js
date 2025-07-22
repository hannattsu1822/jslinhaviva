const express = require("express");
const router = express.Router();
const path = require("path");
const { promisePool, projectRootDir } = require("../init");
const { autenticar, verificarNivel, registrarAuditoria } = require("../auth");

router.get(
  "/subestacoes-dashboard",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(
        projectRootDir,
        "public/pages/subestacoes/subestacoes-dashboard.html"
      )
    );
  }
);

router.get(
  "/pagina-subestacoes-admin",
  autenticar,
  verificarNivel(3),
  (req, res) => {
    res.sendFile(
      path.join(projectRootDir, "public/pages/subestacoes/subestacoes.html")
    );
  }
);

router.get("/subestacoes", autenticar, verificarNivel(3), async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT Id, sigla, nome, Ano_Inicio_Op FROM subestacoes ORDER BY nome ASC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar subestações:", error);
    res.status(500).json({ message: "Erro interno ao buscar subestações." });
  }
});

router.get(
  "/subestacoes/:id",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id, 10))) {
      return res
        .status(400)
        .json({ message: `ID da subestação inválido: ${id}` });
    }
    try {
      const [rows] = await promisePool.query(
        "SELECT Id, sigla, nome, Ano_Inicio_Op FROM subestacoes WHERE Id = ?",
        [id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ message: "Subestação não encontrada." });
      }
      res.json(rows[0]);
    } catch (error) {
      console.error("Erro ao buscar subestação por ID:", error);
      res.status(500).json({ message: "Erro interno ao buscar subestação." });
    }
  }
);

router.post("/subestacoes", autenticar, verificarNivel(3), async (req, res) => {
  const { sigla, nome, Ano_Inicio_Op } = req.body;
  if (!sigla || !nome) {
    return res.status(400).json({ message: "Sigla e Nome são obrigatórios." });
  }
  let anoOperacao = null;
  if (Ano_Inicio_Op) {
    const anoNum = parseInt(Ano_Inicio_Op, 10);
    if (isNaN(anoNum) || anoNum < 1900 || anoNum > 2200) {
      return res
        .status(400)
        .json({ message: "Ano de Início de Operação inválido." });
    }
    anoOperacao = anoNum;
  }
  try {
    const [result] = await promisePool.query(
      "INSERT INTO subestacoes (sigla, nome, Ano_Inicio_Op) VALUES (?, ?, ?)",
      [sigla.toUpperCase(), nome, anoOperacao]
    );
    const newSubestacaoId = result.insertId;
    if (req.user && req.user.matricula) {
      await registrarAuditoria(
        req.user.matricula,
        "CREATE_SUBESTACAO",
        `Subestação criada: ID ${newSubestacaoId}, Sigla: ${sigla}`
      );
    }
    res.status(201).json({
      id: newSubestacaoId,
      sigla: sigla.toUpperCase(),
      nome,
      Ano_Inicio_Op: anoOperacao,
      message: "Subestação criada com sucesso!",
    });
  } catch (error) {
    console.error("Erro ao criar subestação:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ message: "Erro ao criar subestação: Sigla já cadastrada." });
    }
    res.status(500).json({ message: "Erro interno ao criar subestação." });
  }
});

router.put(
  "/subestacoes/:id",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id, 10))) {
      return res
        .status(400)
        .json({ message: `ID da subestação inválido: ${id}` });
    }
    const { sigla, nome, Ano_Inicio_Op } = req.body;
    if (!sigla || !nome) {
      return res
        .status(400)
        .json({ message: "Sigla e Nome são obrigatórios." });
    }
    let anoOperacao = undefined;
    if (Ano_Inicio_Op !== undefined) {
      if (Ano_Inicio_Op === null || String(Ano_Inicio_Op).trim() === "") {
        anoOperacao = null;
      } else {
        const anoNum = parseInt(Ano_Inicio_Op, 10);
        if (isNaN(anoNum) || anoNum < 1900 || anoNum > 2200) {
          return res
            .status(400)
            .json({ message: "Ano de Início de Operação inválido." });
        }
        anoOperacao = anoNum;
      }
    }
    try {
      const [currentSubestacao] = await promisePool.query(
        "SELECT sigla, nome, Ano_Inicio_Op FROM subestacoes WHERE Id = ?",
        [id]
      );
      if (currentSubestacao.length === 0) {
        return res
          .status(404)
          .json({ message: "Subestação não encontrada para atualização." });
      }
      const updateFields = {
        sigla: sigla.toUpperCase(),
        nome: nome,
        Ano_Inicio_Op:
          anoOperacao !== undefined
            ? anoOperacao
            : currentSubestacao[0].Ano_Inicio_Op,
      };
      await promisePool.query(
        "UPDATE subestacoes SET sigla = ?, nome = ?, Ano_Inicio_Op = ? WHERE Id = ?",
        [updateFields.sigla, updateFields.nome, updateFields.Ano_Inicio_Op, id]
      );
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "UPDATE_SUBESTACAO",
          `Subestação atualizada: ID ${id}`
        );
      }
      res.json({
        id: parseInt(id),
        ...updateFields,
        message: "Subestação atualizada com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao atualizar subestação:", error);
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          message:
            "Erro ao atualizar subestação: Sigla já cadastrada para outra subestação.",
        });
      }
      res
        .status(500)
        .json({ message: "Erro interno ao atualizar subestação." });
    }
  }
);

router.delete(
  "/subestacoes/:id",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id, 10))) {
      return res
        .status(400)
        .json({ message: `ID da subestação inválido: ${id}` });
    }
    try {
      const [servicos] = await promisePool.query(
        "SELECT COUNT(*) as count FROM servicos_subestacoes WHERE subestacao_id = ?",
        [id]
      );
      if (servicos[0].count > 0) {
        return res.status(409).json({
          message: `Não é possível excluir subestação: Existem ${servicos[0].count} serviços associados.`,
        });
      }
      const [inspecoes] = await promisePool.query(
        "SELECT COUNT(*) as count FROM inspecoes_subestacoes WHERE subestacao_id = ?",
        [id]
      );
      if (inspecoes[0].count > 0) {
        return res.status(409).json({
          message: `Não é possível excluir subestação: Existem ${inspecoes[0].count} inspeções associadas.`,
        });
      }
      const [result] = await promisePool.query(
        "DELETE FROM subestacoes WHERE Id = ?",
        [id]
      );
      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ message: "Subestação não encontrada para exclusão." });
      }
      if (req.user && req.user.matricula) {
        await registrarAuditoria(
          req.user.matricula,
          "DELETE_SUBESTACAO",
          `Subestação excluída: ID ${id}`
        );
      }
      res.json({ message: "Subestação excluída com sucesso!" });
    } catch (error) {
      console.error("Erro ao excluir subestação:", error);
      if (error.code === "ER_ROW_IS_REFERENCED_2") {
        return res.status(409).json({
          message:
            "Não é possível excluir subestação: Existem registros associados em outras tabelas.",
        });
      }
      res.status(500).json({ message: "Erro interno ao excluir subestação." });
    }
  }
);

router.get(
  "/api/catalogo/equipamentos",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    try {
      const [rows] = await promisePool.query(
        "SELECT id, codigo, nome, descricao, categoria FROM catalogo_equipamentos ORDER BY categoria, nome ASC"
      );
      res.json(rows);
    } catch (error) {
      console.error("Erro ao buscar catálogo de equipamentos:", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar catálogo de equipamentos." });
    }
  }
);

router.post(
  "/api/catalogo/equipamentos",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { codigo, nome, descricao, categoria } = req.body;
    if (!codigo || !nome) {
      return res.status(400).json({
        message: "Código e Nome são obrigatórios para o item do catálogo.",
      });
    }
    try {
      const [result] = await promisePool.query(
        "INSERT INTO catalogo_equipamentos (codigo, nome, descricao, categoria) VALUES (?, ?, ?, ?)",
        [codigo.toUpperCase(), nome, descricao, categoria]
      );
      await registrarAuditoria(
        req.user.matricula,
        "CREATE_CATALOGO_EQUIP",
        `Item de catálogo criado: ID ${result.insertId}, Código: ${codigo}`
      );
      res.status(201).json({
        id: result.insertId,
        message: "Item de catálogo criado com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao criar item no catálogo:", error);
      if (error.code === "ER_DUP_ENTRY") {
        return res
          .status(409)
          .json({ message: "Erro: Código já existe no catálogo." });
      }
      res
        .status(500)
        .json({ message: "Erro interno ao criar item no catálogo." });
    }
  }
);

router.put(
  "/api/catalogo/equipamentos/:id",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { id } = req.params;
    const { codigo, nome, descricao, categoria } = req.body;
    if (isNaN(parseInt(id, 10))) {
      return res
        .status(400)
        .json({ message: `ID do item de catálogo inválido: ${id}` });
    }
    if (!codigo || !nome) {
      return res
        .status(400)
        .json({ message: "Código e Nome são obrigatórios." });
    }
    try {
      const [result] = await promisePool.query(
        "UPDATE catalogo_equipamentos SET codigo = ?, nome = ?, descricao = ?, categoria = ? WHERE id = ?",
        [codigo.toUpperCase(), nome, descricao, categoria, id]
      );
      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ message: "Item de catálogo não encontrado." });
      }
      await registrarAuditoria(
        req.user.matricula,
        "UPDATE_CATALOGO_EQUIP",
        `Item de catálogo atualizado: ID ${id}`
      );
      res.json({ message: "Item de catálogo atualizado com sucesso!" });
    } catch (error) {
      console.error("Erro ao atualizar item do catálogo:", error);
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          message: "Erro: Código já pertence a outro item do catálogo.",
        });
      }
      res
        .status(500)
        .json({ message: "Erro interno ao atualizar item do catálogo." });
    }
  }
);

router.delete(
  "/api/catalogo/equipamentos/:id",
  autenticar,
  verificarNivel(3),
  async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id, 10))) {
      return res
        .status(400)
        .json({ message: `ID do item de catálogo inválido: ${id}` });
    }
    try {
      const [usage] = await promisePool.query(
        "SELECT COUNT(*) as count FROM servico_itens_escopo WHERE catalogo_equipamento_id = ?",
        [id]
      );
      if (usage[0].count > 0) {
        return res.status(409).json({
          message: `Não é possível excluir: este tipo de equipamento está sendo usado em ${usage[0].count} serviço(s).`,
        });
      }
      const [result] = await promisePool.query(
        "DELETE FROM catalogo_equipamentos WHERE id = ?",
        [id]
      );
      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ message: "Item de catálogo não encontrado." });
      }
      await registrarAuditoria(
        req.user.matricula,
        "DELETE_CATALOGO_EQUIP",
        `Item de catálogo excluído: ID ${id}`
      );
      res.json({ message: "Item de catálogo excluído com sucesso!" });
    } catch (error) {
      console.error("Erro ao excluir item do catálogo:", error);
      res
        .status(500)
        .json({ message: "Erro interno ao excluir item do catálogo." });
    }
  }
);

module.exports = router;
