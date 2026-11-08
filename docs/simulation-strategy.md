# Simulation strategy

Status: multiple simulation deployments are useful. All reuse portable C model,
controller, and device logic. Only the STM32-controller/external-simulated-plant
arrangement is excluded from the project plan.

## 1. Supported and planned environments

| Mode | Physics/device logic | UI connection | What it tests | Status |
|---|---|---|---|---|
| On-STM32 simulation | STM32 | Real ST-LINK USB serial → server → WebSocket | Target execution, UART, USB, protocol, operator workflow | Implemented; new firmware still needs physical bench verification |
| Native process | Mac/Linux native C | Process pipes → server → WebSocket | Shared-core/protocol tests and quick development | Implemented as `just web-mock` |
| Native virtual serial | Mac/Linux native C | Pseudo-terminal → actual SerialPort path → server → WebSocket | Normal serial API without hardware | Planned; macOS PTY byte round trip verified |
| Browser WebAssembly | Shared C compiled to WASM in a worker | Worker adapter → frontend | Interactive simulation without a board or local serial server | Planned |
| Headless experiments | Native C, fixed-step scenarios | Saved traces and metrics | Controller regression, parameter sweeps, gain tuning | Planned; native tests provide a foundation |
| Recorded-data replay | Saved telemetry, optionally offline estimation | Replay adapter → frontend | Reproduce issues and inspect prior runs | Planned; replay itself is not physics simulation |

The actual STM32 controller connected to physics running on a separate Mac or
external simulator is not needed. No external simulated-plant exchange,
additional sensor-feedback link, or HIL rig is planned.

## 2. Shared C architecture

Keep the model/controller/device core independent of HAL, serial transport,
operating-system scheduling, browser events, and drawing code.

```text
operator commands → device state machine → controller/velocity target
                                             ↓
                                       actuator model
                                             ↓
                                      pendulum/cart model
                                             ↓
                                  measurements and telemetry
                                             ↓
                            STM32 / native / WASM runner adapter
```

There is no balancing controller or separate noisy sensor model yet. Current
manual commands set a velocity target; a bounded ramp produces simulated cart
acceleration, which drives the pendulum dynamics. A future controller can use
simulated measurements or real sensor adapters without duplicating control code.

Separate model state, model parameters, requested actuation, applied actuation,
and estimated/sensed state. Fixed-step numerical functions should accept explicit
dt and parameters. Runner adapters own transport and clocks. Use seeded random
state when adding sensor noise or disturbances.

## 3. Current model and recovered values

The model uses prescribed cart acceleration and pivot rotational inertia:

```text
I × angular_acceleration =
    mass × center_of_mass_distance × (gravity × sin(angle) - cart_acceleration × cos(angle))
    - viscous_damping × angular_velocity
```

Upright is zero radians. The physical constants recovered from the old Due code
(commit `340351a`, `inverted-pendulum-main-v2/src/main.cpp`, function `pendE`)
are mass 0.094 kg, center-of-mass distance 0.1444 m, and pivot inertia
2676.83 kg·mm² = 0.00267683 kg·m². Damping was not specified there: the initial
coefficient is inertia × 0.15/s = approximately 0.0004015245 N·m·s/rad.

Inertia and damping are configurable while the cart is stationary in IDLE or
ARMED. Accepted ranges are 0.0001..0.1 kg·m² and 0..0.05 N·m·s/rad, respectively.
Both are applied on the next integration step, survive simulation reset and
serial reconnect, and return to defaults on MCU reboot. Changing them does not
reset the current angle. The UI reads back device-confirmed parameters.

Legacy motion settings from `BiPolarStepper` and its instantiation are:

| Parameter | Value |
|---|---|
| Full steps per revolution | 200 |
| Microstepping | 8× |
| Pulses per revolution | 1600 |
| Cart travel per revolution | 32 mm |
| Travel per pulse | 0.02 mm |
| Maximum speed | Approximately 320 mm/s, represented as 16000 pulses/s |
| Acceleration/deceleration default | 10000 mm/s², or 500000 pulses/s² |
| Configurable ramp range | 1–10000 mm/s² |
| Enforced simulated cart travel | −190 to +190 mm, or −9500 to +9500 pulses |

The old acceleration value was a software limit, not a measured motor capability.
Confirm physical driver DIP settings and mechanics before hardware actuation.

The numerical model uses a fixed 1 ms step and semi-implicit Euler integration.
Track end stops clamp continuous cart position, including its fractional pulse,
and remove outward velocity without bouncing. The resulting cart deceleration
also acts on the pendulum. Collision acceleration can exceed the configured
motor ramp because the ramp is an actuator limit, not a soft end stop. Held
outward intent stays visible while the cart remains at the stop; an inward jog
works immediately without rearming or clearing a fault.

