const { promisePool } = require("./init");
const bcrypt = require("bcrypt");

// Função para autenticar
function autenticar(req, res, next) {
  if (req.session.user) {
    req.user = req.session.user;
    next();
  } else {
    res.redirect("/login");
  }
}

// Função para login seguro com migração automática de senhas
async function loginSeguro(req, res, next) {
  // Remova 'next' se não for usá-lo aqui
  const { matricula, senha } = req.body;

  try {
    const [rows] = await promisePool.query(
      "SELECT * FROM users WHERE matricula = ?", // Supondo que sua tabela de usuários seja 'users'
      [matricula]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Matrícula ou senha inválida" });
    }

    const usuario = rows[0];
    let senhaValida = false;
    const senhaJaCriptografada = usuario.senha.startsWith("$2b$");

    if (senhaJaCriptografada) {
      senhaValida = await bcrypt.compare(senha, usuario.senha);
    } else {
      senhaValida = senha === usuario.senha;
      if (senhaValida) {
        const hash = await bcrypt.hash(senha, 10);
        await promisePool.query(
          "UPDATE users SET senha = ? WHERE matricula = ?", // Supondo 'users'
          [hash, matricula]
        );
        console.log(`Senha migrada para bcrypt (usuário ${matricula})`);
      }
    }

    if (!senhaValida) {
      return res.status(401).json({ message: "Matrícula ou senha inválida" });
    }

    const { senha: _, ...userWithoutPassword } = usuario;
    req.session.user = userWithoutPassword;

    await registrarAuditoria(matricula, "LOGIN", "Login no sistema");

    // ADICIONE ESTA LINHA PARA ENVIAR A RESPOSTA DE SUCESSO
    res.status(200).json({
      message: "Login bem-sucedido!",
      user: req.session.user,
    });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
}

// Função para verificar permissão por cargo
function verificarPermissaoPorCargo(req, res, next) {
  const cargo = req.user.cargo;
  console.log(`Cargo do usuário: ${cargo}`);
  console.log(`Rota solicitada: ${req.path}`);

  const rotasPublicas = ["/login", "/dashboard"];
  if (rotasPublicas.includes(req.path)) {
    return next();
  }

  const rotasPermitidas = {
    Motorista: ["/frota", "/checklist_veiculos"],
    Inspetor: ["*"],
    Técnico: ["*"],
    Engenheiro: ["*"],
    Encarregado: ["*"],
    ADM: ["*"],
    ADMIN: ["*"],
    Construção: ["/avulsos-dashboard", "/gerar-formulario-txt-bas", "/gerar-formulario-bas-linhaviva", "/bas-importar-dados-pagina" ],
    Transporte: ["/frota", "/frota", "/frota_controle", "/frota_veiculos_cadastro", "/frota_motoristas_cadastro", "/frota_estoque_cadastro"]
  };

  const rotasPermitidasUsuario = rotasPermitidas[cargo] || [];
  const rotaPermitida = rotasPermitidasUsuario.some((rota) => {
    if (rota === "*") return true;
    return req.path === rota;
  });

  if (!rotaPermitida) {
    console.log("Acesso negado!");
    res.status(403).json({ message: "Acesso negado!" });
  } else {
    console.log("Acesso permitido!");
    next();
  }
}

// Função para verificar permissão geral
function verificarPermissao(req, res, next) {
  const cargo = req.user.cargo;
  const cargosPermitidos = [
    "Técnico",
    "Engenheiro",
    "Encarregado",
    "ADMIN",
    "Inspetor",
  ];

  if (cargosPermitidos.includes(cargo)) {
    next();
  } else {
    res.status(403).json({ message: "Acesso negado!" });
  }
}

// Função para registrar auditoria
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

// Função para criar hash de senha (usar em cadastros/resets)
async function criarHashSenha(senha) {
  return await bcrypt.hash(senha, 10);
}

// Função para verificar senha (uso geral)
async function verificarSenha(senhaDigitada, hashArmazenado) {
  return await bcrypt.compare(senhaDigitada, hashArmazenado);
}

module.exports = {
  autenticar,
  loginSeguro, // Garanta que está exportando loginSeguro
  verificarPermissaoPorCargo,
  verificarPermissao,
  registrarAuditoria,
  criarHashSenha,
  verificarSenha,
};
