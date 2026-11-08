import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  Capabilities,
  Telemetry,
  SimulationParameters,
} from "../server/protocol";
import { Apparatus } from "./Apparatus";
import { Plot } from "./Plot";
import { PolicyPanel } from "./PolicyPanel";
import { TelemetryExplorer, type ExtraSample } from "./TelemetryExplorer";
import type {
  PolicyDescriptor,
  PolicyStatus,
  TelemetryChannel,
  Subscription,
} from "../server/protocol";
import { ConsolePanel } from "./ConsolePanel";
import { useDiagnostics } from "./useDiagnostics";
import { JogKeys } from "./jog";
import { ANGLE_VIEWS, displayAngle, type AngleView } from "./angle";
import "./style.css";

type Sample = Telemetry & { seconds: number };
type Port = { path: string; label: string };
type Connection = {
  serial: string;
  control: string;
  capabilities: Capabilities | null;
  simulation_parameters: SimulationParameters | null;
  policies?: PolicyDescriptor[];
  policy?: PolicyStatus | null;
  path?: string;
};
const initial: Connection = {
  serial: "disconnected",
  control: "available",
  capabilities: null,
  simulation_parameters: null,
};
const number = (v: number | null | undefined, digits = 1) =>
  v == null
    ? "—"
    : v.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

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
  const [policy, setPolicy] = useState<PolicyStatus | null>(null);
  const [page, setPage] = useState(
    location.hash === "#telemetry" ? "telemetry" : "main",
  );
  useEffect(() => {
    const change = () =>
      setPage(location.hash === "#telemetry" ? "telemetry" : "main");
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const [setup, setSetup] = useState<{
    catalog: TelemetryChannel[];
    subscription: Subscription | null;
    channels: number[];
    rate_hz: number;
  }>({ catalog: [], subscription: null, channels: [], rate_hz: 0 });
  const extraSamples = useRef<ExtraSample[]>([]),
    extraEpoch = useRef<bigint | null>(null),
    extraRevision = useRef(-1);
  const [acceleration, setAcceleration] = useState(10000);
  const [angleView, setAngleView] = useState<AngleView>(() => {
    try {
      const saved = localStorage.getItem("pendulum-angle-view");
      return saved && Object.hasOwn(ANGLE_VIEWS, saved)
        ? (saved as AngleView)
        : "upright";
    } catch {
      return "upright";
    }
  });
  const [fitAngleTrace, setFitAngleTrace] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem("pendulum-angle-view", angleView);
    } catch {}
  }, [angleView]);
  const [model, setModel] = useState({
    inertia: "0.00267683",
    damping: "0.0004015245",
  });
  useEffect(() => {
    const parameters = connection.simulation_parameters;
    if (parameters)
      setModel({
        inertia: String(Number(parameters.inertia_kg_m2.toPrecision(7))),
        damping: String(Number(parameters.damping_n_m_s.toPrecision(7))),
      });
  }, [
    connection.simulation_parameters?.inertia_kg_m2,
    connection.simulation_parameters?.damping_n_m_s,
  ]);
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
    pressed = useRef(new JogKeys()),
    pointerId = useRef<number | null>(null),
    policyRef = useRef(policy);
  policyRef.current = policy;
  connRef.current = connection;
  sampleRef.current = sample;
  speedRef.current = speed;
  const send = useCallback(
    (type: string, fields: Record<string, unknown> = {}) => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        const requestId = ++id.current;
        ws.current.send(
          JSON.stringify({ v: 1, type, id: requestId, ...fields }),
        );
        return requestId;
      }
      return undefined;
    },
    [],
  );
  const {
    logs,
    commands,
    submit: submitCommand,
    receive: receiveDiagnostic,
    connectionLost,
  } = useDiagnostics(send);
  const stop = useCallback(() => {
    const active = heldRef.current !== 0;
    heldRef.current = 0;
    setHeld(0);
    pressed.current.clear();
    if (active) send("stop");
  }, [send]);
  const runConsoleCommand = useCallback(
    (line: string) => {
      stop();
      submitCommand(line);
    },
    [stop, submitCommand],
  );
  const jog = useCallback(
    (direction: number) => {
      const c = connRef.current,
        s = sampleRef.current;
      if (
        c.control !== "owned" ||
        !s ||
        !["ARMED", "RUNNING", "STOPPING"].includes(s.state) ||
        s.fault_bits !== 0 ||
        policyRef.current?.id !== 0 ||
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
        receiveDiagnostic(m);
        if (m.type === "connection") {
          setConnection(m);
          if (m.policy) setPolicy(m.policy);
          if (m.serial !== "connected") setPolicy(null);
          if (m.serial !== "connected" || m.control !== "owned") stop();
          if (m.serial !== "connected") {
            setSample(null);
            samples.current = [];
            epoch.current = null;
          }
        }
        if (m.type === "policy_status") {
          setPolicy(m.policy);
          if (m.policy.id !== 0) {
            heldRef.current = 0;
            setHeld(0);
            pressed.current.clear();
          }
        }
        if (m.type === "telemetry_setup") {
          setSetup(m);
          if (
            !m.subscription ||
            m.subscription.revision !== extraRevision.current
          ) {
            extraSamples.current = [];
            extraEpoch.current = null;
            extraRevision.current = m.subscription?.revision ?? -1;
          }
        }
        if (m.type === "selected_telemetry") {
          const stamp = BigInt(m.time_us);
          if (extraEpoch.current === null) extraEpoch.current = stamp;
          const seconds = Number(stamp - extraEpoch.current) / 1e6;
          extraSamples.current.push({ seconds, values: m.values });
          while (
            extraSamples.current.length > 1500 ||
            (extraSamples.current[0] &&
              seconds - extraSamples.current[0].seconds > 60)
          )
            extraSamples.current.shift();
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
          extraSamples.current = [];
          extraEpoch.current = null;
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
        connectionLost();
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
  }, [refreshPorts, stop, receiveDiagnostic, connectionLost]);
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
      if (connRef.current.control !== "owned" || policyRef.current?.id !== 0)
        return;
      event.preventDefault();
      if (event.repeat) return;
      pointerId.current = null;
      const direction = pressed.current.press(event.code);
      if (direction) jog(direction);
    };
    const up = (event: KeyboardEvent) => {
      const direction = pressed.current.release(event.code);
      if (direction === null) return;
      if (direction) jog(direction);
      else {
        heldRef.current = 0;
        setHeld(0);
        send("stop");
      }
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
    ["ARMED", "RUNNING", "STOPPING"].includes(sample.state) &&
    sample.fault_bits === 0 &&
    policy?.id === 0 &&
    !sample.simulation_paused;
  const angle =
    sample?.angle_rad == null ? null : (sample.angle_rad * 180) / Math.PI;
  const pointer =
    (direction: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      pointerId.current = e.pointerId;
      e.currentTarget.setPointerCapture(e.pointerId);
      jog(direction);
    };
  const releasePointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerId.current === event.pointerId) {
      pointerId.current = null;
      stop();
    }
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
        <nav className="page-nav">
          <a href="#main" aria-current={page === "main" ? "page" : undefined}>
            Overview
          </a>
          <a
            href="#telemetry"
            aria-current={page === "telemetry" ? "page" : undefined}
          >
            Telemetry lab
          </a>
        </nav>
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
        {page === "telemetry" && (
          <TelemetryExplorer
            setup={setup}
            samples={extraSamples}
            ready={connected}
            send={send}
          />
        )}
        <div
          className="layout"
          style={page === "telemetry" ? { display: "none" } : undefined}
        >
          <div className="workspace">
            <div className="metrics">
              {[
                ["Angle · upright zero", number(angle), "°", "#7ee5bf"],
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
            <Apparatus
              sample={sample}
              parameters={connection.simulation_parameters}
              mmPerPulse={connection.capabilities?.mm_per_pulse ?? 0.02}
            />
            <div className="chart-toolbar">
              <span>
                <i className="live-line" />
                LIVE TRACES
              </span>
              <span>50 Hz · 15 s window · device clock</span>
            </div>
            <div className="angle-graph-controls">
              <label htmlFor="angle-view">
                Angle graph
                <select
                  id="angle-view"
                  value={angleView}
                  onChange={(event) =>
                    setAngleView(event.target.value as AngleView)
                  }
                >
                  {Object.entries(ANGLE_VIEWS).map(([id, view]) => (
                    <option key={id} value={id}>
                      {view.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={fitAngleTrace}
                  onChange={(event) => setFitAngleTrace(event.target.checked)}
                />{" "}
                Auto-scale
              </label>
              <p>{ANGLE_VIEWS[angleView].hint}</p>
            </div>
            <div className="plots">
              <Plot
                title={
                  angleView === "cosine"
                    ? "Pendulum orientation · cos(θ)"
                    : angleView === "absolute"
                      ? "Absolute angle from upright"
                      : "Pendulum angle"
                }
                unit={ANGLE_VIEWS[angleView].unit}
                color="#7ee5bf"
                samples={samples}
                field={(s) => displayAngle(s.angle_rad, angleView)}
                domain={
                  fitAngleTrace ? undefined : ANGLE_VIEWS[angleView].domain
                }
                wrapPeriod={
                  angleView === "cosine" || angleView === "absolute"
                    ? undefined
                    : 360
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
          </div>
          <aside>
            <PolicyPanel
              policies={connection.policies ?? []}
              policy={policy}
              state={sample?.state ?? "IDLE"}
              owned={owned}
              fresh={fresh}
              paused={!!sample?.simulation_paused}
              send={send}
              select={(id) => {
                heldRef.current = 0;
                setHeld(0);
                pressed.current.clear();
                send("select_policy", { policy_id: id });
              }}
            />
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
                  !owned ||
                  !fresh ||
                  !idle ||
                  policy?.id !== 0 ||
                  !!sample?.simulation_paused
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
                  onPointerUp={releasePointer}
                  onPointerCancel={releasePointer}
                  onLostPointerCapture={releasePointer}
                >
                  ← <span>Hold left</span>
                </button>
                <button
                  className={held === 1 ? "active" : ""}
                  disabled={!jogAllowed}
                  onPointerDown={pointer(1)}
                  onPointerUp={releasePointer}
                  onPointerCancel={releasePointer}
                  onLostPointerCapture={releasePointer}
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
                <form
                  className="model-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    send("sim_parameters", {
                      inertia_kg_m2: Number(model.inertia),
                      damping_n_m_s: Number(model.damping),
                    });
                  }}
                >
                  <h3>Pendulum model</h3>
                  <div className="form-grid">
                    <label>
                      Pivot inertia<small>kg·m²</small>
                      <input
                        aria-label="Pendulum inertia"
                        type="number"
                        min="0.0001"
                        max="0.1"
                        step="any"
                        required
                        value={model.inertia}
                        onChange={(event) =>
                          setModel({ ...model, inertia: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Viscous damping<small>N·m·s/rad</small>
                      <input
                        aria-label="Pendulum damping"
                        type="number"
                        min="0"
                        max="0.05"
                        step="any"
                        required
                        value={model.damping}
                        onChange={(event) =>
                          setModel({ ...model, damping: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  <button
                    disabled={
                      !owned ||
                      !fresh ||
                      !["IDLE", "ARMED"].includes(sample?.state ?? "") ||
                      sample?.step_velocity_pulses_s !== 0 ||
                      sample?.target_velocity_pulses_s !== 0
                    }
                  >
                    Apply model parameters
                  </button>
                  <p className="hint">
                    Mass 0.094 kg · center of mass 0.1444 m. Apply while the
                    cart is stationary. Preserved on simulation reset.
                  </p>
                </form>
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
                                  : -9500
                          }
                          max={
                            key === "angle"
                              ? 180
                              : key === "omega"
                                ? 50
                                : key === "velocity"
                                  ? (connection.capabilities?.max_velocity ??
                                    16000)
                                  : 9500
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
        <ConsolePanel
          logs={logs}
          commands={commands}
          submit={runConsoleCommand}
          ready={socketReady}
          owned={owned}
        />
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
