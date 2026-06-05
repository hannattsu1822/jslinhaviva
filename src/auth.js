// src/auth.js
const { promisePool, logger } = require("./init");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Muitas tentativas de login. Tente novamente em 15 minutos.",
  },
});

function autenticar(req, res, next) {
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }
  res.redirect("/login");
}

async function loginSeguro(req, res) {
  const { matricula, senha } = req.body;

  if (
    !matricula || !senha ||
    typeof matricula !== "string" || typeof senha !== "string"
  ) {
    return res.status(400).json({ message: "Matrícula e senha são obrigatórios." });
  }

  const matriculaLimpa = matricula.trim();
  const senhaLimpa     = senha.trim();

  if (!matriculaLimpa || !senhaLimpa) {
    return res.status(400).json({ message: "Matrícula e senha não podem ser vazios." });
  }

  try {
    const [rows] = await promisePool.query(
      "SELECT *, nivel FROM users WHERE matricula = ?",
      [matriculaLimpa]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Matrícula ou senha inválida." });
    }

    const usuario = rows[0];

    if (usuario.nivel === 0) {
      return res.status(403).json({
        message: "Usuário desativado ou sem permissão de acesso.",
      });
    }

    // Rejeita senhas que não estejam em formato bcrypt — sem fallback de texto plano
    if (!usuario.senha || !usuario.senha.startsWith("$2b$")) {
      logger.warn(`[Auth] Usuário ${matriculaLimpa} com senha não-bcrypt bloqueado. Execute a migração manual.`);
      return res.status(401).json({ message: "Matrícula ou senha inválida." });
    }

    const senhaValida = await bcrypt.compare(senhaLimpa, usuario.senha);

    if (!senhaValida) {
      return res.status(401).json({ message: "Matrícula ou senha inválida." });
    }

    const { senha: _, ...userWithoutPassword } = usuario;

    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    req.session.user = userWithoutPassword;

    await registrarAuditoria(matriculaLimpa, "LOGIN", "Login no sistema");

    return res.status(200).json({
      message: "Login bem-sucedido!",
      user: req.session.user,
    });
  } catch (err) {
    logger.error(`[Auth] Erro no login: ${err.message}`);
    return res.status(500).json({ message: "Erro interno no servidor." });
  }
}

function verificarNivel(nivelRequerido) {
  return (req, res, next) => {
    const nivelUsuario = req.user?.nivel;

    if (nivelUsuario === undefined) {
      logger.warn("[Auth] Acesso negado: nível não definido na sessão");
      return res.status(403).json({
        message: "Acesso negado! Nível de permissão não encontrado.",
      });
    }

    if (nivelUsuario >= nivelRequerido) return next();

    logger.warn(`[Auth] Nível insuficiente: ${nivelUsuario} < ${nivelRequerido}`);
    return res.status(403).json({
      message: "Acesso negado! Você não tem permissão para acessar este recurso.",
    });
  };
}

function verificarCargo(cargosPermitidos) {
  return (req, res, next) => {
    const cargoUsuario = req.user?.cargo;

    if (!cargoUsuario) {
      logger.warn("[Auth] Acesso negado: cargo não definido na sessão");
      return res.status(403).json({
        message: "Acesso negado! Cargo de permissão não encontrado.",
      });
    }

    if (cargosPermitidos.includes(cargoUsuario)) return next();

    logger.warn(`[Auth] Cargo bloqueado: ${cargoUsuario} não está em [${cargosPermitidos.join(", ")}]`);
    return res.status(403).json({
      message: "Acesso negado! Você não tem permissão para acessar este recurso.",
    });
  };
}

async function registrarAuditoria(matricula, acao, detalhes = null, connection = null) {
  if (!matricula) {
    logger.error("[Auth] Tentativa de auditoria sem matrícula");
    throw new Error("Matrícula é obrigatória para auditoria");
  }

  const query = "INSERT INTO auditoria (matricula_usuario, acao, detalhes) VALUES (?, ?, ?)";

  try {
    if (connection) {
      await connection.query(query, [matricula, acao, detalhes]);
    } else {
      await promisePool.query(query, [matricula, acao, detalhes]);
    }
  } catch (err) {
    logger.error(`[Auth] Erro ao registrar auditoria: ${err.message}`);
  }
}

async function criarHashSenha(senha) {
  return bcrypt.hash(senha, 10);
}

async function verificarSenha(senhaDigitada, hashArmazenado) {
  return bcrypt.compare(senhaDigitada, hashArmazenado);
}

module.exports = {
  loginLimiter,
  autenticar,
  loginSeguro,
  verificarNivel,
  verificarCargo,
  registrarAuditoria,
  criarHashSenha,
  verificarSenha,
};
