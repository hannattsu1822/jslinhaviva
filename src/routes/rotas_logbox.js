const express = require("express");
const router = express.Router();
const { promisePool } = require("../init");
const { autenticar, verificarNivel } = require("../auth");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");

// --- FUNÇÕES AUXILIARES ---
function formatarDuracao(segundos) {
  if (segundos === null || segundos === undefined) return "Em andamento";
  if (segundos < 60) return `${segundos} seg`;
  if (segundos < 3600)
    return `${Math.floor(segundos / 60)} min ${segundos % 60} seg`;
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  return `${horas}h ${minutos}min`;
}

async function getReportData(filters) {
  const { deviceId, startDate, endDate } = filters;
  let whereClauseLeituras = "WHERE l.timestamp_leitura BETWEEN ? AND ?";
  let whereClauseVentilacao = "WHERE v.timestamp_inicio BETWEEN ? AND ?";
  let params = [startDate, endDate];
  let deviceInfo = null;

  if (deviceId !== "all") {
    whereClauseLeituras += " AND d.id = ?";
    whereClauseVentilacao += " AND d.id = ?";
    params.push(deviceId);
    const [deviceRows] = await promisePool.query(
      "SELECT * FROM dispositivos_logbox WHERE id = ?",
      [deviceId]
    );
    if (deviceRows.length > 0) deviceInfo = deviceRows[0];
  }

  const [leituras] = await promisePool.query(
    `SELECT l.timestamp_leitura, JSON_UNQUOTE(JSON_EXTRACT(l.payload_json, '$.value_channels[2]')) AS temperatura FROM leituras_logbox l JOIN dispositivos_logbox d ON l.serial_number = d.serial_number ${whereClauseLeituras} ORDER BY l.timestamp_leitura ASC`,
    params
  );
  const [stats] = await promisePool.query(
    `SELECT MIN(CAST(JSON_UNQUOTE(JSON_EXTRACT(l.payload_json, '$.value_channels[2]')) AS DECIMAL(10,2))) as temp_min, AVG(CAST(JSON_UNQUOTE(JSON_EXTRACT(l.payload_json, '$.value_channels[2]')) AS DECIMAL(10,2))) as temp_avg, MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(l.payload_json, '$.value_channels[2]')) AS DECIMAL(10,2))) as temp_max FROM leituras_logbox l JOIN dispositivos_logbox d ON l.serial_number = d.serial_number ${whereClauseLeituras}`,
    params
  );
  const [fanHistory] = await promisePool.query(
    `SELECT v.* FROM historico_ventilacao v JOIN dispositivos_logbox d ON v.serial_number = d.serial_number ${whereClauseVentilacao} ORDER BY v.timestamp_inicio ASC`,
    params
  );

  const labels = leituras.map((r) =>
    new Date(r.timestamp_leitura).toLocaleString("pt-BR")
  );
  const temperaturas = leituras.map((r) => parseFloat(r.temperatura));

  return {
    device: deviceInfo || { local_tag: "Todos os Equipamentos" },
    filters,
    chartData: {
      labels,
      datasets: [{ label: "Temperatura", data: temperaturas }],
    },
    stats: stats[0],
    fanHistory,
  };
}

// --- ROTAS QUE ESTAVAM NO LUGAR ERRADO ---
router.get("/dashboard-logbox", autenticar, (req, res) => {
  res.render("pages/logbox/logbox.html", {
    pageTitle: "Dashboard LogBox",
    user: req.session.user,
  });
});

