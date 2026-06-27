export interface ReleRow {
  id: number;
  nome_rele: string;
  local_tag: string | null;
  ip_address: string;
  port: number;
  ativo: number;
  ultima_leitura: Date | string | null;
  status_json: string | Record<string, unknown> | null;
  listen_port: number | null;
  custom_id: string | null;
}

export interface SaveReleInput {
  nome_rele?: string;
  local_tag?: string | null;
  ip_address?: string;
  port?: number;
  ativo?: number;
  listen_port?: number | null;
  custom_id?: string | null;
}

export interface LeituraReleRow {
  id: number;
  rele_id: number;
  timestamp_leitura: Date | string;
  tensao_vab: number | null;
  tensao_vbc: number | null;
  tensao_vca: number | null;
  tensao_va: number | null;
  tensao_vb: number | null;
  tensao_vc: number | null;
  corrente_a: number | null;
  corrente_b: number | null;
  corrente_c: number | null;
  frequencia: number | null;
  temperatura_dispositivo: number | null;
  temperatura_ambiente: number | null;
  temperatura_enrolamento: number | null;
  payload_completo: string | null;
}
