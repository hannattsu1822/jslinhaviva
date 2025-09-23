const express = require("express");
const router = express.Router();
const { promisePool } = require("../init");
const { autenticar, verificarNivel } = require("../auth");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");

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
  const { deviceId, reportType, date, month, year } = filters;
  let deviceInfo = null;
  let startDate, endDate;

  switch (reportType) {
    case "monthly":
      startDate = new Date(`${month}-01T00:00:00`);
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "annual":
      startDate = new Date(`${year}-01-01T00:00:00`);
      endDate = new Date(`${year}-12-31T23:59:59`);
      break;
    default:
      startDate = new Date(`${date}T00:00:00`);
      endDate = new Date(`${date}T23:59:59`);
      break;
  }

  const [deviceRows] = await promisePool.query(
    "SELECT * FROM dispositivos_logbox WHERE id = ?",
    [deviceId]
  );
  if (deviceRows.length > 0) {
    deviceInfo = deviceRows[0];
  }

  const [readings] = await promisePool.query(
    "SELECT * FROM leituras_logbox WHERE dispositivo_id = ? AND timestamp_leitura BETWEEN ? AND ? ORDER BY timestamp_leitura ASC",
    [deviceId, startDate, endDate]
  );
  const [stats] = await promisePool.query(
    "SELECT MIN(temperatura_externa) as temp_min, AVG(temperatura_externa) as temp_avg, MAX(temperatura_externa) as temp_max FROM leituras_logbox WHERE dispositivo_id = ? AND timestamp_leitura BETWEEN ? AND ?",
    [deviceId, startDate, endDate]
  );
  const [fanHistory] = await promisePool.query(
    "SELECT * FROM historico_ventilacao WHERE dispositivo_id = ? AND timestamp_inicio >= ? AND timestamp_inicio <= ? ORDER BY timestamp_inicio DESC",
    [deviceId, startDate, endDate]
  );
  const [connectionHistory] = await promisePool.query(
    "SELECT * FROM historico_conexao WHERE serial_number = ? AND timestamp_offline >= ? AND timestamp_offline <= ? ORDER BY timestamp_offline DESC",
    [deviceInfo.serial_number, startDate, endDate]
  );

  return {
    device: deviceInfo,
    filters: { ...filters, startDate, endDate },
    readings,
    stats: stats[0],
    fanHistory,
    connectionHistory,
  };
}

router.get("/gerenciar-dispositivos", autenticar, async (req, res) => {
  try {
    const [devices] = await promisePool.query(
      "SELECT id, local_tag, serial_number, descricao, ativo, ultima_leitura, status_json FROM dispositivos_logbox ORDER BY local_tag"
    );

    const devicesComStatus = devices.map(device => {
      let status = {};
      try {
        if (device.status_json && typeof device.status_json === 'string') {
          status = JSON.parse(device.status_json);
        } else {
          status = device.status_json || {};
        }
      } catch (e) {
        console.error(`Erro ao parsear status_json para SN ${device.serial_number}:`, device.status_json);
        status = {};
      }
      
      const temperaturaExterna = status.ch_analog_1 !== undefined ? status.ch_analog_1 : (status.value_channels ? status.value_channels[2] : null);
      
      return {
        ...device,
        temperatura_externa: temperaturaExterna,
        connection_status: status.connection_status || 'offline',
      };
    });

    res.render("pages/logbox/gerenciar_dispositivos.html", {
      pageTitle: "Gerenciar Dispositivos LogBox",
      user: req.user,
      devices: devicesComStatus,
    });
  } catch (err) {
    console.error("Erro ao buscar dispositivos:", err);
    res.status(500).send("Erro interno ao buscar dispositivos.");
  }
});