router.get("/api/logbox/leituras", autenticar, async (req, res) => {
  try {
    const limite = parseInt(req.query.limite) || 200;
    const [rows] = await promisePool.query(
      `SELECT l.timestamp_leitura, l.payload_json ->> '$.value_channels[2]' AS temperatura, l.payload_json ->> '$.value_channels[3]' AS umidade, l.payload_json ->> '$.battery' AS bateria FROM (SELECT * FROM leituras_logbox ORDER BY id DESC LIMIT ?) l ORDER BY l.id ASC`,
      [limite]
    );
    const labels = rows.map((r) =>
      new Date(r.timestamp_leitura).toLocaleString("pt-BR")
    );
    const temperaturas = rows.map((r) => parseFloat(r.temperatura));
    const umidades = rows.map((r) => parseFloat(r.umidade));
    const baterias = rows.map((r) => parseFloat(r.bateria));
    res.json({ labels, temperaturas, umidades, baterias });
  } catch (err) {
    console.error("Erro ao buscar leituras do LogBox:", err);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
});

router.get("/api/logbox/stats", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      `SELECT MIN(CAST(payload_json ->> '$.value_channels[2]' AS DECIMAL(10,2))) as temp_min, AVG(CAST(payload_json ->> '$.value_channels[2]' AS DECIMAL(10,2))) as temp_avg, MAX(CAST(payload_json ->> '$.value_channels[2]' AS DECIMAL(10,2))) as temp_max FROM leituras_logbox WHERE timestamp_leitura >= NOW() - INTERVAL 1 DAY`
    );
    const stats = rows[0];
    const formattedStats = {
      temp_min: stats.temp_min ? parseFloat(stats.temp_min).toFixed(2) : "N/A",
      temp_avg: stats.temp_avg ? parseFloat(stats.temp_avg).toFixed(2) : "N/A",
      temp_max: stats.temp_max ? parseFloat(stats.temp_max).toFixed(2) : "N/A",
    };
    res.json(formattedStats);
  } catch (err) {
    console.error("Erro ao buscar estatísticas do LogBox:", err);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
});
// --- FIM DAS ROTAS MOVIDAS ---

// --- ROTAS QUE JÁ ESTAVAM CORRETAS ---
router.get("/logbox-device/:serialNumber", autenticar, async (req, res) => {
  const serialNumber = req.params.serialNumber;
  try {
    const [rows] = await promisePool.query(
      "SELECT local_tag FROM dispositivos_logbox WHERE serial_number = ?",
      [serialNumber]
    );
    if (rows.length === 0)
      return res.status(404).send("Equipamento não encontrado");
    res.render("pages/logbox/device-detail.html", {
      pageTitle: `Detalhes - ${rows[0].local_tag}`,
      user: req.session.user,
      serialNumber: serialNumber,
      localTag: rows[0].local_tag,
    });
  } catch (err) {
    console.error("Erro ao buscar dispositivo:", err);
    res.status(500).send("Erro interno no servidor");
  }
});

router.get(
  "/gerenciar-dispositivos",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    try {
      const [devices] = await promisePool.query(
        "SELECT * FROM dispositivos_logbox ORDER BY local_tag ASC"
      );
      res.render("pages/logbox/gerenciar-dispositivos.html", {
        pageTitle: "Gerenciar Dispositivos",
        user: req.session.user,
        devices: devices,
      });
    } catch (err) {
      console.error("Erro ao carregar página de gerenciamento:", err);
      res.status(500).send("Erro interno no servidor");
    }
  }
);

router.get(
  "/relatorios-logbox",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    try {
      const [devices] = await promisePool.query(
        "SELECT id, serial_number, local_tag FROM dispositivos_logbox WHERE ativo = 1 ORDER BY local_tag ASC"
      );
      res.render("pages/logbox/relatorios.html", {
        pageTitle: "Gerador de Relatórios",
        user: req.session.user,
        devices: devices,
      });
    } catch (err) {
      console.error("Erro ao carregar página de relatórios:", err);
      res.status(500).send("Erro interno no servidor");
    }
  }
);

router.get(
  "/api/logbox-device/:serialNumber/latest",
  autenticar,
  async (req, res) => {
    const serialNumber = req.params.serialNumber;
    try {
      const [rows] = await promisePool.query(
        "SELECT payload_json, timestamp_leitura, fonte_alimentacao FROM leituras_logbox WHERE serial_number = ? ORDER BY id DESC LIMIT 1",
        [serialNumber]
      );
      if (rows.length === 0)
        return res.status(404).json({ message: "Nenhuma leitura encontrada." });
      res.json({
        payload: rows[0].payload_json,
        timestamp_leitura: rows[0].timestamp_leitura,
        fonte_alimentacao: rows[0].fonte_alimentacao,
      });
    } catch (err) {
      console.error("Erro ao buscar última leitura:", err);
      res.status(500).json({ message: "Erro interno no servidor" });
    }
  }
);

