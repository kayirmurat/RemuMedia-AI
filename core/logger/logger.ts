type Level = "info" | "warn" | "error";

function log(level: Level, message: string, meta?: Record<string, unknown>): void {
  const line = { timestamp: new Date().toISOString(), level, message, ...meta };
  const output = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  output(JSON.stringify(line));
}

export function createLogger() {
  return {
    info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
    error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;
