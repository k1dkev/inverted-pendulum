import type { RefObject } from "react";
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
  return (
    <div className="control-effort-plot">
      <div className="control-effort-grid">
        <Plot
          title="Raw control effort · u"
          unit="mm/s²"
          color="#f3b37a"
          samples={samples}
          field={(sample) => sample.raw_u_mm_s2}
          step
          maxGapSeconds={0.12}
        />
        <Plot
          title="Limited control effort · u"
          unit="mm/s²"
          color="#7ee5bf"
          samples={samples}
          field={(sample) => sample.limited_u_mm_s2}
          step
          maxGapSeconds={0.12}
        />
      </div>
      <p className="hint">
        {available
          ? "25 Hz command samples from the controller (v1/v2: 100 Hz; v3: 1 kHz). Gaps mean no active policy. Raw u is the controller demand; limited u is clamped to ±10,000 mm/s², before the motor speed limit. The plots match when that clamp is inactive. Each vertical axis scales independently. Cart acceleration is plotted above."
          : "Connect current firmware or a local simulator to stream controller output. Manual mode has no balancing control effort."}
      </p>
    </div>
  );
}