router.get(
  "/api/logbox-device/:serialNumber/status",
  autenticar,
  async (req, res) => {
    const serialNumber = req.params.serialNumber;
    try {
      const [rows] = await promisePool.query(
        "SELECT local_tag, ultima_leitura, status_json FROM dispositivos_logbox WHERE serial_number = ?",
        [serialNumber]
      );
      if (rows.length === 0) {
        return res.status(404).json({ message: "Dispositivo não encontrado." });
      }
      const statusData = {
        local_tag: rows[0].local_tag,
        ultima_leitura_status: rows[0].ultima_leitura,
        status: rows[0].status_json || {},
      };
      res.json(statusData);
    } catch (err) {
      console.error("Erro ao buscar status do dispositivo:", err);
      res.status(500).json({ message: "Erro interno no servidor" });
    }
  }
);

router.get(
  "/api/logbox-device/:serialNumber/leituras",
  autenticar,
  async (req, res) => {
    const serialNumber = req.params.serialNumber;
    const limite = parseInt(req.query.limite) || 200;
    try {
      const [rows] = await promisePool.query(
        `SELECT l.timestamp_leitura, JSON_UNQUOTE(JSON_EXTRACT(l.payload_json, '$.value_channels[2]')) AS temperatura, JSON_UNQUOTE(JSON_EXTRACT(l.payload_json, '$.value_channels[3]')) AS umidade, JSON_UNQUOTE(JSON_EXTRACT(l.payload_json, '$.battery')) AS bateria FROM (SELECT * FROM leituras_logbox WHERE serial_number = ? ORDER BY id DESC LIMIT ?) l ORDER BY l.id ASC`,
        [serialNumber, limite]
      );
      const labels = rows.map((r) =>
        new Date(r.timestamp_leitura).toLocaleString("pt-BR")
      );
      const temperaturas = rows.map((r) => parseFloat(r.temperatura));
      const umidades = rows.map((r) => parseFloat(r.umidade));
      const baterias = rows.map((r) => parseFloat(r.bateria));
      res.json({ labels, temperaturas, umidades, baterias });
    } catch (err) {
      console.error("Erro ao buscar histórico do dispositivo:", err);
      res.status(500).json({ message: "Erro interno no servidor" });
    }
  }
);

router.get(
  "/api/logbox-device/:serialNumber/stats-detail",
  autenticar,
  async (req, res) => {
    const { serialNumber } = req.params;
    try {
      const [todayStatsRows] = await promisePool.query(
        `SELECT MIN(CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.value_channels[2]')) AS DECIMAL(10,2))) as temp_min, AVG(CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.value_channels[2]')) AS DECIMAL(10,2))) as temp_avg, MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.value_channels[2]')) AS DECIMAL(10,2))) as temp_max FROM leituras_logbox WHERE serial_number = ? AND DATE(timestamp_leitura) = CURDATE()`,
        [serialNumber]
      );
      const [monthStatsRows] = await promisePool.query(
        `SELECT MIN(CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.value_channels[2]')) AS DECIMAL(10,2))) as temp_min, AVG(CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.value_channels[2]')) AS DECIMAL(10,2))) as temp_avg, MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.value_channels[2]')) AS DECIMAL(10,2))) as temp_max FROM leituras_logbox WHERE serial_number = ? AND YEAR(timestamp_leitura) = YEAR(CURDATE()) AND MONTH(timestamp_leitura) = MONTH(CURDATE())`,
        [serialNumber]
      );
      const formatStats = (stats) => ({
        min: stats.temp_min ? parseFloat(stats.temp_min).toFixed(2) : "N/A",
        avg: stats.temp_avg ? parseFloat(stats.temp_avg).toFixed(2) : "N/A",
        max: stats.temp_max ? parseFloat(stats.temp_max).toFixed(2) : "N/A",
      });
      res.json({
        today: formatStats(todayStatsRows[0]),
        month: formatStats(monthStatsRows[0]),
      });
    } catch (err) {
      console.error("Erro ao buscar estatísticas detalhadas:", err);
      res.status(500).json({ message: "Erro interno no servidor" });
    }
  }
);

