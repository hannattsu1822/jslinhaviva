import type net from "net";

export type ReleSocketState =
  | "AWAITING_IDENTITY"
  | "AWAITING_PASSWORD_PROMPT"
  | "LOGGING_IN_OTTER"
  | "AWAITING_MET"
  | "AWAITING_THE"
  | "IDLE";

export interface ReleDeviceInfo {
  rele_id_db: number;
  deviceId: string;
}

export interface ParsedReleData {
  corrente_r?: number | null;
  corrente_s?: number | null;
  corrente_t?: number | null;
  tensao_rn?: number | null;
  tensao_sn?: number | null;
  tensao_tn?: number | null;
  tensao_rs?: number | null;
  tensao_st?: number | null;
  tensao_tr?: number | null;
  frequencia?: number | null;
  temperatura_dispositivo?: number | null;
  temperatura_ambiente?: number | null;
  temperatura_enrolamento?: number | null;
}

export interface ReleSocket extends net.Socket {
  state: ReleSocketState;
  binaryBuffer: Buffer;
  textBuffer: string;
  processing: boolean;
  rele_id_db?: number;
  deviceId?: string;
  metData?: string;
  tempData?: string;
  pollTimer?: NodeJS.Timeout;
  keepaliveTimer?: NodeJS.Timeout;
  startPollingCycle: () => void;
  startKeepalive: () => void;
}

export interface ReleDbRow {
  id: number;
  nome_rele: string;
  custom_id: string | null;
  listen_port: number | null;
}
