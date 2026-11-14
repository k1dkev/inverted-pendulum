# Local simulation over virtual serial

Run the same portable C device, physics, and control-policy code on your computer,
with a real OS virtual serial endpoint in place of the STM32's USB connection.
No board or USB cable is needed.

## Start

Inside the Nix development environment:

```sh
just web-sim
```

This builds the native simulator, creates a raw pseudo-terminal (PTY), and starts
the web server at <http://localhost:3000>. Select **Local C simulator · virtual
serial · /dev/…** in the port picker and press Connect. On macOS the path normally
looks like `/dev/ttys008`; on Linux it looks like `/dev/pts/3`. The actual pathname
is allocated by the OS and printed in the terminal.

The browser labels this **LOCAL SERIAL SIMULATION**. Use the same graphs, reset /
initial-state controls, model parameters, control policies, logs, and command
console as with the on-STM32 simulation. Acquire control before sending motion
commands; the same ownership and command leases apply.

`PORT=3001 just web-sim` uses a different web port. Normal `just web` still opens
physical serial devices, and `just web-mock` retains the process-pipe helper for
fast development/tests. The virtual endpoint is explicitly registered only in
the server that launched it; arbitrary OS terminal paths are not accepted from
browser requests.

## Data path

```text
Browser ↔ WebSocket ↔ Node bridge ↔ SerialPort ↔ OS PTY ↔ native C device core
```

The bridge opens the replica pathname through the real SerialPort implementation,
with its normal 115200 / 8N1 options, flushing, framing, and error handling. The
C process owns the primary endpoint. Raw mode disables terminal echo, canonical
line buffering, and newline translation so COBS/CRC frames remain binary-clean.
Only a startup readiness message travels over process stdout in this mode; wire
frames use the PTY and diagnostic process errors use stderr.

This exercises OS serial reads/writes and disconnect behavior. It does not emulate
USB enumeration, ST-LINK, electrical UART timing, baud-rate pacing, interrupts,
or Cortex-M7 execution. Physics runs in real time on the computer with the existing
1 ms steps and 100 Hz policies. The native timing watchdog is still active; a
long host scheduling stall may fault control as designed.

## Lifecycle and reconnects

The web server owns the native process and its in-memory port registration. There
are no symlink/registry files to leave behind. Stopping the server with Ctrl-C
terminates the simulator and closes its PTY. The process also exits when the
server's stdin lifeline pipe closes, covering an abrupt server crash. An unexpected simulator exit removes
the port from discovery and disconnects/revokes control if that port was active.
It does not interrupt a separately selected physical board connection.

Disconnecting/reconnecting the **serial connection in the UI** leaves the native
process alive. State and configuration persist; HELLO establishes a new session
and never resumes old motion. Reset/reposition the simulation explicitly when
needed. If the server restarts, it creates a fresh simulation and a new OS endpoint.
A crashed simulator is not automatically restarted; restart `just web-sim`.

The native transmit path is nonblocking and bounded to 4096 bytes, with 512 bytes
reserved for responses. Slow or absent readers can cause telemetry/log drops,
but cannot block physics or lease expiration. The simulator retains its own
replica descriptor to keep the endpoint alive across serial opens/closes; a close
is therefore handled by bridge ownership/disarm and the MCU command lease, rather
than by treating terminal EOF as a reset.

Only one bridge connection is active at a time. Multiple browser tabs share that
connection and the existing single control owner. Future CLI/TUI clients remain
planned in [logging-and-console.md](logging-and-console.md); this mode does not
introduce a second simultaneous serial controller.

## Validation

Integration tests use a real PTY and the installed SerialPort bindings. They cover
port discovery, binary HELLO/capabilities, telemetry/logs, timed motion, policy
selection, selected channels, reconnect/new sessions, process exit, and live-child
cleanup on server shutdown. A second test suspends serial reads until TX queues
fill and verifies dropped telemetry plus the expired device lease, showing the
clock stays responsive under backpressure. The ordinary pipe-mode tests continue
to run separately. Test files run sequentially so unrelated test-process startup
and CPU load do not compete with the real-time lease/overrun checks.

The implementation targets macOS and Linux. The real serial path was verified on
macOS during development; the repository's Linux CI runs the same tests when pushed.
