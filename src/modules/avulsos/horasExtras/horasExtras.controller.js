const service = require("./horasExtras.service");
const { registrarAuditoria } = require("../../../auth");

async function solicitarHorasExtras(req, res) {
    try {
        const { autorizacaoId, connection } = await service.solicitarHorasExtras(req.body);
        await registrarAuditoria(
            req.user.matricula,
            "Solicitação Horas Extras",
            `Solicitação para ${req.body.nomeEmpregado} (ID: ${autorizacaoId}) enviada.`,
            connection
        );
        res.status(201).json({
            message: "Solicitação de horas extras enviada com sucesso!",
            id: autorizacaoId,
        });
    } catch (error) {
        console.error("Erro ao processar solicitação de horas extras:", error);
        let userMessage = "Erro interno no servidor ao processar a solicitação.";
        let statusCode = 500;

        if (error.message.includes("incompletos")) {
            userMessage = error.message;
            statusCode = 400;
        } else if (error.code === "ER_NO_REFERENCED_ROW_2" || (error.message && error.message.includes("foreign key constraint fails"))) {
            userMessage = "Erro de dados: Verifique se a matrícula do empregado é válida ou se há referências corretas.";
        } else if (error.code === "ER_DATA_TOO_LONG") {
            userMessage = "Erro de dados: Um dos campos excedeu o tamanho máximo permitido.";
        } else if (error.code === "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD" || error.code === "WARN_DATA_TRUNCATED") {
            userMessage = "Erro de dados: Valor inválido para um dos campos numéricos ou de data.";
        }
        res.status(statusCode).json({ message: userMessage });
    }
}

async function listarTurmasEncarregados(req, res) {
    try {
        const turmas = await service.listarTurmasEncarregados();
        res.json(turmas);
    } catch (error) {
        console.error("Erro ao buscar turmas e encarregados:", error);
        res.status(500).json({ message: "Erro interno ao buscar dados." });
    }
}

module.exports = {
    solicitarHorasExtras,
    listarTurmasEncarregados,
};