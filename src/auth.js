const { promisePool } = require('./init');

// 1. Função de autenticação básica
function autenticar(req, res, next) {
    if (req.session.user) {
        req.user = req.session.user;
        next();
    } else {
        res.redirect('/login');
    }
}

// 2. Controle de permissões liberal (todos acessam tudo, exceto auditoria)
function verificarPermissaoPorCargo(req, res, next) {
    const cargo = req.user.cargo;
    
    // Única restrição: rotas de auditoria
    if (req.path.startsWith('/auditoria') || req.path.startsWith('/api/auditoria')) {
        const cargosPermitidos = ['ADMIN', 'ADM', 'Gerente', 'Engenheiro'];
        if (!cargosPermitidos.includes(cargo)) {
            return res.status(403).json({ 
                message: 'Acesso restrito a administradores e gerentes' 
            });
        }
    }
    next(); // Libera todas as outras rotas
}

// 3. Função de permissão genérica (liberada para todos)
function verificarPermissao(req, res, next) {
    next();
}

// 4. Registro de auditoria (com tratamento de transação)
async function registrarAuditoria(matricula, acao, detalhes = null, connection = null) {
    if (!matricula) throw new Error('Matrícula obrigatória para auditoria');
    
    const query = `INSERT INTO auditoria (matricula_usuario, acao, detalhes) VALUES (?, ?, ?)`;
    try {
        const executor = connection || promisePool;
        await executor.query(query, [matricula, acao, detalhes]);
    } catch (err) {
        console.error('Falha na auditoria:', err);
        throw err;
    }
}

module.exports = {
    autenticar,
    verificarPermissaoPorCargo,
    verificarPermissao,
    registrarAuditoria
};
