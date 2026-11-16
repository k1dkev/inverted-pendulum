# Deterministic controller and simulation tests

The native tests use the same portable C policy and plant code as the STM32.
CTest runs them locally and in the existing GitHub Actions console job. Run:

```sh
nix develop --command just test-controller  # controller and scenario suites
nix develop --command just test             # all native and web integration tests
```

`tests/scenario.h` and `tests/scenario.c` provide a reusable scenario runner.
A scenario specifies the policy, initial angle, angular velocity, cart position
and velocity, model parameters, and duration. An optional state disturbance is
applied at an exact simulated time. The runner advances the controller and plant
in 1 ms steps without wall-clock time, networking, serial ports, or random input.
The optional observer receives a timestamped sample each step for additional
assertions or writing a trace. Initial positions and velocities use millimetres
and mm/s; angles use radians and rad/s. Model parameters use SI units.

The result includes the first LQR capture, first five-second settled period,
maximum absolute cart position, recovery count, final state, and fault status.
Settled means `abs(angle) < 0.02 rad` and `abs(velocity) < 10 mm/s` continuously
for five seconds in LQR. For scenarios with a later disturbance, the first settled
time can occur before the disturbance; check the recovery count and final state
separately. A discontinuous injected angle is intentionally visible to the
controller as a disturbance, not a reset of its estimator.

`tests/scenarios_test.c` exercises v2 and v3 downward starts, a cart offset, an
injected fall, and a track-limit fault. Each normal scenario runs twice and
compares results within the same process. These scenarios use bounds and behavior
checks instead of relying on a fragile stored trace. Existing `v3`, `recovery`,
`policy-reference`, and simulation suites cover estimator noise, individual
controller behavior, legacy equations, and plant limits. Add scenarios by
extending the table or by calling `scenario_run` from a focused test; use the
observer to check intermediate state or record a trace when needed.

Fixed simulated time makes a run reproducible on the same build and machine.
Floating-point operations and math libraries can differ between platforms, so
compare physical outcomes with tolerances rather than expecting bit-identical
traces across macOS, Linux, and STM32. The runner bypasses the device command
protocol and watchdog; the existing native-peer/WebSocket tests exercise those
integration paths. It does not prove MCU timing, hardware dynamics, or safety.
Future extensions can add seeded disturbances, parameter sweeps, trace export,
and hardware-in-the-loop tests once the physical interfaces are available.

For Python scripts and plots using the same scenario runner, see the repository’s
`experiments/README.md` and run `just plot-v3` or `just test-experiments`.
