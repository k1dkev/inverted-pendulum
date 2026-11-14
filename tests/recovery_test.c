#include "policy.h"
#include "simulation.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#define PI 3.14159265358979323846f
static void near(float a, float b) { assert(fabsf(a - b) < 0.0003f); }
static policy_t fresh(uint64_t now)
{
    policy_t p;
    policy_init(&p, POLICY_RECOVERY);
    policy_start(&p, now);
    return p;
}
static void sensor_tests(void)
{
    const uint64_t boot = 123456789000ULL;
    policy_t p = fresh(boot);
    policy_update(&p, boot + 10000, 0, 0, 3.13f);
    near(p.filtered_velocity, 0);
    near(p.sample_dt, .01f);
    assert(p.velocity_samples == 0);
    policy_update(&p, boot + 20000, 0, 0, -3.13f);
    near(p.filtered_velocity, (2 * PI - 6.26f) / .01f);
    assert(p.velocity_samples == 1);
    p = fresh(boot);
    policy_update(&p, boot + 10000, 0, 0, -3.13f);
    policy_update(&p, boot + 20000, 0, 0, 3.13f);
    near(p.filtered_velocity, -(2 * PI - 6.26f) / .01f);
    p = fresh(boot);
    policy_update(&p, boot + 10000, 0, 0, 1);
    policy_update(&p, boot + 30000, 0, 0, 1.04f);
    near(p.filtered_velocity, 2);
    policy_update(&p, boot + 40000, 0, 0, 1.06f);
    near(p.filtered_velocity, 2);
    for (unsigned i = 1; i <= 8; i++)
        policy_update(&p, boot + 40000 + i * 10000, 0, 0, 1.06f + .02f * i);
    near(p.filtered_velocity, 2);
    assert(p.velocity_samples == 5);
}
static void domain_and_transition_tests(void)
{
    const float positions[] = {-189.99f, -150.01f, -150, -149.99f, -142.5f, 0,
                               142.5f,   149.99f,  150,  150.01f,  189.99f};
    const float angles[] = {-PI, -3, -.3f, 0, .3f, 3, PI};
    for (unsigned i = 0; i < sizeof(positions) / sizeof(*positions); i++)
        for (unsigned j = 0; j < sizeof(angles) / sizeof(*angles); j++)
            for (int direction = -1; direction <= 1; direction++)
            {
                policy_t p = fresh(0);
                policy_update(&p, 10000, positions[i], direction * 319.99f, angles[j]);
                assert(p.running && p.error == 0 && isfinite(p.raw_acceleration));
                assert(fabsf(p.applied_acceleration) <= 10000);
            }
    policy_t p = fresh(0);
    policy_update(&p, 10000, 0, 0, PI);
    assert(p.applied_acceleration != 0); // No deadlock at exact downward rest.
    p = fresh(0);
    policy_update(&p, 10000, 0, 0, 0);
    policy_update(&p, 20000, 0, 0, 0);
    assert(p.phase == POLICY_LQR);
    p.integral = 123;
    policy_update(&p, 30000, 0, 0, .6f);
    assert(p.running && p.error == 0 && p.phase == POLICY_SWING_UP && p.recovery_count == 1);
    near(p.integral, 0);
    near(p.elapsed_s, 0);
    near(p.energy_fraction, .65f);
    // Return to upright; retain measured velocity history across recovery.
    for (unsigned t = 40000; t <= 100000; t += 10000)
        policy_update(&p, t, 0, 0, 0);
    assert(p.phase == POLICY_LQR && p.recovery_count == 1);
    policy_update(&p, 110000, 0, 0, -.6f);
    assert(p.phase == POLICY_SWING_UP && p.recovery_count == 2 && !p.error);
    policy_update(&p, 120000, 151, 20, PI);
    assert(p.phase == POLICY_RECENTER && p.applied_acceleration < 0 && !p.error);
    policy_update(&p, 130000, 45, 0, PI);
    assert(p.phase == POLICY_SWING_UP);
    policy_stop(&p);
    assert(!policy_update(&p, 140000, 0, 0, 0));
    p = fresh(0);
    policy_update(&p, 10000, 190, 0, PI);
    assert(p.error == POLICY_TRACK_LIMIT && !p.running);
    p = fresh(0);
    policy_update(&p, 10000, 0, 0, NAN);
    assert(p.error == POLICY_NUMERIC && !p.running);
}
static void trajectory(float initial_angle, int repeated_falls, int position)
{
    simulation_parameters_t parameters = {SIM_DEFAULT_INERTIA, SIM_DEFAULT_DAMPING};
    simulation_t s;
    simulation_reset(&s);
    s.angle = initial_angle;
    s.position = position;
    s.direct_velocity = true;
    policy_t p = fresh(0);
    unsigned captures = 0, last_phase = 0;
    bool recentered = false;
    uint64_t duration = repeated_falls ? 420000000 : 300000000;
    float max_position = 0;
    for (uint64_t t = 1000; t <= duration; t += 1000)
    {
        if (repeated_falls && t == 5000000)
        {
            s.angle = 1;
            s.angular_velocity = 1;
        }
        if (repeated_falls && t == 180000000)
        {
            assert(p.phase == POLICY_LQR);
            s.angle = -1;
            s.angular_velocity = -1;
        }
        if (policy_update(&p, t, s.position * SIM_MM_PER_PULSE, s.velocity * SIM_MM_PER_PULSE,
                          s.angle))
        {
            assert(!p.error && p.running && isfinite(p.applied_acceleration));
            float velocity = s.velocity * SIM_MM_PER_PULSE + p.applied_acceleration * p.sample_dt;
            const float limit = (float)(62.83 * 16.0 / 3.14159265358979323846);
            s.target = fmaxf(-limit, fminf(limit, velocity)) / SIM_MM_PER_PULSE;
            if (p.phase != last_phase)
            {
                if (p.phase == POLICY_LQR)
                    captures++;
                last_phase = p.phase;
            }
            if (p.phase == POLICY_RECENTER)
                recentered = true;
        }
        simulation_tick(&s, .001f, SIM_DEFAULT_ACCELERATION, &parameters);
        assert(isfinite(s.angle) && isfinite(s.angular_velocity));
        float x = fabsf(((float)s.position + (float)s.fractional_position) * SIM_MM_PER_PULSE);
        max_position = fmaxf(max_position, x);
        assert(x < 190);
    }
    printf("Final: phase %d error %u retries %u captures %u x %.1f angle %.3f v %.1f\n", p.phase,
           p.error, p.recovery_count, captures, s.position * SIM_MM_PER_PULSE, s.angle,
           s.velocity * SIM_MM_PER_PULSE);
    if (!repeated_falls && !position)
        assert(p.phase == POLICY_LQR && fabsf(s.angle) < .02f &&
               fabsf(s.velocity * SIM_MM_PER_PULSE) < 10);
    if (repeated_falls)
        assert(p.recovery_count >= 2 && captures >= 3);
    if (position)
        assert(recentered);
    printf(
        "Recovery trajectory angle %.2f start x %.1f: %u captures, %u retries, max |x| %.1f mm\n",
        initial_angle, position * SIM_MM_PER_PULSE, captures, p.recovery_count, max_position);
}
int main(void)
{
    sensor_tests();
    domain_and_transition_tests();
    trajectory(.04f, 0, 0);
    trajectory(PI, 0, 0);
    trajectory(0, 1, 0);
    trajectory(PI, 0, 9000);
    trajectory(PI, 0, -9000);
    puts("Corrected wrap/dt/filter, finite wall law, recovery, recentering and trajectories "
         "passed.");
}
