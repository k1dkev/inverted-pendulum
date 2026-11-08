import React, { useRef, useEffect } from "react";
const number = (v: number, digits = 1) =>
  v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
export function Plot<
  T extends { seconds: number; target_velocity_pulses_s?: number },
>({
  title,
  unit,
  color,
  field,
  samples,
  target = false,
  domain,
  wrapPeriod,
  maxGapSeconds = 0.1,
  diagnosticScale = false,
}: {
  title: string;
  unit: string;
  color: string;
  field: (s: T) => number | null;
  samples: React.RefObject<T[]>;
  target?: boolean;
  domain?: [number, number];
  wrapPeriod?: number;
  maxGapSeconds?: number;
  diagnosticScale?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef(field);
  fieldRef.current = field;
  useEffect(() => {
    let frame = 0,
      last = 0;
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if (time - last < 33) return;
      last = time;
      const el = canvas.current;
      if (!el) return;
      const ctx = el.getContext("2d");
      if (!ctx) return;
      const w = el.clientWidth,
        h = el.clientHeight,
        dpr = window.devicePixelRatio || 1;
      if (!w || !h) return;
      if (el.width !== w * dpr || el.height !== h * dpr) {
        el.width = w * dpr;
        el.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const data = samples.current,
        right = data.at(-1)?.seconds ?? 0,
        left = Math.max(0, right - 15),
        span = Math.max(15, right - left);
      const values = data
        .filter((s) => s.seconds >= left)
        .flatMap((s) => {
          const v = fieldRef.current(s);
          return v == null
            ? []
            : target
              ? [v, s.target_velocity_pulses_s ?? 0]
              : [v];
        });
      let lo = Math.min(0, ...values),
        hi = Math.max(0, ...values);
      const pad = Math.max(
        (hi - lo) * 0.15,
        diagnosticScale ? 1e-9 : unit === "unitless" ? 0.05 : 1,
      );
      if (domain) {
        [lo, hi] = domain;
      } else {
        lo -= pad;
        hi += pad;
      }
      const x = (t: number) => 46 + ((t - left) / span) * (w - 60),
        y = (v: number) => h - 27 - ((v - lo) / (hi - lo)) * (h - 42);
      ctx.font = "10px ui-monospace,monospace";
      ctx.textAlign = "right";
      for (let i = 0; i <= 4; i++) {
        const value = lo + ((hi - lo) * i) / 4,
          py = y(value);
        ctx.strokeStyle = Math.abs(value) < 1e-9 ? "#526b60" : "#273132";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(46, py);
        ctx.lineTo(w - 14, py);
        ctx.stroke();
        ctx.fillStyle = "#839596";
        ctx.fillText(
          diagnosticScale
            ? value.toLocaleString(undefined, { maximumSignificantDigits: 3 })
            : number(value, Math.abs(hi) < 10 ? 1 : 0),
          39,
          py + 3,
        );
      }
      ctx.textAlign = "center";
      for (let i = 0; i <= 3; i++) {
        const t = left + (span * i) / 3;
        ctx.fillStyle = "#839596";
        ctx.fillText(`${t.toFixed(0)}s`, x(t), h - 7);
      }
      const line = (
        get: (s: T) => number | null,
        stroke: string,
        dashed = false,
      ) => {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.8;
        ctx.setLineDash(dashed ? [4, 4] : []);
        ctx.beginPath();
        let previous: T | undefined;
        for (const sample of data) {
          if (sample.seconds < left) continue;
          const value = get(sample);
          if (value == null || !Number.isFinite(value)) {
            previous = undefined;
            continue;
          }
          if (
            !previous ||
            sample.seconds - previous.seconds > maxGapSeconds ||
            (wrapPeriod &&
              Math.abs(value - (get(previous) ?? value)) > wrapPeriod / 2)
          )
            ctx.moveTo(x(sample.seconds), y(value));
          else ctx.lineTo(x(sample.seconds), y(value));
          previous = sample;
        }
        ctx.stroke();
        ctx.setLineDash([]);
      };
      if (target) line((s) => s.target_velocity_pulses_s ?? 0, "#819292", true);
      line(fieldRef.current, color);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [
    color,
    samples,
    target,
    domain,
    wrapPeriod,
    unit,
    maxGapSeconds,
    diagnosticScale,
  ]);
  return (
    <section className="plot">
      <div className="plot-heading">
        <h2>
          <i style={{ background: color }} />
          {title}
        </h2>
        <span>{unit}</span>
      </div>
      <canvas ref={canvas} aria-label={`${title} over time`} role="img" />
      {target && (
        <small className="legend">Solid: applied · Dashed: target</small>
      )}
    </section>
  );
}
