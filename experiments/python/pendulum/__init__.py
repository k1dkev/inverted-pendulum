"""Batch experiments using the project's native C controller and plant."""
from __future__ import annotations

import ctypes
from dataclasses import dataclass
from pathlib import Path
import math
import os
import sys
import numpy as np

COLUMNS = ("time_s", "angle_rad", "angular_velocity_rad_s", "position_mm",
            "velocity_mm_s", "acceleration_mm_s2", "raw_u_mm_s2",
            "limited_u_mm_s2", "phase", "estimated_a", "estimated_c")
_POLICIES = {"swingup_lqr_v1": 1, "swingup_lqr_v2": 2, "swingup_lqr_v3": 3}

@dataclass(frozen=True)
class Result:
    trace: np.ndarray
    capture_time_s: float | None
    settling_time_s: float | None
    max_position_mm: float
    recoveries: int
    policy_error: int
    finite: bool
    final_time_s: float
    inertia: float
    damping: float

    def __getattr__(self, name: str) -> np.ndarray:
        if name in COLUMNS:
            return self.trace[:, COLUMNS.index(name)]
        raise AttributeError(name)

    @property
    def angle_deg(self) -> np.ndarray:
        return np.rad2deg(self.angle_rad)

    @property
    def actual_a(self) -> float:
        return 0.094 * 9.81 * 0.1444 / self.inertia

    @property
    def actual_c(self) -> float:
        return self.damping / self.inertia

def _library() -> ctypes.CDLL:
    root = Path(__file__).resolve().parents[3]
    suffix = ".dylib" if sys.platform == "darwin" else ".so"
    path = Path(os.environ.get("PENDULUM_LIBRARY", root / "build" / "host" / ("libpendulum_experiments" + suffix)))
    if not path.exists():
        raise RuntimeError(f"Native experiment library not found at {path}; run 'just native' first")
    lib = ctypes.CDLL(str(path))
    lib.pendulum_experiment_version.restype = ctypes.c_int
    if lib.pendulum_experiment_version() != 1:
        raise RuntimeError("Incompatible native experiment library; rebuild with 'just native'")
    fn = lib.pendulum_experiment_run
    fn.argtypes = ([ctypes.c_int] + [ctypes.c_double] * 6 + [ctypes.c_uint32] * 3 +
                   [ctypes.c_double] * 2 + [ctypes.POINTER(ctypes.c_double), ctypes.c_size_t,
                                             ctypes.POINTER(ctypes.c_double)])
    fn.restype = ctypes.c_int
    return lib

def _steps(seconds: float, name: str, *, allow_zero: bool = False) -> int:
    if not math.isfinite(seconds) or seconds < 0 or (not allow_zero and seconds == 0):
        raise ValueError(f"{name} must be finite and positive")
    steps = round(seconds * 1000)
    if abs(steps / 1000 - seconds) > 1e-9:
        raise ValueError(f"{name} must be a whole number of milliseconds")
    return steps

def run(*, policy: str = "swingup_lqr_v3", initial_angle_deg: float = 180,
        angular_velocity_rad_s: float = 0, position_mm: float = 0, velocity_mm_s: float = 0,
        inertia: float = 0.00267683, damping: float = 0.0004015245,
        duration_s: float = 30, sample_every_ms: int = 10,
        disturbance_s: float | None = None, disturbance_angle_deg: float = 0,
        disturbance_angular_velocity_rad_s: float = 0) -> Result:
    """Run a deterministic scenario; traces use SI angles and mm-based cart units."""
    if policy not in _POLICIES:
        raise ValueError(f"Unknown policy {policy!r}; choose one of {list(_POLICIES)}")
    steps = _steps(duration_s, "duration_s")
    if steps > 600000 or not isinstance(sample_every_ms, int) or not 1 <= sample_every_ms <= steps:
        raise ValueError("duration must be at most 600 seconds and sample_every_ms must fit the duration")
    disturbance_step = 0 if disturbance_s is None else _steps(disturbance_s, "disturbance_s")
    if disturbance_step > steps:
        raise ValueError("disturbance must occur within the scenario")
    trace = np.empty((steps // sample_every_ms, len(COLUMNS)), dtype=np.float64)
    metrics = np.empty(7, dtype=np.float64)
    ptr = ctypes.POINTER(ctypes.c_double)
    lib = _library()
    count = lib.pendulum_experiment_run(
        _POLICIES[policy], math.radians(initial_angle_deg), angular_velocity_rad_s,
        position_mm, velocity_mm_s, inertia, damping, steps, sample_every_ms,
        disturbance_step, math.radians(disturbance_angle_deg), disturbance_angular_velocity_rad_s,
        trace.ctypes.data_as(ptr), len(trace), metrics.ctypes.data_as(ptr))
    if count < 0:
        raise ValueError("Scenario parameters are outside the simulator's supported range")
    optional = lambda value: None if math.isnan(value) else float(value)
    return Result(trace[:count], optional(metrics[0]), optional(metrics[1]), float(metrics[2]),
                  int(metrics[3]), int(metrics[4]), bool(metrics[5]), float(metrics[6]), inertia, damping)
