import rateLimit from "express-rate-limit";
import { LOGIN_RATE_LIMIT_MAX, LOGIN_RATE_LIMIT_WINDOW_MS } from "./constants";

export const loginLimiter = rateLimit({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  max: LOGIN_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Muitas tentativas de login. Tente novamente em 15 minutos.",
  },
});

export * from "./audit";
export * from "./constants";
export * from "./login";
export * from "./middleware";
export * from "./passwords";
export * from "./request";
export * from "./types";
