import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Capabilities, Telemetry } from "../server/protocol";
import "./style.css";

type Sample = Telemetry & { seconds: number };
type Port = { path: string; label: string };
type Connection = {
  serial: string;
  control: string;
  capabilities: Capabilities | null;
  path?: string;
};
const initial: Connection = {
  serial: "disconnected",
  control: "available",
  capabilities: null,
};
const number = (v: number | null | undefined, digits = 1) =>
  v == null
    ? "—"
    : v.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

function Plot({
  title,
  unit,
  color,
  field,
  samples,
  target = false,
}: {
  title: string;
  unit: string;
  color: string;
  field: (s: Sample) => number | null;
  samples: React.RefObject<Sample[]>;
  target?: boolean;
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
              ? [v, s.target_velocity_pulses_s]
              : [v];
        });
      let lo = Math.min(0, ...values),
        hi = Math.max(0, ...values);
      const pad = Math.max((hi - lo) * 0.15, 1);
      lo -= pad;
      hi += pad;
      const x = (t: number) => 46 + ((t - left) / span) * (w - 60),
        y = (v: number) => h - 27 - ((v - lo) / (hi - lo)) * (h - 42);
      ctx.font = "10px ui-monospace,monospace";
      ctx.textAlign = "right";
      for (let i = 0; i <= 4; i++) {
        const value = lo + ((hi - lo) * i) / 4,
          py = y(value);
        ctx.strokeStyle = "#273132";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(46, py);
        ctx.lineTo(w - 14, py);
        ctx.stroke();
        ctx.fillStyle = "#839596";
        ctx.fillText(number(value, Math.abs(hi) < 10 ? 1 : 0), 39, py + 3);
      }
      ctx.textAlign = "center";
      for (let i = 0; i <= 3; i++) {
        const t = left + (span * i) / 3;
        ctx.fillStyle = "#839596";
        ctx.fillText(`${t.toFixed(0)}s`, x(t), h - 7);
      }
      const line = (
        get: (s: Sample) => number | null,
        stroke: string,
        dashed = false,
      ) => {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.8;
        ctx.setLineDash(dashed ? [4, 4] : []);
        ctx.beginPath();
        let previous: Sample | undefined;
        for (const sample of data) {
          if (sample.seconds < left) continue;
          const value = get(sample);
          if (value == null || !Number.isFinite(value)) {
            previous = undefined;
            continue;
          }
          if (!previous || sample.seconds - previous.seconds > 0.1)
            ctx.moveTo(x(sample.seconds), y(value));
          else ctx.lineTo(x(sample.seconds), y(value));
          previous = sample;
        }
        ctx.stroke();
        ctx.setLineDash([]);
      };
      if (target) line((s) => s.target_velocity_pulses_s, "#819292", true);
      line(fieldRef.current, color);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [color, samples, target]);
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

