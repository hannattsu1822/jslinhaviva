const mqtt = require("mqtt");
const { promisePool } = require("../init");

const LIMITE_TEMPERATURA_VENTILACAO = 60.0;
const HISTERESE_TEMPERATURA = 5.0;

let estadoVentilacao = {};

async function verificarEAtualizarVentilacao(
  serialNumber,
  temperaturaAtual,
  timestampLeitura
) {
  const estadoAtual = estadoVentilacao[serialNumber] || {
    ligada: false,
    ultimoId: null,
  };

  if (
    !estadoAtual.ligada &&
    temperaturaAtual >= LIMITE_TEMPERATURA_VENTILACAO
  ) {
    const [result] = await promisePool.query(
      `INSERT INTO historico_ventilacao (serial_number, timestamp_inicio) VALUES (?, ?)`,
      [serialNumber, timestampLeitura]
    );
    estadoVentilacao[serialNumber] = {
      ligada: true,
      ultimoId: result.insertId,
    };
    console.log(
      `[Ventilação Handler] LIGADA para SN: ${serialNumber} no ID: ${result.insertId}`
    );
  } else if (
    estadoAtual.ligada &&
    temperaturaAtual < LIMITE_TEMPERATURA_VENTILACAO - HISTERESE_TEMPERATURA
  ) {
    if (estadoAtual.ultimoId) {
      await promisePool.query(
        `UPDATE historico_ventilacao SET timestamp_fim = ?, duracao_segundos = TIMESTAMPDIFF(SECOND, timestamp_inicio, ?) WHERE id = ?`,
        [timestampLeitura, timestampLeitura, estadoAtual.ultimoId]
      );
      console.log(
        `[Ventilação Handler] DESLIGADA para SN: ${serialNumber} no ID: ${estadoAtual.ultimoId}`
      );
    }
    estadoVentilacao[serialNumber] = { ligada: false, ultimoId: null };
  }
}

async function salvarLeituraLogBox(serialNumber, data, wss) {
  try {
    const temperatura = data.ch_analog_1;
    const bateria = data.battery;
    const tDateTime = data.timestamp;

    if (temperatura === undefined) {
      console.error(
        "[MQTT Handler] Valor de temperatura (ch_analog_1) não encontrado no payload:",
        data
      );
      return;
    }

    const epochOffset = 25569;
    const jsTimestamp = (tDateTime - epochOffset) * 86400 * 1000;
    const timestampLeitura = new Date(jsTimestamp);

    const fonteAlimentacao = "Verificar Status";

    const sql = `
      INSERT INTO leituras_logbox 
      (serial_number, timestamp_leitura, payload_json, fonte_alimentacao) 
      VALUES (?, ?, ?, ?)
    `;

    await promisePool.query(sql, [
      serialNumber,
      timestampLeitura,
      JSON.stringify(data),
      fonteAlimentacao,
    ]);
    console.log(
      `[MQTT Handler] Payload de canais salvo para SN: ${serialNumber}`
    );

    await salvarInfoDispositivo(serialNumber, data, wss);

    await verificarEAtualizarVentilacao(
      serialNumber,
      temperatura,
      timestampLeitura
    );

    if (wss) {
      const [deviceRows] = await promisePool.query(
        "SELECT local_tag FROM dispositivos_logbox WHERE serial_number = ?",
        [serialNumber]
      );
      const localTag =
        deviceRows.length > 0 ? deviceRows[0].local_tag : serialNumber;

      const payloadWebSocket = {
        type: "nova_leitura",
        dados: {
          serial_number: serialNumber,
          local_tag: localTag,
          temperatura: temperatura,
          bateria: bateria,
          timestamp_leitura: timestampLeitura.toLocaleString("pt-BR"),
        },
      };

      wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify(payloadWebSocket));
        }
      });
    }
  } catch (err) {
    console.error(
      "[MQTT Handler] Erro ao salvar payload de canais no banco de dados:",
      err
    );
    console.error("Payload que causou o erro:", data);
  }
}

