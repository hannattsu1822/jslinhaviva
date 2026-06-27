export type ConnectionStatus = "online" | "offline";
export type FanStatus = "ON" | "OFF" | "HOLD";

export interface TemperatureValidation {
  valid: boolean;
  reason?: string;
  value?: number;
}

export interface ConnectionCheckOnline {
  online: true;
  minutes_ago: number;
}

export interface ConnectionCheckOffline {
  online: false;
  reason: string;
  minutes_offline: number | null;
}

export type ConnectionCheck = ConnectionCheckOnline | ConnectionCheckOffline;

export interface DeviceStatusValidation {
  connection_status: ConnectionStatus;
  minutes_since_last_reading: number | null | undefined;
  connection_warning: string | null;
}

export interface SanitizedReading {
  temperatura_valida: boolean;
  temperatura_valor: number | null;
  temperatura_motivo_invalido: string | null;
  dados_originais: LogboxPayload;
}

export interface FanStateAnalysis {
  novoEstado: boolean;
  mudou: boolean;
  motivo: string;
}

export interface LogboxPayload {
  ch_analog_1?: number | string;
  value_channels?: number[];
  temperature?: number;
  internal_temperature?: number;
  temp_int?: number;
  serial_number?: string;
  connection_status?: ConnectionStatus;
  lqi?: number;
  rssi?: number;
  ip?: string;
  firmware_version?: string;
  fan_status?: FanStatus;
  fan_daily_count?: number;
  last_seen_minutes?: number;
  temperature_error?: string;
  [key: string]: unknown;
}

export interface LogboxDeviceStatus extends LogboxPayload {
  connection_status: ConnectionStatus;
  last_seen_minutes?: number;
  fan_daily_count?: number;
}

export interface ReadingsChartData {
  labels: (Date | string)[];
  temperaturas: (number | null)[];
}

export interface StatsPeriod {
  min: string;
  avg: string;
  max: string;
}

export interface FanStats {
  total_count: number;
  min_duration: number;
  max_duration: number;
  avg_duration: number;
}

export interface ReleMqttPayload {
  rele_id: number;
  device_id: string;
  timestamp: string;
  dados: Record<string, unknown>;
}

export interface WebSocketPayload {
  type: string;
  dados: Record<string, unknown>;
}

export interface AppLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}
