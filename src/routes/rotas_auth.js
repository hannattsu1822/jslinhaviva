const express = require("express");
const path = require("path");
const { loginSeguro, registrarAuditoria, autenticar } = require("../auth");
const { promisePool } = require("../init");

const router = express.Router();

router.get("/login", (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect("/dashboard");
  }
  res.sendFile(path.join(__dirname, "../../public/pages/into/index.html"));
});

router.post("/login", loginSeguro);

router.post("/api/logout", async (req, res) => {
  if (req.session && req.session.user) {
    const matricula = req.session.user.matricula;

    req.session.destroy(async (err) => {
      if (err) {
        console.error("Erro ao destruir a sessão:", err);
        return res.status(500).send("Ocorreu um erro ao tentar fazer logout.");
      }

      res.clearCookie("connect.sid");

      try {
        if (matricula) {
          await registrarAuditoria(
            matricula,
            "LOGOUT",
            "Logout do sistema efetuado pelo usuário."
          );
        }
      } catch (auditError) {
        console.error(
          "Servidor (/api/logout) - Erro ao registrar auditoria de logout:",
          auditError
        );
      }

      return res.redirect("/login");
    });
  } else {
    return res.redirect("/login");
  }
});

router.get("/api/me", autenticar, (req, res) => {
  if (req.user) {
    res.json({
      id: req.user.id,
      nome: req.user.nome,
      cargo: req.user.cargo,
      matricula: req.user.matricula,
      nivel: req.user.nivel,
    });
  } else {
    res.status(401).json({ message: "Usuário não autenticado." });
  }
});

router.patch("/api/me/fcm-token", autenticar, async (req, res) => {
  console.log("--- ROTA /api/me/fcm-token FOI ACESSADA ---");

  const { fcm_token } = req.body;
  const { matricula } = req.user;

  console.log("Token recebido no body:", fcm_token);
  console.log("Matrícula do usuário da sessão:", matricula);

  if (!fcm_token) {
    console.error("ERRO: fcm_token está vazio ou não foi fornecido no body.");
    return res.status(400).json({ message: "FCM token não fornecido." });
  }
  if (!matricula) {
    console.error("ERRO: Não foi possível obter a matrícula do usuário da sessão.");
    return res.status(401).json({ message: "Usuário não autenticado corretamente." });
  }

  try {
    console.log(`Executando SQL: UPDATE users SET fcm_token = '...' WHERE matricula = '${matricula}'`);
    
    const [result] = await promisePool.query("UPDATE users SET fcm_token = ? WHERE matricula = ?", [
      fcm_token,
      matricula,
    ]);

    console.log("SQL executado com sucesso. Linhas afetadas:", result.affectedRows);

    if (result.affectedRows > 0) {
      res.status(200).json({ message: "Token FCM atualizado com sucesso." });
    } else {
      console.warn(`AVISO: Nenhuma linha foi atualizada para a matrícula ${matricula}. Usuário existe na tabela?`);
      res.status(404).json({ message: "Usuário não encontrado para atualizar o token." });
    }
    
  } catch (error) {
    console.error("ERRO CRÍTICO NO BANCO DE DADOS ao salvar token FCM:", error);
    res.status(500).json({ message: "Erro interno ao salvar o token." });
  }
});

module.exports = router;
