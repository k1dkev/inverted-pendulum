# Control policies

The firmware and native simulator now share a compiled policy registry. The
console discovers it over serial. Policy `0` is manual velocity control; policy
`1`, `legacy_swingup_lqr`, ports the controller from
`inverted-pendulum-main-v2/src/main.cpp` at commit `340351a` (the parent of the
legacy deletion). Its sensor filter comes from `lib/P3Encoder/P3Encoder.cpp` and
its actuator limits from `lib/BiPolarStepper/BiPolarStepper.cpp` in that revision.

The class-demo controller at `6044f7ab` has the same law and stepper implementation;
only the encoder's default calibration values differ substantively.

Policy **2**, [`recovery_swingup_lqr`](recovery-policy.md), adds automatic
swing-up retries, corrected angular velocity, and bounded centering. The original
policy documented below remains available unchanged.

This currently controls the **on-device simulation**. Physical ADC acquisition,
calibration, pulse generation, and driver enable are still unimplemented.

## Running and changing policies

1. Connect, acquire control, and set/reset simulation state while disarmed.
2. Select `legacy swingup lqr` in the Control policy panel.
3. Press Arm, then Run policy. Watch phase and output in the panel; use the
   Telemetry lab for energy, threshold, filtered angular velocity, and integral.
4. Stop requests a ramp to zero and returns to ARMED. Disarm inhibits motion
   immediately. Clear a fault before selecting/restarting a policy.

The control owner can select a policy while RUNNING. The device retains plant
position, angle, and velocity, resets the incoming policy's filter/integral/timers,
and begins the next control sample within 10 ms. Selecting Manual requests a
ramped stop before jogging. Selecting the same policy restarts its context.
This does not guarantee a continuous acceleration command during a change.
A stationary selection does not start motion: Arm and Run policy are explicit.

A browser presence heartbeat sustains an autonomous policy; the MCU still enforces
its 500 ms lease, and the bridge disarms on missing browser presence (150 ms),
stale base telemetry (250 ms), or ownership loss. Manual jogging still needs
fresh velocity commands. Arrow keys do not send jog/stop commands while an
autonomous policy is selected. Focus loss or a hidden page disarms either mode.

## Original law and state machine

The legacy `sensorInterval = 10000` microseconds means **100 Hz**, despite the
old `1000 Hz` comment. The new scheduler preserves that rate inside the 1 kHz
simulation/device update. No gains or switching criteria were retuned.

Controller coordinates are `x` in mm, `v` in mm/s, angle `theta` in radians with
zero upright, and angular velocity `w` in rad/s. Energy uses the old millimetre
units, kg·mm²/s²:

```text
E = 0.5 * 2676.83 * w² + 0.094 * 9810 * 144.4 * cos(theta)
a = 0.65 + (0.1 / 25) * seconds_since_swing_start
Eup = 133157.016

if E <= a * Eup:
    u = -600 * sign(w * cos(theta))
        + 822 * sign(x) * log(1 - abs(x) / 150)
else:
    u = -(x + 1.5 * v)
```

After applying the swing-up sample, enter LQR if `abs(theta) <= 5°`. This is an
angle-only condition; the commented-out cart and angular-velocity checks in the
old source remain inactive. Each LQR sample first updates `Ix += x * dt`, then:

```text
u = -(-4.472*x - 5.621*v - 33492*theta - 4749*w - 0.5*Ix)
```

If the angle remains outside ±45° for 500 ms, stop with a balance-lost fault.
There is no automatic fallback to swing-up. Restarting is an explicit operator
action and resets the integral, which the old one-shot program never restarted.

Clamp acceleration to ±10000 mm/s² and integrate the velocity command with the
sensor sample's dt. Limit speed to the old `62.83 rad/s * 16/pi`, approximately
319.991 mm/s. Policy velocity updates bypass the manual acceleration ramp; adding
that ramp would change the controller. The plant receives each velocity increment
on a 1 ms physics step. This preserves the sampled law and actuator limits, not
the original Arduino's pulse timing, ADC quantization, or loop scheduling jitter.

The policy's mass, inertia, COM, and gains remain the legacy constants even when
simulation inertia/damping are changed. Those model controls change the plant,
not the law under comparison.

## Preserved quirks and explicit faults

The five-sample angular-velocity moving average starts with five zero samples and
`last_angle = pi`. It differentiates the simulated wrapped angle, rather than
using the model's exact angular velocity. Its historical wrap branch uses
`(theta + last_angle) / dt` when signs differ and `abs(theta) > pi/2`; it is
intentionally preserved. The first sample dt is boot-relative, reflecting the
old sensor's construction before calibration/operator prompts; subsequent dt is
normally 10 ms. A restart initializes this filter again. Calibration prompts and
raw ADC conversion belong to the future hardware input adapter.

At an exactly motionless downward equilibrium the sign-based pumping law can
produce no kick. No artificial startup disturbance is added. Set a small angle
or angular-velocity offset to experiment with swing-up.

The logarithm is undefined for `abs(x) >= 150 mm` in the pumping branch. The new
code reports a policy-domain fault and inhibits motion instead of allowing
NaN/infinity into the actuator. It does not clamp the logarithm or invent a new
recentering law. The higher-energy centering branch remains valid beyond 150 mm.
The ±190 mm legacy travel limit also faults during policy operation; manual mode
retains the simulator's hard stops and immediate inward jog behavior.

Policy faults set device fault bit 7; detailed errors are 1 log domain,
2 balance lost, 3 nonfinite output, 4 travel limit. A restart requires clearing the
device fault and arming again. Session changes never start a policy.

## Extending and verifying

`lib/policy/policy.c` owns the registry and each entry's start/update callbacks.
Add a stable ID, name, context, and callbacks there for another compiled policy;
the serial catalog and browser selector discover it without hardcoding a new UI
option. Policy code depends on C/math only, keeping it usable by STM32, native,
and future WASM runners. Runtime loading of arbitrary code and adjustable legacy
gains are outside this iteration.

`tests/policy_reference.cpp` compares the port against independent copies of the
original scalar equations and checks filter, handoff, integral, and failure
behavior. Device tests exercise live changes, wire catalogs, sparse telemetry,
and lease expiry. The WebSocket integration test runs through the native C peer.
These checks do not establish successful swing-up/balance or real-time timing on
the physical STM32; flash and bench verification remain necessary.
