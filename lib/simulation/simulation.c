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
void simulation_tick(simulation_t *s, float dt, float acceleration_limit,
                     const simulation_parameters_t *parameters)
{
    if (s->paused)
        return;
    float previous_velocity = s->velocity;
    float target = s->target;
    double position = (double)s->position + s->fractional_position;
    if ((position >= SIM_BOUND_PULSES && target > 0) ||
        (position <= -SIM_BOUND_PULSES && target < 0))
        target = 0;
    float delta = target - s->velocity, max_delta = acceleration_limit * dt;
    if (delta > max_delta)
        delta = max_delta;
    else if (delta < -max_delta)
        delta = -max_delta;
    s->velocity += delta;
    s->fractional_position += (double)s->velocity * dt;
    int64_t pulses = (int64_t)s->fractional_position;
    s->position += pulses;
    s->fractional_position -= pulses;
    position = (double)s->position + s->fractional_position;
    /* Inelastic track end stops: clamp continuous position, including the
     * sub-pulse remainder. Outward intent stays visible; inward jog works
     * immediately and does not require fault clearing or rearming. */
    if (position >= SIM_BOUND_PULSES)
    {
        s->position = SIM_BOUND_PULSES;
        s->fractional_position = 0;
        if (s->velocity > 0)
            s->velocity = 0;
    }
    else if (position <= -SIM_BOUND_PULSES)
    {
        s->position = -SIM_BOUND_PULSES;
        s->fractional_position = 0;
        if (s->velocity < 0)
            s->velocity = 0;
    }
    s->acceleration = (s->velocity - previous_velocity) / dt;
    /* Prescribed cart acceleration, pendulum inertia about its pivot:
     * I*theta'' = m*l*(g*sin(theta) - x''*cos(theta)) - b*theta'.
     * Upright is zero; inertia and viscous damping use SI units. */
    float torque = SIM_MASS_KG * SIM_COM_M *
                       (9.81f * sine(s->angle) -
                        s->acceleration * (SIM_MM_PER_PULSE / 1000.0f) * sine(s->angle + PI / 2)) -
                   parameters->damping_n_m_s * s->angular_velocity;
    float alpha = torque / parameters->inertia_kg_m2;
    s->angular_velocity += alpha * dt;
    s->angle = simulation_wrap(s->angle + s->angular_velocity * dt);
}
