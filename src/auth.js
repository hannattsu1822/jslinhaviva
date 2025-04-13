const { promisePool } = require('./init');
const bcrypt = require('bcrypt');

// Função para autenticar
function autenticar(req, res, next) {
    if (req.session.user) {
        req.user = req.session.user;
        next();
    } else {
        res.redirect('/login');
    }
}

// Função para login seguro com migração automática de senhas
async function loginSeguro(req, res, next) {
    const { matricula, senha } = req.body;

    try {
        // Busca o usuário no banco de dados
        const [rows] = await promisePool.query(
            'SELECT * FROM usuarios WHERE matricula = ?',
            [matricula]
        );
        
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Matrícula ou senha inválida' });
        }

        const usuario = rows[0];
        let senhaValida = false;

        // Verifica se a senha está em bcrypt (começa com $2b$)
        const senhaJaCriptografada = usuario.senha.startsWith('$2b$');

        if (senhaJaCriptografada) {
            // Compara usando bcrypt se já estiver criptografada
            senhaValida = await bcrypt.compare(senha, usuario.senha);
        } else {
            // Comparação direta para senhas em texto puro (durante migração)
            senhaValida = senha === usuario.senha;
            
            // Se a senha estiver correta e não criptografada, migra para bcrypt
            if (senhaValida) {
                const hash = await bcrypt.hash(senha, 10);
                await promisePool.query(
                    'UPDATE usuarios SET senha = ? WHERE matricula = ?',
                    [hash, matricula]
                );
                console.log(`Senha migrada para bcrypt (usuário ${matricula})`);
            }
        }

        if (!senhaValida) {
            return res.status(401).json({ message: 'Matrícula ou senha inválida' });
        }

        // Remove a senha do objeto do usuário antes de salvar na sessão
        const { senha: _, ...userWithoutPassword } = usuario;
        req.session.user = userWithoutPassword;
        
        // Registra a ação de login na auditoria
        await registrarAuditoria(matricula, 'LOGIN', 'Login no sistema');
        
        next();
    } catch (err) {
        console.error('Erro no login:', err);
        res.status(500).json({ message: 'Erro interno no servidor' });
    }
}

// Função para verificar permissão por cargo
function verificarPermissaoPorCargo(req, res, next) {
    const cargo = req.user.cargo;
    console.log(`Cargo do usuário: ${cargo}`);
    console.log(`Rota solicitada: ${req.path}`);

    const rotasPublicas = ['/login', '/dashboard'];
    if (rotasPublicas.includes(req.path)) {
        return next();
    }

    const rotasPermitidas = {
        Motorista: ['/frota', '/checklist_veiculos'],
        Inspetor: ['/transformadores', '/upload_transformadores', '/formulario_transformadores'],
        Técnico: ['*'],
        Engenheiro: ['*'],
        Encarregado: ['*'],
        ADM: ['*'],
        ADMIN: ['*'],
    };

    const rotasPermitidasUsuario = rotasPermitidas[cargo] || [];
    const rotaPermitida = rotasPermitidasUsuario.some(rota => {
        if (rota === '*') return true;
        return req.path === rota;
    });

    if (!rotaPermitida) {
        console.log('Acesso negado!');
        res.status(403).json({ message: 'Acesso negado!' });
    } else {
        console.log('Acesso permitido!');
        next();
    }
}

// Função para verificar permissão geral
function verificarPermissao(req, res, next) {
    const cargo = req.user.cargo;
    const cargosPermitidos = ['Técnico', 'Engenheiro', 'Encarregado', 'ADMIN'];

    if (cargosPermitidos.includes(cargo)) {
        next();
    } else {
        res.status(403).json({ message: 'Acesso negado!' });
    }
}

// Função para registrar auditoria
async function registrarAuditoria(matricula, acao, detalhes = null, connection = null) {
    if (!matricula) {
        console.error('Tentativa de registrar auditoria sem matrícula');
        throw new Error('Matrícula é obrigatória para auditoria');
    }

    const query = `INSERT INTO auditoria (matricula_usuario, acao, detalhes) VALUES (?, ?, ?)`;

    try {
        if (connection) {
            await connection.query(query, [matricula, acao, detalhes]);
        } else {
            await promisePool.query(query, [matricula, acao, detalhes]);
        }
    } catch (err) {
        console.error('Erro ao registrar auditoria:', err);
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
    loginSeguro,
    verificarPermissaoPorCargo,
    verificarPermissao,
    registrarAuditoria,
    criarHashSenha,
    verificarSenha
};
