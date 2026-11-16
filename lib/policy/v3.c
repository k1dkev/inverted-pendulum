#include "v3.h"
#include <math.h>
#define PI 3.14159265358979323846f
#define G 9.81f
#define LIMIT 10000.0f
static float clip(float x, float lo, float hi) { return fminf(hi, fmaxf(lo, x)); }
static void window_reset(policy_t *p, float w, float f)
{
    p->v3_travel = p->v3_phi0 = p->v3_phi1 = p->v3_window_s = 0;
    p->v3_start_w = w;
    p->v3_last_f = f;
}
void v3_start(policy_t *p, uint64_t now)
{
    p->running = true;
    p->phase = POLICY_SWING_UP;
    p->last_control_us = p->last_measurement_us = p->started_us = now;
    p->v3_a = 0.094f * G * .1444f / .00267683f;
    p->v3_c = .15f;
    p->v3_p00 = 100;
    p->v3_p11 = 1;
}
void v3_step(policy_t *p, uint64_t now, float x, float v, float angle)
{
    if (!isfinite(x) || !isfinite(v) || !isfinite(angle) || !isfinite(p->realized_acceleration))
    {
        p->error = POLICY_NUMERIC;
        return;
    }
    if (fabsf(x) >= 190)
    {
        p->error = POLICY_TRACK_LIMIT;
        return;
    }
    float dt = (now - p->last_measurement_us) / 1000000.0f;
    p->last_measurement_us = now;
    p->sample_dt = dt;
    angle = remainderf(angle, 2 * PI);
    float f = sinf(angle) - (p->realized_acceleration / 1000 / G) * cosf(angle);
    if (!p->measurement_initialized)
    {
        p->measurement_initialized = true;
        p->last_angle = angle;
        window_reset(p, 0, f);
    }
    else
    {
        float delta = remainderf(angle - p->last_angle, 2 * PI);
        p->last_angle = angle;
        for (unsigned i = 4; i > 0; --i)
            p->history[i] = p->history[i - 1];
        p->history[0] = delta / dt;
        if (p->velocity_samples < 5)
            ++p->velocity_samples;
        p->filtered_velocity = 0;
        for (unsigned i = 0; i < p->velocity_samples; ++i)
            p->filtered_velocity += p->history[i];
        p->filtered_velocity /= p->velocity_samples;
        /* The five velocity differences describe motion centered about 3 ms
         * before this sample. Delay the regression by the same amount so its
         * endpoints and filtered velocity refer to the same time interval. */
        for (unsigned i = 4; i > 0; --i)
        {
            p->v3_fhist[i] = p->v3_fhist[i - 1];
            p->v3_dhist[i] = p->v3_dhist[i - 1];
        }
        p->v3_fhist[0] = f;
        p->v3_dhist[0] = delta;
        if (p->velocity_samples == 4)
            window_reset(p, p->filtered_velocity, f);
        if (p->velocity_samples >= 5)
        {
            p->v3_travel += fabsf(delta);
            p->v3_phi1 -= p->v3_dhist[3];
            p->v3_phi0 += p->v3_fhist[3] * dt;
            p->v3_last_f = f;
            p->v3_window_s += dt;
            if (p->v3_travel >= 3 * PI / 4 && p->v3_window_s >= .1f)
            {
                float q0 = p->v3_phi0, q1 = p->v3_phi1, r = .05f;
                float z0 = p->v3_p00 * q0 + p->v3_p01 * q1, z1 = p->v3_p01 * q0 + p->v3_p11 * q1;
                float den = r + q0 * z0 + q1 * z1;
                float residual = p->filtered_velocity - p->v3_start_w - q0 * p->v3_a - q1 * p->v3_c;
                p->v3_a = clip(p->v3_a + z0 * residual / den, 5, 150);
                p->v3_c = clip(p->v3_c + z1 * residual / den, 0, 5);
                p->v3_p00 = fmaxf(1e-6f, p->v3_p00 - z0 * z0 / den);
                p->v3_p01 -= z0 * z1 / den;
                p->v3_p11 = fmaxf(1e-6f, p->v3_p11 - z1 * z1 / den);
                p->v3_h00 += q0 * q0 / r;
                p->v3_h01 += q0 * q1 / r;
                p->v3_h11 += q1 * q1 / r;
                float diff = p->v3_h00 - p->v3_h11;
                float eig =
                    .5f * (p->v3_h00 + p->v3_h11 - sqrtf(diff * diff + 4 * p->v3_h01 * p->v3_h01));
                p->v3_excited = eig > .1f;
                ++p->v3_updates;
                window_reset(p, p->filtered_velocity, f);
            }
            else if (p->v3_window_s >= 10)
            {
                ++p->v3_rejected;
                window_reset(p, p->filtered_velocity, f);
            }
        }
    }
    float w = p->filtered_velocity;
    p->elapsed_s = (now - p->started_us) / 1000000.0f;
    float energy = w * w / (2 * p->v3_a) + 1 + cosf(angle), e = energy - 2;
    p->energy = energy;
    p->energy_threshold = 2;
    p->energy_fraction = 1;
    if (p->phase == POLICY_LQR && fabsf(angle) >= 30 * PI / 180)
    {
        p->phase = POLICY_SWING_UP;
        p->integral = 0;
        ++p->recovery_count;
    }
    if (p->phase == POLICY_SWING_UP && p->velocity_samples == 5 && fabsf(angle) < 15 * PI / 180 &&
        fabsf(w) < 1)
    {
        p->phase = POLICY_LQR;
        p->integral = 0;
    }
    float raw;
    if (p->phase == POLICY_LQR)
    {
        float candidate = clip(p->integral + x * dt, -2000, 2000);
        raw = legacy_lqr(x, v, angle, w, candidate);
        if ((fabsf(raw) < LIMIT &&
             fabsf(v + clip(raw, -LIMIT, LIMIT) * dt) < POLICY_MAX_VELOCITY_MM_S) ||
            (candidate - p->integral) * raw < 0)
            p->integral = candidate;
        raw = legacy_lqr(x, v, angle, w, p->integral);
    }
    else
    {
        float u = 0.55f * e * w * cosf(angle) - 0.3f * (x / 1000) - 0.2f * (v / 1000);
        if (fabsf(angle) > 170 * PI / 180 && fabsf(w) < .05f && fabsf(v) < 5)
            u += x > 0 ? -.08f : .08f;
        raw = G * 1000 * u;
    }
    float distance = v > 0 ? 190 - x : 190 + x;
    if (v != 0 && distance <= v * v / (2 * LIMIT) + 10)
        raw = v > 0 ? -LIMIT : LIMIT;
    p->raw_acceleration = raw;
    p->applied_acceleration = clip(raw, -LIMIT, LIMIT);
}
