const TEMP_LIMITS = {
  MIN_VALID: -50,
  MAX_VALID: 150,
};

const FAN_CONFIG = {
  TEMP_ON: 60.0,
  TEMP_OFF: 58.5,
};

const CONNECTION_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_FAN_RUNTIME_MS = 4 * 60 * 60 * 1000;
const CONNECTION_CHECK_INTERVAL_MS = 60 * 1000;

const MQTT_TOPICS = {
  LOGOBOX_CHANNELS: "novus/+/status/channels",
  LOGOBOX_NEIGHBOR: "novus/neighbor",
  RELE_STATUS: "sel/reles/+/status",
};

const MQTT_BROKER_DEFAULT = "mqtt://localhost:1883";

module.exports = {
  TEMP_LIMITS,
  FAN_CONFIG,
  CONNECTION_TIMEOUT_MS,
  MAX_FAN_RUNTIME_MS,
  CONNECTION_CHECK_INTERVAL_MS,
  MQTT_TOPICS,
  MQTT_BROKER_DEFAULT,
};
