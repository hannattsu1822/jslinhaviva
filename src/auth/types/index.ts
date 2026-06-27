export interface SessionUser {
  id: number;
  nome: string;
  matricula: string;
  cargo: string;
  nivel: number;
}

export interface SafeUser extends SessionUser {
  ultimoAcesso: Date | string | null;
}

export interface DbUserRow {
  id: number;
  nome: string;
  matricula: string;
  cargo: string;
  nivel: number;
  senha: string | null;
  ultimo_login: Date | string | null;
}

export interface FailedLoginEntry {
  count: number;
  lockedUntil: number | null;
}

export interface DbConnection {
  query: (sql: string, values?: unknown[]) => Promise<unknown>;
}
