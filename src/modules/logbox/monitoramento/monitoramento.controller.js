const service = require("./monitoramento.service");
const { promisePool } = require("../../../init");

async function renderizarPaginaDetalhe(req, res) {
  try {
    const { serialNumber } = req.params;
    const [deviceRows] = await promisePool.query(
      "SELECT * FROM dispositivos_logbox WHERE serial_number = ?",
      [serialNumber]
    );
    if (deviceRows.length === 0) {
      return res.status(404).send("Dispositivo não encontrado");
    }
    res.render("pages/logbox/device-detail.html", {
      pageTitle: `Monitorando: ${deviceRows[0].local_tag}`,
      user: req.user,
      serialNumber: deviceRows[0].serial_number,
      device: deviceRows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao carregar a página do dispositivo");
  }
}

async function renderizarPaginaRelatorios(req, res) {
  try {
    const [devices] = await promisePool.query(
      "SELECT id, local_tag, serial_number FROM dispositivos_logbox WHERE ativo = 1 ORDER BY local_tag"
    );
    res.render("pages/logbox/relatorios.html", {
      pageTitle: "Relatórios LogBox",
      user: req.user,
      devices: devices,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao carregar a página de relatórios");
  }
}

async function obterLeituras(req, res) {
  try {
    const data = await service.obterLeituras(req.params.serialNumber);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
}

async function obterStatus(req, res) {
  try {
    const status = await service.obterStatus(req.params.serialNumber);
    res.json({ status });
  } catch (err) {
    console.error(err);
    const statusCode = err.message.includes("não encontrado") ? 404 : 500;
    res.status(statusCode).json({ message: err.message });
  }
}

async function obterUltimaLeitura(req, res) {
  try {
    const latest = await service.obterUltimaLeitura(req.params.serialNumber);
    res.json(latest);
  } catch (error) {
    console.error(error);
    const statusCode = error.message.includes("No readings found") ? 404 : 500;
    res.status(statusCode).send(error.message);
  }
}

async function obterEstatisticas(req, res) {
  try {
    const stats = await service.obterEstatisticas(req.params.serialNumber);
    res.json(stats);
  } catch (error) {
    console.error("Erro ao buscar estatísticas detalhadas:", error);
    res.status(500).json({ message: "Erro ao buscar estatísticas detalhadas" });
  }
}

async function obterEstatisticasVentilacao(req, res) {
  try {
    const stats = await service.obterEstatisticasVentilacao(req.params.serialNumber);
    res.json(stats);
  } catch (error) {
    console.error("Erro ao buscar estatísticas de ventilação:", error);
    res.status(500).json({ message: "Erro ao buscar estatísticas de ventilação" });
  }
}

async function obterHistoricoVentilacao(req, res) {
  try {
    const history = await service.obterHistoricoVentilacao(
      req.params.serialNumber
    );
    res.json(history);
  } catch (error) {
    console.error("ERRO DETALHADO ao buscar histórico de ventilação:", error);
    res
      .status(500)
      .json({ message: "Erro interno ao buscar o histórico de ventilação." });
  }
}

async function obterHistoricoConexao(req, res) {
  try {
    const data = await service.obterHistoricoConexao(req.params.serialNumber);
    res.json(data);
  } catch (error) {
    console.error("Erro ao carregar histórico de conexão:", error);
    res.status(500).send("Server error");
  }
}

async function gerarRelatorioVisual(req, res) {
  try {
    const data = await service.getReportData(req.body);
    res.json(data);
  } catch (err) {
    console.error("Erro ao gerar relatório visual:", err);
    res.status(500).json({ message: "Erro ao gerar dados do relatório" });
  }
}

async function gerarPdfRelatorio(req, res) {
  try {
    const pdfBytes = await service.gerarPdfRelatorio(req.body);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=relatorio.pdf");
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("Erro ao gerar PDF com pdf-lib:", err);
    res.status(500).json({ message: "Erro ao gerar PDF" });
  }
}

module.exports = {
  renderizarPaginaDetalhe,
  renderizarPaginaRelatorios,
  obterLeituras,
  obterStatus,
  obterUltimaLeitura,
  obterEstatisticas,
  obterEstatisticasVentilacao,
  obterHistoricoVentilacao,
  obterHistoricoConexao,
  gerarRelatorioVisual,
  gerarPdfRelatorio,
};
