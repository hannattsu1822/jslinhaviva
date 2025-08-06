const express = require("express");
const router = express.Router();
const { promisePool } = require("../init");
const { autenticar, verificarNivel } = require("../auth");

// --- ROTAS DE PÁGINAS (VISUALIZAÇÃO E GERENCIAMENTO) ---

// ROTA PARA A PÁGINA DE DETALHES DE UM EQUIPAMENTO
router.get("/logbox-device/:serialNumber", autenticar, async (req, res) => {
  const serialNumber = req.params.serialNumber;
  try {
    const [rows] = await promisePool.query(
      "SELECT local_tag FROM dispositivos_logbox WHERE serial_number = ?",
      [serialNumber]
    );
    if (rows.length === 0) {
      return res.status(404).send("Equipamento não encontrado");
    }
    res.render("pages/logbox/device-detail", {
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

// ROTA PARA A PÁGINA DE GERENCIAMENTO DE DISPOSITIVOS (CRUD)
router.get(
  "/gerenciar-dispositivos",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    try {
      const [devices] = await promisePool.query(
        "SELECT * FROM dispositivos_logbox ORDER BY local_tag ASC"
      );
      res.render("pages/logbox/gerenciar-dispositivos", {
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

// --- APIs PARA A PÁGINA DE DETALHES ---

// API PARA A ÚLTIMA LEITURA DE UM EQUIPAMENTO
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
      if (rows.length === 0) {
        return res.status(404).json({ message: "Nenhuma leitura encontrada." });
      }
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

// API PARA O HISTÓRICO DE LEITURAS DE UM EQUIPAMENTO
router.get(
  "/api/logbox-device/:serialNumber/leituras",
  autenticar,
  async (req, res) => {
    const serialNumber = req.params.serialNumber;
    const limite = parseInt(req.query.limite) || 200;
    try {
      const [rows] = await promisePool.query(
        `
        SELECT 
          l.timestamp_leitura,
          JSON_UNQUOTE(JSON_EXTRACT(l.payload_json, '$.value_channels[2]')) AS temperatura,
          JSON_UNQUOTE(JSON_EXTRACT(l.payload_json, '$.value_channels[3]')) AS umidade,
          JSON_UNQUOTE(JSON_EXTRACT(l.payload_json, '$.battery')) AS bateria
        FROM (
          SELECT * FROM leituras_logbox WHERE serial_number = ? ORDER BY id DESC LIMIT ?
        ) l
        ORDER BY l.id ASC
        `,
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

// API PARA ESTATÍSTICAS DETALHADAS (DIA E MÊS) DE UM EQUIPAMENTO
router.get(
  "/api/logbox-device/:serialNumber/stats-detail",
  autenticar,
  async (req, res) => {
    const { serialNumber } = req.params;
    try {
      const [todayStatsRows] = await promisePool.query(
        `
        SELECT
          MIN(CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.value_channels[2]')) AS DECIMAL(10,2))) as temp_min,
          AVG(CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.value_channels[2]')) AS DECIMAL(10,2))) as temp_avg,
          MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.value_channels[2]')) AS DECIMAL(10,2))) as temp_max
        FROM leituras_logbox
        WHERE serial_number = ? AND DATE(timestamp_leitura) = CURDATE()
        `,
        [serialNumber]
      );
      const [monthStatsRows] = await promisePool.query(
        `
        SELECT
          MIN(CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.value_channels[2]')) AS DECIMAL(10,2))) as temp_min,
          AVG(CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.value_channels[2]')) AS DECIMAL(10,2))) as temp_avg,
          MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.value_channels[2]')) AS DECIMAL(10,2))) as temp_max
        FROM leituras_logbox
        WHERE serial_number = ? AND YEAR(timestamp_leitura) = YEAR(CURDATE()) AND MONTH(timestamp_leitura) = MONTH(CURDATE())
        `,
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

// API PARA ESTATÍSTICAS DA VENTOINHA
router.get(
  "/api/logbox-device/:serialNumber/fan-stats",
  autenticar,
  async (req, res) => {
    const { serialNumber } = req.params;
    try {
      const [todayStats] = await promisePool.query(
        `SELECT COUNT(*) as count, SUM(duracao_segundos) as total_duration FROM historico_ventoinha WHERE serial_number = ? AND DATE(timestamp_inicio) = CURDATE()`,
        [serialNumber]
      );
      const [monthStats] = await promisePool.query(
        `SELECT COUNT(*) as count, SUM(duracao_segundos) as total_duration FROM historico_ventoinha WHERE serial_number = ? AND YEAR(timestamp_inicio) = YEAR(CURDATE()) AND MONTH(timestamp_inicio) = MONTH(CURDATE())`,
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
      console.error("Erro ao buscar estatísticas da ventoinha:", err);
      res.status(500).json({ message: "Erro interno no servidor" });
    }
  }
);

// API PARA HISTÓRICO DA VENTOINHA
router.get(
  "/api/logbox-device/:serialNumber/fan-history",
  autenticar,
  async (req, res) => {
    const { serialNumber } = req.params;
    try {
      const [history] = await promisePool.query(
        `SELECT timestamp_inicio, timestamp_fim, duracao_segundos FROM historico_ventoinha WHERE serial_number = ? ORDER BY timestamp_inicio DESC LIMIT 50`,
        [serialNumber]
      );
      res.json(history);
    } catch (err) {
      console.error("Erro ao buscar histórico da ventoinha:", err);
      res.status(500).json({ message: "Erro interno no servidor" });
    }
  }
);

// --- APIs PARA O CRUD DE DISPOSITIVOS ---

// API PARA CRIAR UM NOVO DISPOSITIVO
router.post(
  "/api/dispositivos",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { serial_number, local_tag, descricao } = req.body;
    if (!serial_number || !local_tag) {
      return res
        .status(400)
        .json({ message: "Número de série e Local/Tag são obrigatórios." });
    }
    try {
      const [result] = await promisePool.query(
        "INSERT INTO dispositivos_logbox (serial_number, local_tag, descricao) VALUES (?, ?, ?)",
        [serial_number, local_tag, descricao || null]
      );
      res
        .status(201)
        .json({
          id: result.insertId,
          message: "Dispositivo criado com sucesso!",
        });
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res
          .status(409)
          .json({ message: "Este número de série já está cadastrado." });
      }
      console.error("Erro ao criar dispositivo:", err);
      res.status(500).json({ message: "Erro interno no servidor" });
    }
  }
);

// API PARA BUSCAR DADOS DE UM DISPOSITIVO (PARA EDIÇÃO)
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
      if (rows.length === 0) {
        return res.status(404).json({ message: "Dispositivo não encontrado." });
      }
      res.json(rows[0]);
    } catch (err) {
      console.error("Erro ao buscar dispositivo:", err);
      res.status(500).json({ message: "Erro interno no servidor" });
    }
  }
);

// API PARA ATUALIZAR UM DISPOSITIVO
router.put(
  "/api/dispositivos/:id",
  autenticar,
  verificarNivel(4),
  async (req, res) => {
    const { id } = req.params;
    const { serial_number, local_tag, descricao } = req.body;
    if (!serial_number || !local_tag) {
      return res
        .status(400)
        .json({ message: "Número de série e Local/Tag são obrigatórios." });
    }
    try {
      const [result] = await promisePool.query(
        "UPDATE dispositivos_logbox SET serial_number = ?, local_tag = ?, descricao = ? WHERE id = ?",
        [serial_number, local_tag, descricao || null, id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Dispositivo não encontrado." });
      }
      res.json({ message: "Dispositivo atualizado com sucesso!" });
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res
          .status(409)
          .json({ message: "Este número de série já está cadastrado." });
      }
      console.error("Erro ao atualizar dispositivo:", err);
      res.status(500).json({ message: "Erro interno no servidor" });
    }
  }
);

// API PARA EXCLUIR UM DISPOSITIVO
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
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Dispositivo não encontrado." });
      }
      res.json({ message: "Dispositivo excluído com sucesso!" });
    } catch (err) {
      console.error("Erro ao excluir dispositivo:", err);
      res.status(500).json({ message: "Erro interno no servidor" });
    }
  }
);

module.exports = router;
