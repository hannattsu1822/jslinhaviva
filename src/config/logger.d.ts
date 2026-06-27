interface AppLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

declare const logger: AppLogger;
export default logger;
