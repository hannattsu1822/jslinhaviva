import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const EXEMPT_PATHS = new Set(["/login"]);

export function ensureCsrfToken(req: Request): string | null {
  if (!req.session) return null;

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }

  return req.session.csrfToken;
}

function tokensMatch(sessionToken: string | undefined, requestToken: unknown): boolean {
  if (!sessionToken || !requestToken) return false;

  const a = Buffer.from(String(sessionToken));
  const b = Buffer.from(String(requestToken));

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const path = req.path || "";
  if (EXEMPT_PATHS.has(path)) {
    next();
    return;
  }

  const sessionToken = req.session?.csrfToken;
  const requestToken =
    req.headers["x-csrf-token"] ||
    req.headers["x-xsrf-token"] ||
    (req.body as { _csrf?: string } | undefined)?._csrf;

  if (!tokensMatch(sessionToken, requestToken)) {
    res.status(403).json({
      success: false,
      message: "Token CSRF inválido ou ausente.",
    });
    return;
  }

  next();
}
