const { promisePool } = require("../../../init");

async function solicitarHorasExtras(dadosSolicitacao) {
    const { matricula, nomeEmpregado, mesAno, servicos } = dadosSolicitacao;
    if (!matricula || !nomeEmpregado || !mesAno || !servicos || !Array.isArray(servicos) || servicos.length === 0) {
        throw new Error("Dados incompletos para solicitação de horas extras.");
    }

    const connection = await promisePool.getConnection();
    try {
        await connection.beginTransaction();
        const [autorizacaoResult] = await connection.execute(
            "INSERT INTO autorizacoes_horas_extras (matricula_empregado, nome_empregado, mes_referencia, status_aprovacao) VALUES (?, ?, ?, ?)",
            [matricula, nomeEmpregado, mesAno, "PENDENTE"]
        );
        const autorizacaoId = autorizacaoResult.insertId;

        for (const servico of servicos) {
            await connection.execute(
                "INSERT INTO servicos_horas_extras (autorizacao_id, data_servico, descricao_servico, horas_solicitadas) VALUES (?, ?, ?, ?)",
                [autorizacaoId, servico.data, servico.descricao, servico.horas]
            );
        }
        
        await connection.commit();
        return { autorizacaoId, connection };
    } catch (error) {
        if (connection) await connection.rollback();
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

async function listarTurmasEncarregados() {
    const query = `
        SELECT DISTINCT t.turma_encarregado, u.nome as nome_encarregado
        FROM sua_tabela_de_turmas t 
        JOIN users u ON t.turma_encarregado = u.matricula
        ORDER BY u.nome;
    `;
    const [rows] = await promisePool.query(query);
    return rows;
}

module.exports = {
    solicitarHorasExtras,
    listarTurmasEncarregados,
};