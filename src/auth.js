const { promisePool } = require("./init");
const bcrypt = require("bcrypt");

// Função para autenticar (permanece a mesma)
function autenticar(req, res, next) {
  if (req.session.user) {
    req.user = req.session.user;
    next();
  } else {
    res.redirect("/login");
  }
}

// MODIFICADO: Função de login para incluir o 'nivel' na sessão
async function loginSeguro(req, res, next) {
  const { matricula, senha } = req.body;

  try {
    // MODIFICADO: Adicionado 'nivel' à consulta SELECT
    const [rows] = await promisePool.query(
      "SELECT *, nivel FROM users WHERE matricula = ?",
      [matricula]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Matrícula ou senha inválida" });
    }

    const usuario = rows[0];

    // ADICIONADO: Verificação de nível para impedir login de usuários desativados/sem permissão
    if (usuario.nivel === 0) {
      return res
        .status(403)
        .json({ message: "Usuário desativado ou sem permissão de acesso." });
    }

    let senhaValida = false;
    const senhaJaCriptografada = usuario.senha.startsWith("$2b$");

    if (senhaJaCriptografada) {
      senhaValida = await bcrypt.compare(senha, usuario.senha);
    } else {
      senhaValida = senha === usuario.senha;
      if (senhaValida) {
        const hash = await bcrypt.hash(senha, 10);
        await promisePool.query(
          "UPDATE users SET senha = ? WHERE matricula = ?",
          [hash, matricula]
        );
        console.log(`Senha migrada para bcrypt (usuário ${matricula})`);
      }
    }

    if (!senhaValida) {
      return res.status(401).json({ message: "Matrícula ou senha inválida" });
    }

    // MODIFICADO: O objeto do usuário na sessão agora inclui o 'nivel'
    const { senha: _, ...userWithoutPassword } = usuario;
    req.session.user = userWithoutPassword;

    await registrarAuditoria(matricula, "LOGIN", "Login no sistema");

    res.status(200).json({
      message: "Login bem-sucedido!",
      user: req.session.user,
    });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
}

// NOVO: Middleware para verificar o nível de permissão
// Esta função recebe o nível mínimo requerido e retorna um middleware
function verificarNivel(nivelRequerido) {
  return (req, res, next) => {
    // req.user é populado pela função autenticar()
    const nivelUsuario = req.user?.nivel;

    if (nivelUsuario === undefined) {
      console.log("Acesso negado! Nível do usuário não definido na sessão.");
      return res
        .status(403)
        .json({ message: "Acesso negado! Nível de permissão não encontrado." });
    }

    if (nivelUsuario >= nivelRequerido) {
      // O usuário tem o nível necessário ou superior
      next();
    } else {
      console.log(
        `Acesso negado! Nível do usuário: ${nivelUsuario}, Nível requerido: ${nivelRequerido}`
      );
      res
        .status(403)
        .json({
          message:
            "Acesso negado! Você não tem permissão para acessar este recurso.",
        });
    }
  };
}

// Função para registrar auditoria (permanece a mesma)
async function registrarAuditoria(
  matricula,
  acao,
  detalhes = null,
  connection = null
) {
  if (!matricula) {
    console.error("Tentativa de registrar auditoria sem matrícula");
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
    console.error("Erro ao registrar auditoria:", err);
    throw err;
  }
}

// Funções de hash e verificação de senha (permanecem as mesmas)
async function criarHashSenha(senha) {
  return await bcrypt.hash(senha, 10);
}

async function verificarSenha(senhaDigitada, hashArmazenado) {
  return await bcrypt.compare(senhaDigitada, hashArmazenado);
}

// MODIFICADO: Exportando a nova função e removendo as antigas
module.exports = {
  autenticar,
  loginSeguro,
  verificarNivel, // <-- Nova função
  registrarAuditoria,
  criarHashSenha,
  verificarSenha,
};
