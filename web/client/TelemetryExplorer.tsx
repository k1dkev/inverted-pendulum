import { useEffect, useState, type RefObject } from "react";
import type { TelemetryChannel, Subscription } from "../server/protocol";
import { Plot } from "./Plot";
export interface ExtraSample {
  seconds: number;
  values: Record<number, number | null>;
}
export function TelemetryExplorer({
  setup,
  samples,
  ready,
  send,
}: {
  setup: {
    catalog: TelemetryChannel[];
    subscription: Subscription | null;
    channels: number[];
    rate_hz: number;
  };
  samples: RefObject<ExtraSample[]>;
  ready: boolean;
  send: (type: string, fields?: Record<string, unknown>) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]),
    [rate, setRate] = useState(10);
  useEffect(() => {
    setSelected(setup.channels);
    setRate(setup.rate_hz || 10);
  }, [setup.channels.join(","), setup.rate_hz]);
  const active = setup.catalog.filter((channel) =>
    setup.channels.includes(channel.id),
  );
  return (
    <section className="telemetry-lab">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">MCU TELEMETRY CATALOG</p>
            <h2>Choose what to inspect</h2>
          </div>
          <button disabled={!ready} onClick={() => send("get_telemetry_setup")}>
            Query device setup
          </button>
        </div>
        <p className="hint">
          The four state plots remain on their own 50 Hz stream; the overview u
          plot requests controller channels separately at 25 Hz. These optional
          channels are discovered from the microcontroller. Only selected
          diagnostics are requested. Multiple browser subscriptions are combined
          on the device and filtered for each browser.
        </p>
        <div className="channel-picker">
          {setup.catalog.map((channel) => (
            <label key={channel.id} title={channel.description}>
              <input
                type="checkbox"
                checked={selected.includes(channel.id)}
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? [...selected, channel.id]
                      : selected.filter((id) => id !== channel.id),
                  )
                }
              />
              <span>
                <strong>{channel.name}</strong>
                <small>
                  {channel.unit} · {channel.description}
                </small>
              </span>
            </label>
          ))}
        </div>
        <div className="subscription-controls">
          <label htmlFor="diagnostic-rate">
            Diagnostic rate
            <select
              id="diagnostic-rate"
              value={rate}
              onChange={(event) => setRate(Number(event.target.value))}
            >
              {[5, 10, 25].map((hz) => (
                <option key={hz} value={hz}>
                  {hz} Hz
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={!ready || !setup.catalog.length}
            onClick={() =>
              send("telemetry_subscribe", {
                channels: selected,
                rate_hz: selected.length ? rate : 0,
              })
            }
          >
            Apply {selected.length} channels
          </button>
          <button
            disabled={!ready}
            onClick={() =>
              send("telemetry_subscribe", { channels: [], rate_hz: 0 })
            }
          >
            Stop optional stream
          </button>
        </div>
        <p className="hint">
          Your stream: {setup.channels.length} channels / {setup.rate_hz} Hz ·
          MCU combined rate: {setup.subscription?.rate_hz ?? 0} Hz · schema{" "}
          {setup.subscription?.schema_version ?? "—"} · revision{" "}
          {setup.subscription?.revision ?? "—"}. Policy-specific channels show
          gaps when unavailable.
        </p>
      </div>
      {!active.length && (
        <div className="empty-state">
          {ready
            ? "Select channels above and apply to begin plotting."
            : "Connect a device on the Overview page to discover its telemetry."}
        </div>
      )}
      <div className="plots">
        {active.map((channel, index) => (
          <Plot
            key={channel.id}
            title={channel.name}
            unit={channel.unit}
            color={["#7ee5bf", "#f3b37a", "#88bdf8", "#c8abef"][index % 4]}
            samples={samples}
            diagnosticScale
            maxGapSeconds={3 / Math.max(1, setup.rate_hz)}
            field={(sample) => sample.values[channel.id] ?? null}
          />
        ))}
      </div>
    </section>
  );
}
