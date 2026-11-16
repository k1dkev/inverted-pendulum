import numpy as np
import pytest
from pendulum import run

def test_default_v3_scenario_is_repeatable_and_balances():
    result = run(duration_s=30, sample_every_ms=10)
    repeat = run(duration_s=30, sample_every_ms=10)
    np.testing.assert_array_equal(result.trace, repeat.trace)
    assert result.trace.shape == (3000, 11)
    assert result.policy_error == 0 and result.finite
    assert 10 < result.capture_time_s < 20
    assert result.settling_time_s is not None and result.settling_time_s < 30
    assert result.max_position_mm < 190
    assert result.phase[-1] == 2
    assert np.max(np.abs(result.velocity_mm_s)) <= 320.1
    assert np.max(np.abs(result.limited_u_mm_s2)) <= 10000.1
    assert np.isclose(result.actual_c, .15)

def test_bad_arguments_and_faults_are_reported():
    with pytest.raises(ValueError): run(policy="unknown")
    with pytest.raises(ValueError): run(duration_s=0.0001)
    with pytest.raises(ValueError): run(inertia=-1)
    result = run(position_mm=190, duration_s=1)
    assert result.policy_error != 0
    assert result.trace.shape[0] == 0


def test_disturbance_and_legacy_policy():
    disturbed = run(duration_s=30, disturbance_s=25, disturbance_angle_deg=57.2957795,
                    disturbance_angular_velocity_rad_s=1)
    assert disturbed.policy_error == 0 and disturbed.finite
    assert disturbed.recoveries > 0
    assert np.isclose(disturbed.angle_deg[2499], 57.3, atol=0.2)
    v2 = run(policy="swingup_lqr_v2", duration_s=60)
    assert v2.capture_time_s is not None and v2.policy_error == 0
    assert np.isnan(v2.estimated_a).all()


def test_plot_script_can_run_headless(tmp_path):
    import subprocess
    import sys
    from pathlib import Path

    script = Path(__file__).resolve().parents[1] / "scripts" / "plot_v3.py"
    output = tmp_path / "plot.png"
    trace = tmp_path / "trace.csv"
    result = subprocess.run(
        [sys.executable, str(script), "--no-show", "--duration", "1", "--output", str(output), "--csv", str(trace)],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, result.stderr
    assert output.read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
    assert (tmp_path / "plot-acceleration.png").read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
    assert trace.read_text().startswith("time_s,angle_rad,")
