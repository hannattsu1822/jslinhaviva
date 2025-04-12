const { promisePool } = require('./init');

// Função para autenticar
function autenticar(req, res, next) {
    if (req.session.user) {
        req.user = req.session.user;
        next();
    } else {
        res.redirect('/login');
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
        Inspetor: ['/transformadores', '/upload_transformadores', '/formulario_transformadores', '/filtrar_transformadores'],
        Encarregado: ['/transformadores', '/upload_transformadores', '/formulario_transformadores', '/filtrar_transformadores'], // Mesmas permissões do Inspetor
        Técnico: ['*'],
        Engenheiro: ['*'],
        Gerente: ['*'],
        ADM: ['*'],
        ADMIN: ['*'],
    };

    const rotasPermitidasUsuario = rotasPermitidas[cargo] || [];
    const rotaPermitida = rotasPermitidasUsuario.some(rota => {
        if (rota === '*') return true;
        return req.path.startsWith(rota); // Alterado para verificar prefixo da rota
    });

    if (!rotaPermitida) {
        console.log('Acesso negado!');
        return res.status(403).json({ message: 'Acesso negado! Cargo não autorizado.' });
    } else {
        console.log('Acesso permitido!');
        next();
    }
}

// Função para verificar permissão geral
function verificarPermissao(req, res, next) {
    const cargo = req.user.cargo;
    const cargosPermitidos = ['Técnico', 'Engenheiro', 'Gerente', 'ADMIN', 'ADM', 'Encarregado'];

    if (cargosPermitidos.includes(cargo)) {
        next();
    } else {
        res.status(403).json({ message: 'Acesso negado! Nível de permissão insuficiente.' });
    }
}

// Função para registrar auditoria (modificada para suportar transações)
async function registrarAuditoria(matricula, acao, detalhes = null, connection = null) {
    if (!matricula) {
        console.error('Tentativa de registrar auditoria sem matrícula');
        throw new Error('Matrícula é obrigatória para auditoria');
    }

    const query = `INSERT INTO auditoria (matricula_usuario, acao, detalhes) VALUES (?, ?, ?)`;

    try {
        if (connection) {
            // Usa a conexão existente da transação
            await connection.query(query, [matricula, acao, detalhes]);
        } else {
            // Cria uma nova conexão se não for passada
            await promisePool.query(query, [matricula, acao, detalhes]);
        }
    } catch (err) {
        console.error('Erro ao registrar auditoria:', err);
        throw err; // Propaga o erro para ser tratado na transação
    }
}

module.exports = {
    autenticar,
    verificarPermissaoPorCargo,
    verificarPermissao,
    registrarAuditoria
};
