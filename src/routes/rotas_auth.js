// src/routes/rotas_auth.js
const express = require("express");
const path = require("path");
const { loginSeguro, registrarAuditoria } = require("../auth"); // Importa as funções necessárias de auth.js

const router = express.Router();

// Rota para servir a página de login (ex: index.html)
// Esta rota é chamada quando o usuário navega para /login.
router.get("/login", (req, res) => {
  // Se o usuário já tem uma sessão ativa, redireciona para o dashboard principal.
  if (req.session && req.session.user) {
    console.log(
      "Servidor (GET /login): Usuário já logado, redirecionando para /dashboard."
    );
    return res.redirect("/dashboard");
  }
  // Se não estiver logado, serve o arquivo HTML da página de login.
  // Ajuste o caminho abaixo se sua página de login tiver outro nome ou localização.
  // Ex: ../../public/login.html ou ../../public/index.html
  console.log("Servidor (GET /login): Servindo a página de login.");
  res.sendFile(path.join(__dirname, "../../public/pages/into/index.html"));
});

// Rota para processar a tentativa de login (POST)
// A função loginSeguro lida com a lógica de autenticação e envia a resposta JSON.
router.post("/login", loginSeguro);

// MELHOR MÉTODO: Rota POST para logout
// Esta rota será chamada pelo frontend (sidebar.js) via fetch.
router.post("/api/logout", async (req, res) => {
  if (req.session && req.session.user) {
    const matricula = req.session.user.matricula; // Guarda a matrícula para auditoria ANTES de destruir a sessão.

    console.log(
      `Servidor (/api/logout): Recebida requisição de logout para matrícula ${matricula}.`
    );

    req.session.destroy(async (err) => {
      // Usa callback para garantir que a sessão seja destruída antes de responder.
      if (err) {
        console.error(
          "Servidor (/api/logout) - Erro ao destruir a sessão:",
          err
        );
        return res.status(500).json({
          message: "Erro interno no servidor ao tentar fazer logout.",
        });
      }

      // Limpa o cookie de sessão do navegador.
      // 'connect.sid' é o nome padrão do cookie para express-session.
      // Verifique o nome do seu cookie de sessão se você o personalizou.
      res.clearCookie("connect.sid");

      try {
        if (matricula) {
          // Registra a ação de logout na auditoria.
          await registrarAuditoria(
            matricula,
            "LOGOUT",
            "Logout do sistema efetuado pelo usuário."
          );
          console.log(
            "Servidor (/api/logout) - Auditoria de logout registrada para matrícula:",
            matricula
          );
        } else {
          // Isso não deveria acontecer se req.session.user existia, mas é uma verificação de segurança.
          console.warn(
            "Servidor (/api/logout) - Matrícula não encontrada na sessão para auditoria de logout, embora a sessão existisse."
          );
        }
      } catch (auditError) {
        console.error(
          "Servidor (/api/logout) - Erro ao registrar auditoria de logout:",
          auditError
        );
        // Continua o processo de logout mesmo se a auditoria falhar.
      }

      console.log(
        "Servidor (/api/logout) - Sessão destruída com sucesso para matrícula:",
        matricula
      );
      // Envia uma resposta JSON de sucesso para o cliente.
      return res
        .status(200)
        .json({ message: "Logout do servidor bem-sucedido!" });
    });
  } else {
    // Se não houver sessão ativa no servidor quando /api/logout for chamado.
    console.log(
      "Servidor (/api/logout) - Nenhuma sessão ativa para destruir. Requisição de logout recebida."
    );
    return res.status(200).json({
      message:
        "Nenhuma sessão ativa para logout no servidor, mas requisição processada.",
    });
  }
});

module.exports = router;
