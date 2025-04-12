const { promisePool } = require('./init');

module.exports = {
    // Função de autenticação
    autenticar: (req, res, next) => {
        if (req.session.user) {
            req.user = req.session.user;
            return next();
        }
        res.redirect('/login');
    },

    // Função de verificação de permissão
    verificarPermissaoPorCargo: (req, res, next) => {
        const cargo = req.user?.cargo;
        
        if (req.path.includes('auditoria') && !['ADMIN', 'ADM', 'Gerente'].includes(cargo)) {
            return res.status(403).json({ message: 'Acesso não autorizado' });
        }
        next();
    },

    // Função de registro de auditoria
    registrarAuditoria: async (matricula, acao, detalhes = null, connection = null) => {
        const query = `INSERT INTO auditoria (matricula_usuario, acao, detalhes) VALUES (?, ?, ?)`;
        try {
            const executor = connection || promisePool;
            await executor.query(query, [matricula, acao, detalhes]);
        } catch (err) {
            console.error('Erro na auditoria:', err);
            throw err;
        }
    }
};