function App() {
  const [connection, setConnection] = useState(initial),
    [ports, setPorts] = useState<Port[]>([]),
    [path, setPath] = useState("");
  const [sample, setSample] = useState<Telemetry | null>(null),
    [message, setMessage] = useState("Connect your STM32 to begin."),
    [speed, setSpeed] = useState(400);
  const [fresh, setFresh] = useState(false),
    [socketReady, setSocketReady] = useState(false),
    [held, setHeld] = useState(0);
  const [acceleration, setAcceleration] = useState(10000);
  const [form, setForm] = useState({
    angle: "12",
    omega: "0",
    position: "0",
    velocity: "0",
    paused: true,
  });
  useEffect(() => {
    const caps = connection.capabilities;
    if (caps?.mm_per_pulse)
      setAcceleration(Math.round(caps.acceleration * caps.mm_per_pulse));
  }, [
    connection.capabilities?.acceleration,
    connection.capabilities?.mm_per_pulse,
  ]);
  const ws = useRef<WebSocket | null>(null),
    id = useRef(0),
    samples = useRef<Sample[]>([]),
    epoch = useRef<bigint | null>(null),
    lastTime = useRef(0);
  const connRef = useRef(connection),
    sampleRef = useRef(sample),
    speedRef = useRef(speed),
    heldRef = useRef(0),
    pressed = useRef(new Set<string>()),
    blocked = useRef(false);
  connRef.current = connection;
  sampleRef.current = sample;
  speedRef.current = speed;
  const send = useCallback(
    (type: string, fields: Record<string, unknown> = {}) => {
      if (ws.current?.readyState === WebSocket.OPEN)
        ws.current.send(
          JSON.stringify({ v: 1, type, id: ++id.current, ...fields }),
        );
    },
    [],
  );
  const stop = useCallback(() => {
    const active = heldRef.current !== 0;
    heldRef.current = 0;
    setHeld(0);
    pressed.current.clear();
    if (active) send("stop");
  }, [send]);
  const jog = useCallback(
    (direction: number) => {
      const c = connRef.current,
        s = sampleRef.current;
      if (
        c.control !== "owned" ||
        !s ||
        !["ARMED", "RUNNING"].includes(s.state) ||
        s.simulation_paused ||
        Date.now() - lastTime.current > 250
      )
        return;
      heldRef.current = direction;
      setHeld(direction);
      send("jog", { velocity_pulses_s: direction * speedRef.current });
    },
    [send],
  );
  const refreshPorts = useCallback(async () => {
    try {
      const r = await fetch("/api/ports");
      if (!r.ok) throw Error();
      const p: Port[] = await r.json();
      setPorts(p);
      setPath((old) =>
        p.some((x) => x.path === old) ? old : (p[0]?.path ?? ""),
      );
    } catch {
      setMessage("Unable to list serial ports.");
    }
  }, []);
  useEffect(() => {
    void refreshPorts();
    let disposed = false,
      retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      const socket = new WebSocket(`ws://${location.host}/ws`);
      ws.current = socket;
      id.current = 0;
      socket.onopen = () => setSocketReady(true);
      socket.onmessage = (event) => {
        const m = JSON.parse(event.data);
        if (m.type === "connection") {
          setConnection(m);
          if (m.serial !== "connected" || m.control !== "owned") stop();
          if (m.serial !== "connected") {
            setSample(null);
            samples.current = [];
            epoch.current = null;
          }
        }
        if (m.type === "telemetry") {
          const t = m as Telemetry,
            stamp = BigInt(t.time_us);
          if (epoch.current == null || stamp < epoch.current) {
            epoch.current = stamp;
            samples.current = [];
          }
          const seconds = Number(stamp - epoch.current) / 1e6;
          samples.current.push({ ...t, seconds });
          while (
            samples.current.length > 1500 ||
            (samples.current[0] && seconds - samples.current[0].seconds > 30)
          )
            samples.current.shift();
          lastTime.current = Date.now();
          setSample(t);
          setFresh(true);
        }
        if (m.type === "event" && (m.code === 5 || m.code === 4)) {
          samples.current = [];
          epoch.current = null;
        }
        if (m.type === "notice") setMessage(m.message);
        if (m.type === "result" && !m.ok) {
          setMessage(m.code.replaceAll("_", " "));
          if (heldRef.current) stop();
        }
      };
      socket.onclose = () => {
        stop();
        setSocketReady(false);
        setConnection(initial);
        setFresh(false);
        setSample(null);
        samples.current = [];
        epoch.current = null;
        if (!disposed) retry = setTimeout(connect, 1000);
      };
    };
    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      ws.current?.close();
    };
  }, [refreshPorts, stop]);
  useEffect(() => {
    const interval = setInterval(() => {
      const isFresh = Date.now() - lastTime.current <= 250;
      setFresh(isFresh);
      if (!isFresh) stop();
      else if (heldRef.current)
        send("jog", { velocity_pulses_s: heldRef.current * speedRef.current });
      else if (connRef.current.control === "owned" && !document.hidden)
        send("keepalive");
    }, 50);
    const blur = () => {
      blocked.current = true;
      stop();
      if (connRef.current.control === "owned") send("disarm");
    };
    const visibility = () => {
      if (document.hidden) blur();
    };
    const editable = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      !!target.closest('input,textarea,select,[contenteditable="true"]');
    const down = (event: KeyboardEvent) => {
      if (editable(event.target)) return;
      if (event.code === "Space") {
        event.preventDefault();
        stop();
        send("stop");
        return;
      }
      if (!["ArrowLeft", "ArrowRight"].includes(event.code)) return;
      if (connRef.current.control !== "owned") return;
      event.preventDefault();
      if (event.repeat) return;
      if (pressed.current.size === 0) blocked.current = false;
      pressed.current.add(event.code);
      if (pressed.current.size > 1) {
        blocked.current = true;
        heldRef.current = 0;
        setHeld(0);
        send("stop");
      } else if (!blocked.current) jog(event.code === "ArrowLeft" ? -1 : 1);
    };
    const up = (event: KeyboardEvent) => {
      if (
        !["ArrowLeft", "ArrowRight"].includes(event.code) ||
        !pressed.current.has(event.code)
      )
        return;
      pressed.current.delete(event.code);
      heldRef.current = 0;
      setHeld(0);
      send("stop");
      if (pressed.current.size === 0) blocked.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [jog, send, stop]);
  const connected = connection.serial === "connected",
    owned = connection.control === "owned",
    idle = sample?.state === "IDLE",
    sim = !!connection.capabilities?.simulation;
  const jogAllowed =
    owned &&
    fresh &&
    !!sample &&
    ["ARMED", "RUNNING"].includes(sample.state) &&
    !sample.simulation_paused;
  const angle =
    sample?.angle_rad == null ? null : (sample.angle_rad * 180) / Math.PI;
  const pointer =
    (direction: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      jog(direction);
    };
  const setInitial = (event: React.FormEvent) => {
    event.preventDefault();
    send("sim_state", {
      angle_rad: (Number(form.angle) * Math.PI) / 180,
      angular_velocity_rad_s: Number(form.omega),
      position_pulses: form.position,
      velocity_pulses_s: Number(form.velocity),
      paused: form.paused,
    });
  };
  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="brand-mark">╱</span>
          <div>
            PENDULUM<small>CONTROL ROOM / 01</small>
          </div>
        </div>
        <div className="header-status">
          <span className={`dot ${connected && fresh ? "live" : ""}`} />
          {connected
            ? fresh
              ? "Telemetry live"
              : "Waiting for telemetry"
            : "Device offline"}
          <span className="divider" />
          <span>{socketReady ? "LOCAL SERVER" : "SERVER OFFLINE"}</span>
        </div>
      </header>
      <main>
        <div className="page-title">
          <div>
            <p className="eyebrow">SYSTEM OBSERVATORY</p>
            <h1>Motion, in view.</h1>
            <p className="subtitle">
              Pendulum state and motion telemetry, straight from the controller.
            </p>
          </div>
          <span className={`mode-pill ${sim ? "sim" : ""}`}>
            {sim ? "◈ ON-DEVICE SIMULATION" : "NUCLEO-F767ZI"}
          </span>
        </div>
        <div className="layout">
          <div className="workspace">
            <div className="metrics">
              {[
                ["Pendulum angle", number(angle), "°", "#7ee5bf"],
                [
                  "Stepper position",
                  sample?.step_position_pulses ?? "—",
                  "pulses",
                  "#f3b37a",
                ],
                [
                  "Velocity",
                  number(sample?.step_velocity_pulses_s, 0),
                  "pulses/s",
                  "#88bdf8",
                ],
                [
                  "Acceleration",
                  number(sample?.step_acceleration_pulses_s2, 0),
                  "pulses/s²",
                  "#c8abef",
                ],
              ].map(([label, value, unit, color]) => (
                <div className="metric" key={label}>
                  <label>{label}</label>
                  <div style={{ color }}>
                    {value}
                    <small>{unit}</small>
                  </div>
                </div>
              ))}
            </div>
            <div className="chart-toolbar">
              <span>
                <i className="live-line" />
                LIVE TRACES
              </span>
              <span>50 Hz · 15 s window · device clock</span>
            </div>
            <div className="plots">
              <Plot
                title="Pendulum angle"
                unit="degrees"
                color="#7ee5bf"
                samples={samples}
                field={(s) =>
                  s.angle_rad == null ? null : (s.angle_rad * 180) / Math.PI
                }
              />
              <Plot
                title="Stepper position"
                unit="pulses"
                color="#f3b37a"
                samples={samples}
                field={(s) =>
                  s.step_position_pulses == null
                    ? null
                    : Number(s.step_position_pulses)
                }
              />
              <Plot
                title="Stepper velocity"
                unit="pulses/s"
                color="#88bdf8"
                samples={samples}
                field={(s) => s.step_velocity_pulses_s}
                target
              />
              <Plot
                title="Stepper acceleration"
                unit="pulses/s²"
                color="#c8abef"
                samples={samples}
                field={(s) => s.step_acceleration_pulses_s2}
              />
            </div>
            <div className="trace-footer">
              <span>
                {sim ? "Simulated pulse count" : "Pulse-derived values"} · No
                encoder feedback
              </span>
              <span>
                {sample
                  ? `Sample ${sample.sample_seq} · ${sample.dropped_samples} dropped`
                  : "Awaiting first sample"}
              </span>
            </div>
            <section className="apparatus">
              <div>
                <p className="eyebrow">
                  {sim ? "VIRTUAL APPARATUS" : "APPARATUS"}
                </p>
                <h2>{sample?.state ?? "DISCONNECTED"}</h2>
                <p>
                  {sim
                    ? "Physics runs on the STM32. Physical motor outputs are inactive."
                    : "Connect the device to inspect its state."}
                </p>
              </div>
              <svg viewBox="0 0 320 125" aria-label="Pendulum animation">
                <path d="M15 106H305" stroke="#405151" />
                <g
                  transform={`translate(${160 + Math.max(-100, Math.min(100, Number(sample?.step_position_pulses ?? 0) / 30))},77)`}
                >
                  <rect
                    x="-23"
                    y="0"
                    width="46"
                    height="22"
                    rx="4"
                    fill="#364b48"
                    stroke="#7ee5bf"
                  />
                  <circle cx="-14" cy="25" r="4" fill="#819292" />
                  <circle cx="14" cy="25" r="4" fill="#819292" />
                  <g transform={`rotate(${angle ?? 0})`}>
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="-60"
                      stroke="#7ee5bf"
                      strokeWidth="3"
                    />
                    <circle cx="0" cy="-60" r="8" fill="#7ee5bf" />
                  </g>
                </g>
              </svg>
            </section>
          </div>
          <aside>
            <section className="panel">
              <div className="panel-heading">
                <h2>Connection</h2>
                <span className={`badge ${connected ? "good" : ""}`}>
                  {connection.serial}
                </span>
              </div>
              <label htmlFor="port">USB serial device</label>
              <div className="port-row">
                <select
                  id="port"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  disabled={connected}
                >
                  {ports.length === 0 ? (
                    <option value="">No serial devices found</option>
                  ) : (
                    ports.map((p) => (
                      <option key={p.path} value={p.path}>
                        {p.label}
                      </option>
                    ))
                  )}
                </select>
                <button
                  className="icon-button"
                  onClick={() => void refreshPorts()}
                  aria-label="Refresh serial devices"
                >
                  ↻
                </button>
              </div>
              <button
                className="connect"
                disabled={
                  !socketReady ||
                  (!connected && !path) ||
                  connection.serial === "connecting" ||
                  (connected && !owned)
                }
                onClick={() =>
                  send(
                    connected ? "disconnect" : "connect",
                    connected ? {} : { path },
                  )
                }
              >
                {connected ? "Disconnect device" : "Connect device"}
              </button>
              {connected && !owned && (
                <button
                  onClick={() => send("acquire_control")}
                  disabled={connection.control === "other"}
                >
                  {connection.control === "other"
                    ? "Controlled by another browser"
                    : "Take control"}
                </button>
              )}
              <p className="hint">CN1 / ST-LINK · 115200 baud</p>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>Manual motion</h2>
                <span className="badge">{sample?.state ?? "OFFLINE"}</span>
              </div>
              <label htmlFor="speed">
                Jog velocity <span>pulses/s</span>
              </label>
              <input
                id="speed"
                type="number"
                min="0"
                max={connection.capabilities?.max_velocity ?? 16000}
                value={speed}
                onChange={(e) =>
                  setSpeed(
                    Math.max(
                      0,
                      Math.min(
                        connection.capabilities?.max_velocity ?? 16000,
                        Number(e.target.value),
                      ),
                    ),
                  )
                }
              />
              <input
                aria-label="Jog velocity slider"
                type="range"
                min="0"
                max={connection.capabilities?.max_velocity ?? 16000}
                step="10"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
              <label htmlFor="acceleration">
                Acceleration / deceleration <span>mm/s²</span>
              </label>
              <input
                id="acceleration"
                type="number"
                min="1"
                max="10000"
                step="1"
                value={acceleration}
                onChange={(e) => setAcceleration(Number(e.target.value))}
              />
              <button
                disabled={
                  !owned ||
                  !fresh ||
                  !["IDLE", "ARMED"].includes(sample?.state ?? "") ||
                  sample?.step_velocity_pulses_s !== 0 ||
                  !Number.isFinite(acceleration) ||
                  acceleration < 1 ||
                  acceleration > 10000
                }
                onClick={() =>
                  send("set_acceleration", {
                    acceleration_pulses_s2: Math.round(
                      acceleration /
                        (connection.capabilities?.mm_per_pulse ?? 0.02),
                    ),
                  })
                }
              >
                Apply acceleration
              </button>
              <p className="hint">
                Legacy default: 10,000 mm/s². Adjust while stationary.
              </p>
              <button
                className="arm"
                disabled={
                  !owned || !fresh || !idle || !!sample?.simulation_paused
                }
                onClick={() => send("arm")}
              >
                {["ARMED", "RUNNING"].includes(sample?.state ?? "")
                  ? "Manual mode armed"
                  : "Arm manual motion"}
              </button>
              <div className="jog-row">
                <button
                  className={held === -1 ? "active" : ""}
                  disabled={!jogAllowed}
                  onPointerDown={pointer(-1)}
                  onPointerUp={stop}
                  onPointerCancel={stop}
                  onLostPointerCapture={stop}
                >
                  ← <span>Hold left</span>
                </button>
                <button
                  className={held === 1 ? "active" : ""}
                  disabled={!jogAllowed}
                  onPointerDown={pointer(1)}
                  onPointerUp={stop}
                  onPointerCancel={stop}
                  onLostPointerCapture={stop}
                >
                  <span>Hold right</span> →
                </button>
              </div>
              <div className="stop-row">
                <button
                  className="stop"
                  disabled={!owned}
                  onClick={() => {
                    stop();
                    send("stop");
                  }}
                >
                  ■ Stop
                </button>
                <button
                  disabled={!owned}
                  onClick={() => {
                    stop();
                    send("disarm");
                  }}
                >
                  Disarm
                </button>
              </div>
              <p className="hint">
                Hold ← / → to jog. Release to stop.
                <br />
                Arm once; release stops without disarming. Space stops motion.
              </p>
              {sample?.faults.length ? (
                <div className="fault">
                  {sample.faults.join(" · ")}
                  <button disabled={!owned} onClick={() => send("clear_fault")}>
                    Clear fault
                  </button>
                </div>
              ) : null}
            </section>
            {sim && (
              <section className="panel simulation">
                <div className="panel-heading">
                  <h2>Simulation lab</h2>
                  <span className="badge good">STM32</span>
                </div>
                <p className="hint">
                  Set initial conditions while idle. Pause freezes physics;
                  serial and watchdog stay active.
                </p>
                <form onSubmit={setInitial}>
                  <div className="form-grid">
                    {[
                      ["angle", "Angle", "degrees"],
                      ["omega", "Angular velocity", "rad/s"],
                      ["position", "Stepper position", "pulses"],
                      ["velocity", "Stepper velocity", "pulses/s"],
                    ].map(([key, label, unit]) => (
                      <label key={key}>
                        {label}
                        <small>{unit}</small>
                        <input
                          aria-label={`Initial ${label.toLowerCase()}`}
                          type="number"
                          required
                          step={key === "position" ? "1" : "any"}
                          min={
                            key === "angle"
                              ? -180
                              : key === "omega"
                                ? -50
                                : key === "velocity"
                                  ? -(
                                      connection.capabilities?.max_velocity ??
                                      16000
                                    )
                                  : -1000000000000
                          }
                          max={
                            key === "angle"
                              ? 180
                              : key === "omega"
                                ? 50
                                : key === "velocity"
                                  ? (connection.capabilities?.max_velocity ??
                                    16000)
                                  : 1000000000000
                          }
                          value={form[key as keyof typeof form] as string}
                          onChange={(e) =>
                            setForm({ ...form, [key]: e.target.value })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={form.paused}
                      onChange={(e) =>
                        setForm({ ...form, paused: e.target.checked })
                      }
                    />{" "}
                    Start paused
                  </label>
                  <button disabled={!owned || !idle}>
                    Apply initial state
                  </button>
                </form>
                <div className="stop-row">
                  <button
                    disabled={!owned || !idle}
                    onClick={() =>
                      send("sim_pause", { paused: !sample?.simulation_paused })
                    }
                  >
                    {sample?.simulation_paused ? "▶ Resume" : "Ⅱ Pause"}
                  </button>
                  <button
                    disabled={!owned || !idle}
                    onClick={() => send("sim_reset")}
                  >
                    ↺ Reset
                  </button>
                </div>
              </section>
            )}
          </aside>
        </div>
        <footer role="status">
          <span className="status-label">CONSOLE</span>
          {message}
          <span className="footer-right">PENDULUM / v0.1</span>
        </footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
