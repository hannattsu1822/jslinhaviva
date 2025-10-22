const service = require("./uteis.service");

async function relatorioServicosPorEncarregado(req, res) {
  try {
    const dados = await service.relatorioServicosPorEncarregado(req.query);
    res.json(dados);
  } catch (error) {
    console.error(
      "Erro ao buscar relatório de serviços por encarregado:",
      error
    );
    res.status(500).json({ message: "Erro ao buscar dados do relatório." });
  }
}

async function relatorioServicosPorDesligamento(req, res) {
  try {
    const dados = await service.relatorioServicosPorDesligamento(req.query);
    res.json(dados);
  } catch (error) {
    console.error(
      "Erro ao buscar relatório de serviços por desligamento:",
      error
    );
    res.status(500).json({ message: "Erro ao buscar dados do relatório." });
  }
}

async function relatorioServicosConcluidosPorMes(req, res) {
  try {
    const dados = await service.relatorioServicosConcluidosPorMes(req.query);
    res.json(dados);
  } catch (error) {
    console.error(
      "Erro ao buscar relatório de serviços concluídos por mês:",
      error
    );
    res.status(500).json({ message: "Erro ao buscar dados do relatório." });
  }
}

async function relatorioStatusFinalizacao(req, res) {
  try {
    const dados = await service.relatorioStatusFinalizacao(req.query);
    res.json(dados);
  } catch (error) {
    console.error("Erro ao buscar relatório de status de finalização:", error);
    res.status(500).json({ message: "Erro ao buscar dados do relatório." });
  }
}

async function renderizarPaginaLogboxDevices(req, res) {
  try {
    const devices = await service.obterDispositivosLogbox();
    res.render("pages/logbox/device-list", {
      pageTitle: "Equipamentos LogBox",
      user: req.session.user,
      devices: devices,
    });
  } catch (err) {
    console.error("Erro ao buscar lista de dispositivos LogBox:", err);
    res.status(500).send("Erro interno no servidor");
  }
}

module.exports = {
  relatorioServicosPorEncarregado,
  relatorioServicosPorDesligamento,
  relatorioServicosConcluidosPorMes,
  relatorioStatusFinalizacao,
  renderizarPaginaLogboxDevices,
};
