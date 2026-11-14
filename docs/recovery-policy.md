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

The controller runs at 100 Hz with the original energy model and LQR gains,
±10000 mm/s² acceleration limit, and approximately 319.991 mm/s speed limit.
Swing-up keeps the original pumping direction and 600 mm/s² initial magnitude,
with the bounded stall response described below. It enters LQR within ±5° of upright after the velocity estimator has at
least one measured difference. It leaves LQR immediately outside ±20°, clears the
position integral, restarts the swing-up clock, and continues RUNNING. The 5°/20°
entry/exit hysteresis avoids switching back and forth at a single threshold.
There is no balance-lost fault or manual re-arming between attempts.

## Energy target and stalled swings

`Eup` matches the default plant. With upright as zero angle, the energy model is
`E = 0.5*I*w² + m*g*L*cos(theta)`, so upright at rest is `m*g*L`, not zero:

```text
Eup = 0.094 * 9810 * 144.4 = 133157.016 kg·mm²/s² = 0.133157016 J
```

The old ramp began at `0.65*Eup`, below upright energy, and increased by only
0.004 per second. In an ideal lossless pendulum a turning-point energy of
`0.65*Eup` corresponds to about 49.5° from upright. Each RECENTER exit also reset
that ramp, delaying progress again. Increasing `Eup` arbitrarily would hide those
issues and change the model's physical meaning.

V2 now derives `Eup` from `legacy_energy(0, 0)` and uses the same threshold-based
switch with `target_fraction = 1.05 + 0.02*attempt_seconds`. It starts at upright
energy plus 5% headroom and retains a rising target for estimator lag and losses.
The ramp remains uncapped as before. RECENTER preserves the attempt clock and
progress; only a new run or a fall out of LQR starts a fresh attempt.

The pumping magnitude starts at the original **600 mm/s²**. A closer approach to
upright by more than **2°** refreshes a progress timer. After **3 seconds** with no
such improvement, the magnitude increases by **200 mm/s²**, up to **1800 mm/s²**.
It never decreases during an attempt and resets to 600 on a new attempt. No
increase is applied during RECENTER or LQR. This retains the original bang-bang
push direction and energy switch while allowing stronger pumping when losses
or limited cart motion prevent progress. The existing raw-u graph shows the
changing push magnitude; energy and target remain available in Telemetry lab.

A native run from exact downward rest with default inertia/damping and a centered,
stationary cart reached LQR at 34.93 s and five seconds of settled balance at
42.68 s, compared with 169.77 s and 177.89 s before this change. Settled here means
`abs(theta) < 0.02 rad` and cart speed below 10 mm/s continuously for five seconds.
These are deterministic simulated times, not hardware measurements. The model's
inertia/damping controls still change only the plant; the controller keeps its
historical energy-model constants and LQR gains. Recovery is not guaranteed for
arbitrary models or initial states. Some zero-damping trials repeatedly capture
and lose LQR; capture conditions and LQR/filter tuning have not changed here.

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

During energy pumping, `u = -pump_acceleration * sign(w * cos(theta))`,
starting at 600 mm/s² with the stall response above. There is no additive
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
50 mm` and `abs(v) <= 60 mm/s`, clearing the integral while preserving the
attempt clock, best approach, and pumping magnitude.

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
Regression cases also verify stall timing, progress detection, bounded pumping,
RECENTER continuity and fresh-attempt resets. A nine-case matrix combines
0.7/1.0/1.3 times default inertia with 0.5/1.0/2.0 times default damping, starting
from downward rest; all reach five seconds of settled LQR balance within 180 s
and remain within the track bounds for the entire run.
Separate reference tests still compare the legacy equations against 7,875 input
cases. Hardware timing and physical balance remain unverified.
