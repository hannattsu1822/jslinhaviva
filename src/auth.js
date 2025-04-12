const { promisePool } = require('./init');

const autenticar = (req, res, next) => {
    if (req.session.user) {
        req.user = req.session.user;
        return next();
    }
    res.redirect('/login');
};

const verificarPermissaoPorCargo = (req, res, next) => {
    const cargo = req.user?.cargo;
    
    if (req.path.includes('auditoria') && !['ADMIN', 'ADM', 'Gerente', 'Engenheiro'].includes(cargo)) {
        return res.status(403).json({ message: 'Acesso restrito' });
    }
    next();
};

const registrarAuditoria = async (matricula, acao, detalhes = null, connection = null) => {
    const query = `INSERT INTO auditoria (matricula_usuario, acao, detalhes) VALUES (?, ?, ?)`;
    const executor = connection || promisePool;
    await executor.query(query, [matricula, acao, detalhes]);
};

module.exports = {
    autenticar,
    verificarPermissaoPorCargo,
    registrarAuditoria
};
