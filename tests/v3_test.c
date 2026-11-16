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
static void identification_with_noise(void)
{
    policy_t p;
    policy_init(&p, POLICY_V3);
    policy_start(&p, 0);
    float theta = 3.0f, omega = 0;
    const float actual_a = 35, actual_c = .6f;
    uint32_t rng = 1234;
    float early_a = 0, early_c = 0;
    for (uint32_t t = 1; t <= 30000; ++t)
    {
        float time = t * .001f;
        float u = .5f * sinf(2.1f * time) + .2f * sinf(6.3f * time);
        rng = 1664525U * rng + 1013904223U;
        float noise = ((rng >> 8) * (1.0f / 16777216) - .5f) * .002f;
        p.realized_acceleration = u * 9810;
        assert(policy_update(&p, t * 1000ULL, 0, 0, theta + noise));
        assert(!p.error);
        omega += (actual_a * (sinf(theta) - u * cosf(theta)) - actual_c * omega) * .001f;
        theta = remainderf(theta + omega * .001f, 2 * PI);
        if (t == 4000)
        {
            early_a = p.v3_a;
            early_c = p.v3_c;
        }
    }
    assert(fabsf(early_a - actual_a) < 4);
    assert(fabsf(early_c - actual_c) < .3f);
    assert(fabsf(p.v3_a - actual_a) < 1.5f);
    assert(fabsf(p.v3_c - actual_c) < .15f);
    assert(p.v3_excited && p.v3_updates > 5);
    printf("Noisy identification at 4 s: a %.2f c %.3f; final: a %.2f c %.3f\n", early_a, early_c,
           p.v3_a, p.v3_c);
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
    for (uint64_t t = 1000; t <= 6000000; t += 1000)
        policy_update(&p, t, 0, 0, 3);
    assert(p.v3_swing_boosted && p.energy_threshold == 2);
    for (uint64_t t = 6001000; t <= 6020000; t += 1000)
        policy_update(&p, t, 0, 0, 0);
    assert(p.phase == POLICY_LQR);
    policy_update(&p, 6021000, 0, 0, 1);
    assert(p.phase == POLICY_SWING_UP && !p.v3_swing_boosted);
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
    identification_with_noise();
    trajectory();
    puts("v3 checks passed");
}
