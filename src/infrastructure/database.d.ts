export const promisePool: {
  query: (sql: string, values?: unknown[]) => Promise<[unknown[], unknown]>;
};

export const pool: unknown;
