import type { ConnectionStatus } from "../../../telemetry/types";

export interface LogboxDeviceRow {
  id: number;
  local_tag: string;
  serial_number: string;
  descricao: string | null;
  ativo: number;
  ultima_leitura: Date | string | null;
  status_json: string | Record<string, unknown> | null;
}

export interface LogboxDeviceListItem {
  id: number;
  local_tag: string;
  serial_number: string;
  ativo: number;
}

export interface LogboxDeviceManagementView extends LogboxDeviceRow {
  temperatura_externa: number | null;
  temperatura_invalida: boolean;
  connection_status: ConnectionStatus;
  minutes_since_last_reading: number | null | undefined;
  connection_warning: string | null;
}

export interface SaveDeviceInput {
  id?: number;
  local_tag?: string;
  serial_number?: string;
  descricao?: string | null;
}

export interface ReportFilters {
  deviceId: number;
  reportType: string;
  date?: string;
  month?: string;
  year?: string;
}

export interface FanHistoryAggregate {
  dia: string;
  count: number;
  total_duration: number;
}
