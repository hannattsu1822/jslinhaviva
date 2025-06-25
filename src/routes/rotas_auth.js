const express = require("express");
const path = require("path");
const { loginSeguro, registrarAuditoria, autenticar } = require("../auth");

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
        return res.status(500).json({
          message: "Erro interno no servidor ao tentar fazer logout.",
        });
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

      return res
        .status(200)
        .json({ message: "Logout do servidor bem-sucedido!" });
    });
  } else {
    return res.status(200).json({
      message:
        "Nenhuma sessão ativa para logout no servidor, mas requisição processada.",
    });
  }
});

router.get("/api/me", autenticar, (req, res) => {
  if (req.user) {
    res.json({
      id: req.user.id,
      nome: req.user.nome,
      cargo: req.user.cargo,
      matricula: req.user.matricula,
    });
  } else {
    res.status(401).json({ message: "Usuário não autenticado." });
  }
});

module.exports = router;
