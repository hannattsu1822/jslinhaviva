import mqtt from "mqtt";
import type { WebSocketServer } from "ws";
import logger from "../../config/logger";
import { promisePool } from "../../infrastructure/database";
import { sanitizarDadosLeitura } from "../rules/validation";
import { processarNovaLeitura } from "../ingest/logbox.ingest";
import { broadcastToClients } from "./websocket.broadcast";
import { MQTT_BROKER_DEFAULT, MQTT_TOPICS } from "../constants";
import type { LogboxPayload, ReleMqttPayload } from "../types";

async function salvarLeituraRele(
  dados: ReleMqttPayload,
  wss: WebSocketServer | undefined
): Promise<void> {
  if (!dados?.rele_id || !dados?.dados) {
    logger.error("[MQTT] Dados incompletos para relé.");
    return;
  }

  const { rele_id, device_id, timestamp, dados: dadosMedidos } = dados;

  try {
    await promisePool.query(
      "UPDATE dispositivos_reles SET status_json = ? WHERE id = ?",
      [JSON.stringify(dadosMedidos), rele_id]
    );

    broadcastToClients(wss, {
      type: "nova_leitura_rele",
      dados: { rele_id, device_id, timestamp, ...dadosMedidos },
    });
  } catch (error) {
    const err = error as Error;
    logger.error(`[MQTT] Erro ao processar leitura do relé: ${err.message}`);
  }
}

async function salvarLeituraLogBox(
  serialNumber: string,
  dados: LogboxPayload,
  wss: WebSocketServer | undefined
): Promise<void> {
  const dadosSanitizados = sanitizarDadosLeitura(dados);

  if (!dadosSanitizados.temperatura_valida) {
    logger.warn(
      `[MQTT] Leitura ignorada (SN: ${serialNumber}): valor inválido (${dadosSanitizados.temperatura_valor})`
    );
    return;
  }

  try {
    await processarNovaLeitura(serialNumber, dados);

    broadcastToClients(wss, {
      type: "nova_leitura_logbox",
      dados: {
        serial_number: serialNumber,
        temperatura_valida: true,
        ...dados,
      },
    });
  } catch (error) {
    const err = error as Error;
    logger.error(`[MQTT] Erro ao processar LogBox SN ${serialNumber}: ${err.message}`);
  }
}

async function salvarStatusConexao(
  dados: LogboxPayload,
  wss: WebSocketServer | undefined
): Promise<void> {
  try {
    await promisePool.query(
      "UPDATE dispositivos_logbox SET status_json = ? WHERE serial_number = ?",
      [JSON.stringify(dados), dados.serial_number]
    );

    broadcastToClients(wss, {
      type: "atualizacao_status",
      dados,
    });
  } catch (error) {
    const err = error as Error;
    logger.error(`[MQTT] Erro ao salvar status de conexão (SN: ${dados.serial_number}): ${err.message}`);
  }
}

export function iniciarClienteMQTT(app: { get(name: "wss"): WebSocketServer | undefined }): void {
  const brokerUrl = process.env.MQTT_BROKER_URL || MQTT_BROKER_DEFAULT;
  const client = mqtt.connect(brokerUrl, {
    clientId: "sistema_js_" + Math.random().toString(16).slice(2, 10),
  });

  const topicos = [
    MQTT_TOPICS.LOGOBOX_CHANNELS,
    MQTT_TOPICS.LOGOBOX_NEIGHBOR,
    MQTT_TOPICS.RELE_STATUS,
  ];

  client.on("connect", () => {
    logger.info("[MQTT] Conectado ao broker.");

    client.subscribe(topicos, (err) => {
      if (err) {
        logger.error(`[MQTT] Falha ao inscrever nos tópicos: ${err.message}`);
      } else {
        logger.info(`[MQTT] Inscrito nos tópicos: ${topicos.join(", ")}`);
      }
    });
  });

  client.on("message", (topic, message) => {
    try {
      const dados = JSON.parse(message.toString()) as LogboxPayload | ReleMqttPayload;
      const wss = app.get("wss") as WebSocketServer | undefined;

      if (topic.startsWith("sel/reles/")) {
        void salvarLeituraRele(dados as ReleMqttPayload, wss);
      } else if (topic.includes("status/channels")) {
        const serialNumber = topic.split("/")[1];
        void salvarLeituraLogBox(serialNumber, dados as LogboxPayload, wss);
      } else if (topic === MQTT_TOPICS.LOGOBOX_NEIGHBOR) {
        void salvarStatusConexao(dados as LogboxPayload, wss);
      }
    } catch (e) {
      const err = e as Error;
      logger.error(`[MQTT] Erro ao processar mensagem do tópico ${topic}: ${err.message}`);
    }
  });

  client.on("error", (err) => {
    logger.error(`[MQTT] Erro de conexão: ${err.message}`);
  });
}
