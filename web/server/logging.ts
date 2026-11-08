import { LOG_CAPACITY, type LogRecord } from "../shared/logging";
export class LogStore {
  private nextId = 0;
  private entries: LogRecord[] = [];
  append(record: Omit<LogRecord, "id" | "timestamp">): LogRecord {
    const entry = {
      ...record,
      id: ++this.nextId,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(entry);
    if (this.entries.length > LOG_CAPACITY) this.entries.shift();
    return entry;
  }
  snapshot(limit = LOG_CAPACITY) {
    return this.entries.slice(-limit);
  }
  recent() {
    const records = this.snapshot(50);
    while (Buffer.byteLength(JSON.stringify(records)) > 32768) records.shift();
    return records;
  }
  ndjson() {
    return (
      this.entries.map((entry) => JSON.stringify(entry)).join("\n") +
      (this.entries.length ? "\n" : "")
    );
  }
}
export function deviceLog(
  p: Buffer,
): Omit<LogRecord, "id" | "timestamp" | "session_id"> {
  if (p.length !== 32 || ![10, 20, 30, 40].includes(p[12]))
    throw Error("Invalid MCU log");
  const levels = { 10: "debug", 20: "info", 30: "warn", 40: "error" } as const;
  const code = p.readUInt16LE(14),
    a = p.readUInt32LE(16),
    b = p.readUInt32LE(20),
    c = p.readUInt32LE(24);
  const names: Record<number, string> = {
    1: "Device state changed",
    2: "Device fault asserted",
    3: "Device fault cleared",
    4: "Position zeroed",
    5: "Simulation state reset/set",
    6: "Simulation pause changed",
    7: "Policy selected",
    8: "Policy phase changed",
    9: "Configuration changed",
    10: "Serial session established",
    11: "Command rejected",
  };
  let fields: Record<string, unknown> = {
    code,
    subsystem: p[13],
    sequence: p.readUInt32LE(8),
    dropped: p.readUInt32LE(28),
  };
  if (code >= 1 && code <= 6)
    fields = { ...fields, state: a, fault_bits: b, paused: !!c };
  else if (code === 7)
    fields = { ...fields, policy_id: a, live: !!b, revision: c };
  else if (code === 8)
    fields = { ...fields, policy_id: a, phase: b, error_code: c };
  else if (code === 9) fields = { ...fields, command_type: a, revision: b };
  else if (code === 11)
    fields = { ...fields, command_type: a, result: b, request_id: c };
  else fields = { ...fields, args: [a, b, c] };
  return {
    source: "mcu",
    level: levels[p[12] as keyof typeof levels],
    message: names[code] ?? `MCU event ${code}`,
    device_time_us: p.readBigUInt64LE(0).toString(),
    fields,
  };
}
