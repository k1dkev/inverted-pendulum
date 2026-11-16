#!/usr/bin/env python3
"""Plot a deterministic v3 swing-up; see --help for scenario settings."""
import argparse
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python"))
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from pendulum import COLUMNS, run

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--angle", type=float, default=180, help="initial angle in degrees (upright = 0)")
parser.add_argument("--omega", type=float, default=0, help="initial angular velocity, rad/s")
parser.add_argument("--position", type=float, default=0, help="initial cart position, mm")
parser.add_argument("--velocity", type=float, default=0, help="initial cart velocity, mm/s")
parser.add_argument("--inertia", type=float, default=0.00267683, help="pivot inertia, kg m²")
parser.add_argument("--damping", type=float, default=0.0004015245, help="damping, N m s/rad")
parser.add_argument("--duration", type=float, default=30, help="duration, seconds")
parser.add_argument("--sample-ms", type=int, default=10, help="trace sampling interval, milliseconds")
parser.add_argument("--output", type=Path, default=Path("build/experiments/v3-swingup.png"))
parser.add_argument("--csv", type=Path, help="also save sampled trace as CSV")
args = parser.parse_args()
r = run(initial_angle_deg=args.angle, angular_velocity_rad_s=args.omega, position_mm=args.position,
        velocity_mm_s=args.velocity, inertia=args.inertia, damping=args.damping,
        duration_s=args.duration, sample_every_ms=args.sample_ms)
fig, axes = plt.subplots(7, 1, figsize=(12, 15), sharex=True, constrained_layout=True)
fig.suptitle("Swing-up LQR v3 — deterministic C simulation", fontsize=16, weight="bold")
axes[0].plot(r.time_s, np.abs(r.angle_deg), color="#3b6cc0", lw=1.2)
axes[0].axhline(0, color="#555", lw=.7)
axes[0].set_ylabel("Angle from\nupright (deg)")
axes[1].plot(r.time_s, r.position_mm, color="#bb6133", label="Position")
axes[1].axhline(190, color="#a52a2a", ls=":", lw=1)
axes[1].axhline(-190, color="#a52a2a", ls=":", lw=1)
axes[1].set_ylabel("Cart position\n(mm)")
axes[2].plot(r.time_s, r.velocity_mm_s, color="#4a8174")
axes[2].set_ylabel("Cart velocity\n(mm/s)")
axes[3].plot(r.time_s, r.raw_u_mm_s2, label="Raw u", color="#cc7744", alpha=.8, lw=1)
axes[3].plot(r.time_s, r.limited_u_mm_s2, label="Clamped u", color="#2b6eaa", alpha=.8, lw=1)
axes[3].plot(r.time_s, r.acceleration_mm_s2, label="Applied acceleration", color="#7956a2", alpha=.7, lw=1)
axes[3].set_ylabel("Acceleration\n(mm/s²)")
axes[3].legend(loc="upper right", ncol=3, fontsize=8)
axes[4].plot(r.time_s, r.estimated_a, color="#3b6cc0", label="Estimated a")
axes[4].axhline(r.actual_a, color="#333", ls="--", lw=1, label="Simulated actual a")
axes[4].set_ylabel("a (s⁻²)")
axes[4].legend(loc="best", fontsize=8)
axes[5].plot(r.time_s, r.estimated_c, color="#bb6133", label="Estimated c")
axes[5].axhline(r.actual_c, color="#333", ls="--", lw=1, label="Simulated actual c")
axes[5].set_ylabel("c (s⁻¹)")
axes[5].legend(loc="best", fontsize=8)
axes[6].step(r.time_s, r.phase, where="post", color="#576b61")
axes[6].set_yticks([1,2,4],["Swing", "LQR", "Recenter"])
axes[6].set_ylabel("Policy phase")
axes[6].set_xlabel("Simulated time (s)")
for ax in axes:
    ax.grid(True, alpha=.2)
    if r.capture_time_s is not None: ax.axvline(r.capture_time_s, color="#587e67", ls="--", lw=.8, alpha=.8)
args.output.parent.mkdir(parents=True, exist_ok=True)
fig.savefig(args.output, dpi=150)
if args.csv:
    args.csv.parent.mkdir(parents=True, exist_ok=True)
    np.savetxt(args.csv, r.trace, delimiter=",", header=",".join(COLUMNS), comments="")
    print(f"Trace: {args.csv}")
print(f"Plot: {args.output}")
print(f"First capture: {r.capture_time_s} s; settled: {r.settling_time_s} s; max |x|: {r.max_position_mm:.2f} mm; recoveries: {r.recoveries}; policy error: {r.policy_error}; finite: {r.finite}")
if r.policy_error or not r.finite: raise SystemExit(1)
