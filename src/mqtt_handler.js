const mqtt = require("mqtt");
const { promisePool } = require("./init");

let estadoVentilacao = {};

async function verificarDispositivosOffline(wss) {
  try {
    const cincoMinutosAtras = new Date(Date.now() - 5 * 60 * 1000);

    const [offlineDevices] = await promisePool.query(
      "SELECT serial_number, status_json FROM dispositivos_logbox WHERE ativo = 1 AND ultima_leitura < ?",
      [cincoMinutosAtras]
    );

    for (const device of offlineDevices) {
      let status = {};
      try {
        status = typeof device.status_json === 'string' ? JSON.parse(device.status_json) : (device.status_json || {});
      } catch (e) {
        console.error(`[Offline Checker] Erro ao parsear status_json para SN ${device.serial_number}:`, device.status_json);
        status = {};
      }

      if (status.connection_status !== "offline") {
        status.connection_status = "offline";
        
        await promisePool.query(
          "UPDATE dispositivos_logbox SET status_json = ? WHERE serial_number = ?",
          [JSON.stringify(status), device.serial_number]
        );

        const payloadWebSocket = {
          type: "atualizacao_status",
          dados: {
            serial_number: device.serial_number,
            status: status,
          },
        };

        wss.clients.forEach((client) => {
          if (client.readyState === client.OPEN) {
            client.send(JSON.stringify(payloadWebSocket));
          }
        });
        console.log(`[Offline Checker] Dispositivo ${device.serial_number} marcado como OFFLINE.`);
      }
    }
  } catch (err) {
    console.error("[Offline Checker] Erro ao verificar dispositivos offline:", err);
  }
}

async function verificarVentilacaoPorAlarme(serialNumber, alarmeAtivo, timestampLeitura) {
  const estadoAtual = estadoVentilacao[serialNumber] || {
    ligada: false,
    ultimoId: null,
  };

  if (alarmeAtivo && !estadoAtual.ligada) {
    const [result] = await promisePool.query(
      `INSERT INTO historico_ventilacao (serial_number, timestamp_inicio) VALUES (?, ?)`,
      [serialNumber, timestampLeitura]
    );
    estadoVentilacao[serialNumber] = {
      ligada: true,
      ultimoId: result.insertId,
    };
    console.log(
      `[Ventilação Handler] LIGADA por ALARME para SN: ${serialNumber} no ID: ${result.insertId}`
    );
  } else if (!alarmeAtivo && estadoAtual.ligada) {
    if (estadoAtual.ultimoId) {
      await promisePool.query(
        `UPDATE historico_ventilacao SET timestamp_fim = ?, duracao_segundos = TIMESTAMPDIFF(SECOND, timestamp_inicio, ?) WHERE id = ?`,
        [timestampLeitura, timestampLeitura, estadoAtual.ultimoId]
      );
      console.log(
        `[Ventilação Handler] DESLIGADA por ALARME para SN: ${serialNumber} no ID: ${estadoAtual.ultimoId}`
      );
    }
    estadoVentilacao[serialNumber] = { ligada: false, ultimoId: null };
  }
}

async function salvarLeituraLogBox(serialNumber, data, wss) {
  try {
    let temperatura;
    let alarmeAtivo;
    const bateria = data.battery;
    const tDateTime = data.timestamp;

    if (data.value_channels !== undefined) {
      console.log(`[MQTT Handler] Payload formato 'value_channels' detectado para SN: ${serialNumber}`);
      temperatura = data.value_channels[2];
      alarmeAtivo = data.alarms && data.alarms[1] === 1;
    } else if (data.ch_analog_1 !== undefined) {
      console.log(`[MQTT Handler] Payload formato 'ch_analog_1' detectado para SN: ${serialNumber}`);
      temperatura = data.ch_analog_1;
      alarmeAtivo = data.alarm_01 === 1;
    } else {
      console.error(`[MQTT Handler] Formato de payload desconhecido para SN: ${serialNumber}`, data);
      return;
    }

    if (temperatura === undefined) {
      console.error(
        "[MQTT Handler] Valor de temperatura não pôde ser extraído do payload:",
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

    await verificarVentilacaoPorAlarme(serialNumber, alarmeAtivo, timestampLeitura);

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

    let statusAtual = {};
    try {
        statusAtual = rows[0].status_json ? JSON.parse(rows[0].status_json) : {};
    } catch (e) {
        console.error(`[Device Info Handler] Erro ao parsear status_json para SN ${serialNumber}:`, rows[0].status_json);
        statusAtual = {};
    }
    
    const novoStatus = Object.assign(statusAtual, data);
    
    novoStatus.connection_status = "online";

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

    let statusAtual = {};
    try {
        statusAtual = rows[0].status_json ? JSON.parse(rows[0].status_json) : {};
    } catch (e) {
        console.error(`[Connection Status Handler] Erro ao parsear status_json para SN ${serialNumber}:`, rows[0].status_json);
        statusAtual = {};
    }

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

async function salvarLeituraRele(data, wss) {
  try {
    const { rele_id, timestamp_leitura, tensao_a, tensao_b, tensao_c, corrente_a, corrente_b, corrente_c, frequencia, payload_completo, local_tag } = data;

    const sqlInsert = `INSERT INTO leituras_reles (rele_id, timestamp_leitura, tensao_a, tensao_b, tensao_c, corrente_a, corrente_b, corrente_c, frequencia, payload_completo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await promisePool.query(sqlInsert, [rele_id, timestamp_leitura, tensao_a, tensao_b, tensao_c, corrente_a, corrente_b, corrente_c, frequencia, payload_completo]);

    const sqlUpdate = "UPDATE dispositivos_reles SET ultima_leitura = ?, status_json = ? WHERE id = ?";
    await promisePool.query(sqlUpdate, [timestamp_leitura, JSON.stringify({ connection_status: "online", ...data }), rele_id]);

    console.log(`[MQTT Handler] Leitura do relé '${local_tag}' (ID: ${rele_id}) salva no banco.`);

    if (wss) {
      const payloadWebSocket = {
        type: "nova_leitura_rele",
        dados: data
      };
      wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify(payloadWebSocket));
        }
      });
    }
  } catch (err) {
    console.error("[MQTT Handler] Erro ao salvar leitura do relé:", err);
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
    const topicos = ["novus/+/status/channels", "novus/neighbor", "sel/reles/+/status"];
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
      } else if (topic.startsWith("sel/reles/")) {
        console.log(`[MQTT Router] Mensagem de RELÉ recebida do tópico: ${topic}`);
        salvarLeituraRele(dados, wss);
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

  setInterval(() => {
    const wss = app.get("wss");
    if (wss) {
      verificarDispositivosOffline(wss);
    }
  }, 30000);
}

module.exports = {
  iniciarClienteMQTT,
};
