#include "scenario.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#define PI 3.14159265358979323846f
static void require(bool condition, const scenario_t *s, const char *message)
{
    if (!condition)
    {
        fprintf(stderr, "%s: %s\n", s->name, message);
        exit(1);
    }
}
typedef struct
{
    uint64_t count, swing, clipped, speed_limited, boosted;
} stats_t;
static void count_samples(const scenario_sample_t *s, void *ctx)
{
    stats_t *stats = ctx;
    if (s->time_us != (stats->count + 1) * 1000)
    {
        fprintf(stderr, "non-monotonic scenario clock\n");
        exit(1);
    }
    ++stats->count;
    if (s->phase == POLICY_SWING_UP)
    {
        ++stats->swing;
        if (fabsf(s->raw_control) > 10000.01f)
            ++stats->clipped;
        if (fabsf(s->velocity_mm_s) > 319.9f)
            ++stats->speed_limited;
        if (s->swing_boosted)
            ++stats->boosted;
    }
}
int main(void)
{
    const scenario_t cases[] = {
        {"v2 downward",
         POLICY_RECOVERY,
         PI,
         0,
         0,
         0,
         {SIM_DEFAULT_INERTIA, SIM_DEFAULT_DAMPING},
         120000000,
         0,
         0,
         0},
        {"v3 downward",
         POLICY_V3,
         PI,
         0,
         0,
         0,
         {SIM_DEFAULT_INERTIA, SIM_DEFAULT_DAMPING},
         60000000,
         0,
         0,
         0},
        {"v3 offset start",
         POLICY_V3,
         1,
         0,
         100,
         0,
         {SIM_DEFAULT_INERTIA, SIM_DEFAULT_DAMPING},
         60000000,
         0,
         0,
         0},
        {"v3 lower damping fallback",
         POLICY_V3,
         PI,
         0,
         0,
         0,
         {SIM_DEFAULT_INERTIA * 1.3f, SIM_DEFAULT_DAMPING * .5f},
         60000000,
         0,
         0,
         0},
        {"v3 disturbance",
         POLICY_V3,
         PI,
         0,
         0,
         0,
         {SIM_DEFAULT_INERTIA, SIM_DEFAULT_DAMPING},
         120000000,
         30000000,
         1,
         1},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); ++i)
    {
        const scenario_t *s = &cases[i];
        stats_t samples = {0};
        scenario_result_t a = scenario_run(s, count_samples, &samples),
                          b = scenario_run(s, NULL, NULL);
        require(a.finite && !a.final.error, s, "nonfinite state or policy fault");
        require(a.max_abs_position_mm < 190, s, "exceeded policy track limit");
        require(a.first_capture_us && a.settled_us && a.final.phase == POLICY_LQR, s,
                "did not settle in LQR");
        require(samples.count == s->duration_us / 1000, s, "unexpected number of samples");
        if (i == 1)
        {
            require(samples.swing > 0 && samples.clipped * 20 < samples.swing, s,
                    "excessive acceleration clipping");
            require(samples.speed_limited * 100 < samples.swing * 35, s,
                    "excessive time at the speed limit");
        }
        if (i == 3)
            require(samples.boosted > 0, s, "fallback did not engage in stalled scenario");
        if (s->disturbance_us)
            require(a.disturbance_applied && a.recoveries > 0 && a.final.phase == POLICY_LQR, s,
                    "did not recover from disturbance");
        require(a.first_capture_us == b.first_capture_us && a.settled_us == b.settled_us &&
                    a.final.angle == b.final.angle && a.final.position_mm == b.final.position_mm,
                s, "repeated run differed");
        printf("%s: capture %.3fs settled %.3fs max |x| %.2fmm\n", s->name,
               a.first_capture_us / 1e6, a.settled_us / 1e6, a.max_abs_position_mm);
    }
    scenario_t fault = {
        "track limit", POLICY_V3, PI, 0, 190, 0, {SIM_DEFAULT_INERTIA, SIM_DEFAULT_DAMPING},
        100000,        0,         0,  0};
    scenario_result_t stopped = scenario_run(&fault, NULL, NULL);
    require(stopped.final.error == POLICY_TRACK_LIMIT, &fault, "expected track limit fault");
    return 0;
}
