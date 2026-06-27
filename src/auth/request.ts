import type { Request } from "express";

export function isApiRequest(req: Request): boolean {
  const url = req.originalUrl || req.url || "";
  return (
    url.startsWith("/api/") ||
    req.path?.startsWith("/api/") ||
    req.headers.accept?.includes("application/json") ||
    req.headers["x-requested-with"] === "XMLHttpRequest"
  );
}
