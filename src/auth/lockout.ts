import { MAX_FAILED_ATTEMPTS, LOCKOUT_MS } from "./constants";
import type { FailedLoginEntry } from "./types";

const failedLoginAttempts = new Map<string, FailedLoginEntry>();

export function isAccountLocked(matricula: string): boolean {
  const entry = failedLoginAttempts.get(matricula);
  if (!entry?.lockedUntil) return false;

  if (Date.now() >= entry.lockedUntil) {
    failedLoginAttempts.delete(matricula);
    return false;
  }

  return true;
}

export function recordFailedLogin(matricula: string): void {
  const entry = failedLoginAttempts.get(matricula) ?? { count: 0, lockedUntil: null };
  entry.count += 1;

  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
  }

  failedLoginAttempts.set(matricula, entry);
}

export function clearFailedLogin(matricula: string): void {
  failedLoginAttempts.delete(matricula);
}