router.get(
  "/api/logbox-device/:serialNumber/ventilation-stats",
  autenticar,
  async (req, res) => {
    const { serialNumber } = req.params;
    try {
      const [todayStats] = await promisePool.query(
        `SELECT COUNT(*) as count, SUM(duracao_segundos) as total_duration FROM historico_ventilacao WHERE serial_number = ? AND DATE(timestamp_inicio) = CURDATE()`,
        [serialNumber]
      );
      const [monthStats] = await promisePool.query(
        `SELECT COUNT(*) as count, SUM(duracao_segundos) as total_duration FROM historico_ventilacao WHERE serial_number = ? AND YEAR(timestamp_inicio) = YEAR(CURDATE()) AND MONTH(timestamp_inicio) = MONTH(CURDATE())`,
        [serialNumber]
      );
      res.json({
        today: {
          count: todayStats[0].count || 0,
          duration: todayStats[0].total_duration || 0,
        },
        month: {
          count: monthStats[0].count || 0,
          duration: monthStats[0].total_duration || 0,
        },
      });
    } catch (err) {
      console.error("Erro ao buscar estatísticas da ventilação:", err);
      res.status(500).json({ message: "Erro interno no servidor" });
    }
  }
);

router.get(
  "/api/logbox-device/:serialNumber/ventilation-history",
  autenticar,
  async (req, res) => {
    const { serialNumber } = req.params;
    try {
      const [history] = await promisePool.query(
        `SELECT timestamp_inicio, timestamp_fim, duracao_segundos FROM historico_ventilacao WHERE serial_number = ? ORDER BY timestamp_inicio DESC LIMIT 50`,
        [serialNumber]
      );
      res.json(history);
    } catch (err) {
      console.error("Erro ao buscar histórico da ventilação:", err);
      res.status(500).json({ message: "Erro interno no servidor" });
    }
  }
);

router.post(
  "/api/dispositivos",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { serial_number, local_tag, descricao } = req.body;
    if (!serial_number || !local_tag)
      return res
        .status(400)
        .json({ message: "Número de série e Local/Tag são obrigatórios." });
    try {
      const [result] = await promisePool.query(
        "INSERT INTO dispositivos_logbox (serial_number, local_tag, descricao) VALUES (?, ?, ?)",
        [serial_number, local_tag, descricao || null]
      );
      res.status(201).json({
        id: result.insertId,
        message: "Dispositivo criado com sucesso!",
      });
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY")
        return res
          .status(409)
          .json({ message: "Este número de série já está cadastrado." });
      console.error("Erro ao criar dispositivo:", err);
      res.status(500).json({ message: "Erro interno no servidor" });
    }
  }
);

router.get(
  "/api/dispositivos/:id",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { id } = req.params;
    try {
      const [rows] = await promisePool.query(
        "SELECT id, serial_number, local_tag, descricao FROM dispositivos_logbox WHERE id = ?",
        [id]
      );
      if (rows.length === 0)
        return res.status(404).json({ message: "Dispositivo não encontrado." });
      res.json(rows[0]);
    } catch (err) {
      console.error("Erro ao buscar dispositivo:", err);
      res.status(500).json({ message: "Erro interno no servidor" });
    }
  }
);

router.put(
  "/api/dispositivos/:id",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { id } = req.params;
    const { serial_number, local_tag, descricao } = req.body;
    if (!serial_number || !local_tag)
      return res
        .status(400)
        .json({ message: "Número de série e Local/Tag são obrigatórios." });
    try {
      const [result] = await promisePool.query(
        "UPDATE dispositivos_logbox SET serial_number = ?, local_tag = ?, descricao = ? WHERE id = ?",
        [serial_number, local_tag, descricao || null, id]
      );
      if (result.affectedRows === 0)
        return res.status(404).json({ message: "Dispositivo não encontrado." });
      res.json({ message: "Dispositivo atualizado com sucesso!" });
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY")
        return res
          .status(409)
          .json({ message: "Este número de série já está cadastrado." });
      console.error("Erro ao atualizar dispositivo:", err);
      res.status(500).json({ message: "Erro interno no servidor" });
    }
  }
);

router.delete(
  "/api/dispositivos/:id",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { id } = req.params;
    try {
      const [result] = await promisePool.query(
        "DELETE FROM dispositivos_logbox WHERE id = ?",
        [id]
      );
      if (result.affectedRows === 0)
        return res.status(404).json({ message: "Dispositivo não encontrado." });
      res.json({ message: "Dispositivo excluído com sucesso!" });
    } catch (err) {
      console.error("Erro ao excluir dispositivo:", err);
      res.status(500).json({ message: "Erro interno no servidor" });
    }
  }
);

