export const TEMP_LIMITS = {
  MIN_VALID: -50,
  MAX_VALID: 150,
} as const;

export const FAN_CONFIG = {
  TEMP_ON: 60.0,
  TEMP_OFF: 58.5,
} as const;

export const CONNECTION_TIMEOUT_MS = 5 * 60 * 1000;
export const MAX_FAN_RUNTIME_MS = 4 * 60 * 60 * 1000;
export const CONNECTION_CHECK_INTERVAL_MS = 60 * 1000;

export const MQTT_TOPICS = {
  LOGOBOX_CHANNELS: "novus/+/status/channels",
  LOGOBOX_NEIGHBOR: "novus/neighbor",
  RELE_STATUS: "sel/reles/+/status",
} as const;

export const MQTT_BROKER_DEFAULT = "mqtt://localhost:1883";
