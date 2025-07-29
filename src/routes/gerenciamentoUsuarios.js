const express = require("express");
const router = express.Router();
const { promisePool } = require("../init");
const {
  autenticar,
  verificarNivel,
  registrarAuditoria,
  criarHashSenha,
} = require("../auth");

router.get(
  "/api/gerenciamento/usuarios",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    try {
      const page = parseInt(req.query.pagina, 10) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;

      let countQuery = "SELECT COUNT(*) as total FROM users WHERE 1=1";
      let dataQuery =
        "SELECT id, matricula, nome, cargo, nivel FROM users WHERE 1=1";
      const params = [];

      if (req.query.termo) {
        const filterClause = " AND (nome LIKE ? OR matricula LIKE ?)";
        countQuery += filterClause;
        dataQuery += filterClause;
        params.push(`%${req.query.termo}%`, `%${req.query.termo}%`);
      }
      if (req.query.cargo) {
        const filterClause = " AND cargo LIKE ?";
        countQuery += filterClause;
        dataQuery += filterClause;
        params.push(`%${req.query.cargo}%`);
      }
      if (req.query.nivel) {
        const filterClause = " AND nivel = ?";
        countQuery += filterClause;
        dataQuery += filterClause;
        params.push(req.query.nivel);
      }

      const [countResult] = await promisePool.query(countQuery, params);
      const totalUsers = countResult[0].total;
      const totalPages = Math.ceil(totalUsers / limit);

      dataQuery += " ORDER BY nome ASC LIMIT ? OFFSET ?";
      const dataParams = [...params, limit, offset];

      const [users] = await promisePool.query(dataQuery, dataParams);

      res.json({
        users,
        totalPages,
        currentPage: page,
      });
    } catch (error) {
      console.error("Erro ao listar usuários:", error);
      res.status(500).json({ message: "Erro interno ao buscar usuários." });
    }
  }
);

router.get(
  "/api/gerenciamento/usuarios/:id",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await promisePool.query(
        "SELECT id, matricula, nome, cargo, nivel FROM users WHERE id = ?",
        [id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ message: "Usuário não encontrado." });
      }
      res.json(rows[0]);
    } catch (error) {
      console.error("Erro ao buscar usuário por ID:", error);
      res.status(500).json({ message: "Erro interno ao buscar usuário." });
    }
  }
);

router.post(
  "/api/gerenciamento/usuarios",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { matricula, senha, nome, cargo, nivel } = req.body;

    if (!matricula || !senha || !nome || !cargo || !nivel) {
      return res
        .status(400)
        .json({ message: "Todos os campos são obrigatórios." });
    }

    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();

      const senhaHash = await criarHashSenha(senha);

      const [result] = await connection.query(
        "INSERT INTO users (matricula, senha, nome, cargo, nivel) VALUES (?, ?, ?, ?, ?)",
        [matricula, senhaHash, nome, cargo, nivel]
      );

      const novoUserId = result.insertId;
      await registrarAuditoria(
        req.user.matricula,
        "CREATE_USER",
        `Usuário ID ${novoUserId} (Matrícula: ${matricula}) criado.`,
        connection
      );

      await connection.commit();
      res
        .status(201)
        .json({ id: novoUserId, message: "Usuário criado com sucesso!" });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao criar usuário:", error);
      if (error.code === "ER_DUP_ENTRY") {
        return res
          .status(409)
          .json({ message: "A matrícula informada já está em uso." });
      }
      res.status(500).json({ message: "Erro interno ao criar usuário." });
    } finally {
      connection.release();
    }
  }
);

router.put(
  "/api/gerenciamento/usuarios/:id",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { id } = req.params;
    const { matricula, nome, cargo, nivel, senha } = req.body;

    if (!matricula || !nome || !cargo || !nivel) {
      return res
        .status(400)
        .json({
          message: "Os campos nome, matrícula, cargo e nível são obrigatórios.",
        });
    }

    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();

      let query =
        "UPDATE users SET matricula = ?, nome = ?, cargo = ?, nivel = ?";
      const params = [matricula, nome, cargo, nivel];

      if (senha && senha.trim() !== "") {
        const senhaHash = await criarHashSenha(senha);
        query += ", senha = ?";
        params.push(senhaHash);
      }

      query += " WHERE id = ?";
      params.push(id);

      const [result] = await connection.query(query, params);

      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({ message: "Usuário não encontrado." });
      }

      await registrarAuditoria(
        req.user.matricula,
        "UPDATE_USER",
        `Usuário ID ${id} (Matrícula: ${matricula}) atualizado.`,
        connection
      );

      await connection.commit();
      res.json({ message: "Usuário atualizado com sucesso!" });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao atualizar usuário:", error);
      if (error.code === "ER_DUP_ENTRY") {
        return res
          .status(409)
          .json({
            message: "A matrícula informada já pertence a outro usuário.",
          });
      }
      res.status(500).json({ message: "Erro interno ao atualizar usuário." });
    } finally {
      connection.release();
    }
  }
);

router.put(
  "/api/gerenciamento/usuarios/:id/status",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { id } = req.params;
    const { nivelAtual } = req.body;
    const idNumerico = parseInt(id, 10);

    if (req.user.id === idNumerico) {
      return res
        .status(403)
        .json({ message: "Você não pode desativar sua própria conta." });
    }

    const novoNivel = nivelAtual > 0 ? 0 : 1;
    const acao = novoNivel === 0 ? "DESATIVADO" : "ATIVADO";

    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        "UPDATE users SET nivel = ? WHERE id = ?",
        [novoNivel, id]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({ message: "Usuário não encontrado." });
      }

      await registrarAuditoria(
        req.user.matricula,
        `USER_STATUS_CHANGE`,
        `Usuário ID ${id} foi ${acao}.`,
        connection
      );

      await connection.commit();
      res.json({ message: `Usuário ${acao.toLowerCase()} com sucesso.` });
    } catch (error) {
      await connection.rollback();
      console.error(`Erro ao ${acao.toLowerCase()} usuário:`, error);
      res
        .status(500)
        .json({ message: `Erro interno ao ${acao.toLowerCase()} usuário.` });
    } finally {
      connection.release();
    }
  }
);

router.delete(
  "/api/gerenciamento/usuarios/:id",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { id } = req.params;
    const idNumerico = parseInt(id, 10);

    if (req.user.id === idNumerico) {
      return res
        .status(403)
        .json({ message: "Você não pode excluir sua própria conta." });
    }

    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        "DELETE FROM users WHERE id = ?",
        [id]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({ message: "Usuário não encontrado." });
      }

      await registrarAuditoria(
        req.user.matricula,
        "DELETE_USER",
        `Usuário ID ${id} excluído permanentemente.`,
        connection
      );

      await connection.commit();
      res.json({ message: "Usuário excluído com sucesso." });
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao excluir usuário:", error);
      res.status(500).json({ message: "Erro interno ao excluir usuário." });
    } finally {
      connection.release();
    }
  }
);

module.exports = router;
