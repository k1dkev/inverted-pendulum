# Logging and command console

Logging and command execution are separate features sharing the existing local
serial bridge. The diagnostics panel sits below the overview and Telemetry lab;
the existing four overview graphs and optional telemetry stream stay unchanged.
Flash the current simulation firmware for MCU log messages and log-level control.

## Event logging

The MCU emits structured binary log frames, rather than mixing `printf` text into
the serial protocol. The bridge adds host receive time and records its own
connection, ownership, parser, and command events. Records include:

- Monotonic server record ID and UTC timestamp.
- Severity (`debug`, `info`, `warn`, `error`) and source (`mcu`, `bridge`, `command`).
- Message/event name and structured fields.
- MCU session ID, and device microsecond time/sequence when supplied by the MCU.

MCU events currently cover state/fault changes, policy selection and phase,
simulation state/pause changes, configuration changes, session establishment, and
command rejections. Server command records cover both buttons and typed commands.
Routine keepalive and successful manual-jog refreshes are omitted to avoid noise.
Telemetry samples remain in the numeric stream and are not copied into the log.

Use minimum-severity, source, and text filters; expand an entry for fields. Follow
latest can be disabled while inspecting history. Clear view hides existing rows
in that browser without clearing the server buffer. Server and browser each
retain at most 1,000 records; a newly connected browser receives up to 50 recent records within a bounded history message.
Logs are in memory, not durable storage. Server restart clears server history.
Download logs exports the server's retained records as newline-delimited JSON
from `/api/logs`; it includes records hidden by local filters or Clear view.

MCU logging defaults to INFO, with a maximum of ten transmitted records per
one-second window. Level changes persist through simulation reset and serial
reconnect; MCU reboot restores INFO. `off` disables MCU log emission but does not
disable bridge/command records. DEBUG currently includes the same lifecycle
events as INFO; no high-frequency debug trace is generated. Suppressed severity
levels do not count as dropped records. Rate-limited/TX-rejected records increment
a saturating counter, queryable with `log config` and included in subsequent
records. Diagnostics use the low-priority TX budget, retain the 512-byte response
reserve, and never block or fault motion when dropped. Logs are best effort;
latched faults still appear in normal telemetry independently of log delivery.

## Browser commands

The command input has suggestions, Up/Down history, and a bounded 100-entry
transcript showing replies or rejection codes. `help` works without a device;
other queries require a connection. Motion/configuration commands require the
same control owner and validated device state as their corresponding buttons.
The command parser runs on the server and maps onto the existing command path.
It is not a JavaScript evaluator, operating-system shell, or raw serial terminal.

| Command | Meaning |
|---|---|
| `help` | Command syntax and units |
| `status`, `config` | Query MCU status/configuration |
| `control acquire`, `control release` | Acquire/release motion ownership |
| `arm`, `stop`, `disarm`, `fault clear`, `position zero` | Existing device actions |
| `policy list`, `policy status` | Discover policies/read MCU policy state |
| `policy select <id or exact name>`, `policy start` | Select/start a compiled policy |
| `jog <signed-mm/s> <duration-ms>` | Bounded manual jog, 50..5000 ms |
| `acceleration <mm/s²>` | Set manual acceleration/deceleration while stationary |
| `sim reset`, `sim pause`, `sim resume` | Simulation-only actions |
| `sim state <angle-deg> <omega-rad/s> <x-mm> <v-mm/s> [paused or running]` | Initial state, disarmed only; defaults to paused |
| `sim parameters <inertia-kg·m²> <damping-N·m·s/rad>` | Set model parameters while stationary |
| `telemetry catalog`, `telemetry setup` | Query available channels/current setup |
| `telemetry subscribe <comma-separated-IDs> <5 or 10 or 25>`, `telemetry off` | Set this browser's optional subscription |
| `log config`, `log level debug/info/warn/error/off` | Query/change MCU logging threshold |

Commands are lowercase and accept one command per submission, at most 512
characters. Unknown syntax, extra arguments, nonfinite numbers, invalid states,
and out-of-range values are rejected. Command numbers use a decimal point.
Position and velocity use mm units here and are converted using the MCU's
advertised scale; initial positions and acceleration round to whole pulses or
pulses/s². The angle graph's selected display convention does not affect command
coordinates: initial-state angle is always degrees from upright.

Example, with a connected device:

```text
control acquire
policy select manual
sim state 180 0 0 0 running
arm
jog 20 500
status
```

A timed jog refreshes the MCU command at approximately 20 Hz and requests a ramped
Stop at its deadline. The duration is the commanded-motion window, not a guarantee
that deceleration is complete at that instant. The cart does not return to the
origin. Normal manual speed/acceleration/travel limits still apply. A new jog,
Stop, Disarm, policy selection, or loss of ownership cancels the existing timed
jog. The MCU lease still expires without fresh requests. The server requires fresh
browser presence (150 ms) and base telemetry (250 ms) throughout the jog.

The browser keeps sending presence while visible and controlling, even while the
console input has focus. Window focus loss/hidden page disarms as before. The
console input consumes its arrow keys for history; they do not jog the motor.
Submitting a command while a manual button/arrow jog is held first stops that
held intent. The browser console never silently acquires control or arms motion.

## Future CLI / TUI — planned, deferred

A terminal client is intentionally deferred until the serial-sharing and control
ownership model is chosen. The browser command grammar and structured logs can
be reused, but no terminal executable or TUI is implemented yet.

The leading option is **one bridge process owning each serial port**, with the
browser and CLI/TUI as clients of that bridge's API. That lets them share
telemetry/log subscriptions without competing for the USB device. One client
would hold motion authority at a time, with explicit release/handoff, separate
client IDs, and the existing presence/device leases. This is a design candidate,
not a final commitment to a daemon or terminal transport.

Before implementation, decide:

1. How the bridge starts/discovers a device in headless operation, and how a
   terminal client finds an already-running bridge.
2. Whether a standalone exclusive-serial CLI mode is useful when the web server
   is absent; it would require explicit mutual exclusion with the bridge.
3. How clients request/handoff authority, report an occupied port, and stop on
   client exit, timeout, or bridge failure. Read-only clients should not own motion.
4. Whether the terminal uses the existing loopback WebSocket API or a local IPC
   socket, and how a future non-loopback deployment authenticates clients.
5. Whether to start with scriptable CLI commands or an interactive TUI with
   live logs/state; both need a stable output/error contract and acceptance tests.

Do not open the same USB serial port independently from two active controllers.
A separate broker or explicit exclusive mode should resolve that conflict before
adding the terminal UI. Existing multiple-browser tests and per-client telemetry
subscriptions provide a starting point for testing whichever model is selected.

## Diagnostic trouble codes

The overview displays active device fault bits as stable project-specific codes
`IP0001` through `IP0008`, corresponding to bits 0 through 7; unknown bits get
an `IP` code too. `IP0005` means control overrun. The top banner shows FAULT,
NO FAULTS, or STATUS UNKNOWN when telemetry is unavailable. The device's
existing fault-clear command clears its latched active bits.

The browser records transitions it observes while the page is open, including
an occurrence count and last observed time. This is session-only history: it is
not stored in device nonvolatile memory and cannot report events missed while
disconnected. The existing server event log remains separately downloadable.
