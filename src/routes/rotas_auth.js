const express = require("express");
const path = require("path");
const { loginSeguro, loginLimiter, registrarAuditoria, autenticar } = require("../auth");
const { promisePool } = require("../init");

const router = express.Router();

// ─── Página de login ──────────────────────────────────────────────────────────
router.get("/login", (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect("/dashboard");
  }
  res.sendFile(path.join(__dirname, "../../public/pages/into/index.html"));
});

// ─── POST login — com rate limit específico (5 tentativas / 15 min por IP) ───
router.post("/login", loginLimiter, loginSeguro);

// ─── Logout ───────────────────────────────────────────────────────────────────
router.post("/api/logout", async (req, res) => {
  if (req.session && req.session.user) {
    const matricula = req.session.user.matricula;

    req.session.destroy(async (err) => {
      if (err) {
        console.error("Erro ao destruir a sessão:", err);
        return res.status(500).json({ message: "Ocorreu um erro ao tentar fazer logout." });
      }

      // Limpa o cookie de sessão com as mesmas flags definidas no init.js
      res.clearCookie("connect.sid", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      });

      try {
        if (matricula) {
          await registrarAuditoria(matricula, "LOGOUT", "Logout do sistema efetuado pelo usuário.");
        }
      } catch (auditError) {
        console.error("Erro ao registrar auditoria de logout:", auditError);
      }

      return res.redirect("/login");
    });
  } else {
    return res.redirect("/login");
  }
});

// ─── GET /api/me — retorna dados do usuário autenticado ───────────────────────
router.get("/api/me", autenticar, (req, res) => {
  if (req.user) {
    return res.json({
      id:        req.user.id,
      nome:      req.user.nome,
      cargo:     req.user.cargo,
      matricula: req.user.matricula,
      nivel:     req.user.nivel,
    });
  }
  return res.status(401).json({ message: "Usuário não autenticado." });
});

// ─── POST /api/push/subscribe — salva inscrição de push notification ──────────
router.post("/api/push/subscribe", autenticar, async (req, res) => {
  const subscription = req.body.subscription;
  const matricula    = req.user.matricula;

  if (!subscription) {
    return res.status(400).json({ message: "Subscription object não fornecido." });
  }

  try {
    await promisePool.query(
      "UPDATE users SET push_subscription = ? WHERE matricula = ?",
      [JSON.stringify(subscription), matricula]
    );
    return res.status(201).json({ message: "Inscrição salva com sucesso." });
  } catch (error) {
    console.error("Erro ao salvar inscrição push:", error);
    return res.status(500).json({ message: "Erro ao salvar inscrição." });
  }
});

module.exports = router;
