const { promisePool, logger } = require("./init");
const bcrypt = require("bcrypt");

// ─── Rate limit específico para login (5 tentativas / 15 min por IP) ──────────
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

// ─── Middleware: verifica sessão ativo ────────────────────────────────────────
function autenticar(req, res, next) {
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }
  res.redirect("/login");
}

// ─── Login seguro ─────────────────────────────────────────────────────────────
async function loginSeguro(req, res, next) {
  const { matricula, senha } = req.body;

  // Validação básica de entrada
  if (!matricula || !senha || typeof matricula !== "string" || typeof senha !== "string") {
    return res.status(400).json({ message: "Matrícula e senha são obrigatórios." });
  }

  const matriculaLimpa = matricula.trim();
  const senhaLimpa     = senha.trim();

  if (matriculaLimpa.length === 0 || senhaLimpa.length === 0) {
    return res.status(400).json({ message: "Matrícula e senha não podem ser vazios." });
  }

  try {
    const [rows] = await promisePool.query(
      "SELECT *, nivel FROM users WHERE matricula = ?",
      [matriculaLimpa]
    );

    // Resposta genérica para não revelar se a matrícula existe
    if (rows.length === 0) {
      return res.status(401).json({ message: "Matrícula ou senha inválida." });
    }

    const usuario = rows[0];

    if (usuario.nivel === 0) {
      return res.status(403).json({
        message: "Usuário desativado ou sem permissão de acesso.",
      });
    }

    let senhaValida = false;
    const senhaJaCriptografada = usuario.senha.startsWith("$2b$");

    if (senhaJaCriptografada) {
      senhaValida = await bcrypt.compare(senhaLimpa, usuario.senha);
    } else {
      // Migração de senha legado (texto plano) → bcrypt
      senhaValida = senhaLimpa === usuario.senha;

      if (senhaValida) {
        const hash = await bcrypt.hash(senhaLimpa, 10);
        await promisePool.query(
          "UPDATE users SET senha = ? WHERE matricula = ?",
          [hash, matriculaLimpa]
        );
        logger.info(`Senha migrada para bcrypt (usuário ${matriculaLimpa})`);
      }
    }

    if (!senhaValida) {
      return res.status(401).json({ message: "Matrícula ou senha inválida." });
    }

    // Regenerar sessão após login bem-sucedido (previne session fixation)
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
    logger.error(`Erro no login: ${err.message}`);
    return res.status(500).json({ message: "Erro interno no servidor." });
  }
}

// ─── Middleware: verificar nível de acesso ────────────────────────────────────
function verificarNivel(nivelRequerido) {
  return (req, res, next) => {
    const nivelUsuario = req.user?.nivel;

    if (nivelUsuario === undefined) {
      logger.warn("Acesso negado: Nível do usuário não definido na sessão");
      return res.status(403).json({
        message: "Acesso negado! Nível de permissão não encontrado.",
      });
    }

    if (nivelUsuario >= nivelRequerido) {
      return next();
    }

    logger.warn(
      `Acesso negado: Nível do usuário: ${nivelUsuario}, Nível requerido: ${nivelRequerido}`
    );
    return res.status(403).json({
      message: "Acesso negado! Você não tem permissão para acessar este recurso.",
    });
  };
}

// ─── Middleware: verificar cargo ──────────────────────────────────────────────
function verificarCargo(cargosPermitidos) {
  return (req, res, next) => {
    const cargoUsuario = req.user?.cargo;

    if (!cargoUsuario) {
      logger.warn("Acesso negado: Cargo do usuário não definido na sessão");
      return res.status(403).json({
        message: "Acesso negado! Cargo de permissão não encontrado.",
      });
    }

    if (cargosPermitidos.includes(cargoUsuario)) {
      return next();
    }

    logger.warn(
      `Acesso negado: Cargo do usuário: ${cargoUsuario}, Cargos permitidos: ${cargosPermitidos.join(", ")}`
    );
    return res.status(403).json({
      message: "Acesso negado! Você não tem permissão para acessar este recurso.",
    });
  };
}

// ─── Auditoria ────────────────────────────────────────────────────────────────
async function registrarAuditoria(matricula, acao, detalhes = null, connection = null) {
  if (!matricula) {
    logger.error("Tentativa de registrar auditoria sem matrícula");
    throw new Error("Matrícula é obrigatória para auditoria");
  }

  const query = `INSERT INTO auditoria (matricula_usuario, acao, detalhes) VALUES (?, ?, ?)`;

  try {
    if (connection) {
      await connection.query(query, [matricula, acao, detalhes]);
    } else {
      await promisePool.query(query, [matricula, acao, detalhes]);
    }
  } catch (err) {
    logger.error(`Erro ao registrar auditoria: ${err.message}`);
  }
}

// ─── Helpers de senha ─────────────────────────────────────────────────────────
async function criarHashSenha(senha) {
  return await bcrypt.hash(senha, 10);
}

async function verificarSenha(senhaDigitada, hashArmazenado) {
  return await bcrypt.compare(senhaDigitada, hashArmazenado);
}

// ─── Exports ──────────────────────────────────────────────────────────────────
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
