const logger = {
  debug: (msg) => process.env.NODE_ENV === "development" && console.log(`[DEBUG] ${msg}`),
  info:  (msg) => console.log(`[INFO] ${msg}`),
  warn:  (msg) => console.warn(`[WARN] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`),
};

module.exports = logger;
