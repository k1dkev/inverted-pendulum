#include "simulation.h"
#define PI 3.14159265358979323846f
float simulation_wrap(float a)
{
    while (a >= PI)
        a -= 2 * PI;
    while (a < -PI)
        a += 2 * PI;
    return a;
}
/* Range-reduced sine polynomial keeps the freestanding firmware libc-free. */
static float sine(float a)
{
    a = simulation_wrap(a);
    if (a > PI / 2)
        a = PI - a;
    else if (a < -PI / 2)
        a = -PI - a;
    float x = a * a;
    return a * (1 + x * (-1.0f / 6 + x * (1.0f / 120 + x * (-1.0f / 5040 + x / 362880))));
}
void simulation_reset(simulation_t *s)
{
    s->angle = 0.2f;
    s->angular_velocity = 0;
    s->velocity = 0;
    s->acceleration = 0;
    s->target = 0;
    s->position = 0;
    s->fractional_position = 0;
    s->paused = false;
}
void simulation_tick(simulation_t *s, float dt, float acceleration_limit)
{
    if (s->paused)
        return;
    float delta = s->target - s->velocity, max_delta = acceleration_limit * dt;
    if (delta > max_delta)
        delta = max_delta;
    else if (delta < -max_delta)
        delta = -max_delta;
    s->acceleration = delta / dt;
    s->velocity += delta;
    s->fractional_position += (double)s->velocity * dt;
    int64_t pulses = (int64_t)s->fractional_position;
    s->position += pulses;
    s->fractional_position -= pulses;
    /* Cart acceleration drives a damped inverted pendulum: L=.30 m,
     * gravity=9.81 m/s², legacy 0.02 mm per simulated pulse, damping=.15 /s.
     * Upright is angle=0; no balancing controller is applied. */
    float alpha = (9.81f * sine(s->angle) -
                   s->acceleration * (SIM_MM_PER_PULSE / 1000.0f) * sine(s->angle + PI / 2)) /
                      0.30f -
                  0.15f * s->angular_velocity;
    s->angular_velocity += alpha * dt;
    s->angle = simulation_wrap(s->angle + s->angular_velocity * dt);
}
