# Python experiments

These experiments call the same native C controller and simulator used by the
firmware simulation. Enter `nix develop`; then run:

```sh
just plot-v3
just test-experiments
```

The plot is written to `build/experiments/v3-swingup.png`. To change a scenario:

```sh
python3 experiments/scripts/plot_v3.py --angle 180 --duration 60 \
  --inertia 0.00267683 --damping 0.0008 --sample-ms 5 \
  --output build/experiments/high-damping.png \
  --csv build/experiments/high-damping.csv
```

Run `python3 experiments/scripts/plot_v3.py --help` for all options. The PNG
uses absolute angle from upright (0° upright, 180° down), plots raw controller
output, acceleration-clamped output, and actual simulated cart acceleration in
the same units, and marks first LQR capture with a vertical dashed line.
Dashed horizontal cart-position lines show the simulated hard track bounds.
A run can fail to capture; the script prints capture/settling times when present,
and exits nonzero on a controller fault or nonfinite simulation.

To write your own script, use the `pendulum` module. `just native` first builds
its shared C library; `PYTHONPATH` makes the local module importable:

```sh
just native
PYTHONPATH=experiments/python python3 - <<'PY'
from pathlib import Path
import matplotlib.pyplot as plt
from pendulum import run

for damping in (0.0002, 0.0004, 0.0008):
    result = run(policy="swingup_lqr_v3", damping=damping, duration_s=30)
    plt.plot(result.time_s, result.angle_deg, label=f"damping={damping}")
    print(damping, result.capture_time_s, result.policy_error)
plt.legend()
plt.xlabel("Simulated time (s)")
plt.ylabel("Angle from upright (degrees, signed and wrapped)")
Path("build/experiments").mkdir(parents=True, exist_ok=True)
plt.savefig("build/experiments/damping-sweep.png")
PY
```

The result exposes named NumPy arrays `time_s`, `angle_rad`, `angle_deg`,
`angular_velocity_rad_s`, `position_mm`, `velocity_mm_s`,
`acceleration_mm_s2`, `raw_u_mm_s2`, `limited_u_mm_s2`, `phase`,
`estimated_a`, and `estimated_c`. The latter two are NaN for other policies.
Metrics include `capture_time_s`, `settling_time_s`, `max_position_mm`,
`recoveries`, `policy_error`, `finite`, and `final_time_s`; missing capture or
settling is `None`. `actual_a` and `actual_c` come from the simulated plant
parameters. `COLUMNS` defines the order of the two-dimensional `trace` array.

`sample_every_ms` controls trace output only; physics still runs at 1 ms. Scenario
durations and optional `disturbance_s` are multiples of 1 ms; `run` accepts
`disturbance_angle_deg` and `disturbance_angular_velocity_rad_s` for one
instantaneous state disturbance. The native scenario runs as a batch rather than
calling Python each step. Faults can truncate a trace; inspect `policy_error` and
`final_time_s`. Experiments bypass the serial protocol and watchdog and do not
establish hardware timing or physical performance.
