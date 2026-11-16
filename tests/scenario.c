#include "scenario.h"
#include <math.h>
#include <string.h>

scenario_result_t scenario_run(const scenario_t *scenario, scenario_observer_t observe, void *ctx)
{
    scenario_result_t result;
    memset(&result, 0, sizeof(result));
    result.finite = true;
    simulation_t sim;
    simulation_reset(&sim);
    sim.angle = scenario->initial_angle;
    sim.angular_velocity = scenario->initial_angular_velocity;
    double pulses = scenario->initial_position_mm / SIM_MM_PER_PULSE;
    sim.position = (int64_t)pulses;
    sim.fractional_position = pulses - sim.position;
    sim.velocity = scenario->initial_velocity_mm_s / SIM_MM_PER_PULSE;
    sim.acceleration_controlled = true;
    sim.command_velocity_limit = POLICY_MAX_VELOCITY_MM_S / SIM_MM_PER_PULSE;
    policy_t policy;
    policy_init(&policy, scenario->policy_id);
    policy_start(&policy, 0);
    uint64_t stable_since = 0;
    for (uint64_t time = 1000; time <= scenario->duration_us; time += 1000)
    {
        if (scenario->disturbance_us && time == scenario->disturbance_us)
        {
            sim.angle = scenario->disturbance_angle;
            sim.angular_velocity = scenario->disturbance_angular_velocity;
            result.disturbance_applied = true;
            stable_since = 0;
        }
        policy.realized_acceleration = sim.acceleration * SIM_MM_PER_PULSE;
        if (policy_update(&policy, time, sim.position * SIM_MM_PER_PULSE,
                          sim.velocity * SIM_MM_PER_PULSE, sim.angle))
            sim.command_acceleration = policy.applied_acceleration / SIM_MM_PER_PULSE;
        if (policy.error)
        {
            result.final.error = policy.error;
            result.final.time_us = time;
            break;
        }
        simulation_tick(&sim, .001f, SIM_DEFAULT_ACCELERATION, &scenario->model);
        scenario_sample_t sample = {
            .time_us = time,
            .position_mm = (float)((sim.position + sim.fractional_position) * SIM_MM_PER_PULSE),
            .velocity_mm_s = sim.velocity * SIM_MM_PER_PULSE,
            .angle = sim.angle,
            .angular_velocity = sim.angular_velocity,
            .acceleration_mm_s2 = sim.acceleration * SIM_MM_PER_PULSE,
            .raw_control = policy.raw_acceleration,
            .limited_control = policy.applied_acceleration,
            .phase = policy.phase,
            .error = policy.error,
        };
        result.final = sample;
        result.recoveries = policy.recovery_count;
        if (!isfinite(sample.position_mm) || !isfinite(sample.velocity_mm_s) ||
            !isfinite(sample.angle) || !isfinite(sample.angular_velocity) ||
            !isfinite(sample.acceleration_mm_s2) || !isfinite(sample.limited_control))
        {
            result.finite = false;
            break;
        }
        result.max_abs_position_mm = fmaxf(result.max_abs_position_mm, fabsf(sample.position_mm));
        if (!result.first_capture_us && policy.phase == POLICY_LQR)
            result.first_capture_us = time;
        if (policy.phase == POLICY_LQR && fabsf(sample.angle) < .02f &&
            fabsf(sample.velocity_mm_s) < 10)
        {
            if (!stable_since)
                stable_since = time;
            if (!result.settled_us && time - stable_since >= 5000000)
                result.settled_us = time;
        }
        else
            stable_since = 0;
        if (observe)
            observe(&sample, ctx);
    }
    return result;
}