async function salvarInfoDispositivo(serialNumber, data, wss) {
  try {
    const [rows] = await promisePool.query(
      "SELECT status_json FROM dispositivos_logbox WHERE serial_number = ?",
      [serialNumber]
    );

    if (rows.length === 0) {
      console.log(
        `[Device Info Handler] Dispositivo com SN ${serialNumber} não encontrado no DB.`
      );
      return;
    }

    const statusAtual = rows[0].status_json
      ? JSON.parse(rows[0].status_json)
      : {};
    const novoStatus = Object.assign(statusAtual, data);

    await promisePool.query(
      "UPDATE dispositivos_logbox SET status_json = ?, ultima_leitura = NOW() WHERE serial_number = ?",
      [JSON.stringify(novoStatus), serialNumber]
    );

    console.log(
      `[Device Info Handler] Status atualizado para SN: ${serialNumber} com dados de canais.`
    );

    if (wss) {
      const payloadWebSocket = {
        type: "atualizacao_status",
        dados: {
          serial_number: serialNumber,
          status: novoStatus,
        },
      };
      wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify(payloadWebSocket));
        }
      });
    }
  } catch (err) {
    console.error(
      "[Device Info Handler] Erro ao salvar status do dispositivo:",
      err
    );
    console.error("Payload que causou o erro:", data);
  }
}

async function salvarStatusConexao(data, wss) {
  const serialNumber = data.serial;
  if (!serialNumber) {
    console.error(
      "[Connection Status Handler] Serial number não encontrado no payload de 'neighbor'."
    );
    return;
  }

  try {
    const [rows] = await promisePool.query(
      "SELECT status_json FROM dispositivos_logbox WHERE serial_number = ?",
      [serialNumber]
    );

    if (rows.length === 0) {
      console.log(
        `[Connection Status Handler] Dispositivo com SN ${serialNumber} não encontrado no DB.`
      );
      return;
    }

    const statusAtual = rows[0].status_json
      ? JSON.parse(rows[0].status_json)
      : {};
    const novoStatus = Object.assign(statusAtual, data);

    await promisePool.query(
      "UPDATE dispositivos_logbox SET status_json = ? WHERE serial_number = ?",
      [JSON.stringify(novoStatus), serialNumber]
    );

    console.log(
      `[Connection Status Handler] Status de conexão atualizado para SN: ${serialNumber}.`
    );

    if (wss) {
      const payloadWebSocket = {
        type: "atualizacao_status",
        dados: {
          serial_number: serialNumber,
          status: novoStatus,
        },
      };
      wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify(payloadWebSocket));
        }
      });
    }
  } catch (err) {
    console.error(
      "[Connection Status Handler] Erro ao salvar status de conexão:",
      err
    );
    console.error("Payload que causou o erro:", data);
  }
}

function iniciarClienteMQTT(app) {
  const options = {
    host: "localhost",
    port: 1883,
    clientId: "meu_sistema_js_" + Math.random().toString(16).substr(2, 8),
  };

  const client = mqtt.connect(options);

  client.on("connect", () => {
    console.log(
      "[MQTT Handler] Conectado ao broker Mosquitto local com sucesso!"
    );
    const topicos = ["novus/+/status/channels", "novus/neighbor"];
    client.subscribe(topicos, (err) => {
      if (!err) {
        console.log(
          `[MQTT Handler] Inscrito com sucesso nos tópicos: "${topicos.join(
            ", "
          )}"`
        );
      } else {
        console.error(`[MQTT Handler] Falha ao se inscrever nos tópicos:`, err);
      }
    });
  });

  client.on("message", (topic, message) => {
    try {
      const dados = JSON.parse(message.toString());
      const wss = app.get("wss");

      if (topic.includes("status/channels")) {
        const serialNumber = topic.split("/")[1];
        console.log(
          `[MQTT Router] Mensagem de CANAIS recebida para SN: ${serialNumber}`
        );
        salvarLeituraLogBox(serialNumber, dados, wss);
      } else if (topic === "novus/neighbor") {
        console.log(`[MQTT Router] Mensagem de CONEXÃO recebida.`);
        salvarStatusConexao(dados, wss);
      }
    } catch (e) {
      console.error(
        "[MQTT Handler] Erro ao processar mensagem:",
        message.toString(),
        e
      );
    }
  });

  client.on("error", (error) => {
    console.error("[MQTT Handler] Erro de conexão com o broker:", error);
  });
}

module.exports = {
  iniciarClienteMQTT,
};