This is not a coupled cart-force/motor-electrical model. It still lacks measured
friction, backlash, sensor noise/delay, and missed-step dynamics. Improve fidelity
against measurements rather than adding complexity solely for its own sake.

## 4. Timing, controls, and common experiment behavior

- Simulation time advances in fixed model steps. Render cadence never sets dt.
- Real device/transport freshness uses monotonic wall time, even while physics
  is paused. Browser-only and offline runners need explicit virtual timing for
  deterministic experiments, without changing real-device watchdog semantics.
- Telemetry is 50 Hz; rendering is independent of both telemetry and 1 kHz physics.
- Reset, pause/resume, initial state, and parameter editing use common logical
  commands across platforms. Reset/state replacement is IDLE-only.
- Arm once per manual session. Fresh jog targets can interrupt a normal STOPPING
  ramp; newest arrow press wins even if the other arrow is held. Acceleration
  still limits velocity changes, with no move-to-center requirement.
- Fault-induced stopping cannot be interrupted. Disarm, faults, lost focus, or
  lost connection remove authority; reconnect never replays held controls.
- Every runner enforces cart bounds in its C model, not just in the animation.
  Out-of-bounds initial conditions are rejected. Units and simulation labels stay
  explicit; a physical pulse count is not encoder-measured cart position.
- Physical motor outputs stay disabled in simulation firmware.

See [serial-protocol.md](serial-protocol.md) for packet layouts and lease rules.

## 5. Native virtual serial

Use an OS pseudo-terminal pair in raw binary mode. The simulator owns the primary
side; the ordinary server opens the replica pathname using `serialport`.
macOS `openpty()` provides both descriptors and the pathname; see
[Apple's manual](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man3/openpty.3.html).
A byte round trip was verified with the existing dependency; full application
PTY integration remains to be built.

Explicitly register and label simulator ports in the picker because PTYs need
not appear in USB/serial enumeration. Own their process/descriptor lifecycle,
handle disconnects, disable echo/newline/line-buffer processing, and keep logs
separate from protocol bytes. Use the same framing, sessions, and command leases
as real serial operation. Optional byte fragmentation/pacing supports fault tests.

A PTY exercises the OS serial API but does not emulate USB enumeration, ST-LINK,
electrical UART timing, or MCU interrupts. Keep process pipes as the cheaper
integration-test path rather than forcing every test through a PTY.

## 6. Browser WebAssembly

Compile the portable C core with Emscripten and run it in a Web Worker. Add a
frontend client abstraction so WebSocket, WASM-worker, and later replay clients
feed the same charts and logical controls. Binary serial framing is unnecessary
for every worker call, but serialization is tested independently.

Support reset, initial state, model/ramp parameters, pause, single-step, and
optional simulation-speed control. Execute bounded batches of fixed steps,
decimate telemetry, and render independently. Hidden-tab throttling must pause
explicitly or report lag rather than performing unbounded catch-up. Increasing
speed advances more fixed steps per wall second, not a larger physics dt.

Static frontend assets can serve this mode without a local serial bridge.
Emscripten compilation/runtime guidance:
[WebAssembly](https://emscripten.org/docs/compiling/WebAssembly.html),
[event-loop integration](https://emscripten.org/docs/porting/emscripten-runtime-environment.html).

## 7. Headless scenarios, replay, and fault injection

Versioned scenarios should record model version, parameter values/provenance,
controller/gains, timestep, random seed, initial state, disturbances, command
schedule, duration, source revision, and expected outcomes/tolerances.

Native batch execution can run faster than wall time and compare angle error,
settling time, travel, saturation, and failure rates. Recorded traces support
read-only replay and offline estimator comparisons. Replaying measurements
through another controller does not establish how the actual plant would have
responded to different commands; that counterfactual needs a model.

Reuse scenarios across native, WASM, and STM32. Compare at matching simulation
timestamps with numeric tolerances, rather than expecting bit-identical floating
point everywhere. Separate packet faults (delay/corruption/disconnect) from model
faults (sensor dropout, saturation, missed steps). Replay must never forward
recorded motion commands to real hardware.

## 8. Implementation order and acceptance

1. Keep on-STM32 simulation and the native helper reliable; parameterize the model
   and verify bounds, reversal, timing, and command-loss behavior.
2. Add native PTY mode and its explicit serial-port registration/integration tests.
3. Add the frontend backend abstraction and WASM worker; compare trajectories.
4. Add reusable headless scenarios, metrics, recording, and read-only replay.
5. Improve plant/sensor fidelity from measurements and add the shared controller.

Acceptance requires repeatable runs, consistent units and commands, bounded
buffers and scheduling, visible simulation provenance, enforced travel limits,
physical outputs disabled, and cross-runtime results within documented tolerances.
Actual hardware/controller validation remains a separate bench milestone.
