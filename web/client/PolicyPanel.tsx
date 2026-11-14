import type { PolicyDescriptor, PolicyStatus } from "../server/protocol";
export function PolicyPanel({
  policies,
  policy,
  state,
  owned,
  fresh,
  paused,
  send,
  select,
}: {
  policies: PolicyDescriptor[];
  policy: PolicyStatus | null;
  state: string;
  owned: boolean;
  fresh: boolean;
  paused: boolean;
  send: (type: string, fields?: Record<string, unknown>) => void;
  select: (id: number) => void;
}) {
  const ready = owned && fresh && !paused && state !== "FAULT";
  const error = [
    "",
    "Logarithm domain: |x| ≥ 150 mm",
    "Balance lost: outside ±45° for 500 ms",
    "Nonfinite policy output",
    "±190 mm policy travel limit",
  ][policy?.error_code ?? 0];
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Control policy</h2>
        <span className="badge">{policy?.phase_name ?? "OFF"}</span>
      </div>
      <label htmlFor="policy">Compiled policy</label>
      <select
        id="policy"
        value={policy?.id ?? 0}
        disabled={!ready || state === "STOPPING"}
        onChange={(event) => select(Number(event.target.value))}
      >
        {policies.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name === "manual" ? "Manual" : p.name.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <div className="stop-row">
        <button
          disabled={!ready || state !== "IDLE"}
          onClick={() => send("arm")}
        >
          Arm
        </button>
        <button
          disabled={!ready || state !== "ARMED" || !policy?.id}
          onClick={() => send("start_policy")}
        >
          Run policy
        </button>
      </div>
      <div className="stop-row">
        <button disabled={!owned} onClick={() => send("stop")}>
          Stop policy
        </button>
        <button disabled={!owned} onClick={() => send("disarm")}>
          Disarm
        </button>
      </div>
      <p className="hint">
        {policy?.id === 2
          ? "Recovery swing-up → LQR: retries after falls, recenters near the track edges, and uses corrected angular velocity."
          : policy?.id === 1
            ? "Legacy swing-up → LQR preserves the original 100 Hz loop and terminal balance-failure behavior."
            : "Select a compiled policy, then Arm and Run policy."}{" "}
        A live policy change resets controller state; plant state is retained.
        Selecting Manual requests a stop before manual jogging.
      </p>
      {!!policy?.id && (
        <p className="hint">
          Output {policy.acceleration_mm_s2.toFixed(2)} mm/s² · Integral{" "}
          {policy.integral_mm_s.toFixed(2)} mm·s
        </p>
      )}
      {error && <p className="fault">{error}</p>}
    </section>
  );
}
