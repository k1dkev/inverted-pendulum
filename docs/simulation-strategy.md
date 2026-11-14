# Simulation strategy

Status: support multiple simulation deployments and interchangeable physics
engines. The existing portable C engine remains the default; MuJoCo is a planned
optional engine. Reuse controller/device logic and common interfaces across
engines, rather than requiring every engine to implement our C equations.
Only the STM32-controller/external-simulated-plant arrangement is excluded.

## 1. Supported and planned environments

| Mode | Physics/device logic | UI connection | What it tests | Status |
|---|---|---|---|---|
| On-STM32 simulation | STM32 | Real ST-LINK USB serial → server → WebSocket | Target execution, UART, USB, protocol, operator workflow | Implemented; new firmware still needs physical bench verification |
| Native process | Mac/Linux; builtin C initially, engine adapters later | Process pipes → server → WebSocket | Shared-core/protocol tests and quick development | Builtin implemented as `just web-mock`; other engines planned |
| Native virtual serial | Mac/Linux; selected supported engine | Pseudo-terminal → actual SerialPort path → server → WebSocket | Normal serial API without hardware | Implemented as `just web-sim`; macOS integration verified, Linux CI configured |
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
                                  physics engine adapter
                                             ↓
                                  measurements and telemetry
                                             ↓
                            STM32 / native / WASM runner adapter
