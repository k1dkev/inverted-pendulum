#include "policy.h"
#include "recovery.h"
#include <math.h>
#define PI 3.14159265358979323846
static float absolute(float x) { return x < 0 ? -x : x; }
static int sign(float x) { return (x > 0) - (x < 0); }

/* Port of main-v2/src/main.cpp at 340351a. Keep legacy constants, units,
 * arithmetic order, energy threshold and switching law. Do not retune here. */
float legacy_energy(float theta, float thetadot)
{
    float Ih = 2676.83f, g = 9810.0f, m = .094f, L = 144.4f;
    return (float)(0.5 * Ih * pow(thetadot, 2) + m * g * L * cos(theta));
}
float legacy_lqr(float x, float v, float theta, float thetadot, float Ix)
{
    float Kx = -4.472f, Kv = -5.621f, Kt = -33492.0f, Kw = -4749.0f, Kix = -0.5f;
    return -(Kx * x + Kv * v + Kt * theta + Kw * thetadot + Kix * Ix);
}
float legacy_swing_up(float x, float v, float theta, float thetadot, float swingDT)
{
    float ksu = 600.0f, kcw = 1.37f * ksu, Lt = 150.0f;
    float a = (float)(0.65 + 0.1 / 25.0 * swingDT), E = legacy_energy(theta, thetadot),
          Eup = 133157.016f;
    if (E <= a * Eup)
        return (float)(-ksu * sign((float)(thetadot * cos(theta))) +
                       kcw * sign(x) * log(1 - absolute(x) / Lt));
    return -(1.0f * x + 1.5f * v);
}
static void legacy_start(policy_t *p, uint64_t now)
{
    p->running = true;
    p->phase = POLICY_SWING_UP;
    p->started_us = now;
    p->last_control_us = now;
}
static void legacy_step(policy_t *p, uint64_t now, float x, float v, float angle)
{
    /* Preserve P3Encoder's five-sample filter, including its historical wrap
     * branch, and boot-relative first sensor dt. ADC calibration belongs to IO. */
    float dt = (float)(now - p->last_measurement_us) / 1000000.0f;
    p->last_measurement_us = now;
    p->sample_dt = dt;
    for (unsigned i = 4; i > 0; --i)
        p->history[i] = p->history[i - 1];
    p->history[0] = (sign(angle) * sign(p->last_angle) < 0 && absolute(angle) > PI / 2)
                        ? (angle + p->last_angle) / dt
                        : (angle - p->last_angle) / dt;
    p->last_angle = angle;
    p->filtered_velocity = 0;
    for (unsigned i = 0; i < 5; ++i)
        p->filtered_velocity += p->history[i];
    p->filtered_velocity /= 5;
    p->elapsed_s = (float)(now - p->started_us) / 1000000.0f;
    p->energy = legacy_energy(angle, p->filtered_velocity);
    p->energy_fraction = (float)(0.65 + 0.1 / 25.0 * p->elapsed_s);
    p->energy_threshold = p->energy_fraction * 133157.016f;
    if (absolute(x) >= 190)
    {
        p->error = POLICY_TRACK_LIMIT;
        return;
    }
    if (p->phase == POLICY_SWING_UP)
    {
        if (p->energy <= p->energy_threshold && absolute(x) >= 150)
        {
            p->error = POLICY_LOG_DOMAIN;
            return;
        }
        p->raw_acceleration = legacy_swing_up(x, v, angle, p->filtered_velocity, p->elapsed_s);
        /* The old code applies this swing-up update before entering LQR. */
        if (absolute(angle) <= 5 * PI / 180)
        {
            p->phase = POLICY_LQR;
            p->far_since_us = now;
        }
    }
    else
    {
        p->integral += x * dt;
        p->raw_acceleration = legacy_lqr(x, v, angle, p->filtered_velocity, p->integral);
        if (absolute(angle) < 45 * PI / 180)
            p->far_since_us = now;
        if (now - p->far_since_us >= 500000)
            p->error = POLICY_BALANCE_LOST;
    }
    if (!isfinite(p->raw_acceleration))
        p->error = POLICY_NUMERIC;
    p->applied_acceleration = p->raw_acceleration;
    if (p->applied_acceleration > 10000)
        p->applied_acceleration = 10000;
    if (p->applied_acceleration < -10000)
        p->applied_acceleration = -10000;
}
/* Compiled-in registry. A future policy supplies its own start/update callbacks;
 * the device and UI do not need a new control law switch statement. */
typedef struct
{
    policy_descriptor_t descriptor;
    void (*start)(policy_t *, uint64_t);
    void (*step)(policy_t *, uint64_t, float, float, float);
} policy_entry_t;
static const policy_entry_t registry[] = {
    {{POLICY_MANUAL, "manual"}, 0, 0},
    {{POLICY_LEGACY, "legacy_swingup_lqr"}, legacy_start, legacy_step},
    {{POLICY_RECOVERY, "recovery_swingup_lqr"}, recovery_start, recovery_step}};
uint16_t policy_count(void) { return sizeof(registry) / sizeof(registry[0]); }
const policy_descriptor_t *policy_descriptor(uint16_t index)
{
    return index < policy_count() ? &registry[index].descriptor : 0;
}
static const policy_entry_t *entry(uint16_t id)
{
    for (unsigned i = 0; i < policy_count(); ++i)
        if (registry[i].descriptor.id == id)
            return &registry[i];
    return 0;
}
void policy_init(policy_t *p, uint16_t id)
{
    *p = (policy_t){0};
    p->id = id;
    p->last_angle = (float)PI;
}
void policy_start(policy_t *p, uint64_t now)
{
    uint16_t id = p->id;
    policy_init(p, id);
    const policy_entry_t *e = entry(id);
    if (e && e->start)
        e->start(p, now);
}
void policy_stop(policy_t *p)
{
    p->running = false;
    if (p->error)
        p->phase = POLICY_FAILED;
    else
        p->phase = POLICY_OFF;
}
bool policy_update(policy_t *p, uint64_t now, float x, float v, float angle)
{
    if (!p->running || now - p->last_control_us < 10000)
        return false;
    p->last_control_us = now;
    const policy_entry_t *e = entry(p->id);
    if (e && e->step)
        e->step(p, now, x, v, angle);
    if (p->error)
        policy_stop(p);
    return true;
}
