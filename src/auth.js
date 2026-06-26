// src/auth.js
const { promisePool } = require("./infrastructure/database");
const logger = require("./config/logger");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");
const { ensureCsrfToken } = require("./middleware/csrf");

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

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const failedLoginAttempts = new Map();

function isAccountLocked(matricula) {
  const entry = failedLoginAttempts.get(matricula);
  if (!entry?.lockedUntil) return false;
  if (Date.now() >= entry.lockedUntil) {
    failedLoginAttempts.delete(matricula);
    return false;
  }
  return true;
}

function recordFailedLogin(matricula) {
  const entry = failedLoginAttempts.get(matricula) || { count: 0, lockedUntil: null };
  entry.count += 1;
  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  failedLoginAttempts.set(matricula, entry);
}

function clearFailedLogin(matricula) {
  failedLoginAttempts.delete(matricula);
}

function isApiRequest(req) {
  const url = req.originalUrl || req.url || "";
  return (
    url.startsWith("/api/") ||
    req.path?.startsWith("/api/") ||
    req.headers.accept?.includes("application/json") ||
    req.headers["x-requested-with"] === "XMLHttpRequest"
  );
}

function autenticarApi(req, res, next) {
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }
  return res.status(401).json({
    success: false,
    message: "Não autenticado.",
  });
}

function autenticarPagina(req, res, next) {
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }
  res.redirect("/login");
}

function autenticar(req, res, next) {
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }
  if (isApiRequest(req)) {
    return res.status(401).json({
      success: false,
      message: "Não autenticado.",
    });
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

  if (isAccountLocked(matriculaLimpa)) {
    return res.status(429).json({
      message: "Conta temporariamente bloqueada por tentativas inválidas. Tente novamente em 15 minutos.",
    });
  }

  try {
    const [rows] = await promisePool.query(
      "SELECT *, nivel FROM users WHERE matricula = ?",
      [matriculaLimpa]
    );

    if (rows.length === 0) {
      recordFailedLogin(matriculaLimpa);
      await registrarAuditoria(matriculaLimpa, "LOGIN_FALHA", "Tentativa com matrícula inexistente");
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
      recordFailedLogin(matriculaLimpa);
      await registrarAuditoria(matriculaLimpa, "LOGIN_FALHA", "Senha incorreta");
      return res.status(401).json({ message: "Matrícula ou senha inválida." });
    }

    clearFailedLogin(matriculaLimpa);

    const ultimoAcessoAnterior = usuario.ultimo_login || null;

    const safeUser = {
      id: usuario.id,
      nome: usuario.nome,
      matricula: usuario.matricula,
      cargo: usuario.cargo,
      nivel: usuario.nivel,
      ultimoAcesso: ultimoAcessoAnterior,
    };

    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    req.session.user = {
      id: safeUser.id,
      nome: safeUser.nome,
      matricula: safeUser.matricula,
      cargo: safeUser.cargo,
      nivel: safeUser.nivel,
    };
    ensureCsrfToken(req);

    await promisePool.query(
      "UPDATE users SET ultimo_login = NOW() WHERE matricula = ?",
      [matriculaLimpa]
    );

    await registrarAuditoria(matriculaLimpa, "LOGIN", "Login no sistema");

    return res.status(200).json({
      message: "Login bem-sucedido!",
      user: safeUser,
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

function validarPoliticaSenha(senha) {
  if (!senha || typeof senha !== "string" || senha.length < 8) {
    throw new Error("A senha deve ter no mínimo 8 caracteres.");
  }
  if (!/[A-Za-z]/.test(senha) || !/[0-9]/.test(senha)) {
    throw new Error("A senha deve conter letras e números.");
  }
}

async function criarHashSenha(senha) {
  validarPoliticaSenha(senha);
  return bcrypt.hash(senha, 10);
}

async function verificarSenha(senhaDigitada, hashArmazenado) {
  return bcrypt.compare(senhaDigitada, hashArmazenado);
}

module.exports = {
  loginLimiter,
  autenticar,
  autenticarApi,
  autenticarPagina,
  isApiRequest,
  loginSeguro,
  verificarNivel,
  verificarCargo,
  registrarAuditoria,
  criarHashSenha,
  verificarSenha,
  validarPoliticaSenha,
};
