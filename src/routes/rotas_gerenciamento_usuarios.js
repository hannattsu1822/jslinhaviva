const express = require("express");
const router = express.Router();
const { promisePool } = require("../init");
const { autenticar, verificarNivel, criarHashSenha } = require("../auth");

router.get(
  "/api/gerenciamento/usuarios",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    try {
      const page = parseInt(req.query.pagina) || 1;
      const limit = 15;
      const offset = (page - 1) * limit;
      const { termo, cargo, nivel } = req.query;
      let whereClauses = [];
      let params = [];
      if (termo) {
        whereClauses.push("(nome LIKE ? OR matricula LIKE ?)");
        params.push(`%${termo}%`, `%${termo}%`);
      }
      if (cargo) {
        whereClauses.push("cargo LIKE ?");
        params.push(`%${cargo}%`);
      }
      if (nivel && nivel !== "") {
        whereClauses.push("nivel = ?");
        params.push(nivel);
      }
      const whereString =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
      const countSql = `SELECT COUNT(*) as total FROM users ${whereString}`;
      const [countRows] = await promisePool.query(countSql, params);
      const totalUsers = countRows[0].total;
      const totalPages = Math.ceil(totalUsers / limit);
      const usersSql = `SELECT id, nome, matricula, cargo, nivel FROM users ${whereString} ORDER BY nome ASC LIMIT ? OFFSET ?`;
      const [users] = await promisePool.query(usersSql, [
        ...params,
        limit,
        offset,
      ]);
      res.json({ users, currentPage: page, totalPages });
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
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
        "SELECT id, nome, matricula, cargo, nivel FROM users WHERE id = ?",
        [id]
      );
      if (rows.length === 0)
        return res.status(404).json({ message: "Usuário não encontrado." });
      res.json(rows[0]);
    } catch (error) {
      res.status(500).json({ message: "Erro interno ao buscar usuário." });
    }
  }
);

router.post(
  "/api/gerenciamento/usuarios",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { nome, matricula, cargo, nivel, senha } = req.body;
    if (!nome || !matricula || !cargo || !nivel || !senha)
      return res
        .status(400)
        .json({ message: "Todos os campos são obrigatórios." });
    try {
      const hashSenha = await criarHashSenha(senha);
      const [result] = await promisePool.query(
        "INSERT INTO users (nome, matricula, cargo, nivel, senha) VALUES (?, ?, ?, ?, ?)",
        [nome, matricula, cargo, nivel, hashSenha]
      );
      res
        .status(201)
        .json({ id: result.insertId, message: "Usuário criado com sucesso!" });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY")
        return res
          .status(409)
          .json({ message: "A matrícula informada já está em uso." });
      res.status(500).json({ message: "Erro interno ao criar usuário." });
    }
  }
);

router.put(
  "/api/gerenciamento/usuarios/:id",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { id } = req.params;
    const { nome, matricula, cargo, nivel, senha } = req.body;
    try {
      let sql, params;
      if (senha) {
        const hashSenha = await criarHashSenha(senha);
        sql =
          "UPDATE users SET nome = ?, matricula = ?, cargo = ?, nivel = ?, senha = ? WHERE id = ?";
        params = [nome, matricula, cargo, nivel, hashSenha, id];
      } else {
        sql =
          "UPDATE users SET nome = ?, matricula = ?, cargo = ?, nivel = ? WHERE id = ?";
        params = [nome, matricula, cargo, nivel, id];
      }
      const [result] = await promisePool.query(sql, params);
      if (result.affectedRows === 0)
        return res.status(404).json({ message: "Usuário não encontrado." });
      res.json({ message: "Usuário atualizado com sucesso!" });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY")
        return res
          .status(409)
          .json({
            message: "A matrícula informada já está em uso por outro usuário.",
          });
      res.status(500).json({ message: "Erro interno ao atualizar usuário." });
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
    const novoNivel = nivelAtual > 0 ? 0 : 1;
    try {
      await promisePool.query("UPDATE users SET nivel = ? WHERE id = ?", [
        novoNivel,
        id,
      ]);
      res.json({
        message: `Usuário ${
          novoNivel > 0 ? "ativado" : "desativado"
        } com sucesso!`,
      });
    } catch (error) {
      res.status(500).json({ message: "Erro ao alterar status do usuário." });
    }
  }
);

router.delete(
  "/api/gerenciamento/usuarios/:id",
  autenticar,
  verificarNivel(5),
  async (req, res) => {
    const { id } = req.params;
    try {
      const [result] = await promisePool.query(
        "DELETE FROM users WHERE id = ?",
        [id]
      );
      if (result.affectedRows === 0)
        return res.status(404).json({ message: "Usuário não encontrado." });
      res.json({ message: "Usuário excluído permanentemente com sucesso!" });
    } catch (error) {
      res.status(500).json({ message: "Erro interno ao excluir usuário." });
    }
  }
);

module.exports = router;
