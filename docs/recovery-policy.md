# Recovery swing-up and LQR

Policy ID **2**, `swingup_lqr_v2`, is a separate controller based on the
original swing-up/LQR law. It keeps operating after losing balance, with corrected
angular-velocity estimation and separate track recentering. Policy ID 1 remains
the faithful legacy reference; its equations, filter, and terminal failure are
unchanged.

This currently controls the on-STM32/native simulator, with physical motor outputs
still unimplemented. Run the current firmware, select **swingup lqr v2**,
then Arm and Run policy. The browser console equivalent, after connection, is:

```text
control acquire
policy select swingup_lqr_v2
arm
policy start
```

## Continuous attempts

The controller runs at 100 Hz with the original energy constants, swing-up gains,
LQR gains, ±10000 mm/s² acceleration limit, and approximately 319.991 mm/s speed
limit. It enters LQR within ±5° of upright after the velocity estimator has at
least one measured difference. It leaves LQR immediately outside ±20°, clears the
position integral, restarts the swing-up clock, and continues RUNNING. The 5°/20°
entry/exit hysteresis avoids switching back and forth at a single threshold.
There is no balance-lost fault or manual re-arming between attempts.

The original energy-target ramp `0.65 + 0.004 * elapsed_seconds` restarts with each
new swing-up attempt. It is deliberately not capped at 1: filter lag and plant
losses can require a higher target before capture. The preserved ramp is slow;
default-model swing-up can take several simulated minutes and may require several
captures. This is not a promise of recovery from every initial state or model
parameter setting. Gains and ramp speed have not been tuned for faster recovery.

The position integral is limited to ±2000 mm·s and only advances when the tentative
output is unsaturated or the integration reduces saturation. This accounts for
both ±10000 mm/s² acceleration saturation and the predicted velocity at the
±319.991 mm/s speed limit over the next control interval. It resets when
leaving LQR. This prevents a failed balancing attempt from carrying a large
integral into the next attempt. A small deterministic cart kick escapes exact
motionless downward rest; its direction is inward when the cart is off-center.

Stop, Disarm, ownership loss, missing heartbeats, communication/overrun faults,
nonfinite input/output, and the hard ±190 mm policy limit still stop operation.
Automatic recovery applies to loss of balance, not to latched device faults.
Restarting the policy explicitly resets its filter, integral, timers, and counter.

## Correct angular velocity

1. The first sample initializes the measured-angle reference and reports zero
   estimated velocity. It does not differentiate against the legacy initial π.
2. Each later sample computes `remainder(theta - last_theta, 2*pi) / dt`, using
   the actual interval since the previous measurement, not time since boot.
3. A five-sample moving mean uses only the measured differences available during
   warm-up. It does not dilute the first valid estimate with four fake zeros.

The signed shortest arc preserves direction across both +π→−π and −π→+π. The
angle must move less than π between samples for unambiguous differentiation; the
tested default-model trajectories satisfy that at the normal 10 ms interval.
Recheck that assumption when changing model parameters or sampling intervals.
The estimator stays warm during a fall/recenter transition, so recovery does not
inject a fresh measurement discontinuity. Policy selection/restart reinitializes it.

## Bounded centering and track recovery

During energy pumping, `u = -600 * sign(w * cos(theta))`. There is no additive
logarithmic wall correction: it could previously cancel or reverse that push
well inside the track (for example at x=80 mm). Track management has its own
RECENTER phase instead. A startup kick is used only when the normal pumping term
is zero, so it cannot cancel an existing push either. No logarithmic singularity
exists in this version. The output remains limited to ±10000 mm/s².

The simulator holds this acceleration across the 1 ms steps until the next 100 Hz
update, rather than applying velocity changes impulsively. Speed saturation can
reduce the realized acceleration; v2's integral gate accounts for that constraint.

A **RECENTER** phase (wire value 4) takes priority when `abs(x) >= 150 mm`, or when
outward velocity predicts that `abs(x) + v²/(2*10000) + 5 mm >= 150 mm`. This is a
conservative early trigger, not a formal stopping-distance guarantee for all
states. RECENTER requests `u = -20*x - 12*v` (mm units), subject to the same
acceleration and speed limits. It returns to swing-up after reaching `abs(x) <=
50 mm` and `abs(v) <= 60 mm/s`, resetting the attempt clock and integral.

This handles the soft boundary without opposing the swing-up term or permanently faulting at 150 mm. The ±190 mm hard limit remains a terminal fault.
Inertia/damping changes and near-limit initial outward velocities still need
careful examination; the simulator's physical hard stops remain enforced as well.

## Diagnostics and verification

The existing historical `legacy.*` channel names are retained as stable IDs for
both policies derived from that law. Their values reflect the **selected**
controller: raw/limited acceleration, energy, threshold, integral, attempt elapsed
time, and filtered angular velocity. In particular `legacy.filtered_angular_velocity`
(channel 15) shows the corrected estimate for ID 2; the regular
`angular_velocity` channel shows the simulator's true velocity.

Channel **24**, `controller.recovery_count`, counts exits from LQR during the
current run. Entering RECENTER from LQR also increments it. RECENTER reached during
an existing swing-up attempt does not increment it. Policy status and structured
phase logs report SWING_UP, LQR, and RECENTER automatically. The counter is zero
for the legacy policy and unavailable in Manual or OFF.

Tests cover both wrap directions, startup at long boot times, irregular sample
intervals, warm-up, finite outputs and pumping direction around ±150 mm, repeated LQR fallback and
recapture, recentering, integral reset, hard-limit/numeric faults, and continued
lease/Stop enforcement. Default-model trajectories check bounds over hundreds of
simulated seconds, including two imposed falls and starts near each track edge.
Separate reference tests still compare the legacy equations against 7,875 input
cases. Hardware timing and physical balance remain unverified.
