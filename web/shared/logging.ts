export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogSource = "mcu" | "bridge" | "command";
export interface LogRecord {
  id: number;
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  session_id?: string;
  device_time_us?: string;
  fields: Record<string, unknown>;
}
export const LOG_CAPACITY = 1000;
