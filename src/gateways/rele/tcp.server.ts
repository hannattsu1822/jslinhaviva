import net from "net";
import mysql from "mysql2/promise";
import mqtt, { type MqttClient } from "mqtt";
import { extractDeviceIdFromBinary, parseReleResponse } from "./protocol";
import type { ReleDbRow, ReleDeviceInfo, ReleSocket } from "./types";

const POLL_INTERVAL_MS = 300_000;
const KEEPALIVE_INTERVAL_MS = 120_000;
const INITIAL_CONNECTION_DELAY_MS = 3_000;
const STARTUP_DELAY_PORT_5001_MS = 10_000;
const POST_LOGIN_DELAY_MS = 4_000;
const SHUTDOWN_DELAY_MS = 1_000;
const CACHE_RELOAD_INTERVAL_MS = 60_000;
const LEGACY_DIRECT_PORT = 5001;

export interface ReleTcpServerConfig {
  mqttBrokerUrl: string;
  tcpPort: number;
  bindHost: string;
  devicePassword: string;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
}

export function createReleTcpServer(config: ReleTcpServerConfig) {
  const promisePool = mysql.createPool(config.db);
  const mqttClient: MqttClient = mqtt.connect(config.mqttBrokerUrl);

  const deviceCache = new Map<string, ReleDeviceInfo>();
  const portToDeviceMap = new Map<number, ReleDeviceInfo>();
  const legacyServers = new Map<number, net.Server>();
  const activeSockets = new Set<ReleSocket>();

  let mqttConnected = false;
  let cacheReloadTimer: NodeJS.Timeout | undefined;

  mqttClient.on("connect", () => {
    mqttConnected = true;
    console.log("[MQTT] Conectado ao broker.");
  });

  mqttClient.on("reconnect", () => {
    console.log("[MQTT] Reconectando...");
  });

  mqttClient.on("close", () => {
    mqttConnected = false;
    console.warn("[MQTT] Conexão fechada.");
  });

  mqttClient.on("error", (err) => {
    console.error("[MQTT] Erro:", err.message);
  });

  async function loadDeviceCaches(): Promise<void> {
    try {
      const [rows] = (await promisePool.query(
        "SELECT id, nome_rele, custom_id, listen_port FROM dispositivos_reles WHERE ativo = 1"
      )) as [ReleDbRow[], unknown];

      deviceCache.clear();
      portToDeviceMap.clear();

      for (const device of rows) {
        const deviceInfo: ReleDeviceInfo = {
          rele_id_db: device.id,
          deviceId: device.nome_rele,
        };

        if (device.custom_id) {
          deviceCache.set(device.custom_id.toLowerCase(), deviceInfo);
        }
        if (device.listen_port) {
          portToDeviceMap.set(Number(device.listen_port), deviceInfo);
        }
      }

      console.log(
        `[Cache] ${deviceCache.size} Smart (ID) | ${portToDeviceMap.size} Legacy (Porta).`
      );

      for (const listenPort of portToDeviceMap.keys()) {
        if (!legacyServers.has(listenPort)) {
          createLegacyServer(listenPort);
        }
      }

      for (const listenPort of portToDeviceMap.keys()) {
        if (!legacyServers.has(listenPort)) {
          createLegacyServer(listenPort);
        }
      }
    } catch (error) {
      const err = error as Error;
      console.error("[Cache] Erro ao carregar dispositivos:", err.message);
    }
  }

  function publishMqtt(topic: string, payload: string, deviceId: string): void {
    if (!mqttConnected) {
      console.warn(`[MQTT] Broker offline — leitura de ${deviceId} gravada no DB, MQTT ignorado.`);
      return;
    }

    mqttClient.publish(topic, payload, (err) => {
      if (err) {
        console.error(`[MQTT] Erro pub ${deviceId}:`, err.message);
      } else {
        console.log(`[MQTT] ${deviceId} - PUBLICADO`);
      }
    });
  }

  async function processAndPublish(socket: ReleSocket): Promise<void> {
    if (!socket.deviceId || !socket.rele_id_db) {
      return;
    }

    const parsedData = parseReleResponse(socket.metData ?? "", socket.tempData ?? "");

    if (Object.keys(parsedData).length === 0) {
      return;
    }

    const topic = `sel/reles/${socket.deviceId}/status`;
    const payload = JSON.stringify({
      rele_id: socket.rele_id_db,
      device_id: socket.deviceId,
      timestamp: new Date().toISOString(),
      dados: parsedData,
    });

    publishMqtt(topic, payload, socket.deviceId);

    try {
      const conn = await promisePool.getConnection();
      const sqlQuery = `INSERT INTO leituras_reles (rele_id, timestamp_leitura, tensao_vab, tensao_vbc, tensao_vca, tensao_va, tensao_vb, tensao_vc, corrente_a, corrente_b, corrente_c, frequencia, temperatura_dispositivo, temperatura_ambiente, temperatura_enrolamento, payload_completo) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const values = [
        socket.rele_id_db,
        parsedData.tensao_rs ?? null,
        parsedData.tensao_st ?? null,
        parsedData.tensao_tr ?? null,
        parsedData.tensao_rn ?? null,
        parsedData.tensao_sn ?? null,
        parsedData.tensao_tn ?? null,
        parsedData.corrente_r ?? null,
        parsedData.corrente_s ?? null,
        parsedData.corrente_t ?? null,
        parsedData.frequencia ?? null,
        parsedData.temperatura_dispositivo ?? null,
        parsedData.temperatura_ambiente ?? null,
        parsedData.temperatura_enrolamento ?? null,
        payload,
      ];

      await conn.query(sqlQuery, values);
      await conn.query("UPDATE dispositivos_reles SET ultima_leitura = NOW() WHERE id = ?", [
        socket.rele_id_db,
      ]);
      conn.release();
    } catch (dbError) {
      const err = dbError as Error;
      console.error(`[DB] Erro ${socket.deviceId}:`, err.message);
    }
  }

  async function handleSocketData(socket: ReleSocket): Promise<void> {
    if (socket.processing) {
      return;
    }

    socket.processing = true;

    try {
      while (true) {
        if (socket.state === "AWAITING_IDENTITY") {
          if (socket.binaryBuffer.length === 0) {
            break;
          }

          const deviceIdHex = extractDeviceIdFromBinary(socket.binaryBuffer);
          socket.binaryBuffer = Buffer.alloc(0);
          const deviceInfo = deviceCache.get(deviceIdHex.toLowerCase());

          if (deviceInfo) {
            socket.rele_id_db = deviceInfo.rele_id_db;
            socket.deviceId = deviceInfo.deviceId;

            setTimeout(() => {
              socket.state = "AWAITING_PASSWORD_PROMPT";
              socket.write("\r\n");
              setTimeout(() => socket.write("ACC\r\n"), 500);
            }, INITIAL_CONNECTION_DELAY_MS);
          } else {
            console.warn(`[TCP] Dispositivo não cadastrado (ID hex: ${deviceIdHex}).`);
            socket.end();
            return;
          }
          break;
        }

        if (socket.state === "AWAITING_PASSWORD_PROMPT") {
          const passIndex = socket.textBuffer.indexOf("Password:");
          const promptIndexCheck = socket.textBuffer.indexOf("=>");

          if (passIndex !== -1) {
            socket.textBuffer = socket.textBuffer.substring(passIndex + 9);
            socket.state = "LOGGING_IN_OTTER";
            socket.write(`${config.devicePassword}\r\n`);
          } else if (promptIndexCheck !== -1) {
            socket.state = "LOGGING_IN_OTTER";
          } else {
            break;
          }
        }

        const promptIndex = socket.textBuffer.indexOf("=>");
        if (promptIndex === -1) {
          break;
        }

        const completeMessage = socket.textBuffer.substring(0, promptIndex + 2);
        socket.textBuffer = socket.textBuffer.substring(promptIndex + 2);

        let loginSuccessful = false;

        switch (socket.state) {
          case "LOGGING_IN_OTTER":
            loginSuccessful = true;
            break;
          case "AWAITING_MET":
            if (
              !completeMessage.includes("unknown") &&
              !completeMessage.includes("Enter at least")
            ) {
              socket.metData = completeMessage;
              socket.state = "AWAITING_THE";
              socket.write("THE\r\n");
            } else {
              socket.state = "IDLE";
            }
            break;
          case "AWAITING_THE":
            socket.tempData = completeMessage;
            await processAndPublish(socket);
            socket.state = "IDLE";
            break;
        }

        if (loginSuccessful) {
          socket.state = "IDLE";
          socket.write("\r\n");
          setTimeout(() => {
            socket.startPollingCycle();
            if (socket.pollTimer) {
              clearInterval(socket.pollTimer);
            }
            socket.pollTimer = setInterval(socket.startPollingCycle, POLL_INTERVAL_MS);
            socket.startKeepalive();
          }, POST_LOGIN_DELAY_MS);
        }
      }
    } catch (err) {
      const error = err as Error;
      console.error(`[Handler] Erro ${socket.deviceId ?? "desconhecido"}:`, error.message);
      socket.end();
    } finally {
      socket.processing = false;
    }
  }

  function setupSocketLogic(socket: ReleSocket): void {
    activeSockets.add(socket);
    socket.binaryBuffer = Buffer.alloc(0);
    socket.textBuffer = "";
    socket.processing = false;

    socket.startPollingCycle = () => {
      if (socket.state === "IDLE") {
        socket.state = "AWAITING_MET";
        socket.write("MET\r\n");

        if (socket.keepaliveTimer) {
          clearInterval(socket.keepaliveTimer);
          socket.keepaliveTimer = undefined;
        }
      }
    };

    socket.startKeepalive = () => {
      if (socket.keepaliveTimer) {
        clearInterval(socket.keepaliveTimer);
      }
      socket.keepaliveTimer = setInterval(() => {
        if (socket.state === "IDLE") {
          socket.write(Buffer.from([0x00]));
        }
      }, KEEPALIVE_INTERVAL_MS);
    };

    socket.on("data", (data) => {
      if (socket.state === "AWAITING_IDENTITY") {
        socket.binaryBuffer = Buffer.concat([socket.binaryBuffer, data]);
      } else {
        socket.textBuffer += data.toString("latin1");
      }
      void handleSocketData(socket);
    });

    socket.on("close", () => {
      activeSockets.delete(socket);
      if (socket.pollTimer) {
        clearInterval(socket.pollTimer);
      }
      if (socket.keepaliveTimer) {
        clearInterval(socket.keepaliveTimer);
      }
    });

    socket.on("error", (err) => {
      console.error(`[Socket] Erro ${socket.deviceId ?? ""}:`, err.message);
    });
  }

  const mainServer = net.createServer((rawSocket) => {
    const socket = rawSocket as ReleSocket;
    socket.state = "AWAITING_IDENTITY";
    setupSocketLogic(socket);
  });

  function createLegacyServer(listenPort: number): void {
    if (legacyServers.has(listenPort)) {
      return;
    }

    const deviceInfo = portToDeviceMap.get(listenPort);
    if (!deviceInfo) {
      console.warn(`[TCP] Porta ${listenPort} sem dispositivo no cache — ignorada.`);
      return;
    }

    const legacyServer = net.createServer((rawSocket) => {
      const socket = rawSocket as ReleSocket;
      socket.rele_id_db = deviceInfo.rele_id_db;
      socket.deviceId = deviceInfo.deviceId;

      setupSocketLogic(socket);

      if (listenPort === LEGACY_DIRECT_PORT) {
        console.log(`[TCP] ${deviceInfo.deviceId} (Porta ${LEGACY_DIRECT_PORT}) - Modo Direto.`);
        setTimeout(() => {
          socket.state = "IDLE";
          socket.startPollingCycle();
          if (socket.pollTimer) {
            clearInterval(socket.pollTimer);
          }
          socket.pollTimer = setInterval(socket.startPollingCycle, POLL_INTERVAL_MS);
          socket.startKeepalive();
        }, STARTUP_DELAY_PORT_5001_MS);
      } else {
        setTimeout(() => {
          socket.state = "AWAITING_PASSWORD_PROMPT";
          socket.write("\r\n");
          setTimeout(() => socket.write("ACC\r\n"), 500);
        }, INITIAL_CONNECTION_DELAY_MS);
      }
    });

    legacyServer.listen(listenPort, config.bindHost, () => {
      console.log(`[TCP] Porta ${listenPort} aberta para ${deviceInfo.deviceId}`);
    });

    legacyServers.set(listenPort, legacyServer);
  }

  async function start(): Promise<void> {
    await loadDeviceCaches();

    cacheReloadTimer = setInterval(() => {
      void loadDeviceCaches();
    }, CACHE_RELOAD_INTERVAL_MS);

    mainServer.listen(config.tcpPort, config.bindHost, () => {
      console.log(`[TCP] Main Server na porta ${config.tcpPort} (${config.bindHost})`);
    });
  }

  async function shutdown(): Promise<void> {
    if (cacheReloadTimer) {
      clearInterval(cacheReloadTimer);
    }

    for (const socket of activeSockets) {
      if (socket.writable) {
        socket.write("QUIT\r\n");
      }
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, SHUTDOWN_DELAY_MS);
    });

    for (const socket of activeSockets) {
      socket.destroy();
    }

    mainServer.close();
    legacyServers.forEach((server) => server.close());
    mqttClient.end();
    await promisePool.end();
  }

  return { start, shutdown, reloadCaches: loadDeviceCaches };
}
