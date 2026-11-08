#include "simulation.h"
#include <assert.h>
#include <stdio.h>
static float absolute(float x) { return x < 0 ? -x : x; }
static double continuous_position(const simulation_t *s)
{
    return (double)s->position + s->fractional_position;
}
int main(void)
{
    simulation_parameters_t parameters = {SIM_DEFAULT_INERTIA, SIM_DEFAULT_DAMPING};
    simulation_t a, b;
    simulation_reset(&a);
    a.angle = 0;
    a.angular_velocity = 0;
    simulation_tick(&a, 0.001f, SIM_DEFAULT_ACCELERATION, &parameters);
    assert(a.angle == 0 && a.angular_velocity == 0);
    simulation_reset(&a);
    b = a;
    simulation_parameters_t heavier = parameters;
    heavier.inertia_kg_m2 *= 2;
    simulation_tick(&a, 0.001f, SIM_DEFAULT_ACCELERATION, &parameters);
    simulation_tick(&b, 0.001f, SIM_DEFAULT_ACCELERATION, &heavier);
    assert(absolute(a.angular_velocity - 2 * b.angular_velocity) < 0.000001f);
    simulation_reset(&a);
    a.angle = 0;
    a.angular_velocity = 1;
    b = a;
    simulation_parameters_t undamped = parameters;
    undamped.damping_n_m_s = 0;
    simulation_tick(&a, 0.001f, SIM_DEFAULT_ACCELERATION, &parameters);
    simulation_tick(&b, 0.001f, SIM_DEFAULT_ACCELERATION, &undamped);
    assert(a.angular_velocity < b.angular_velocity && b.angular_velocity == 1);
    for (int direction = -1; direction <= 1; direction += 2)
    {
        simulation_reset(&a);
        a.position = direction * (SIM_BOUND_PULSES - 1);
        a.fractional_position = direction * 0.9;
        a.velocity = direction * SIM_MAX_VELOCITY;
        a.target = a.velocity;
        for (unsigned i = 0; i < 100; ++i)
            simulation_tick(&a, 0.001f, SIM_DEFAULT_ACCELERATION, &parameters);
        assert(a.position == direction * SIM_BOUND_PULSES && a.velocity == 0 &&
               a.fractional_position == 0);
        a.target = -direction * 200;
        simulation_tick(&a, 0.001f, SIM_DEFAULT_ACCELERATION, &parameters);
        assert(continuous_position(&a) < SIM_BOUND_PULSES &&
               continuous_position(&a) > -SIM_BOUND_PULSES);
        assert(a.velocity * direction < 0);
    }
    simulation_parameters_t extremes = {SIM_MIN_INERTIA, SIM_MAX_DAMPING};
    simulation_reset(&a);
    a.target = SIM_MAX_VELOCITY;
    for (unsigned i = 0; i < 10000; ++i)
    {
        if (i % 1000 == 0)
            a.target = -a.target;
        simulation_tick(&a, 0.001f, SIM_DEFAULT_ACCELERATION, &extremes);
        assert(__builtin_isfinite(a.angle) && __builtin_isfinite(a.angular_velocity));
        assert(continuous_position(&a) <= SIM_BOUND_PULSES &&
               continuous_position(&a) >= -SIM_BOUND_PULSES);
    }
    puts("Inertia, viscous damping, hard bounds, inward recovery, and parameter extremes passed.");
}
