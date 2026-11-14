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
      <Plot
        title="Control effort · u"
        unit="mm/s²"
        color="#7ee5bf"
        samples={samples}
        field={(sample) => sample.limited_u_mm_s2}
        primaryLabel="Limited u"
        secondary={{
          field: (sample) => sample.raw_u_mm_s2,
          label: "Raw u",
          color: "#f3b37a",
        }}
        step
        maxGapSeconds={0.12}
      />
      <p className="hint">
        {available
          ? "25 Hz command samples from the 100 Hz controller. Gaps mean no active policy. Limited u is before the motor speed limit; it is not the cart acceleration plotted above."
          : "Connect current firmware or a local simulator to stream controller output. Manual mode has no balancing control effort."}
      </p>
    </div>
  );
}
