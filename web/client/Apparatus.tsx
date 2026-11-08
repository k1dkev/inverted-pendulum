import type { SimulationParameters, Telemetry } from "../server/protocol";

export function Apparatus({
  sample,
  parameters,
  mmPerPulse = 0.02,
}: {
  sample: Telemetry | null;
  parameters: SimulationParameters | null;
  mmPerPulse?: number;
}) {
  const min = parameters?.x_min_mm ?? -190,
    max = parameters?.x_max_mm ?? 190;
  const x = Number(sample?.step_position_pulses ?? 0) * mmPerPulse;
  const map = (position: number) =>
    250 + ((position - min) / (max - min)) * 460;
  const cartX = map(Math.max(min, Math.min(max, x)));
  const angle = ((sample?.angle_rad ?? 0) * 180) / Math.PI;
  const atLeft = sample?.at_left_bound,
    atRight = sample?.at_right_bound;
  return (
    <section className="apparatus">
      <div className="apparatus-heading">
        <div>
          <p className="eyebrow">
            VIRTUAL APPARATUS · {sample?.state ?? "DISCONNECTED"}
          </p>
          <h2>Pendulum &amp; cart</h2>
          <p>
            Track: {min} to +{max} mm · Physical motor outputs inactive
          </p>
        </div>
        <div className="position-readout">
          <strong>
            {x.toFixed(2)} <small>mm</small>
          </strong>
          <span>
            {atLeft
              ? "LEFT END STOP"
              : atRight
                ? "RIGHT END STOP"
                : "CART POSITION"}
          </span>
        </div>
      </div>
      <svg
        viewBox="0 0 960 460"
        aria-label={`Pendulum animation, cart ${x.toFixed(2)} mm, bounds ${min} to ${max} mm`}
        role="img"
      >
        <defs>
          <pattern
            id="end-hatch"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <line y2="8" stroke="#a86c47" strokeWidth="2" />
          </pattern>
        </defs>
        <rect x="250" y="24" width="460" height="370" rx="8" fill="#243a322b" />
        <line
          x1="480"
          y1="24"
          x2="480"
          y2="322"
          stroke="#517163"
          strokeDasharray="5 7"
        />
        <text x="480" y="422" textAnchor="middle" fill="#819d8e" fontSize="13">
          UPRIGHT = 0° · RIGHT = +X
        </text>
        <path d="M210 260H750" stroke="#78998b" strokeWidth="4" />
        <path d="M210 269H750" stroke="#3c584b" strokeWidth="2" />
        <rect
          x="202"
          y="213"
          width="13"
          height="63"
          rx="3"
          fill={atLeft ? "#f3b37a" : "#9d7559"}
        />
        <rect
          x="745"
          y="213"
          width="13"
          height="63"
          rx="3"
          fill={atRight ? "#f3b37a" : "#9d7559"}
        />
        <rect x="190" y="213" width="12" height="63" fill="url(#end-hatch)" />
        <rect x="758" y="213" width="12" height="63" fill="url(#end-hatch)" />
        <path
          d="M250 182V303M710 182V303"
          stroke="#a98363"
          strokeDasharray="4 5"
        />
        {[min, min / 2, 0, max / 2, max].map((tick) => (
          <g key={tick}>
            <line
              x1={map(tick)}
              y1="277"
              x2={map(tick)}
              y2="288"
              stroke="#78998b"
            />
            <text
              x={map(tick)}
              y="309"
              textAnchor="middle"
              fill="#a9c1b2"
              fontSize="14"
            >
              {tick > 0 ? "+" : ""}
              {tick} mm
            </text>
          </g>
        ))}
        <g transform={`translate(${cartX},205)`} data-cart-x={cartX.toFixed(2)}>
          <rect
            x="-35"
            y="5"
            width="70"
            height="31"
            rx="6"
            fill="#334f43"
            stroke="#7ee5bf"
            strokeWidth="2"
          />
          <circle
            cx="-23"
            cy="44"
            r="8"
            fill="#182b23"
            stroke="#8caa9a"
            strokeWidth="2"
          />
          <circle
            cx="23"
            cy="44"
            r="8"
            fill="#182b23"
            stroke="#8caa9a"
            strokeWidth="2"
          />
          <g transform={`rotate(${angle})`}>
            <line y2="-175" stroke="#b6f0d6" strokeWidth="5" />
            <circle
              cy="-175"
              r="15"
              fill="#7ee5bf"
              stroke="#c3ffe4"
              strokeWidth="2"
            />
          </g>
          <circle r="6" fill="#e4f8ec" stroke="#456b58" strokeWidth="2" />
        </g>
      </svg>
      <div className="apparatus-footer">
        <span>Hard end stops · ±190 mm</span>
        <span>Fresh arrow presses immediately retarget motion</span>
      </div>
    </section>
  );
}
