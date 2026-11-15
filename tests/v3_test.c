#include "policy.h"
#include "simulation.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#define PI 3.14159265358979323846f
static void trajectory(void)
{
    simulation_t s;
    simulation_reset(&s);
    s.angle = PI;
    s.acceleration_controlled = true;
    s.command_velocity_limit = POLICY_MAX_VELOCITY_MM_S / SIM_MM_PER_PULSE;
    simulation_parameters_t model = {SIM_DEFAULT_INERTIA, SIM_DEFAULT_DAMPING};
    policy_t p;
    policy_init(&p, POLICY_V3);
    policy_start(&p, 0);
    unsigned long long stable = 0, settled = 0;
    for (uint64_t t = 1000; t <= 60000000; t += 1000)
    {
        p.realized_acceleration = s.acceleration * SIM_MM_PER_PULSE;
        assert(policy_update(&p, t, s.position * SIM_MM_PER_PULSE, s.velocity * SIM_MM_PER_PULSE,
                             s.angle));
        assert(!p.error && p.running);
        s.command_acceleration = p.applied_acceleration / SIM_MM_PER_PULSE;
        simulation_tick(&s, .001f, SIM_DEFAULT_ACCELERATION, &model);
        assert(fabs(((double)s.position + s.fractional_position) * SIM_MM_PER_PULSE) < 190);
        if (p.phase == POLICY_LQR && fabsf(s.angle) < .02f &&
            fabsf(s.velocity * SIM_MM_PER_PULSE) < 10)
        {
            if (!stable)
                stable = t;
            if (!settled && t - stable >= 5000000)
                settled = t;
        }
        else
            stable = 0;
    }
    assert(settled && p.v3_updates > 0 && p.v3_excited);
    assert(fabsf(p.v3_a - SIM_MASS_KG * 9.81f * SIM_COM_M / SIM_DEFAULT_INERTIA) < 5);
    assert(fabsf(p.v3_c - .15f) < .08f);
    printf("v3 settled %.2f s, a %.2f c %.3f, %u windows\n", settled / 1e6, p.v3_a, p.v3_c,
           p.v3_updates);
}
static void checks(void)
{
    policy_t p;
    policy_init(&p, POLICY_V3);
    policy_start(&p, 0);
    policy_update(&p, 1000, 0, 0, 1);
    /* Oscillation has no net travel, but crosses the 135-degree threshold. */
    for (unsigned i = 2; i <= 600; i++)
    {
        float a = 1.0f + 0.7f * sinf((i - 1) * .01f);
        policy_update(&p, i * 1000, 0, 0, a);
    }
    assert(p.v3_updates > 0);
    assert(p.v3_a >= 5 && p.v3_a <= 150 && p.v3_c >= 0 && p.v3_c <= 5);
    policy_init(&p, POLICY_V3);
    policy_start(&p, 0);
    policy_update(&p, 1000, 180, 100, 1);
    assert(p.applied_acceleration == -10000);
    policy_init(&p, POLICY_V3);
    policy_start(&p, 0);
    for (unsigned i = 1; i <= 10010; i++)
        policy_update(&p, i * 1000, 0, 0, 1);
    assert(p.v3_rejected >= 1 && p.v3_updates == 0);
}
int main(void)
{
    checks();
    trajectory();
    puts("v3 checks passed");
}
