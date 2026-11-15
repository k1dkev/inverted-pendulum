export const COMMAND_HELP = [
  "help · status · config · control acquire|release",
  "arm · stop · disarm · fault clear · position zero",
  "policy list|status|start · policy select <id|name>",
  "jog <signed-mm/s> <duration-ms: 50..5000>",
  "acceleration <mm/s²> · sim reset|pause|resume",
  "sim state <angle-deg> <omega-rad/s> <x-mm> <v-mm/s> [paused|running]",
  "sim parameters <inertia-kg·m²> <damping-N·m·s/rad>",
  "telemetry catalog|setup|off · telemetry subscribe <ids-comma-separated> <5|10|25>",
  "log config · log level debug|info|warn|error|off",
];
export const COMMAND_COMPLETIONS = [
  "help",
  "status",
  "config",
  "control acquire",
  "control release",
  "arm",
  "stop",
  "disarm",
  "fault clear",
  "position zero",
  "policy list",
  "policy status",
  "policy select manual",
  "policy select swingup_lqr_v1",
  "policy select swingup_lqr_v2",
  "policy select swingup_lqr_v3",
  "policy start",
  "jog 20 500",
  "jog -20 500",
  "acceleration 10000",
  "sim reset",
  "sim pause",
  "sim resume",
  "sim state 180 0 0 0 paused",
  "sim parameters 0.00267683 0.0004015245",
  "telemetry catalog",
  "telemetry setup",
  "telemetry off",
  "telemetry subscribe 0,8,10 10",
  "log config",
  "log level info",
];
export interface ConsoleCommand {
  type: string;
  fields: Record<string, unknown>;
}
export function parseCommand(line: string): ConsoleCommand {
  if (
    typeof line !== "string" ||
    line.length > 512 ||
    /[\r\n\x00-\x1f]/.test(line)
  )
    throw Error("INVALID_COMMAND_LINE");
  const t = line.trim().split(/\s+/),
    key = t.slice(0, 2).join(" ");
  const command = (
    type: string,
    fields: Record<string, unknown> = {},
  ): ConsoleCommand => ({ type, fields });
  const n = (at: number) => {
    const v = Number(t[at]);
    if (t[at] === undefined || !Number.isFinite(v))
      throw Error("EXPECTED_FINITE_NUMBER");
    return v;
  };
  const single: Record<string, string> = {
    help: "console_help",
    status: "console_status",
    config: "console_config",
    arm: "arm",
    stop: "stop",
    disarm: "disarm",
  };
  if (t.length === 1 && single[t[0]]) return command(single[t[0]]);
  const pairs: Record<string, string> = {
    "control acquire": "acquire_control",
    "control release": "release_control",
    "fault clear": "clear_fault",
    "position zero": "zero_position",
    "policy list": "console_policies",
    "policy status": "console_policy_status",
    "policy start": "start_policy",
    "sim reset": "sim_reset",
    "telemetry catalog": "console_catalog",
    "telemetry setup": "get_telemetry_setup",
    "log config": "console_log_config",
  };
  if (t.length === 2 && pairs[key]) return command(pairs[key]);
  if (t.length === 2 && (key === "sim pause" || key === "sim resume"))
    return command("sim_pause", { paused: t[1] === "pause" });
  if (t.length === 3 && key === "policy select")
    return command("console_select_policy", { policy: t[2] });
  if (t.length === 3 && key === "log level") {
    const levels: Record<string, number> = {
      off: 0,
      debug: 10,
      info: 20,
      warn: 30,
      error: 40,
    };
    if (!Object.hasOwn(levels, t[2])) throw Error("UNKNOWN_LOG_LEVEL");
    return command("set_log_level", { level: levels[t[2]] });
  }
  if (t.length === 3 && t[0] === "jog") {
    const duration = n(2);
    if (!Number.isInteger(duration) || duration < 50 || duration > 5000)
      throw Error("DURATION_MUST_BE_50_TO_5000_MS");
    return command("console_jog", {
      velocity_mm_s: n(1),
      duration_ms: duration,
    });
  }
  if (t.length === 2 && t[0] === "acceleration")
    return command("console_acceleration", { acceleration_mm_s2: n(1) });
  if (t.length === 4 && key === "sim parameters")
    return command("sim_parameters", {
      inertia_kg_m2: n(2),
      damping_n_m_s: n(3),
    });
  if ((t.length === 6 || t.length === 7) && key === "sim state") {
    if (t[6] && !["paused", "running"].includes(t[6]))
      throw Error("EXPECTED_PAUSED_OR_RUNNING");
    return command("console_sim_state", {
      angle_rad: (n(2) * Math.PI) / 180,
      angular_velocity_rad_s: n(3),
      position_mm: n(4),
      velocity_mm_s: n(5),
      paused: t[6] !== "running",
    });
  }
  if (t.length === 2 && key === "telemetry off")
    return command("telemetry_subscribe", { channels: [], rate_hz: 0 });
  if (t.length === 4 && key === "telemetry subscribe") {
    if (!/^\d+(,\d+)*$/.test(t[2])) throw Error("EXPECTED_CHANNEL_IDS");
    const rate = n(3);
    if (![5, 10, 25].includes(rate)) throw Error("EXPECTED_RATE_5_10_OR_25");
    return command("telemetry_subscribe", {
      channels: t[2].split(",").map(Number),
      rate_hz: rate,
    });
  }
  throw Error("UNKNOWN_COMMAND_OR_ARGUMENTS: type help");
}
