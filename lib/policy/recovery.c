#include "recovery.h"
#include <math.h>
#define PI_F 3.14159265358979323846f
#define MAX_ACCELERATION 10000.0f
static float clamp(float x, float lo, float hi) { return fminf(fmaxf(x, lo), hi); }
static int sign(float x) { return (x > 0) - (x < 0); }
static void begin_swing(policy_t *p, uint64_t now)
{
    p->phase = POLICY_SWING_UP;
    p->started_us = now;
    p->integral = 0;
}
void recovery_start(policy_t *p, uint64_t now)
{
    p->running = true;
    p->last_control_us = now;
    p->last_measurement_us = now;
    begin_swing(p, now);
}
static void estimate_velocity(policy_t *p, uint64_t now, float angle)
{
    /* The first angle is a reference, not a velocity measurement. Subsequent
     * samples use the shortest signed arc and the actual measurement interval. */
    p->sample_dt = (float)(now - p->last_measurement_us) / 1000000.0f;
    p->last_measurement_us = now;
    if (!p->measurement_initialized)
        p->measurement_initialized = true;
    else
    {
        for (unsigned i = 4; i > 0; --i)
            p->history[i] = p->history[i - 1];
        p->history[0] = remainderf(angle - p->last_angle, 2 * PI_F) / p->sample_dt;
        if (p->velocity_samples < 5)
            ++p->velocity_samples;
        p->filtered_velocity = 0;
        for (unsigned i = 0; i < p->velocity_samples; ++i)
            p->filtered_velocity += p->history[i];
        p->filtered_velocity /= p->velocity_samples;
    }
    p->last_angle = angle;
}
void recovery_step(policy_t *p, uint64_t now, float x, float v, float angle)
{
    if (!isfinite(x) || !isfinite(v) || !isfinite(angle))
    {
        p->error = POLICY_NUMERIC;
        return;
    }
    if (fabsf(x) >= 190)
    {
        p->error = POLICY_TRACK_LIMIT;
        return;
    }
    angle = remainderf(angle, 2 * PI_F);
    estimate_velocity(p, now, angle);
    const float w = p->filtered_velocity;
    bool near_edge =
        fabsf(x) >= 150 || (x * v > 0 && fabsf(x) + v * v / (2 * MAX_ACCELERATION) + 5 >= 150);
    if (p->phase == POLICY_LQR && (fabsf(angle) >= 20 * PI_F / 180 || near_edge))
    {
        if (p->recovery_count < UINT32_MAX)
            ++p->recovery_count;
        begin_swing(p, now);
    }
    if (near_edge && p->phase != POLICY_RECENTER)
    {
        p->phase = POLICY_RECENTER;
        p->integral = 0;
    }
    if (p->phase == POLICY_RECENTER && fabsf(x) <= 50 && fabsf(v) <= 60)
        begin_swing(p, now);

    p->elapsed_s = (float)(now - p->started_us) / 1000000.0f;
    p->energy = legacy_energy(angle, w);
    p->energy_fraction = 0.65f + 0.004f * p->elapsed_s;
    p->energy_threshold = p->energy_fraction * 133157.016f;
    if (!isfinite(p->energy))
    {
        p->error = POLICY_NUMERIC;
        return;
    }
    if (p->phase == POLICY_SWING_UP && p->velocity_samples && fabsf(angle) <= 5 * PI_F / 180)
    {
        p->phase = POLICY_LQR;
        p->integral = 0;
    }
    if (p->phase == POLICY_RECENTER)
        p->raw_acceleration = -20 * x - 12 * v;
    else if (p->phase == POLICY_LQR)
    {
        float integral = clamp(p->integral + x * p->sample_dt, -2000, 2000);
        float output = legacy_lqr(x, v, angle, w, integral);
        float limited = clamp(output, -MAX_ACCELERATION, MAX_ACCELERATION);
        float next_velocity = v + limited * p->sample_dt;
        bool positive_saturation =
            output > MAX_ACCELERATION || (output > 0 && next_velocity > POLICY_MAX_VELOCITY_MM_S);
        bool negative_saturation =
            output < -MAX_ACCELERATION || (output < 0 && next_velocity < -POLICY_MAX_VELOCITY_MM_S);
        float change = integral - p->integral;
        /* The integral contribution is +0.5*I. Freeze it when it would push
         * further into either acceleration OR predicted speed saturation;
         * always allow it to unwind in the opposite direction. */
        if ((!positive_saturation && !negative_saturation) || (positive_saturation && change < 0) ||
            (negative_saturation && change > 0))
            p->integral = integral;
        p->raw_acceleration = legacy_lqr(x, v, angle, w, p->integral);
    }
    else if (p->energy <= p->energy_threshold)
    {
        /* Track management is handled by RECENTER, not an additive wall term
         * that could cancel or reverse the energy-pumping command. */
        p->raw_acceleration = -600 * sign((float)(w * cos(angle)));
        if (p->raw_acceleration == 0 && fabsf(angle) > 170 * PI_F / 180 && fabsf(w) < 0.1f &&
            fabsf(v) < 5)
            p->raw_acceleration = x > 0 ? -600 : 600;
    }
    else
        p->raw_acceleration = -(x + 1.5f * v);
    if (!isfinite(p->raw_acceleration))
    {
        p->error = POLICY_NUMERIC;
        return;
    }
    p->applied_acceleration = clamp(p->raw_acceleration, -MAX_ACCELERATION, MAX_ACCELERATION);
}
