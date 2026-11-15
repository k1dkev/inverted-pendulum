import { useState, type RefObject } from "react";
import type { ControlTelemetry } from "../shared/control";
import { Plot } from "./Plot";
export type ControlSample = ControlTelemetry & { seconds: number };
export function ControlPlot({
  samples,
  available,
}: {
  samples: RefObject<ControlSample[]>;
  available: boolean;
}) {
  const [raw, setRaw] = useState(true),
    [limited, setLimited] = useState(true),
    [isLimited, setIsLimited] = useState(true);
  const sample = samples.current.at(-1);
  const inertia = sample?.model_inertia,
    damping = sample?.model_damping;
  const actualA =
    inertia && inertia > 0 ? (0.094 * 9.81 * 0.1444) / inertia : null;
  const actualC =
    inertia && inertia > 0 && damping != null ? damping / inertia : null;
  const display = (x: number | null | undefined) =>
    x == null ? "—" : x.toFixed(3);
  return (
    <div className="control-effort-plot">
      <div className="control-legend" aria-label="Control graph series">
        <label>
          <input
            type="checkbox"
            checked={raw}
            onChange={(e) => setRaw(e.target.checked)}
          />{" "}
          <span style={{ color: "#f3b37a" }}>Raw u (dashed)</span>
        </label>{" "}
        <label>
          <input
            type="checkbox"
            checked={limited}
            onChange={(e) => setLimited(e.target.checked)}
          />{" "}
          <span style={{ color: "#7ee5bf" }}>Limited u (solid)</span>
        </label>{" "}
        <label>
          <input
            type="checkbox"
            checked={isLimited}
            onChange={(e) => setIsLimited(e.target.checked)}
          />{" "}
          <span style={{ color: "#e5b85d" }}>Is limited</span>
        </label>
      </div>
      <Plot
        title="Control effort · u"
        unit="mm/s²"
        color="#7ee5bf"
        samples={samples}
        field={(s) => (limited ? s.limited_u_mm_s2 : null)}
        primaryLabel="Limited u"
        secondary={
          raw
            ? { field: (s) => s.raw_u_mm_s2, label: "Raw u", color: "#f3b37a" }
            : undefined
        }
        showLegend={false}
        step
        maxGapSeconds={0.12}
      />
      {isLimited && (
        <Plot
          title="Is acceleration limited"
          unit="0 / 1"
          color="#e5b85d"
          samples={samples}
          field={(s) =>
            s.raw_u_mm_s2 == null || s.limited_u_mm_s2 == null
              ? null
              : s.raw_u_mm_s2 !== s.limited_u_mm_s2
                ? 1
                : 0
          }
          domain={[-0.1, 1.1]}
          step
          maxGapSeconds={0.12}
        />
      )}
      <p className="hint">
        {available
          ? "25 Hz samples; is limited indicates acceleration clipping, before motor speed limiting. Gaps mean no active policy."
          : "Connect current firmware or a local simulator to stream controller output."}
      </p>
      <p className="hint">
        V3 parameters · a: estimated {display(sample?.estimated_a)} / simulated
        actual {display(actualA)} s⁻² · c: estimated{" "}
        {display(sample?.estimated_c)} / simulated actual {display(actualC)} s⁻¹
      </p>
    </div>
  );
}
