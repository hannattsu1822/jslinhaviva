const service = require("./prv.service");
const { registrarAuditoria } = require("../../auth");

async function listarVeiculos(req, res) {
  try {
    const veiculos = await service.listarVeiculos();
    res.json(veiculos);
  } catch (error) {
    console.error("Erro ao buscar veículos da frota:", error);
    res.status(500).json({ message: "Erro interno ao buscar veículos." });
  }
}

async function obterUltimoKm(req, res) {
  try {
    const raw = await service.obterUltimoKm(req.query.veiculoId);

    // Normaliza qualquer formato inesperado para número (ou null)
    let km = raw;

    if (km && typeof km === "object") {
      km =
        km.chegadakm ??
        km.ultimoKm ??
        km.ultimo_km ??
        km.km ??
        km.value ??
        null;
    }

    if (km === "" || km === undefined) km = null;

    km = km === null ? null : Number(km);
    if (km !== null && !Number.isFinite(km)) km = null;

    return res.status(200).json(km);
  } catch (error) {
    console.error("Erro ao buscar último KM", error);
    const statusCode = error.message.includes("obrigatório") ? 400 : 500;
    return res.status(statusCode).json({ message: error.message });
  }
}


async function obterStatusViagem(req, res) {
  try {
    const status = await service.obterStatusViagem(req.query.veiculoId);
    res.json(status);
  } catch (error) {
    console.error("Erro ao verificar status da PRV:", error);
    const statusCode = error.message.includes("obrigatório") ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function listarRegistros(req, res) {
  try {
    const registros = await service.listarRegistros(
      req.query.veiculoId,
      req.query.mesAno
    );
    res.json(registros);
  } catch (error) {
    console.error("Erro ao buscar registros da PRV:", error);
    const statusCode = error.message.includes("obrigatórios") ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function iniciarViagem(req, res) {
  try {
    const { matricula } = req.session.user;
    const { id } = await service.iniciarViagem(req.body, matricula);
    await registrarAuditoria(
      matricula,
      "INICIAR_VIAGEM_PRV",
      `ID do Registro: ${id}`
    );
    res.status(201).json({ message: "Saída registrada com sucesso!", id });
  } catch (error) {
    console.error("Erro ao registrar saída na PRV:", error);
    const statusCode =
      error.message.includes("obrigatórios") ||
      error.message.includes("não corresponde")
        ? 400
        : error.message.includes("em andamento")
        ? 409
        : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function finalizarViagem(req, res) {
  try {
    const { id } = req.params;
    const { matricula } = req.session.user;
    await service.finalizarViagem(id, req.body);
    await registrarAuditoria(
      matricula,
      "FINALIZAR_VIAGEM_PRV",
      `ID do Registro: ${id}`
    );
    res.json({ message: "Chegada registrada com sucesso!" });
  } catch (error) {
    console.error("Erro ao registrar chegada na PRV:", error);
    const statusCode = error.message.includes("obrigatório")
      ? 400
      : error.message.includes("não encontrado")
      ? 404
      : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

async function excluirRegistro(req, res) {
  try {
    const { id } = req.params;
    const { matricula } = req.session.user;
    await service.excluirRegistro(id);
    await registrarAuditoria(
      matricula,
      "EXCLUIR_REGISTRO_PRV",
      `ID do Registro: ${id}`
    );
    res.json({ message: "Registro excluído com sucesso!" });
  } catch (error) {
    console.error("Erro ao excluir registro da PRV:", error);
    const statusCode = error.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: error.message });
  }
}

module.exports = {
  listarVeiculos,
  obterUltimoKm,
  obterStatusViagem,
  listarRegistros,
  iniciarViagem,
  finalizarViagem,
  excluirRegistro,
};
