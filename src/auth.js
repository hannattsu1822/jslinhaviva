const { promisePool } = require('./init');

// Middleware de autenticação
const autenticar = (req, res, next) => {
    if (req.session.user) {
        req.user = req.session.user;
        return next();
    }
    res.redirect('/login');
};

// Middleware de permissões
const verificarPermissaoPorCargo = (req, res, next) => {
    const cargo = req.user?.cargo;
    
    // Apenas restringe rotas de auditoria
    if (req.path.includes('auditoria') && !['ADMIN', 'ADM', 'Gerente', 'Engenheiro'].includes(cargo)) {
        return res.status(403).json({ message: 'Acesso restrito a administradores' });
    }
    next();
};

// Função de registro de auditoria
const registrarAuditoria = async (matricula, acao, detalhes = null, connection = null) => {
    const query = `INSERT INTO auditoria (matricula_usuario, acao, detalhes) VALUES (?, ?, ?)`;
    try {
        const executor = connection || promisePool;
        await executor.query(query, [matricula, acao, detalhes]);
    } catch (err) {
        console.error('Erro na auditoria:', err);
        throw err;
    }
};

module.exports = {
    autenticar,
    verificarPermissaoPorCargo,
    registrarAuditoria
};
