import type { SessionUser } from "./types";

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
    csrfToken?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export {};