router.get("/logbox-devices", autenticar, async (req, res) => {
  try {
    const [devices] = await promisePool.query(
      "SELECT id, local_tag, serial_number, ativo FROM dispositivos_logbox WHERE ativo = 1 ORDER BY local_tag"
    );
    res.render("pages/logbox/device_list.html", {
      pageTitle: "Equipamentos LogBox",
      user: req.user,
      devices,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao buscar dispositivos");
  }
});

router.get(
  "/visualizar-dispositivo/:serialNumber",
  autenticar,
  async (req, res) => {
    const { serialNumber } = req.params;
    try {
      const [deviceRows] = await promisePool.query(
        "SELECT * FROM dispositivos_logbox WHERE serial_number = ?",
        [serialNumber]
      );
      if (deviceRows.length === 0) {
        return res.status(404).send("Dispositivo não encontrado");
      }
      const device = deviceRows[0];
      res.render("pages/logbox/device_detail.html", {
        pageTitle: `Monitorando: ${device.local_tag}`,
        user: req.user,
        serialNumber: device.serial_number,
        device: device,
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Erro ao carregar a página do dispositivo");
    }
  }
);

router.get("/api/dispositivos", autenticar, async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT id, local_tag, serial_number, descricao, ativo, ultima_leitura FROM dispositivos_logbox ORDER BY local_tag"
    );
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar dispositivos:", err);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
});

router.get("/api/dispositivos/:id", autenticar, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await promisePool.query(
      "SELECT * FROM dispositivos_logbox WHERE id = ?",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Dispositivo não encontrado" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("Erro ao buscar dispositivo:", err);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
});

router.post("/api/dispositivos", autenticar, async (req, res) => {
  try {
    const { id, local_tag, serial_number, descricao } = req.body;
    if (id) {
      await promisePool.query(
        "UPDATE dispositivos_logbox SET local_tag = ?, serial_number = ?, descricao = ? WHERE id = ?",
        [local_tag, serial_number, descricao, id]
      );
      res.json({ message: "Dispositivo atualizado com sucesso!" });
    } else {
      await promisePool.query(
        "INSERT INTO dispositivos_logbox (local_tag, serial_number, descricao) VALUES (?, ?, ?)",
        [local_tag, serial_number, descricao]
      );
      res.json({ message: "Dispositivo adicionado com sucesso!" });
    }
  } catch (err) {
    console.error("Erro ao salvar dispositivo:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json({ message: "Número de série ou tag já cadastrado." });
    }
    res.status(500).json({ message: "Erro interno no servidor" });
  }
});

router.delete("/api/dispositivos/:id", autenticar, async (req, res) => {
  try {
    const { id } = req.params;
    await promisePool.query("DELETE FROM dispositivos_logbox WHERE id = ?", [
      id,
    ]);
    res.json({ message: "Dispositivo excluído com sucesso!" });
  } catch (err) {
    console.error("Erro ao excluir dispositivo:", err);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
});

router.get(
  "/api/logbox-device/:serialNumber/leituras",
  autenticar,
  async (req, res) => {
    const { serialNumber } = req.params;
    try {
      const [device] = await promisePool.query(
        "SELECT id FROM dispositivos_logbox WHERE serial_number = ?",
        [serialNumber]
      );
      if (device.length === 0) return res.status(404).send("Device not found");

      const [rows] = await promisePool.query(
        "SELECT temperatura_externa, timestamp_leitura FROM leituras_logbox WHERE dispositivo_id = ? ORDER BY timestamp_leitura DESC LIMIT 200",
        [device[0].id]
      );
      const reversedRows = rows.reverse();
      const data = {
        labels: reversedRows.map((r) =>
          new Date(r.timestamp_leitura).toLocaleString("pt-BR")
        ),
        temperaturas: reversedRows.map((r) => r.temperatura_externa),
      };
      res.json(data);
    } catch (error) {
      console.error(error);
      res.status(500).send("Server error");
    }
  }
);

router.get(
  "/api/logbox-device/:serialNumber/status",
  autenticar,
  async (req, res) => {
    const { serialNumber } = req.params;
    try {
      const [rows] = await promisePool.query(
        "SELECT status_json FROM dispositivos_logbox WHERE serial_number = ?",
        [serialNumber]
      );
      if (rows.length === 0 || !rows[0].status_json) {
        return res.status(404).json({ status: {} });
      }
      res.json({ status: rows[0].status_json });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erro ao buscar status" });
    }
  }
);

router.get(
  "/api/logbox-device/:serialNumber/latest",
  autenticar,
  async (req, res) => {
    const { serialNumber } = req.params;
    try {
      const [device] = await promisePool.query(
        "SELECT id FROM dispositivos_logbox WHERE serial_number = ?",
        [serialNumber]
      );
      if (device.length === 0) return res.status(404).send("Device not found");
      const [latest] = await promisePool.query(
        "SELECT payload, timestamp_leitura FROM leituras_logbox WHERE dispositivo_id = ? ORDER BY timestamp_leitura DESC LIMIT 1",
        [device[0].id]
      );
      if (latest.length === 0) return res.status(404).send("No readings found");
      res.json(latest[0]);
    } catch (error) {
      console.error(error);
      res.status(500).send("Server error");
    }
  }
);

router.get(
  "/api/logbox-device/:serialNumber/stats-detail",
  autenticar,
  async (req, res) => {
    const { serialNumber } = req.params;
    try {
      const [device] = await promisePool.query(
        "SELECT id FROM dispositivos_logbox WHERE serial_number = ?",
        [serialNumber]
      );
      if (device.length === 0) return res.status(404).send("Device not found");

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const month = new Date(today.getFullYear(), today.getMonth(), 1);

      const [[todayStats]] = await promisePool.query(
        "SELECT MIN(temperatura_externa) as min, AVG(temperatura_externa) as avg, MAX(temperatura_externa) as max FROM leituras_logbox WHERE dispositivo_id = ? AND timestamp_leitura >= ?",
        [device[0].id, today]
      );
      const [[monthStats]] = await promisePool.query(
        "SELECT MIN(temperatura_externa) as min, AVG(temperatura_externa) as avg, MAX(temperatura_externa) as max FROM leituras_logbox WHERE dispositivo_id = ? AND timestamp_leitura >= ?",
        [device[0].id, month]
      );

      const format = (stats) => ({
        min: stats.min?.toFixed(1) || "N/A",
        avg: stats.avg?.toFixed(1) || "N/A",
        max: stats.max?.toFixed(1) || "N/A",
      });

      res.json({ today: format(todayStats), month: format(monthStats) });
    } catch (error) {
      console.error(error);
      res.status(500).send("Server error");
    }
  }
);

router.get(
  "/api/logbox-device/:serialNumber/ventilation-history",
  autenticar,
  async (req, res) => {
    const { serialNumber } = req.params;
    try {
      const [device] = await promisePool.query(
        "SELECT id FROM dispositivos_logbox WHERE serial_number = ?",
        [serialNumber]
      );
      if (device.length === 0) return res.status(404).send("Device not found");
      const [history] = await promisePool.query(
        "SELECT * FROM historico_ventilacao WHERE dispositivo_id = ? ORDER BY timestamp_inicio DESC LIMIT 50",
        [device[0].id]
      );
      res.json(history);
    } catch (error) {
      console.error(error);
      res.status(500).send("Server error");
    }
  }
);

router.post("/api/relatorios/visual", autenticar, async (req, res) => {
  try {
    const data = await getReportData(req.body);
    res.json(data);
  } catch (err) {
    console.error("Erro ao gerar relatório visual:", err);
    res.status(500).json({ message: "Erro ao gerar dados do relatório" });
  }
});

router.post(
  "/api/relatorios/pdf",
  autenticar,
  verificarNivel(1),
  async (req, res) => {
    try {
      const data = await getReportData(req.body);

      const chartJSNodeCanvas = new ChartJSNodeCanvas({
        width: 700,
        height: 350,
      });
      const configuration = {
        type: "line",
        data: {
          labels: data.readings.map((r) =>
            new Date(r.timestamp_leitura).toLocaleDateString("pt-BR")
          ),
          datasets: [
            {
              label: "Temperatura (°C)",
              data: data.readings.map((r) => r.temperatura_externa),
              borderColor: "rgb(75, 192, 192)",
              tension: 0.1,
            },
          ],
        },
        options: {
          scales: { y: { beginAtZero: false } },
          animation: { duration: 0 },
        },
      };
      const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const image = await pdfDoc.embedPng(imageBuffer);
      const imageDims = image.scale(0.5);

      page.drawText(`Relatório de Monitoramento - ${data.device.local_tag}`, {
        x: 50,
        y: height - 50,
        font,
        size: 18,
      });
      page.drawImage(image, {
        x: 50,
        y: height - 100 - imageDims.height,
        width: imageDims.width,
        height: imageDims.height,
      });

      let y = height - 120 - imageDims.height;
      data.readings.forEach((reading) => {
        if (y < 40) {
          page.addPage();
          y = height - 40;
        }
        page.drawText(`${new Date(reading.timestamp_leitura).toLocaleString("pt-BR")}: ${reading.temperatura_externa.toFixed(1)}°C`, { x: 50, y, font, size: 10 });
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
router.get(
  "/api/logbox-device/:serialNumber/connection-history",
  autenticar,
  async (req, res) => {
    const { serialNumber } = req.params;
    try {
      const [history] = await promisePool.query(
        "SELECT * FROM historico_conexao WHERE serial_number = ? ORDER BY timestamp_offline DESC LIMIT 100",
        [serialNumber]
      );

      const [[summary]] = await promisePool.query(
        "SELECT COUNT(*) as total_disconnects, AVG(duracao_segundos) as avg_duration FROM historico_conexao WHERE serial_number = ?",
        [serialNumber]
      );

      res.json({
        summary: {
          total_disconnects: summary.total_disconnects || 0,
          avg_duration_seconds: summary.avg_duration || 0,
        },
        history,
      });
    } catch (error) {
      console.error("Erro ao carregar histórico de conexão:", error);
      res.status(500).send("Server error");
    }
  }
);

module.exports = router;
