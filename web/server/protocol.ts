export const Type = {
  HELLO: 1,
  HELLO_INFO: 2,
  GET_STATUS: 3,
  STATUS: 4,
  RESPONSE: 5,
  SET_TELEMETRY: 0x10,
  ARM: 0x11,
  VELOCITY: 0x12,
  STOP: 0x13,
  DISARM: 0x14,
  CLEAR_FAULT: 0x15,
  ZERO: 0x16,
  KEEPALIVE: 0x17,
  SET_ACCELERATION: 0x18,
  GET_CONFIG: 0x19,
  TELEMETRY: 0x20,
  EVENT: 0x21,
  LOG_RECORD: 0x22,
  SIM_RESET: 0x30,
  SIM_STATE: 0x31,
  SIM_PAUSE: 0x32,
  SIM_SET_PARAMETERS: 0x33,
  SIM_GET_PARAMETERS: 0x34,
  SIM_PARAMETERS: 0x35,
  LIST_POLICIES: 0x40,
  POLICY_DESCRIPTOR: 0x41,
  GET_POLICY: 0x42,
  SELECT_POLICY: 0x43,
  START_POLICY: 0x44,
  POLICY_STATUS: 0x45,
  TELEMETRY_CATALOG: 0x50,
  TELEMETRY_DESCRIPTOR: 0x51,
  GET_SUBSCRIPTION: 0x52,
  SUBSCRIPTION: 0x53,
  SUBSCRIBE: 0x54,
  SELECTED_TELEMETRY: 0x55,
  GET_LOG_CONFIG: 0x60,
  LOG_CONFIG: 0x61,
  SET_LOG_LEVEL: 0x62,
} as const;
export const states = ["BOOT", "IDLE", "ARMED", "RUNNING", "STOPPING", "FAULT"];
export const results = [
  "OK",
  "UNSUPPORTED",
  "BAD_PAYLOAD",
  "WRONG_STATE",
  "LIMIT_EXCEEDED",
  "FAULT_ACTIVE",
  "BAD_SESSION",
  "STALE_REQUEST",
  "ID_REUSE",
  "BUSY",
  "NOT_CONFIGURED",
];
const faultNames = [
  "hardware stop",
  "travel limit",
  "invalid sensor",
  "motion timing",
  "control overrun",
  "command lease expired",
  "communications overflow",
  "policy stopped (domain, numeric, track limit, or balance loss)",
];
export interface Packet {
  type: number;
  id: number;
  session: bigint;
  payload: Buffer;
}
export interface Telemetry {
  time_us: string;
  sample_seq: number;
  flags: number;
  angle_rad: number | null;
  angular_velocity_rad_s: number | null;
  step_position_pulses: string | null;
  step_velocity_pulses_s: number | null;
  step_acceleration_pulses_s2: number | null;
  target_velocity_pulses_s: number;
  angle_adc_raw: number;
  state: string;
  mode: string;
  faults: string[];
  fault_bits: number;
  dropped_samples: number;
  execution_time_us: number;
  pulse_rate_pulses_s: number;
  physical_reference_valid: boolean;
  simulation_paused: boolean;
  at_left_bound: boolean;
  at_right_bound: boolean;
  position_source: "simulated_pulse_count" | "pulse_count";
  session_id: string;
}
export interface Capabilities {
  board_id: number;
  bits: number;
  simulation: boolean;
  max_velocity: number;
  acceleration: number;
  deceleration: number;
  pulses_per_revolution: number;
  mm_per_pulse: number;
  lease_ms: number;
  max_telemetry_hz: number;
  firmware_version: number;
}
export interface SimulationParameters {
  inertia_kg_m2: number;
  damping_n_m_s: number;
  mass_kg: number;
  center_of_mass_m: number;
  x_min_mm: number;
  x_max_mm: number;
}
export interface PolicyDescriptor {
  id: number;
  name: string;
  can_start: boolean;
  hot_swap: boolean;
}
export interface PolicyStatus {
  id: number;
  phase: number;
  phase_name: string;
  running: boolean;
  generation: number;
  error_code: number;
  acceleration_mm_s2: number;
  filtered_angular_velocity_rad_s: number;
  integral_mm_s: number;
}
export interface TelemetryChannel {
  id: number;
  name: string;
  unit: string;
  description: string;
  value_type: "f32";
}
export interface Subscription {
  schema_version: number;
  rate_hz: number;
  mask: number;
  revision: number;
}
export function policyDescriptor(p: Buffer): {
  count: number;
  index: number;
  policy: PolicyDescriptor;
} {
  if (p.length < 12 || p.length !== 12 + p[10])
    throw Error("Invalid policy descriptor");
  return {
    count: p.readUInt16LE(4),
    index: p.readUInt16LE(6),
    policy: {
      id: p.readUInt16LE(8),
      name: p.toString("utf8", 12),
      can_start: !!(p[11] & 1),
      hot_swap: !!(p[11] & 2),
    },
  };
}
export function policyStatus(p: Buffer): PolicyStatus {
  if (p.length !== 24) throw Error("Invalid policy status");
  return {
    id: p.readUInt16LE(4),
    phase: p[6],
    phase_name:
      ["OFF", "SWING_UP", "LQR", "FAILED", "RECENTER"][p[6]] ?? "UNKNOWN",
    running: !!(p[7] & 1),
    error_code: p[7] >> 1,
    generation: p.readUInt32LE(8),
    acceleration_mm_s2: p.readFloatLE(12),
    filtered_angular_velocity_rad_s: p.readFloatLE(16),
    integral_mm_s: p.readFloatLE(20),
  };
}
export function telemetryDescriptor(p: Buffer): {
  version: number;
  count: number;
  channel: TelemetryChannel;
} {
  if (p.length < 16 || p.length !== 16 + p[12] + p[13] + p[14] || p[10] !== 1)
    throw Error("Invalid telemetry descriptor");
  let n = 16;
  const name = p.toString("utf8", n, (n += p[12])),
    unit = p.toString("utf8", n, (n += p[13])),
    description = p.toString("utf8", n, n + p[14]);
  return {
    version: p.readUInt16LE(4),
    count: p.readUInt16LE(6),
    channel: {
      id: p.readUInt16LE(8),
      name,
      unit,
      description,
      value_type: "f32",
    },
  };
}
export function subscription(p: Buffer): Subscription {
  if (p.length !== 16) throw Error("Invalid telemetry subscription");
  return {
    schema_version: p.readUInt16LE(4),
    rate_hz: p.readUInt16LE(6),
    mask: p.readUInt32LE(8),
    revision: p.readUInt32LE(12),
  };
}
export function selectedTelemetry(p: Buffer) {
  if (p.length < 28) throw Error("Invalid selected telemetry");
  const mask = p.readUInt32LE(12),
    valid = p.readUInt32LE(24),
    values: Record<number, number | null> = {};
  let n = 28;
  for (let id = 0; id < 32; id++)
    if (mask & (1 << id)) {
      if (n + 4 > p.length) throw Error("Truncated selected telemetry");
      values[id] = valid & (1 << id) ? p.readFloatLE(n) : null;
      n += 4;
    }
  if (n !== p.length) throw Error("Invalid selected telemetry length");
  return {
    time_us: p.readBigUInt64LE(0).toString(),
    sample_seq: p.readUInt32LE(8),
    mask,
    revision: p.readUInt32LE(16),
    schema_version: p.readUInt16LE(20),
    rate_hz: p.readUInt16LE(22),
    values,
  };
}
export function simulationParameters(p: Buffer): SimulationParameters {
  if (p.length !== 28)
    throw Error("Invalid simulation parameters; flash current firmware");
  return {
    inertia_kg_m2: p.readFloatLE(4),
    damping_n_m_s: p.readFloatLE(8),
    mass_kg: p.readFloatLE(12),
    center_of_mass_m: p.readFloatLE(16),
    x_min_mm: p.readFloatLE(20),
    x_max_mm: p.readFloatLE(24),
  };
}
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let b = 0; b < 8; b++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function encode(packet: Packet): Buffer {
  if (packet.payload.length > 236) throw Error("Payload too large");
  const raw = Buffer.alloc(20 + packet.payload.length);
  raw[0] = 1;
  raw[1] = packet.type;
  raw.writeUInt16LE(packet.payload.length, 2);
  raw.writeUInt32LE(packet.id, 4);
  raw.writeBigUInt64LE(packet.session, 8);
  packet.payload.copy(raw, 16);
  raw.writeUInt32LE(crc32(raw.subarray(0, -4)), raw.length - 4);
  const out: number[] = [0];
  let codeAt = 0,
    code = 1;
  for (const byte of raw) {
    if (byte === 0) {
      out[codeAt] = code;
      codeAt = out.length;
      out.push(0);
      code = 1;
    } else {
      out.push(byte);
      if (++code === 255) {
        out[codeAt] = code;
        codeAt = out.length;
        out.push(0);
        code = 1;
      }
    }
  }
  out[codeAt] = code;
  out.push(0);
  return Buffer.from(out);
}
export class Parser {
  private bytes: number[] = [];
  private discard = false;
  private last = 0;
  errors = 0;
  push(chunk: Uint8Array, now = Date.now()): Packet[] {
    if (this.bytes.length && now - this.last > 100) {
      this.bytes = [];
      this.discard = true;
      this.errors++;
    }
    this.last = now;
    const packets: Packet[] = [];
    for (const byte of chunk) {
      if (byte !== 0) {
        if (!this.discard) {
          if (this.bytes.length >= 258) {
            this.discard = true;
            this.errors++;
          } else this.bytes.push(byte);
        }
        continue;
      }
      if (this.discard || !this.bytes.length) {
        this.bytes = [];
        this.discard = false;
        continue;
      }
      const encoded = this.bytes;
      this.bytes = [];
      try {
        const decoded: number[] = [];
        for (let r = 0; r < encoded.length;) {
          const code = encoded[r++];
          if (!code || r + code - 1 > encoded.length) throw Error("COBS");
          for (let i = 1; i < code; i++) decoded.push(encoded[r++]);
          if (code !== 255 && r < encoded.length) decoded.push(0);
        }
        const raw = Buffer.from(decoded);
        if (
          raw.length < 20 ||
          raw.length > 256 ||
          raw[0] !== 1 ||
          raw.readUInt16LE(2) + 20 !== raw.length ||
          crc32(raw.subarray(0, -4)) !== raw.readUInt32LE(raw.length - 4)
        )
          throw Error("Frame");
        packets.push({
          type: raw[1],
          id: raw.readUInt32LE(4),
          session: raw.readBigUInt64LE(8),
          payload: raw.subarray(16, -4),
        });
      } catch {
        this.errors++;
      }
    }
    return packets;
  }
}
export function capabilities(p: Buffer): Capabilities {
  if (p.length !== 48) throw Error("Invalid HELLO_INFO");
  return {
    board_id: p.readUInt16LE(4),
    bits: p.readUInt16LE(6),
    simulation: !!(p.readUInt16LE(6) & 8),
    firmware_version: p.readUInt32LE(8),
    max_velocity: p.readFloatLE(16),
    acceleration: p.readFloatLE(20),
    deceleration: p.readFloatLE(24),
    pulses_per_revolution: p.readUInt32LE(28),
    mm_per_pulse: p.readFloatLE(32),
    lease_ms: p.readUInt16LE(36),
    max_telemetry_hz: p.readUInt16LE(38),
  };
}
export function telemetry(p: Buffer, session: bigint): Telemetry {
  if (p.length !== 64) throw Error("Invalid telemetry");
  const flags = p.readUInt32LE(12),
    faults = p.readUInt32LE(48),
    sim = p[47] === 2;
  const value = (at: number, bit: number) =>
    flags & (1 << bit) ? p.readFloatLE(at) : null;
  return {
    time_us: p.readBigUInt64LE(0).toString(),
    sample_seq: p.readUInt32LE(8),
    flags,
    step_position_pulses: flags & 4 ? p.readBigInt64LE(16).toString() : null,
    angle_rad: value(24, 0),
    angular_velocity_rad_s: value(28, 1),
    step_velocity_pulses_s: value(32, 5),
    step_acceleration_pulses_s2: value(36, 5),
    target_velocity_pulses_s: p.readFloatLE(40),
    angle_adc_raw: p.readUInt16LE(44),
    state: states[p[46]] ?? `UNKNOWN_${p[46]}`,
    mode: sim ? "SIMULATION" : p[47] === 1 ? "MANUAL_VELOCITY" : "NONE",
    fault_bits: faults,
    faults: [
      ...faultNames.filter((_, i) => faults & (1 << i)),
      ...(faults >>> 8
        ? [`unknown bits 0x${(faults & ~255).toString(16)}`]
        : []),
    ],
    dropped_samples: p.readUInt32LE(52),
    execution_time_us: p.readUInt32LE(56),
    pulse_rate_pulses_s: p.readFloatLE(60),
    physical_reference_valid: !!(flags & 16),
    simulation_paused: !!(flags & 64),
    at_left_bound: !!(flags & 128),
    at_right_bound: !!(flags & 256),
    position_source: sim ? "simulated_pulse_count" : "pulse_count",
    session_id: session.toString(16).padStart(16, "0"),
  };
}
