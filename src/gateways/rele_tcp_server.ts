import path from "path";
import dotenv from "dotenv";
import { createReleTcpServer } from "./rele/tcp.server";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const RELE_DEVICE_PASSWORD = process.env.RELE_DEVICE_PASSWORD;
const RELE_TCP_BIND_HOST = process.env.RELE_TCP_BIND_HOST || "127.0.0.1";
const TCP_SERVER_PORT = Number(process.env.TCP_SERVER_PORT) || 4000;
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";

if (!RELE_DEVICE_PASSWORD) {
  console.error("[TCP] RELE_DEVICE_PASSWORD não definido no .env");
  process.exit(1);
}

if (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
  console.error("[TCP] DB_USER, DB_PASSWORD ou DB_NAME não definidos no .env");
  process.exit(1);
}

const server = createReleTcpServer({
  mqttBrokerUrl: MQTT_BROKER_URL,
  tcpPort: TCP_SERVER_PORT,
  bindHost: RELE_TCP_BIND_HOST,
  devicePassword: RELE_DEVICE_PASSWORD,
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
});

void server.start();

process.on("SIGINT", () => {
  console.log("[Shutdown] Encerrando...");
  void server.shutdown().then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  console.log("[Shutdown] SIGTERM recebido...");
  void server.shutdown().then(() => process.exit(0));
});
