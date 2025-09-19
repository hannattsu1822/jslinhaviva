const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const net = require("net");
const mqtt = require("mqtt");
const mysql = require("mysql2/promise"); // Corretamente importado

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const POLLING_INTERVAL_MS = 10000;

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const mqttClient = mqtt.connect(MQTT_BROKER_URL);

// AQUI ESTÁ A CORREÇÃO: .promise() foi removido
const promisePool = mysql.createPool(dbConfig);

mqttClient.on("connect", () => {
  console.log("[Gateway Rele] Conectado ao broker MQTT com sucesso.");
});

mqttClient.on("error", (err) => {
  console.error("[Gateway Rele] Não foi possível conectar ao broker MQTT:", err);
});

function parseSelResponse(rawData) {
  try {
    const lines = rawData
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("=>"));
    const data = {};
    const mapping = {
      "Va": "tensao_A", "Vb": "tensao_B", "Vc": "tensao_C",
      "Vab": "tensao_AB", "Vbc": "tensao_BC", "Vca": "tensao_CA",
      "Ia": "corrente_A", "Ib": "corrente_B", "Ic": "corrente_C",
      "P": "potencia_ativa_total", "Q": "potencia_reativa_total", "S": "potencia_aparente_total",
      "PF": "fator_potencia_total", "FREQ": "frequencia",
      "PA": "potencia_ativa_A", "PB": "potencia_ativa_B", "PC": "potencia_ativa_C",
      "QA": "potencia_reativa_A", "QB": "potencia_reativa_B", "QC": "potencia_reativa_C",
      "PFA": "fator_potencia_A", "PFB": "fator_potencia_B", "PFC": "fator_potencia_C",
    };

    lines.forEach((line) => {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const key = parts[0];
        const value = parseFloat(parts[1].replace(",", "."));
        if (mapping[key] && !isNaN(value)) {
          data[mapping[key]] = value;
        }
      }
    });
    return Object.keys(data).length > 0 ? data : null;
  } catch (err) {
    console.error("[Gateway Rele] Erro ao analisar a resposta do relé:", err);
    return null;
  }
}

function pollRele(rele, onDoneCallback) {
  console.log(
    `[Gateway Rele] Consultando relé: ${rele.nome_rele} (${rele.ip_address}:${rele.port})`
  );
  const client = new net.Socket();
  client.setTimeout(5000);

  const done = () => {
    if (onDoneCallback) {
      onDoneCallback();
    }
  };

  client.connect(rele.port, rele.ip_address, () => {
    client.write("ME\r\n");
  });

  let responseData = "";
  client.on("data", (data) => {
    responseData += data.toString();
    if (responseData.includes("=>")) {
      client.end();
    }
  });

  client.on("close", async () => {
    if (responseData) {
      const parsedData = parseSelResponse(responseData);
      if (parsedData) {
        const topic = `reles/${rele.nome_rele}/medicoes`;
        const payload = JSON.stringify({
          timestamp: new Date().toISOString(),
          ...parsedData,
        });
        mqttClient.publish(topic, payload, (err) => {
          if (err) {
            console.error(
              `[Gateway Rele] Falha ao publicar dados para '${rele.nome_rele}' no MQTT:`,
              err
            );
          } else {
            console.log(
              `[Gateway Rele] Dados de '${rele.nome_rele}' publicados no tópico: ${topic}`
            );
          }
        });

        try {
          const updateQuery =
            "UPDATE dispositivos_reles SET ultima_leitura = ?, status_conexao = 'online', dados_json = ? WHERE id = ?";
          await promisePool.query(updateQuery, [
            new Date(),
            JSON.stringify(parsedData),
            rele.id,
          ]);
        } catch (dbErr) {
          console.error(
            `[Gateway Rele] Erro ao atualizar status do relé '${rele.nome_rele}' no banco de dados:`,
            dbErr
          );
        }
      } else {
        console.log(
          `[Gateway Rele] Resposta recebida de '${rele.nome_rele}', mas não foi possível analisar.`
        );
      }
    }
    done();
  });

  client.on("error", async (err) => {
    console.error(
      `[Gateway Rele] Erro de conexão com '${rele.nome_rele}' (${rele.ip_address}:${rele.port}): ${err.message}`
    );
    try {
      const updateQuery =
        "UPDATE dispositivos_reles SET status_conexao = 'offline' WHERE id = ?";
      await promisePool.query(updateQuery, [rele.id]);
    } catch (dbErr) {
      console.error(
        `[Gateway Rele] Erro ao definir relé '${rele.nome_rele}' como offline no banco:`,
        dbErr
      );
    }
    done();
  });

  client.on("timeout", async () => {
    console.error(
      `[Gateway Rele] Timeout na conexão com '${rele.nome_rele}'.`
    );
    try {
      const updateQuery =
        "UPDATE dispositivos_reles SET status_conexao = 'offline' WHERE id = ?";
      await promisePool.query(updateQuery, [rele.id]);
    } catch (dbErr) {
      console.error(
        `[Gateway Rele] Erro ao definir relé '${rele.nome_rele}' como offline (timeout) no banco:`,
        dbErr
      );
    }
    client.destroy();
    done();
  });
}

async function pollAllReles() {
    try {
        const [reles] = await promisePool.query(
            "SELECT * FROM dispositivos_reles WHERE ativo = 1"
        );

        if (reles.length === 0) {
            console.log(
                "[Gateway Rele] Nenhum relé ativo encontrado. Verificando novamente em 10s."
            );
            return;
        }

        console.log(`[Gateway Rele] Iniciando ciclo de consulta para ${reles.length} relé(s)...`);
        for (const rele of reles) {
            await new Promise(resolve => {
                pollRele(rele, resolve);
            });
            await new Promise(resolve => setTimeout(resolve, 500));
        }

    } catch (err) {
        console.error(
            "[Gateway Rele] Erro grave ao buscar ou processar relés no banco de dados:",
            err
        );
    }
}

async function startService() {
  console.log("[Gateway Rele] Iniciando serviço de monitoramento de relés...");
  pollAllReles();
  setInterval(pollAllReles, POLLING_INTERVAL_MS);
}

startService();
