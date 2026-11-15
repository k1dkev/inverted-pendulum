# V3 control and identification design

This page describes the proposed v3 algorithm. **V3 is not implemented yet.**
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

A proposed constrained swing-up command is

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

Bounds on each estimate provide a practical safeguard. The smallest eigenvalue
of `H` can flag poor excitation; bounds clipping is not equivalent to solving a
box-constrained least-squares problem. The implementation must specify priors,
window timing, excitation thresholds, covariance handling, and behavior before
identification is reliable. It also needs a startup disturbance at exact downward
rest, and an angle **and angular-velocity** capture condition for balancing.
