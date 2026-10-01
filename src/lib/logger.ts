/* Logger estructurado (JSON en producción, legible en desarrollo). Sin dependencias. */
type Level = "debug" | "info" | "warn" | "error";
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const lvl = (process.env.LOG_LEVEL as Level) || "info";
  return order[lvl] ?? 20;
}

function serializeError(err: unknown) {
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  return err;
}

function write(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (order[level] < threshold()) return;
  const payload: Record<string, unknown> = { level, time: new Date().toISOString(), msg, ...meta };
  if (meta && "error" in meta) payload.error = serializeError(meta.error);
  const line =
    process.env.NODE_ENV === "production"
      ? JSON.stringify(payload)
      : `[${level.toUpperCase()}] ${msg}${meta ? " " + JSON.stringify({ ...meta, error: meta.error ? serializeError(meta.error) : undefined }) : ""}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => write("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => write("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => write("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => write("error", msg, meta),
};
