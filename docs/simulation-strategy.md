# Simulation strategy

Status: on-STM32 simulation is the current scope. The pendulum and stepper
simulation run on the STM32; the computer provides the serial bridge and browser
interface. External simulated-plant setups are deferred and are not a prerequisite.

## 1. Current architecture

```text
Browser: plots, animation, operator controls, initial-state editing
    ↕ WebSocket
Computer server: USB serial bridge, connection/control ownership
    ↕ ST-LINK USB virtual COM port
STM32: command state machine, simulated motor/cart/pendulum, telemetry
```

The STM32 advances simulated physics locally at a fixed 1 ms timestep. Its
control loop does not exchange sensor readings with a computer-side physics
model. The USB link carries operator commands and 50 Hz telemetry.

Physical STEP/DIR/ENABLE pins remain unconfigured in the simulation firmware.
When balancing is implemented, the controller will also run on the STM32,
consuming simulated measurements and driving the simulated actuator. Hardware
operation will use the same controller with real sensor/actuator adapters.

## 2. Priorities

1. Verify the on-board simulation and serial console on the actual STM32.
2. Keep reset, pause/resume, initial-state edits, manual jog, and configurable
   acceleration dependable. Pause freezes physics, not communication watchdogs.
3. Parameterize and improve the physics against the real pendulum and mechanics.
4. Add simulated sensor behavior and the shared controller; compare model truth,
   measured/estimated state, requested motion, and applied motion.
5. Validate timing, command-loss behavior, and numerical stability on the target.

No Mac virtual serial, browser WebAssembly, or external simulated-plant work is
needed to complete this iteration.

## 3. Shared C code and test harness

Keep the physics, actuator model, controller, and protocol portable C, separate
from HAL, serial transport, host scheduling, and rendering. This makes the core
easier to test without imposing additional user-facing simulation modes.

The existing native C executable and `just web-mock` remain development/test
helpers. They exercise the same core and binary protocol during automated tests
when the board is unavailable. They are not the normal operating path and do
not validate STM32 execution, UART interrupts, or physical USB behavior.

Use fixed timesteps and explicit state/parameters in core APIs. Deterministic
fixtures should cover known trajectories, acceleration ramps, pulse counting,
angle wrapping, reset, pause, initial-state validation, and communication faults.

## 4. Model fidelity and parameter provenance

The current model is a damped pendulum driven by prescribed cart acceleration.
It uses a fixed 1 ms step, an illustrative 0.30 m pendulum length, gravity
9.81 m/s², and damping 0.15/s. It has no balancing controller, coupled cart-force
model, motor torque/electrical dynamics, friction, hard travel limits, sensor
noise, or missed-step model yet.

Motion defaults recovered from the old Due firmware are:

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

Source: commit `340351a`, `inverted-pendulum-main-v2/lib/BiPolarStepper/` and
`inverted-pendulum-main-v2/src/main.cpp`; the original firmware version has the
same values. The old acceleration value was a limit, not a measured capability.
Its ±190 mm travel bound is recorded as reference and is not currently imposed
on the virtual cart. Verify driver DIP switches and mechanics before hardware use.

Introduce fidelity in stages: first repeatable ideal dynamics, then measured
geometry/inertia/damping and actuator limits, then justified sensor noise/delay,
friction, backlash, saturation, and missed-step behavior. Do not add complexity
without measurements or a concrete test need.

Keep simulated ground truth distinct from noisy sensor readings, estimated
state, pulse-derived position, requested velocity, and applied velocity. Display
explicit units and label simulated values in the UI.

## 5. Timing and safety semantics

- Simulation time advances in fixed model steps; graph rendering never sets dt.
- Device monotonic time governs real command freshness and motion leases, even
  while simulated physics is paused.
- Browser rendering is independent of the 1 kHz simulation and 50 Hz telemetry.
- Arm once per manual session. Normal release/STOP returns to stationary ARMED,
  sustained by fresh browser presence. Heartbeats cannot sustain a moving target.
- Disarm, faults, lost focus, or lost connection remove manual authority; reconnect
  never resumes held controls or motion automatically.
- Reset/state changes are accepted only in IDLE. Ramp configuration may change
  in stationary IDLE or ARMED. Simulation reset preserves motion configuration;
  MCU reboot restores its defaults.
- A simulated pulse count is not a measurement of physical cart position. The
  simulation image never enables hardware motor actuation.

See [serial-protocol.md](serial-protocol.md) for exact messages and timing.

## 6. Deferred possibilities

Mac pseudo-terminal simulation, browser WebAssembly, headless parameter sweeps,
record/replay, and a target controller connected to an external simulated plant
remain possible extensions. No implementation is planned for them in the current
iteration. Revisit only when they solve a specific development or testing need.

The native test harness already present remains useful independently of those
extensions. Portability to native/WASM can remain a longer-term architectural
property without requiring those deployment paths now.

## 7. Acceptance criteria

- A USB-connected STM32 produces angle and motion telemetry without sensor/motor wiring.
- Manual jog, repeat jog without rearming, ramp configuration, pause, reset, and
  initial-state controls behave as documented.
- Command and telemetry paths stay bounded and responsive while physics runs.
- Disconnect/fault behavior and disabled physical motor outputs are verified.
- Native core tests pass, and the on-target trajectory/timing are checked against
  reference cases with explicit numeric tolerances.
- Model assumptions and unmeasured parameters are visible; successful simulation
  is not presented as physical validation of a balancing controller.