router.put(
  "/api/dispositivos/:id/toggle-status",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { id } = req.params;
    try {
      await promisePool.query(
        "UPDATE dispositivos_logbox SET ativo = NOT ativo WHERE id = ?",
        [id]
      );
      res.json({ message: "Status do dispositivo alterado com sucesso!" });
    } catch (err) {
      console.error("Erro ao alterar status do dispositivo:", err);
      res.status(500).json({ message: "Erro interno no servidor" });
    }
  }
);

router.post(
  "/api/relatorios/gerar",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    try {
      const data = await getReportData(req.body);
      res.json(data);
    } catch (err) {
      console.error("Erro ao gerar relatório visual:", err);
      res.status(500).json({ message: "Erro interno no servidor" });
    }
  }
);

router.post(
  "/api/relatorios/pdf",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    try {
      const data = await getReportData(req.body);
      const width = 800;
      const height = 400;
      const chartJSNodeCanvas = new ChartJSNodeCanvas({
        width,
        height,
        backgroundColour: "#ffffff",
      });
      const configuration = {
        type: "line",
        data: data.chartData,
        options: { responsive: false },
      };
      const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const { width: pageWidth, height: pageHeight } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      let y = pageHeight - 50;
      page.drawText(`Relatório de Monitoramento - ${data.device.local_tag}`, {
        x: 50,
        y,
        font: fontBold,
        size: 18,
        color: rgb(0, 0, 0),
      });
      y -= 20;
      const start = new Date(data.filters.startDate).toLocaleString("pt-BR");
      const end = new Date(data.filters.endDate).toLocaleString("pt-BR");
      page.drawText(`Período: ${start} até ${end}`, {
        x: 50,
        y,
        font,
        size: 12,
        color: rgb(0.3, 0.3, 0.3),
      });
      y -= 40;
      page.drawText("Estatísticas de Temperatura", {
        x: 50,
        y,
        font: fontBold,
        size: 14,
      });
      y -= 20;
      page.drawText(
        `Mínima: ${parseFloat(data.stats.temp_min || 0).toFixed(2)} °C`,
        { x: 60, y, font, size: 12 }
      );
      page.drawText(
        `Média: ${parseFloat(data.stats.temp_avg || 0).toFixed(2)} °C`,
        { x: 250, y, font, size: 12 }
      );
      page.drawText(
        `Máxima: ${parseFloat(data.stats.temp_max || 0).toFixed(2)} °C`,
        { x: 450, y, font, size: 12 }
      );
      y -= 40;
      const chartImage = await pdfDoc.embedPng(imageBuffer);
      const chartDims = chartImage.scale(0.6);
      page.drawImage(chartImage, {
        x: (pageWidth - chartDims.width) / 2,
        y: y - chartDims.height,
        width: chartDims.width,
        height: chartDims.height,
      });
      y -= chartDims.height + 20;
      page.drawText("Histórico de Acionamentos da Ventilação", {
        x: 50,
        y,
        font: fontBold,
        size: 14,
      });
      y -= 20;
      page.drawText("Início", { x: 60, y, font: fontBold, size: 10 });
      page.drawText("Fim", { x: 220, y, font: fontBold, size: 10 });
      page.drawText("Duração", { x: 380, y, font: fontBold, size: 10 });
      y -= 15;
      data.fanHistory.forEach((item) => {
        if (y < 50) {
          page = pdfDoc.addPage();
          y = pageHeight - 50;
        }
        const inicio = new Date(item.timestamp_inicio).toLocaleString("pt-BR");
        const fim = item.timestamp_fim
          ? new Date(item.timestamp_fim).toLocaleString("pt-BR")
          : "Ativa";
        const duracao = formatarDuracao(item.duracao_segundos);
        page.drawText(inicio, { x: 60, y, font, size: 10 });
        page.drawText(fim, { x: 220, y, font, size: 10 });
        page.drawText(duracao, { x: 380, y, font, size: 10 });
        y -= 15;
      });
      const pdfBytes = await pdfDoc.save();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=relatorio.pdf"
      );
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      console.error("Erro ao gerar PDF com pdf-lib:", err);
      res.status(500).json({ message: "Erro ao gerar PDF" });
    }
  }
);

module.exports = router;
