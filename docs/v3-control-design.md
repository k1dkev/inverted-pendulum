# V3 control and identification design

V3 is selectable as `swingup_lqr_v3` (policy ID 3) in the simulation.
Angles are measured from upright; SI units are used throughout this page.

The plant is

```text
theta_dot = omega
omega_dot = a (sin(theta) - u cos(theta)) - c omega
x_dot = v
v_dot = g u
```

For an ideal point-mass pendulum, `a = g/l`, `c = b/(m*l²)`, and
`u = x_ddot/g`. For a pendulum with general pivot inertia `I`, the corresponding
parameters are `a = m*g*l/I` and `c = b/I`; the prescribed acceleration term
has the same coefficient `a/g`. The simulated plant uses this latter model.

Normalized energy and its derivative are

```text
E = omega²/(2a) + 1 + cos(theta)
e = E - 2
E_dot = -u*omega*cos(theta) - (c/a)*omega²
```

The constrained swing-up command is

```text
u_raw = kE*e*omega*cos(theta) - kx*(x - x_center) - kv*v
u = clip(u_raw, -u_max, u_max)
```

Track protection overrides this command when the distance to the end in the
direction of travel is no greater than `v²/(2*a_brake) + margin`. The override
requests `-sign(v)*a_brake/g`. Real hardware needs measured braking capability
and latency; the override alone is not a guarantee against collision.

For online identification, integrate over a window:

```text
y = omega(t2) - omega(t1)
phi = [ integral(sin(theta) - u*cos(theta)) dt,
        -(theta_unwrapped(t2) - theta_unwrapped(t1)) ]
y = phi^T [a, c]^T
```

The input must represent realized cart acceleration, including speed saturation,
rather than merely the requested command. Accumulate absolute unwrapped angular
travel and finish a window after 135° of total travel, including reversals. A
minimum duration rejects overly short windows; a maximum duration discards stale
windows. Excitation needs checking across multiple regression vectors: 135° of
travel alone cannot identify two parameters.

With prior mean `p`, covariance `P`, observation variance `R`, and window `phi`,
recursive least squares uses

```text
K = P*phi / (R + phi^T*P*phi)
p_new = p + K*(y - phi^T*p)
P_new = (I - K*phi^T)*P
H = sum(phi*phi^T/R)
```

The controller and regression accumulation run at 1 kHz. The prior is
`a = 0.094*9.81*0.1444/0.00267683`, `c = 0.15`, with diagonal covariance
`(100, 1)` and observation variance `R = 0.05`. Estimates are clipped to
`a = 5..150 s⁻²` and `c = 0..5 s⁻¹`. Windows shorter than 0.1 s are deferred;
windows without enough travel after 10 s are discarded. Every completed window
updates RLS; `v3.excited` flags a minimum information-matrix eigenvalue above
0.1. The accumulated information has no forgetting and is a diagnostic rather
than a guarantee of present excitation. Estimates, excitation status, and
window counts are available in Telemetry lab.

The gains are `kE = 0.55`, `kx = 0.3`, and `kv = 0.2` in SI units. The
acceleration limit is 10 m/s², the track spans ±0.19 m, and braking starts at
the calculated stopping distance plus 0.01 m. A small kick escapes exact
downward rest. LQR is entered within 15° of upright and 1 rad/s angular velocity;
it exits outside 30°. These simulation-tuned values and the braking model have
not been validated on physical hardware.

Bounds on each estimate provide a practical safeguard. The smallest eigenvalue
of `H` can flag poor excitation; bounds clipping is not equivalent to solving a
box-constrained least-squares problem. Clipped estimates retain the ordinary RLS covariance, so uncertainty near a bound
is approximate. The estimator uses the same five-sample velocity average as the controller,
and delays the regression by three 1 ms samples to align it with the filtered
velocity endpoints. The smaller observation variance gives completed windows
more weight. Both choices were evaluated in simulation; real sensor noise and
latency still need measurement. Simulation quantization and real sensor noise
can bias identification; treat these estimates as exploratory.

The 135° travel threshold still limits how often RLS can update. In particular,
once LQR balances near upright there may not be enough new motion to complete a
window, and neither parameter is guaranteed to reach the plant value. For
example, in one downward-start simulation with 0.7 times default inertia and
0.5 times default damping, balancing began before damping was accurately
identified (estimated about 0.21 s⁻¹ versus actual about 0.11 s⁻¹). The panel's
window count and cumulative excitation flag help diagnose this; the flag is not
a guarantee of accuracy. No deliberate excitation is added during balance.