```

The compiled policy registry currently offers manual velocity control and the
[original swing-up/LQR controller](control-policy.md), plus the
[recovery variant](recovery-policy.md) with repeated attempts and corrected sensing.
Manual commands use a bounded
acceleration ramp. The legacy policy runs at its original 100 Hz and directly
updates the velocity command; both drive the same 1 kHz plant. The policy retains
the legacy angular-velocity filter; a separate noisy sensor model is still
planned. Future sensor and engine adapters must preserve the policy's input units
and update contract.

Separate model state, model parameters, requested actuation, applied actuation,
and estimated/sensed state. Fixed-step numerical functions should accept explicit
dt and parameters. Runner adapters own transport and clocks. Use seeded random
state when adding sensor noise or disturbances.

### 2.1 Engines and deployment modes are separate choices

An engine determines how physics is computed; a runner determines where it
executes and how it connects to the UI. A native runner can use the builtin
engine or MuJoCo without changing the operator controls or plotting code.
Do not assume every engine works on every deployment target.

| Engine ID | Purpose | Initial deployment support | Status |
|---|---|---|---|
| `builtin` | Small, deterministic cart/pendulum model with prescribed acceleration | STM32, native process; WASM planned | Implemented, currently directly coupled to device core |
| `mujoco` | Multibody dynamics, actuator/constraint modeling, and future richer physical models | Native Mac/Linux process and headless experiments | Planned; not installed or integrated |

MuJoCo-on-STM32 or MuJoCo-in-browser support is not assumed. Its first integration
will run the simulation and controller on the computer, preserving the decision
to exclude a physical STM32 controller connected to an external simulated plant.

### 2.2 Common engine contract

Introduce an engine adapter boundary before adding another physics backend.
Suggested operations describe responsibilities, not an implemented API:

- Create/destroy an engine instance with explicit parameters and model assets.
- Reset/set validated initial state; step with an explicit input and timestep.
- Return a canonical snapshot: simulated time, angle/angular velocity, cart
  position/velocity/acceleration, applied actuation, bounds, and diagnostics.
- Describe supported controls, parameters, units, ranges, integrators, substeps,
  and whether an edit requires pause or model reconstruction.
- Apply parameter edits atomically or reject them explicitly. Report applied
  values; never silently ignore an unsupported parameter or reset state.

Use SI units at the engine boundary: m, s, rad, kg, kg·m², and N·m·s/rad.
Adapters map engine coordinates to our upright-zero angle and right-positive X.
Keep pulse targets/counts and motor calibration in the actuator/device layer;
distinguish commanded pulses from simulated physical cart motion.

The runner owns clocks and transport; controller/state-machine logic owns command
validation and authority. The engine owns physics and its internal integrator.
Choose explicit control periods and engine substeps; do not let browser rendering
or solver defaults set the controller timestep.

Select an available engine only while disarmed/stopped and start an explicitly
initialized run. Engine capabilities drive which UI fields are enabled. Record
engine ID/version, model asset hash, integrator, timestep/substeps, parameters,
seed, and actuator assumptions with scenarios and traces. This is a future
host/runner metadata extension; the current v1 serial packets remain unchanged.

### 2.3 Future MuJoCo adapter

MuJoCo exposes a C API, including `mj_step`, and Python bindings. A native C/C++
adapter is the initial integration candidate so it can reuse the portable C
controller/device code; Python can be used for later experiment tooling.
Keep it an optional, version-pinned dependency so normal STM32/native builds do
not require MuJoCo. See its [overview](https://mujoco.readthedocs.io/en/stable/overview.html),
[step API](https://mujoco.readthedocs.io/en/stable/APIreference/APIfunctions.html),
and [Python bindings](https://mujoco.readthedocs.io/en/stable/python.html).

Start with a versioned MJCF cart-and-hinged-pendulum model: slider for the cart,
hinge for the pendulum, explicit body properties, travel limits, and an actuator.
Map our velocity/acceleration requests through a declared actuator model; a
force-driven or servo-driven MuJoCo cart will not automatically behave like the
builtin prescribed-acceleration cart. Do not force equivalence by overwriting
positions/velocities every simulation step.

Map inertia carefully: our exposed scalar is about the pendulum pivot, while
body inertia in MuJoCo is specified relative to its body inertial frame. Use
mass, center of mass, axis, and a valid full body inertia description, including
the parallel-axis conversion where appropriate. Reject unrepresentable parameter
combinations rather than silently assigning the pivot scalar as body inertia.
Map linear viscous hinge damping consistently. See the
[MJCF body/joint reference](https://mujoco.readthedocs.io/en/stable/XMLreference.html).

Specify constraint behavior and tolerances. Solver joint limits need not reproduce
the builtin inelastic clamp exactly. The adapter must satisfy the selected travel
bound contract, implement an explicit constraint policy, or reject that scenario;
clipping only displayed telemetry would hide a model violation.

Validate reset/state mapping, units/signs, gravity response, damping/energy decay,
actuator saturation, and travel bounds before controller comparisons. Use matched
assumptions and declared tolerances where trajectories are comparable; retain
separate baselines where engine fidelity/actuation differs. Multiple engines are
not expected to generate identical trajectories simply because commands match.

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
- Every runner/engine enforces its declared cart-bound contract, not just the animation.
  Out-of-bounds initial conditions are rejected. Units and simulation labels stay
  explicit; a physical pulse count is not encoder-measured cart position.
- Physical motor outputs stay disabled in simulation firmware.

See [serial-protocol.md](serial-protocol.md) for packet layouts and lease rules.

## 5. Native virtual serial

Use an OS pseudo-terminal pair in raw binary mode. The simulator owns the primary
side; the ordinary server opens the replica pathname using `serialport`.
macOS `openpty()` provides both descriptors and the pathname; see
[Apple's manual](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man3/openpty.3.html).
The full application path is now implemented as `just web-sim`; see
[local-simulation.md](local-simulation.md) for usage and tested behavior.

The server launches the C process with `--pty`, receives its allocated pathname,
and registers the live endpoint in memory because PTYs may not appear in OS serial
enumeration. The ordinary SerialPort code opens it. Native stdin/stdout pipe mode
is retained for existing tests. Raw terminal configuration preserves binary bytes;
startup readiness and process diagnostics stay separate from wire traffic.
The server owns cleanup and removes registration when the process exits.
Nonblocking, bounded native TX keeps the device clock and command lease advancing
when a serial reader is absent/backlogged. Normal UI serial reconnects preserve
simulator state without replaying commands.

Optional byte fragmentation/pacing and injected transport faults remain future
extensions; real serial read fragmentation already occurs in the PTY tests.

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
engine/version/model assets, controller/gains, timestep/substeps, random seed, initial state, disturbances, command
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

1. Keep on-STM32 simulation and the native helper reliable; extract the builtin
   engine boundary and verify bounds, reversal, timing, and command-loss behavior.
2. Maintain native PTY mode, explicit live-port registration, and serial integration/backpressure tests (implemented).
3. Add the frontend backend abstraction and WASM worker; compare trajectories.
4. Add reusable headless scenarios, metrics, recording, and read-only replay.
5. Add an optional native MuJoCo adapter and versioned MJCF model; validate its
   coordinate, parameter, actuator, and constraint mappings against the contract.
6. Improve plant/sensor fidelity from measurements and validate the shared controller across engines.

Acceptance requires repeatable runs, consistent units and commands, bounded
buffers and scheduling, visible simulation provenance, enforced travel limits,
physical outputs disabled, and cross-runtime/engine results checked against
appropriate baselines, invariants, and documented tolerances. Unsupported
engine/runner combinations or model edits must be reported explicitly.
Actual hardware/controller validation remains a separate bench milestone.
