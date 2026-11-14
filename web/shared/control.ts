// Schema-1 channels already provided by both swing-up/LQR implementations.
export const CONTROL_CHANNELS = [6, 7, 13, 14] as const;
export const CONTROL_MASK = CONTROL_CHANNELS.reduce(
  (mask, id) => mask | (1 << id),
  0,
);
export const CONTROL_RATE_HZ = 25;
export interface ControlTelemetry {
  time_us: string;
  sample_seq: number;
  rate_hz: number;
  active: boolean;
  policy_id: number | null;
  phase: number | null;
  raw_u_mm_s2: number | null;
  limited_u_mm_s2: number | null;
}
export function controlTelemetry(frame: {
  time_us: string;
  sample_seq: number;
  rate_hz: number;
  values: Record<number, number | null>;
}): ControlTelemetry {
  const value = (id: number) =>
    Number.isFinite(frame.values[id]) ? frame.values[id] : null;
  const id = value(14),
    phase = value(13);
  const active = id !== null && id > 0 && [1, 2, 4].includes(phase ?? -1);
  return {
    time_us: frame.time_us,
    sample_seq: frame.sample_seq,
    rate_hz: frame.rate_hz,
    active,
    policy_id: id,
    phase,
    raw_u_mm_s2: active ? value(6) : null,
    limited_u_mm_s2: active ? value(7) : null,
  };
}
